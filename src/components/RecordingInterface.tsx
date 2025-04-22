"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Remove default duration from here, it will come from props
// const RECORDING_DURATION_MS = 60000; 
const COUNTDOWN_SECONDS = 3;

interface RecordingInterfaceProps {
  targetDurationMs: number; // Receive the target duration from parent
  onRecordingComplete: (blob: Blob, durationMs: number) => void; // Pass duration back
}

const RecordingInterface: React.FC<RecordingInterfaceProps> = ({ targetDurationMs, onRecordingComplete }) => {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [isCountingDown, setIsCountingDown] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false); // State for preparing phase
  const [showPreparingMessage, setShowPreparingMessage] = useState(false); // State to show message
  const [isRecording, setIsRecording] = useState(false);
  // Use targetDurationMs for initial timeLeft state
  const [timeLeft, setTimeLeft] = useState(targetDurationMs / 1000);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 1
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const preciseTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for the precise timeout
  
  // Refs for calculating actual duration
  const startTimeRef = useRef<number | null>(null);
  const actualDurationMsRef = useRef<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const preparingTimerRef = useRef<NodeJS.Timeout | null>(null); // Ref for the preparing message timer

  const stopRecording = useCallback((stoppedByTimeout: boolean = false) => {
    console.log(`stopRecording called. stoppedByTimeout: ${stoppedByTimeout}`);
    // Remove interval clear from here - useEffect will handle it
    // const intervalId = timerIntervalRef.current;
    // if (intervalId) { ... clearInterval ... }
    
    // 1. Clear precise timeout
    if (preciseTimeoutRef.current) {
        clearTimeout(preciseTimeoutRef.current);
        preciseTimeoutRef.current = null;
    }

    // 2. Calculate actual duration based on stop source
    let finalDurationMs = targetDurationMs; // Default
    if (stoppedByTimeout) {
        console.log(`Recording stopped by precise timeout. Forcing duration to target: ${targetDurationMs}ms`);
        finalDurationMs = targetDurationMs;
    } else if (startTimeRef.current) {
        // Calculate elapsed time only if stopped early
        const elapsedMs = Date.now() - startTimeRef.current;
        finalDurationMs = Math.min(Math.max(0, Math.round(elapsedMs)), targetDurationMs);
        console.log(`Recording stopped early. Calculated actual duration: ${finalDurationMs}ms (Elapsed: ${elapsedMs})`);
    } else {
        console.warn("stopRecording called (early) but startTimeRef was null. Using target duration.");
    }
    // Reset start time ref regardless of stop source
    if (startTimeRef.current) startTimeRef.current = null;

    actualDurationMsRef.current = finalDurationMs; // Store for onstop handler

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
    // console.log("startRecording called"); // Keep if useful
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
      actualDurationMsRef.current = null; // Ensure ref is reset before starting

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        // console.log("MediaRecorder onstop event fired.");
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const finalDuration = actualDurationMsRef.current ?? targetDurationMs;
        // console.log(`Calling onRecordingComplete with duration: ${finalDuration}ms`); // Keep if useful
        onRecordingComplete(audioBlob, finalDuration);
        actualDurationMsRef.current = null;
      };

      startTimeRef.current = Date.now();
      mediaRecorderRef.current.start();
      // console.log("MediaRecorder started.");
      setIsRecording(true);
      setTimeLeft(targetDurationMs / 1000);

      // Precise timeout solely responsible for stopping
      preciseTimeoutRef.current = setTimeout(() => {
          console.log(`Stopping recording via precise timeout (${targetDurationMs}ms)`);
          stopRecording(true);
      }, targetDurationMs);

    } catch (err) {
      // ... (error handling - keep console.error)
      stopRecording();
      setIsPreparing(false); 
      if (preparingTimerRef.current) clearTimeout(preparingTimerRef.current);
      setShowPreparingMessage(false);
    }
  }, [onRecordingComplete, stopRecording, targetDurationMs, updateAudioLevel]);

  // Countdown Logic Effect
  useEffect(() => {
    if (!isCountingDown) return;

    const intervalId = setInterval(() => {
      setCountdown((prevCountdown) => {
        const nextCountdown = prevCountdown - 1;
        if (nextCountdown <= 0) {
          clearInterval(intervalId);
          setIsCountingDown(false);
          setIsPreparing(true);
          preparingTimerRef.current = setTimeout(() => {
              // console.log("Preparing delay exceeded 2 seconds, showing message.");
              setShowPreparingMessage(true);
          }, 2000); 
          startRecording();
          return 0;
        }
        return nextCountdown;
      });
    }, 1000);

    return () => {
        // console.log("Cleaning up countdown interval effect.");
        clearInterval(intervalId);
        if (preparingTimerRef.current) {
            // console.log("Clearing preparing timer in countdown cleanup.");
            clearTimeout(preparingTimerRef.current);
            preparingTimerRef.current = null;
        }
    };

  }, [isCountingDown, startRecording]);

  // *** New useEffect for Display Timer ***
  useEffect(() => {
    // Only run this effect if recording is active
    if (!isRecording) {
        return; // Exit if not recording
    }

    // Clear any existing interval before starting (extra safety)
    if (timerIntervalRef.current) {
        console.warn("Clearing lingering timer interval in useEffect");
        clearInterval(timerIntervalRef.current);
    }

    console.log("Setting display timer interval due to isRecording=true");
    timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
            const nextTime = Math.max(0, prevTime - 1);
            // console.log(`Display Timer Tick: ${nextTime}`); // Optional log
            // Stop interval if time runs out visually (should be redundant due to precise timeout)
            // if (nextTime <= 0 && timerIntervalRef.current) {
            //    console.log("Clearing display interval because time reached 0 visually");
            //    clearInterval(timerIntervalRef.current);
            //    timerIntervalRef.current = null;
            // }
            return nextTime;
        });
    }, 1000);

    // Cleanup function: this runs when isRecording becomes false OR component unmounts
    return () => {
        if (timerIntervalRef.current) {
            console.log(`Cleaning up display timer interval: ${timerIntervalRef.current}`);
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    };

  }, [isRecording]); // Dependency array ensures this runs only when isRecording changes

  // Main cleanup effect (remains the same)
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  const scale = 1 + audioLevel * 0.5; 

  return (
    <div className="flex flex-col items-center justify-center space-y-6 relative">
      {micError ? (
        <div className="text-center p-8 bg-gray-800 rounded-lg shadow-xl w-full">
            <p className="text-red-500 font-semibold mb-4">Recording Error</p>
            <p className="text-gray-300">{micError}</p>
        </div>
      ) : isCountingDown && countdown > 0 ? ( // Render countdown only if > 0
        // Use the main countdown state directly and use it as key
        <div
          key={countdown} // Key ensures component re-mount/animation reset
          className="text-8xl font-bold text-red-500 animate-ping"
          style={{ animationDuration: '1s' }}
        >
          {countdown}
        </div>
      ) : isRecording ? (
        <div className="flex flex-col items-center justify-center space-y-6 w-full relative mx-auto">
          <div className="text-4xl font-semibold text-black">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
          <div 
            className="w-32 h-32 my-2 mb-6 bg-red-600 rounded-full flex items-center justify-center transition-transform duration-100 ease-out"
            style={{ transform: `scale(${scale})` }}
          >
          </div>
          <p className="text-lg text-red-500">Recording...</p>

          <button 
            onClick={() => stopRecording()}
            className="absolute bottom-0 right-0 mb-[-20px] mr-[-10px] px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded shadow"
          >
              Stop Early (Test)
          </button>
        </div>
      ) : isPreparing && showPreparingMessage ? ( // Show preparing message conditionally
         <div className="p-8 bg-gray-800 rounded-lg shadow-xl w-full text-center">
            <p className="text-xl text-yellow-500">Preparing...</p>
         </div>
      ) : null /* Render nothing during brief preparing phase unless message is shown */}
    </div>
  );
};

export default RecordingInterface; 