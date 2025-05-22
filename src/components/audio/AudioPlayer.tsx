"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePlaybackContext } from '@/contexts/PlaybackContext';
import AudioWaveformDisplay from './AudioWaveformDisplay'; // Import the new component

interface AudioPlayerProps {
  src: string;
  durationMs: number;
  createdAt: string; 
  waveformPeaks?: number[] | null; 
}

// Constants that remain in AudioPlayer or are specific to its decisions
const STATIC_MAX_BARS = 70; // Still used to decide how many peaks from prop to potentially use, or how many default peaks to generate.
const MIN_BAR_AMPLITUDE = 2; // Used by getDefaultWaveformPeaks

// Constants to be passed to AudioWaveformDisplay (could also be defined here and passed)
// Consider moving these to AudioWaveformDisplay.tsx if they are intrinsic to its default presentation
// or to a shared theme/config file if they need to be globally configurable.
const STATIC_SVG_HEIGHT = 40;
const STATIC_SVG_WIDTH = 200;
const STATIC_BAR_COLOR = "#EF4444";
const DEFAULT_BACKGROUND_COLOR = "#D1D5DB";
const RENDER_AMPLIFICATION_FACTOR = 1.5;

// Generate a default waveform array with random bar heights
const getDefaultWaveformPeaks = (numBars: number): number[] => {
  const peaks = [];
  const maxRandomAmplitude = 45; 
  for (let i = 0; i < numBars; i++) {
    const randomAmplitude = MIN_BAR_AMPLITUDE + Math.random() * (maxRandomAmplitude - MIN_BAR_AMPLITUDE);
    peaks.push(Math.round(randomAmplitude));
  }
  return peaks;
};
const DEFAULT_WAVEFORM_PEAKS = getDefaultWaveformPeaks(STATIC_MAX_BARS);

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, durationMs, createdAt, waveformPeaks }) => {
  const { currentlyPlayingSrc, setCurrentlyPlayingSrc } = usePlaybackContext();
  const [isPlaying, setIsPlaying] = useState(false);
  const initialDurationSeconds = Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : null;
  const [duration, setDuration] = useState<number | null>(initialDurationSeconds);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const prevSrcRef = useRef<string | undefined>(undefined);
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const formattedDate = createdAt ? new Date(createdAt).toLocaleString() : 'Date unavailable';
  const progressPercentage = duration ? (currentTime / duration) * 100 : 0;
  const clipPathId = useCallback(() => `clipPath-player-${src.replace(/[^a-zA-Z0-9]/g, '')}`, [src]);

  // Consolidated useEffect for primary audio event listeners (as refactored before)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Only reset playback state if the audio source has changed
    if (prevSrcRef.current !== src) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
    prevSrcRef.current = src; // Update previous src for next run

    const newInitialDurationValue = Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : null;
    if (newInitialDurationValue !== undefined) { // Explicitly check, though null is fine for setDuration
      setDuration(newInitialDurationValue);
    }

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (currentlyPlayingSrc === src) {
        setCurrentlyPlayingSrc(null);
      }
    };
    const handleTimeUpdate = () => {
      if (!isSeeking && audio) { 
           setCurrentTime(audio.currentTime);
      }
    };
    const handleMetadata = () => {
      if (!audio) return;
      if (Number.isFinite(audio.duration)) {
          setDuration(audio.duration);
      } else if (newInitialDurationValue !== null) {
          setDuration(newInitialDurationValue);
      }
       if (Number.isFinite(audio.currentTime)) {
            setCurrentTime(audio.currentTime);
       }
    };
    const handleError = (e: Event) => {
        console.error("Audio Error:", e);
    };
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleMetadata);
    audio.addEventListener('durationchange', handleMetadata); 
    audio.addEventListener('error', handleError);
    if (audio.readyState >= 1) { 
        handleMetadata();
    }
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleMetadata);
      audio.removeEventListener('durationchange', handleMetadata);
      audio.removeEventListener('error', handleError);
    };
  }, [src, durationMs, isSeeking, currentlyPlayingSrc, setCurrentlyPlayingSrc]);

  // Effect to pause this player if another one starts playing (as before)
  useEffect(() => {
    if (currentlyPlayingSrc && currentlyPlayingSrc !== src && isPlaying) {
      audioRef.current?.pause();
    }
  }, [currentlyPlayingSrc, src, isPlaying]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused || audio.ended) { 
      setCurrentlyPlayingSrc(src); 
      audio.play().catch(error => {
          console.error("Error playing audio:", error);
          setIsPlaying(false);
          if (currentlyPlayingSrc === src) {
            setCurrentlyPlayingSrc(null);
          }
      });
    } else {
      audio.pause();
    }
  }, [src, currentlyPlayingSrc, setCurrentlyPlayingSrc]);

  const handleSeek = (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement> | globalThis.MouseEvent | globalThis.TouchEvent) => {
    if (!waveformContainerRef.current || duration === null || duration <= 0) return;
    const rect = waveformContainerRef.current.getBoundingClientRect();
    const clientX = 'touches' in event ? (event as React.TouchEvent<HTMLDivElement> | globalThis.TouchEvent).touches[0].clientX : (event as React.MouseEvent<HTMLDivElement> | globalThis.MouseEvent).clientX;
    const offsetX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, offsetX / rect.width));
    const newTime = percentage * duration;
    if (audioRef.current) audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleWaveformMouseDown = (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    setIsSeeking(true);
    handleSeek(event); // Initial seek on mousedown

    const audio = audioRef.current; // Get a stable reference

    const handleMouseMove = (moveEvent: globalThis.MouseEvent | globalThis.TouchEvent) => {
      // No need to check for audio here, handleSeek does it.
      handleSeek(moveEvent);
    };

    const handleMouseUp = () => {
      setIsSeeking(false);
      window.removeEventListener('mousemove', handleMouseMove as EventListener);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove as EventListener);
      window.removeEventListener('touchend', handleMouseUp);

      if (audio) {
        // After seeking via waveform, always attempt to play from the new position.
        setCurrentlyPlayingSrc(src); // Ensure this player is the active one.
        
        audio.play().catch(e => {
          console.error("AudioPlayer: Error trying to play post-seek", e);
          // The 'pause' event handler (if triggered by a failed play) 
          // or an explicit error state manager should ideally set isPlaying to false.
          // As a fallback, if an error occurs and it doesn't naturally pause:
          setIsPlaying(false);
          if (currentlyPlayingSrc === src) { // If this player was the one that failed
            setCurrentlyPlayingSrc(null); // Release its claim as current player
          }
        });
        // We rely on the 'play' event listener in useEffect to call setIsPlaying(true).
        // If play() is successful, the 'play' event will fire, updating the UI.
      }
    };

    window.addEventListener('mousemove', handleMouseMove as EventListener);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove as EventListener);
    window.addEventListener('touchend', handleMouseUp);
  };

  // Determine peaks to render (real or default)
  const hasRealWaveformPeaks = waveformPeaks && waveformPeaks.length > 0;
  const peaksForDisplay = hasRealWaveformPeaks 
    ? waveformPeaks.slice(0, Math.min(waveformPeaks.length, STATIC_MAX_BARS)) 
    : DEFAULT_WAVEFORM_PEAKS;
  // Ensure actualPeaksToRender is never empty if we are attempting to display a waveform
  const actualPeaksToRender = peaksForDisplay.length > 0 ? peaksForDisplay : DEFAULT_WAVEFORM_PEAKS;

  return (
    <div className="bg-gray-100 p-3 rounded-lg shadow w-full mx-auto my-2">
      <p className="text-xs text-gray-500 mb-1">Recorded: {formattedDate}</p>
      <audio key={src} ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center space-x-2">
        <button onClick={togglePlayPause} className="text-gray-800 p-1.5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors flex-shrink-0" aria-label={isPlaying ? 'Pause' : 'Play'}>
          {/* Play/Pause SVG icons */}
          {isPlaying ? ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"> <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" /></svg> ) : ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"> <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z" /></svg> )} 
        </button>
        
        <div ref={waveformContainerRef} className="relative flex-grow h-10 bg-transparent cursor-pointer" onMouseDown={handleWaveformMouseDown} onTouchStart={handleWaveformMouseDown}>
          {/* Use the new AudioWaveformDisplay component */}
          <AudioWaveformDisplay 
            peaks={actualPeaksToRender}
            progressPercentage={progressPercentage}
            svgWidth={STATIC_SVG_WIDTH}
            svgHeight={STATIC_SVG_HEIGHT}
            barColor={STATIC_BAR_COLOR}
            backgroundColor={DEFAULT_BACKGROUND_COLOR} // Pass a background color for unplayed part
            clipPathId={clipPathId()}
            minBarAmplitude={MIN_BAR_AMPLITUDE} // Pass MIN_BAR_AMPLITUDE (already defined locally)
            renderAmplificationFactor={RENDER_AMPLIFICATION_FACTOR} // Pass RENDER_AMPLIFICATION_FACTOR
            barCount={actualPeaksToRender.length} // Pass the actual number of bars being rendered
          />
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer; 