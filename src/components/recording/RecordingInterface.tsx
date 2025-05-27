"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Button from '@/components/ui/Button';
import CountdownDisplay from './CountdownDisplay';
import RecordingTimer from './RecordingTimer';
import { MIN_VALID_DURATION_MS } from '@/config/constants';

// Default duration can be defined here or passed as prop if needed
const COUNTDOWN_SECONDS = 3;
const SAMPLE_INTERVAL_MS = 150; // How often to generate a new bar for the visualizer
const LIVE_VISUAL_SENSITIVITY_BOOST = 4.0; // Experiment with this value (e.g., 1.5, 2.0, 2.5)

// Helper to check if the browser is likely Safari (and not a Chromium-based browser)
const isSafariBrowser = () => {
  if (typeof navigator === 'undefined') return false; // Guard for SSR or non-browser environments
  const ua = navigator.userAgent;
  // Test for Safari, but not Chrome, Chromium (CrOS), Firefox on iOS (FXiOS), or Edge (Edg)
  return /^((?!chrome|android|crios|fxios|edg| CriOS).)*safari/i.test(ua) && !/chromium/i.test(ua);
};

interface RecordingInterfaceProps {
  targetDurationMs: number; // Receive the target duration from parent
  onRecordingComplete: (
    blob: Blob,
    durationMs: number,
    waveformPeaks: number[],
    actualMimeType: string
  ) => void;
}

const RecordingInterface: React.FC<RecordingInterfaceProps> = ({ targetDurationMs, onRecordingComplete }) => {
  const [isCountingDown, setIsCountingDown] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false);
  const [showPreparingMessage, setShowPreparingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(targetDurationMs / 1000);
  const [latestSampledPeak, setLatestSampledPeak] = useState<number | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [showStopButton, setShowStopButton] = useState(false); // State for stop button visibility

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
  const actualMimeTypeRef = useRef<string>('');

  const _cleanupRecordingSession = useCallback(() => {
    console.log("[RecordingInterface._cleanupRecordingSession] Cleaning up recording session.");

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    streamRef.current = null;
    
    mediaRecorderRef.current = null; // Ensure recorder instance is cleared

    audioChunksRef.current = [];
    collectedPeaksRef.current = [];
    actualDurationMsRef.current = null;
    startTimeRef.current = null;
    actualMimeTypeRef.current = '';

    setIsRecording(false);
    setTimeLeft(targetDurationMs / 1000);
    setLatestSampledPeak(null);
    setShowStopButton(false); // Reset stop button state
    // Do not clear micError here as it might be important user feedback.
    // isPreparing and showPreparingMessage are typically handled by the start/countdown flow.
  }, [targetDurationMs]);

  const stopRecording = useCallback((stoppedByTimeout: boolean = false) => {
    console.log(`[RecordingInterface.stopRecording] Called. stoppedByTimeout: ${stoppedByTimeout}, mediaRecorder state: ${mediaRecorderRef.current?.state}`);
    
    if (preciseTimeoutRef.current) {
      clearTimeout(preciseTimeoutRef.current);
      preciseTimeoutRef.current = null;
    }

    if (stoppedByTimeout) {
      actualDurationMsRef.current = targetDurationMs;
    } else if (startTimeRef.current) {
      const elapsedMs = Date.now() - startTimeRef.current;
      actualDurationMsRef.current = Math.min(Math.max(0, Math.round(elapsedMs)), targetDurationMs);
    } else {
      actualDurationMsRef.current = 0;
    }
    // startTimeRef is reset in _cleanupRecordingSession or before next recording

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      // onstop handler will call _cleanupRecordingSession
    } else {
      // If recorder wasn't recording (e.g., stopped early, error, or already stopped),
      // perform immediate full cleanup here as onstop might not fire.
      console.warn(`[RecordingInterface.stopRecording] MediaRecorder not in 'recording' state (current: ${mediaRecorderRef.current?.state}) or null. Performing direct cleanup.`);
      _cleanupRecordingSession();
    }
  }, [targetDurationMs, _cleanupRecordingSession]);

  const updateWaveformData = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !isRecording /* Ensure isRecording to stop RAF when not active */) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      return;
    }
    analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
    animationFrameRef.current = requestAnimationFrame(updateWaveformData);
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording || !dataArrayRef.current) {
      setLatestSampledPeak(null);
      return;
    }
    const intervalId = setInterval(() => {
      if (dataArrayRef.current && dataArrayRef.current.length > 0 && analyserRef.current) {
        let sumOfAmplitudes = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          sumOfAmplitudes += Math.abs(dataArrayRef.current[i] - 128);
        }
        let averageAmplitude = sumOfAmplitudes / dataArrayRef.current.length;
        averageAmplitude = averageAmplitude * LIVE_VISUAL_SENSITIVITY_BOOST;
        const cappedBoostedAverage = Math.min(averageAmplitude, 128);
        const normalizedValue = Math.min(100, Math.round((cappedBoostedAverage / 128) * 100));
        setLatestSampledPeak(normalizedValue);
        collectedPeaksRef.current.push(normalizedValue);
      } else {
        setLatestSampledPeak(0);
        collectedPeaksRef.current.push(0);
      }
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    // Reset states for a new recording attempt
    setMicError(null);
    setIsPreparing(false); // Should be set by calling context if needed (handleCountdownFinish)
    if (preparingTimerRef.current) clearTimeout(preparingTimerRef.current);
    setShowPreparingMessage(false);
    setShowStopButton(false); // Reset stop button state for new recording
    
    // Clear previous recording data explicitly before starting new session.
    // Some of this is also in _cleanupRecordingSession, but good to be sure here.
    collectedPeaksRef.current = [];
    audioChunksRef.current = [];
    actualDurationMsRef.current = null;
    startTimeRef.current = null;
    actualMimeTypeRef.current = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      // updateWaveformData will be started by the useEffect based on isRecording

      let chosenMimeType = '';
      const isSafari = isSafariBrowser();
      if (isSafari) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          chosenMimeType = 'audio/mp4';
        } else {
          console.warn('RecordingInterface: Safari detected, audio/mp4 NOT supported. Using browser default.');
        }
      } else {
        const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
        chosenMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
        if (!chosenMimeType) {
          console.warn('RecordingInterface: No preferred non-Safari mimeType supported. Using browser default.');
        }
      }

      const recorderOptions = chosenMimeType ? { mimeType: chosenMimeType } : {};
      mediaRecorderRef.current = new MediaRecorder(stream, recorderOptions);
      actualMimeTypeRef.current = mediaRecorderRef.current.mimeType || chosenMimeType || 'audio/webm';
      console.log(`RecordingInterface: MediaRecorder initialized. Requested: "${chosenMimeType}", Actual: "${actualMimeTypeRef.current}"`);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blobMimeType = actualMimeTypeRef.current || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobMimeType });
        
        let calculatedDurationMs: number;
        if (typeof actualDurationMsRef.current === 'number') {
          // Duration was already calculated by stopRecording() (manual stop or timeout)
          calculatedDurationMs = actualDurationMsRef.current;
        } else if (startTimeRef.current) {
          // Recording was stopped abruptly (e.g., unmount, nav away) before stopRecording() could calculate it.
          // Calculate elapsed time now.
          const elapsedMs = Date.now() - startTimeRef.current;
          // Ensure it's within 0 and targetDurationMs bounds, similar to stopRecording logic.
          calculatedDurationMs = Math.min(Math.max(0, Math.round(elapsedMs)), targetDurationMs);
          console.log(`[RecordingInterface.onstop] Abrupt stop. Calculated duration: ${calculatedDurationMs}ms`);
        } else {
          // Fallback if neither explicit stop nor start time is available (should be rare).
          calculatedDurationMs = 0;
          console.warn("[RecordingInterface.onstop] Abrupt stop AND no start time. Defaulting duration to 0.");
        }

        if (audioBlob.size === 0) {
            console.warn("[RecordingInterface.onstop] Audio blob size is 0.");
            // Potentially set calculatedDurationMs to 0 here as well if blob is empty?
            // For now, let the parent decide based on duration + blob content.
        }
        
        onRecordingComplete(
          audioBlob,
          calculatedDurationMs, // Use the more reliably calculated duration
          [...collectedPeaksRef.current], // Pass a copy
          blobMimeType
        );
        _cleanupRecordingSession(); // Centralized cleanup after processing
      };

      mediaRecorderRef.current.start();
      setIsRecording(true); // This will trigger visualizer via useEffect
      startTimeRef.current = Date.now();
      setTimeLeft(targetDurationMs / 1000);

      if (preciseTimeoutRef.current) clearTimeout(preciseTimeoutRef.current);
      preciseTimeoutRef.current = setTimeout(() => {
        // Check if still recording, as stopRecording might have been called manually
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          stopRecording(true);
        }
      }, targetDurationMs);

    } catch (err) {
      console.error("RecordingInterface: Error starting recording:", err);
      let message = 'Could not start recording. Please check microphone permissions.';
      if (err instanceof Error) {
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'No microphone found. Please connect a microphone and try again.';
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'Microphone access denied. Please enable microphone permissions in your browser settings.';
        } else if (err.name === 'SecurityError') { // Common for insecure contexts or specific browser policies
            message = 'Cannot access microphone due to security restrictions. Ensure the page is served over HTTPS.';
        }
      }
      setMicError(message);
      _cleanupRecordingSession(); // Cleanup resources if start failed
    }
  }, [targetDurationMs, onRecordingComplete, _cleanupRecordingSession, stopRecording]);

  const handleCountdownFinish = useCallback(async () => {
    setIsCountingDown(false);
    setIsPreparing(true); // Show "Preparing..." state
    // Delay "Preparing..." message slightly to avoid flash if mic access is quick
    if (preparingTimerRef.current) clearTimeout(preparingTimerRef.current);
    preparingTimerRef.current = setTimeout(() => {
      // Only show message if still in preparing phase (not yet recording or errored)
      if (isPreparing && !isRecording && !micError) { 
         setShowPreparingMessage(true);
      }
    }, 700); // Slightly longer delay for preparing message

    await startRecording();
    
    // If startRecording was successful, isPreparing will be false. If it failed, micError will be set.
    // Clear preparing states regardless, as startRecording handles its own flow.
    setIsPreparing(false);
    if (preparingTimerRef.current) clearTimeout(preparingTimerRef.current);
    setShowPreparingMessage(false);
  }, [isPreparing, isRecording, micError, startRecording]);

  useEffect(() => { // Timer display logic & Stop Button Visibility
    if (isRecording) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft(prevTimeLeft => {
          const newTimeLeft = prevTimeLeft - 1;

          // Logic for showing stop button
          const elapsedTimeSeconds = (targetDurationMs / 1000) - newTimeLeft;
          if (!showStopButton && elapsedTimeSeconds >= (MIN_VALID_DURATION_MS / 1000)) {
            setShowStopButton(true);
          }

          if (newTimeLeft <= 0) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            return 0; 
          }
          return newTimeLeft;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      // setShowStopButton(false); // Already handled by _cleanupRecordingSession or startRecording
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording, targetDurationMs, showStopButton]); // Added showStopButton to dependencies

  // Effect for starting and stopping the visualizer's RAF loop based on isRecording
  useEffect(() => {
    if (isRecording && analyserRef.current && dataArrayRef.current && !animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateWaveformData);
    } else if (!isRecording && animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    // Cleanup on unmount for RAF
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isRecording, updateWaveformData]);

  // Effect to handle component unmount
  useEffect(() => {
    return () => {
      if (preciseTimeoutRef.current) clearTimeout(preciseTimeoutRef.current);
      if (preparingTimerRef.current) clearTimeout(preparingTimerRef.current);
      if (isRecording || mediaRecorderRef.current?.state === "recording" || streamRef.current) {
        console.log("[RecordingInterface.unmount] Unmounting, ensuring recording session is cleaned up.");
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop(); 
        } else {
            _cleanupRecordingSession();
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  if (micError) {
    return (
      <div className="flex flex-col items-center justify-center text-white p-4 bg-red-500 rounded-lg">
        <p className="text-center mb-4">{micError}</p>
        <Button onClick={() => {
            setMicError(null);
            // Potentially try to re-initiate countdown or go to idle via parent
            // For now, just clearing error and user can try again via parent UI.
            // Or, directly restart the countdown:
            // setIsCountingDown(true); 
            // _cleanupRecordingSession(); // Ensure clean state before retry
          }} 
          variant="secondary"
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (isCountingDown) {
    return <CountdownDisplay 
              initialCount={COUNTDOWN_SECONDS} 
              onCountdownComplete={handleCountdownFinish}
           />;
  }

  if (isPreparing || showPreparingMessage) { // Simplified condition
    return (
        <div className="flex flex-col items-center justify-center text-white p-4">
            <p className="text-lg animate-pulse">Preparing audio stream...</p>
            {/* Consider adding a cancel button here too if preparation is lengthy */}
        </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      <RecordingTimer
        timeLeft={timeLeft}
        newAmplitudeSample={latestSampledPeak}
      />
      {!showStopButton ? (
        null
      ) : (
        <Button
          onClick={() => stopRecording(false)}
          className="mt-6 bg-red-600 hover:bg-red-700 text-lg px-8 py-3"
          aria-label="Stop Recording"
        >
          Stop Recording
        </Button>
      )}
    </div>
  );
};

export default RecordingInterface; 