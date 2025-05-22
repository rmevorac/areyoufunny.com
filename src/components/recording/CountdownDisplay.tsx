"use client";

import React, { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';

interface CountdownDisplayProps {
  initialCount: number;
  onCountdownComplete: () => void;
  onCancel: () => void;
}

const CountdownDisplay: React.FC<CountdownDisplayProps> = ({ initialCount, onCountdownComplete, onCancel }) => {
  const [countdown, setCountdown] = useState(initialCount);

  // Effect to handle the interval timer for decrementing
  useEffect(() => {
    if (countdown <= 0) return;
    const intervalId = setInterval(() => {
      setCountdown((prevCountdown) => {
        const nextCountdown = prevCountdown - 1;
        if (nextCountdown <= 0) {
          clearInterval(intervalId);
          return 0;
        }
        return nextCountdown;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [countdown]);

  // Effect to call the parent callback *after* state updates
  useEffect(() => {
    if (countdown === 0) {
      onCountdownComplete();
    }
  }, [countdown, onCountdownComplete]);

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-4">
      {/* Optional text above */} 
      {/* <p className="text-xl font-semibold text-yellow-500">Get Ready...</p> */}
      
      {/* Large Pinging Countdown Number */}
      <div 
        key={countdown}
        className="text-8xl font-bold text-red-500 animate-ping" 
        style={{ animationDuration: '1s' }}
      >
        {countdown}
      </div>
    </div>
  );
};

export default CountdownDisplay; 