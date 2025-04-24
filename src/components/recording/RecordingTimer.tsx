"use client";

import React from 'react';

interface RecordingTimerProps {
  timeLeft: number;
  audioLevel: number; // 0 to 1
}

const RecordingTimer: React.FC<RecordingTimerProps> = ({ timeLeft, audioLevel }) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4 w-full">
      {/* Time Left Display - Red text should be okay on light background */}
      <div className="text-6xl font-bold text-red-500">
        {formatTime(timeLeft)}
      </div>

      {/* Audio Level Visualizer */}
      {/* Change background to light gray */}
      <div className="relative w-full h-12 bg-gray-200 rounded-lg overflow-hidden">
        {/* Keep fill red */}
        <div 
          className="absolute top-0 left-0 h-full bg-red-500 transition-transform duration-75 ease-out"
          style={{ transform: `scaleX(${audioLevel})`, transformOrigin: 'left' }}
        ></div>
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Change text to dark, remove mix-blend-difference */}
          <span className="text-sm font-medium text-gray-700">
            Recording...
          </span>
        </div>
      </div>
    </div>
  );
};

export default RecordingTimer; 