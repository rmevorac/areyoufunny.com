"use client";

import React, { useState, useEffect } from 'react';

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
          // REMOVE onCountdownComplete() call from here
          return 0; // Just update state
        }
        return nextCountdown;
      });
    }, 1000);
    return () => clearInterval(intervalId);
    // Dependency array should ideally just be initialCount if it could change, 
    // but for a countdown, it usually doesn't need deps once started.
    // Let's remove onCountdownComplete from here.
  }, []); // Run once on mount or if initialCount changed (add if needed)

  // Effect to call the parent callback *after* state updates
  useEffect(() => {
    if (countdown === 0) {
      onCountdownComplete();
    }
    // Depend on countdown and the callback prop
  }, [countdown, onCountdownComplete]);

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-4 bg-white">
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

      {/* Cancel Button - Below number, standard styling */}
      <button 
        onClick={onCancel} 
        className="mt-6 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-red-500"
      >
        Cancel
      </button>
    </div>
  );
};

export default CountdownDisplay; 