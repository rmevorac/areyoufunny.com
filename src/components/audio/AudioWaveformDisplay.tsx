"use client";

import React from 'react';

interface AudioWaveformDisplayProps {
  peaks: number[];
  progressPercentage: number;
  svgWidth: number;
  svgHeight: number;
  barColor: string;
  backgroundColor: string;
  clipPathId: string;
  minBarAmplitude: number;
  renderAmplificationFactor: number;
  barCount: number; // Number of bars to determine width from (e.g., actualPeaksToRender.length)
}

const AudioWaveformDisplay: React.FC<AudioWaveformDisplayProps> = ({
  peaks,
  progressPercentage,
  svgWidth,
  svgHeight,
  barColor,
  backgroundColor,
  clipPathId,
  minBarAmplitude,
  renderAmplificationFactor,
  barCount
}) => {

  if (!peaks || peaks.length === 0) {
    // Optionally render a completely flat line or nothing if peaks are empty,
    // though AudioPlayer currently provides DEFAULT_WAVEFORM_PEAKS.
    // For now, assume peaks will always have some data due to default.
  }

  return (
    <svg 
      width="100%" 
      height="100%" 
      viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
      preserveAspectRatio="none" 
      className="absolute inset-0 pointer-events-none"
    >
      <defs>
        <clipPath id={clipPathId}>
          <rect x="0" y="0" width={`${progressPercentage}%`} height={svgHeight} />
        </clipPath>
      </defs>
      {/* Background (unplayed part) */}
      {peaks.map((peak, index) => {
        const amplifiedPeak = Math.min(100, Math.max(peak, minBarAmplitude) * renderAmplificationFactor);
        const barHeight = (amplifiedPeak / 100) * (svgHeight / 2);
        const barWidth = barCount > 0 ? svgWidth / barCount : 0; // Prevent division by zero
        const x = index * barWidth;
        const y1 = svgHeight / 2 - barHeight;
        const y2 = svgHeight / 2 + barHeight;
        return (
          <line 
            key={`bg-${index}`} 
            x1={x + barWidth / 2} 
            y1={y1} 
            x2={x + barWidth / 2} 
            y2={y2} 
            stroke={backgroundColor} 
            strokeWidth={barWidth * 0.7} 
            strokeLinecap="round" 
          />
        );
      })}
      {/* Foreground (played part) - same waveform, but clipped and different color */}
      {peaks.map((peak, index) => {
        const amplifiedPeak = Math.min(100, Math.max(peak, minBarAmplitude) * renderAmplificationFactor);
        const barHeight = (amplifiedPeak / 100) * (svgHeight / 2);
        const barWidth = barCount > 0 ? svgWidth / barCount : 0;
        const x = index * barWidth;
        const y1 = svgHeight / 2 - barHeight;
        const y2 = svgHeight / 2 + barHeight;
        return (
          <line 
            key={`fg-${index}`} 
            x1={x + barWidth / 2} 
            y1={y1} 
            x2={x + barWidth / 2} 
            y2={y2} 
            stroke={barColor} 
            strokeWidth={barWidth * 0.7} 
            strokeLinecap="round" 
            clipPath={`url(#${clipPathId})`} 
          />
        );
      })}
    </svg>
  );
};

export default AudioWaveformDisplay; 