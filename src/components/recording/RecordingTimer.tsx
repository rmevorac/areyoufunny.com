"use client";

import React, { useState, useEffect, useRef } from 'react';

interface RecordingTimerProps {
  timeLeft: number;
  newAmplitudeSample: number | null; // New prop for the latest sampled peak
}

const MAX_DISPLAY_BARS = 70; // Number of bars to show in the scrolling display
const SVG_HEIGHT = 70;       // Height of the SVG canvas
const SVG_WIDTH = 250;       // Width of the SVG canvas
const BAR_COLOR = "#EF4444"; // Red color
const VISUAL_TICK_INTERVAL_MS = 150; // Should roughly match SAMPLE_INTERVAL_MS from parent
const MIN_BAR_AMPLITUDE = 1.2; // Small amplitude (0-100 scale) for silence to show a tiny bar
const RENDER_AMPLIFICATION_FACTOR = 3; // Added for sensitivity

const RecordingTimer: React.FC<RecordingTimerProps> = ({ timeLeft, newAmplitudeSample }) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const [displayedAmplitudes, setDisplayedAmplitudes] = useState<number[]>(() => Array(MAX_DISPLAY_BARS).fill(MIN_BAR_AMPLITUDE));
  const latestSampleRef = useRef<number | null>(MIN_BAR_AMPLITUDE); // Store the latest prop value

  // Update ref whenever newAmplitudeSample prop changes
  useEffect(() => {
    latestSampleRef.current = newAmplitudeSample === null ? MIN_BAR_AMPLITUDE : Math.max(newAmplitudeSample, MIN_BAR_AMPLITUDE);
  }, [newAmplitudeSample]);

  // Timer for shifting the waveform display
  useEffect(() => {
    const intervalId = setInterval(() => {
      setDisplayedAmplitudes(prevAmplitudes => {
        const currentSample = latestSampleRef.current ?? MIN_BAR_AMPLITUDE;
        const newAmplitudes = [currentSample, ...prevAmplitudes];
        if (newAmplitudes.length > MAX_DISPLAY_BARS) {
          return newAmplitudes.slice(0, MAX_DISPLAY_BARS);
        }
        return newAmplitudes;
      });
    }, VISUAL_TICK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []); // Empty dependency array: runs once on mount, cleans up on unmount

  return (
    <div className="flex flex-col items-center justify-center space-y-2 w-full">
      <span className="text-sm font-medium text-gray-700 mb-1">
        Recording...
      </span>
      
      <div className="text-6xl font-bold text-red-500 mb-2">
        {formatTime(timeLeft)}
      </div>

      {/* Shifting Waveform Visualizer */}
      <svg width={SVG_WIDTH} height={SVG_HEIGHT} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full max-w-xs bg-gray-50 rounded">
        {/* Render bars from right to left, so newest appears on the right and shifts left */}
        {displayedAmplitudes.map((amplitude, index) => {
          const currentAmplitude = Math.max(amplitude, MIN_BAR_AMPLITUDE);
          // Amplify before calculating height, then cap at 100 for normalization
          const amplifiedSample = Math.min(100, currentAmplitude * RENDER_AMPLIFICATION_FACTOR);
          const barHeight = (amplifiedSample / 100) * (SVG_HEIGHT / 2);
          const barWidth = SVG_WIDTH / MAX_DISPLAY_BARS;
          
          // Draw from right to left: index 0 is newest, should be on the right
          const x = SVG_WIDTH - (index + 1) * barWidth;
          
          const y1 = SVG_HEIGHT / 2 - barHeight;
          const y2 = SVG_HEIGHT / 2 + barHeight;

          return (
            <line 
              key={index} 
              x1={x + barWidth / 2} 
              y1={y1} 
              x2={x + barWidth / 2} 
              y2={y2} 
              stroke={BAR_COLOR} 
              strokeWidth={barWidth * 0.7} // Adjust for thinner bars
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </div>
  );
};

export default RecordingTimer; 