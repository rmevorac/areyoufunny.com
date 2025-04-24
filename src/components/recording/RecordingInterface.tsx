"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Button from '@/components/ui/Button';
import CountdownDisplay from './CountdownDisplay';
import RecordingTimer from './RecordingTimer';

// Default duration can be defined here or passed as prop if needed
const COUNTDOWN_SECONDS = 3;

interface RecordingInterfaceProps {
  targetDurationMs: number; // Receive the target duration from parent
  onRecordingComplete: (blob: Blob, durationMs: number) => void; // Pass duration back
  onCancelCountdown: () => void; // Passed to CountdownDisplay
}

const RecordingInterface: React.FC<RecordingInterfaceProps> = ({ targetDurationMs, onRecordingComplete, onCancelCountdown }) => {
  const [isCountingDown, setIsCountingDown] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false);
  const [showPreparingMessage, setShowPreparingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(targetDurationMs / 1000);
  const [audioLevel, setAudioLevel] = useState(0);
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

  const stopRecording = useCallback((stoppedByTimeout: boolean = false) => {
    
    // 1. Clear precise timeout
    if (preciseTimeoutRef.current) {
        clearTimeout(preciseTimeoutRef.current);
        preciseTimeoutRef.current = null;
    }

    // 2. Calculate actual duration
    let finalDurationMs = targetDurationMs; 
    if (stoppedByTimeout) {
        finalDurationMs = targetDurationMs;
    } else if (startTimeRef.current) {
        const elapsedMs = Date.now() - startTimeRef.current;
        finalDurationMs = Math.min(Math.max(0, Math.round(elapsedMs)), targetDurationMs);
    } else {
        // console.warn("stopRecording called (early) but startTimeRef was null...");
    }
    if (startTimeRef.current) startTimeRef.current = null;
    actualDurationMsRef.current = finalDurationMs;

    // 3. Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
    }

    // 4. Clean up audio context and tracks
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
    
    // 5. Reset component state
    setIsRecording(false);
    setTimeLeft(targetDurationMs / 1000);
    setAudioLevel(0); 
    setMicError(null);

  }, [targetDurationMs]);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return;

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    
    let sum = 0;
    for(let i = 0; i < dataArrayRef.current.length; i++) {
        sum += dataArrayRef.current[i];
    }
    const average = sum / dataArrayRef.current.length;
    const normalizedLevel = Math.min(1, (average / 255) * 2.5); 
    setAudioLevel(normalizedLevel);

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const startRecording = useCallback(async () => {
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

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      actualDurationMsRef.current = null; 

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const finalDuration = actualDurationMsRef.current ?? targetDurationMs;
        onRecordingComplete(audioBlob, finalDuration);
        actualDurationMsRef.current = null;
      };

      startTimeRef.current = Date.now();
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTimeLeft(targetDurationMs / 1000);

      preciseTimeoutRef.current = setTimeout(() => {
          stopRecording(true);
      }, targetDurationMs);

    } catch (err: any) {
      console.error('Error accessing microphone or starting recording:', err);
      setMicError(`Mic Error: ${err.name === 'NotAllowedError' ? 'Permission denied.' : err.message}. Please check browser settings.`);
      stopRecording();
      setIsPreparing(false); 
      if (preparingTimerRef.current) clearTimeout(preparingTimerRef.current);
      setShowPreparingMessage(false);
    }
  }, [onRecordingComplete, stopRecording, targetDurationMs, updateAudioLevel]);

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

      startRecording().catch((err: any) => {
         console.error("Error during startRecording triggered by countdown completion:", err);
         setIsPreparing(false); 
         if (preparingTimerRef.current) clearTimeout(preparingTimerRef.current); 
         setShowPreparingMessage(false);
         setMicError("Failed to start recording. Please check microphone permissions.");
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
    <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-lg text-gray-900 w-full max-w-md mx-auto space-y-4 min-h-[200px]">
      {micError && <p className="text-red-600 mb-4">{micError}</p>}

      {isCountingDown && !micError && (
        <CountdownDisplay
          initialCount={COUNTDOWN_SECONDS}
          onCountdownComplete={handleCountdownComplete}
          onCancel={handleCancel} 
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
          <RecordingTimer timeLeft={timeLeft} audioLevel={audioLevel} />
          {timeLeft <= 30 && (
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