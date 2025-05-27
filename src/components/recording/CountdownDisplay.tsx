"use client";

import React, { useState, useEffect, useRef } from 'react';

interface CountdownDisplayProps {
  initialCount: number;
  onCountdownComplete: () => void;
}

const DISPLAY_DURATION_MS = 925; // New duration for each number display and animation

const CountdownDisplay: React.FC<CountdownDisplayProps> = ({ initialCount, onCountdownComplete }) => {
  const [countdown, setCountdown] = useState(initialCount);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const expectedNextTickTimeRef = useRef<number>(0);

  // Effect to call the parent callback *after* state updates to 0
  useEffect(() => {
    if (countdown === 0) {
      onCountdownComplete();
    }
  }, [countdown, onCountdownComplete]);

  // Effect for the self-correcting timer
  useEffect(() => {
    setCountdown(initialCount); // Initialize/reset countdown state

    if (initialCount <= 0) {
      // The other useEffect will handle onCountdownComplete when countdown state (now 0) is processed.
      return;
    }

    // Set the expected time for the *first* state transition (e.g., 3 -> 2)
    expectedNextTickTimeRef.current = performance.now() + DISPLAY_DURATION_MS;

    const tick = () => {
      setCountdown(prevCountdown => {
        if (prevCountdown <= 1) {
          // This was the last tick (e.g., 1 -> 0), no more timeouts needed.
          return 0;
        }

        const now = performance.now();
        // Calculate drift from the previously expected time for *this current* tick.
        const drift = now - expectedNextTickTimeRef.current;
        
        // Calculate the duration for the *next* timeout to correct for drift.
        const nextTimeoutDuration = DISPLAY_DURATION_MS - drift;
        
        // Update the expected time for the *next* tick, based on the *ideal* schedule
        expectedNextTickTimeRef.current += DISPLAY_DURATION_MS; 

        timerRef.current = setTimeout(tick, Math.max(0, nextTimeoutDuration));
        
        return prevCountdown - 1;
      });
    };

    // Start the first tick after 925ms.
    // initialCount is displayed, then after 925ms, tick() will run to change state to initialCount - 1.
    timerRef.current = setTimeout(tick, DISPLAY_DURATION_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [initialCount]); // Only re-run if initialCount changes. onCountdownComplete is handled by the other effect.

  return (
    <div className="flex flex-col items-center justify-center space-y-6 p-4">
      {/* Optional text above */} 
      {/* <p className="text-xl font-semibold text-yellow-500">Get Ready...</p> */}
      
      {/* Large Pinging Countdown Number */}
      {countdown > 0 && (
        <div 
          key={countdown} // This key change triggers the animation
          className="text-8xl font-bold text-red-500 animate-ping" 
          style={{
            animationDuration: `${DISPLAY_DURATION_MS / 1000}s`,
            animationIterationCount: 1 // Ensure it plays only once per number
          }}
        >
          {countdown}
        </div>
      )}
    </div>
  );
};

export default CountdownDisplay; 