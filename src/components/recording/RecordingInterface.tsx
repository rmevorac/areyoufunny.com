"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Button from '@/components/ui/Button';
import CountdownDisplay from './CountdownDisplay';
import RecordingTimer from './RecordingTimer';

// Default duration can be defined here or passed as prop if needed
const COUNTDOWN_SECONDS = 3;
const SAMPLE_INTERVAL_MS = 150; // How often to generate a new bar for the visualizer
const LIVE_VISUAL_SENSITIVITY_BOOST = 4.0; // Experiment with this value (e.g., 1.5, 2.0, 2.5)

interface RecordingInterfaceProps {
  targetDurationMs: number; // Receive the target duration from parent
  onRecordingComplete: (blob: Blob, durationMs: number, waveformPeaks: number[]) => void; // Pass duration back and waveform peaks
  onCancelCountdown: () => void; // Passed to CountdownDisplay
}

const RecordingInterface: React.FC<RecordingInterfaceProps> = ({ targetDurationMs, onRecordingComplete, onCancelCountdown }) => {
  const [isCountingDown, setIsCountingDown] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false);
  const [showPreparingMessage, setShowPreparingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(targetDurationMs / 1000);
  const [latestSampledPeak, setLatestSampledPeak] = useState<number | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const preciseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const actualDurationMsRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const preparingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const collectedPeaksRef = useRef<number[]>([]);

  const stopRecording = useCallback((stoppedByTimeout: boolean = false) => {
    if (preciseTimeoutRef.current) {
        clearTimeout(preciseTimeoutRef.current);
        preciseTimeoutRef.current = null;
    }

    let finalDurationMs = targetDurationMs; 
    if (stoppedByTimeout) {
        finalDurationMs = targetDurationMs;
    } else if (startTimeRef.current) {
        const elapsedMs = Date.now() - startTimeRef.current;
        finalDurationMs = Math.min(Math.max(0, Math.round(elapsedMs)), targetDurationMs);
    } 
    if (startTimeRef.current) startTimeRef.current = null;
    actualDurationMsRef.current = finalDurationMs; // Set this for onstop to use

    // If mediaRecorder exists and is recording, stop it. Its onstop will handle the rest.
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
    } else {
        // If not recording, or recorder doesn't exist, perform immediate cleanup.
        // This path generally shouldn't result in a valid recording to be completed.
        // collectedPeaksRef will be cleared in the general cleanup part.
    }

    // General cleanup that happens regardless of how stop was initiated
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
        analyserRef.current = null;
        sourceRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    
    setIsRecording(false);
    setTimeLeft(targetDurationMs / 1000);
    setLatestSampledPeak(null);
    setMicError(null);
    // Do NOT clear collectedPeaksRef.current here; onstop will handle it after using it.

  }, [targetDurationMs /* Remove onRecordingComplete from here if it's only in onstop */]);

  const updateWaveformData = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return;
    analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
    animationFrameRef.current = requestAnimationFrame(updateWaveformData);
  }, []);

  // Effect for sampling peak for LIVE visualizer AND collecting peaks for STORAGE
  useEffect(() => {
    if (!isRecording) {
      setLatestSampledPeak(null);
      return;
    }

    const intervalId = setInterval(() => {
      if (dataArrayRef.current && dataArrayRef.current.length > 0) {
        let sumOfAmplitudes = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          const amplitude = Math.abs(dataArrayRef.current[i] - 128); 
          sumOfAmplitudes += amplitude;
        }
        let averageAmplitude = sumOfAmplitudes / dataArrayRef.current.length; 
        
        // Boost the average amplitude before normalizing
        averageAmplitude = averageAmplitude * LIVE_VISUAL_SENSITIVITY_BOOST;

        // Normalize boosted average amplitude (0-128 range effectively expanded by boost)
        // Cap the raw boosted average at 128 before normalizing to prevent exceeding 100% after normalization
        const cappedBoostedAverage = Math.min(averageAmplitude, 128);
        const normalizedValue = Math.min(100, Math.round((cappedBoostedAverage / 128) * 100)); 
        
        setLatestSampledPeak(normalizedValue); 
        collectedPeaksRef.current.push(normalizedValue);
      } else {
        const silentNormalizedValue = 0; 
        setLatestSampledPeak(silentNormalizedValue);
        collectedPeaksRef.current.push(silentNormalizedValue);
      }
    }, SAMPLE_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    collectedPeaksRef.current = []; // This is the correct place to clear for a NEW recording
    setIsPreparing(false);
    if (preparingTimerRef.current) {
      clearTimeout(preparingTimerRef.current);
      preparingTimerRef.current = null;
    }
    setShowPreparingMessage(false);
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      animationFrameRef.current = requestAnimationFrame(updateWaveformData);

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      actualDurationMsRef.current = null; 

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // This is the primary place to call onRecordingComplete
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const finalDuration = actualDurationMsRef.current ?? targetDurationMs; 
        
        // Critical Log: See what collectedPeaksRef contains *at the moment onstop fires*
        console.log("[onstop] FIRING. Collected peaks at this moment:", JSON.stringify(collectedPeaksRef.current));
        onRecordingComplete(audioBlob, finalDuration, collectedPeaksRef.current);
        
        // console.log("[onstop] Clearing peaks AFTER sending. Length was:", collectedPeaksRef.current.length);
        collectedPeaksRef.current = []; 
        actualDurationMsRef.current = null;
        audioChunksRef.current = []; 
      };

      startTimeRef.current = Date.now();
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTimeLeft(targetDurationMs / 1000);

      preciseTimeoutRef.current = setTimeout(() => {
          stopRecording(true);
      }, targetDurationMs);

    } catch (error) {
      console.error('Error accessing microphone or starting recording:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      const specificError = error instanceof Error && error.name === 'NotAllowedError' ? 'Permission denied.' : message;
      setMicError(`Mic Error: ${specificError}. Please check browser settings.`);
      stopRecording();
      setIsPreparing(false); 
      if (preparingTimerRef.current) clearTimeout(preparingTimerRef.current);
      setShowPreparingMessage(false);
    }
  }, [onRecordingComplete, stopRecording, targetDurationMs, updateWaveformData]);

  // Effect for Timer Logic
  useEffect(() => {
    if (!isRecording) {
        return; 
    }
    if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
    }
    timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prevTime) => Math.max(0, prevTime - 1));
    }, 1000);

    return () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    };
  }, [isRecording]);

  // Simplified handleCancel 
  const handleCancel = useCallback(() => {
    if (isPreparing || isRecording) {
        stopRecording(); 
    }
    onCancelCountdown();
  }, [isPreparing, isRecording, onCancelCountdown, stopRecording]);

  // Callback for CountdownDisplay completion
  const handleCountdownComplete = useCallback(() => {
      setIsCountingDown(false);
      setIsPreparing(true);

      if (preparingTimerRef.current) clearTimeout(preparingTimerRef.current);
      preparingTimerRef.current = setTimeout(() => {
          setShowPreparingMessage(true); 
      }, 2000); 

      startRecording().catch((error) => {
         console.error("Error during startRecording triggered by countdown completion:", error);
         const message = error instanceof Error ? error.message : 'Unknown error';
         setMicError(`Failed to start recording: ${message}`);
         setIsPreparing(false); 
         if (preparingTimerRef.current) clearTimeout(preparingTimerRef.current); 
         setShowPreparingMessage(false);
      });
  }, [startRecording]);

  // Main component cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording(); // Ensure everything is stopped and cleaned up
      if (preparingTimerRef.current) clearTimeout(preparingTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on unmount

  return (
    <div className="flex flex-col items-center justify-center p-4 rounded-lg text-gray-900 w-full max-w-md mx-auto space-y-4 min-h-[200px]">
      {micError && <p className="text-red-600 mb-4">{micError}</p>}

      {isCountingDown && !micError && (
        <CountdownDisplay
          initialCount={COUNTDOWN_SECONDS}
          onCountdownComplete={handleCountdownComplete}
        />
      )}

      {isPreparing && !isRecording && !micError && (
        <div className="flex flex-col items-center justify-center space-y-2 text-lg">
          <p>Preparing...</p>
          {showPreparingMessage && <p className="text-sm text-gray-500">(This might take a moment)</p>}
          <Button onClick={handleCancel} variant="secondary" className="mt-2">
            Cancel
          </Button>
        </div>
      )}

      {isRecording && !micError && (
        <>
          <RecordingTimer timeLeft={timeLeft} newAmplitudeSample={latestSampledPeak} />
          {timeLeft <= 50 && (
            <Button onClick={() => stopRecording(false)} variant="warning" className="mt-2">
              Stop Recording
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default RecordingInterface; 