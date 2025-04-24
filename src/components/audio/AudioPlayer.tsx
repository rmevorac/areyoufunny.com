"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePlaybackContext } from '@/contexts/PlaybackContext'; // Import the context hook

interface AudioPlayerProps {
  src: string;
  durationMs: number; // Known duration in milliseconds from DB
}

// Keep bar heights array for path generation logic
const waveformBarHeights = [
  4, 8, 12, 16, 20, 18, 14, 10, 6, 10, 14, 18, 20, 16, 12, 8, 
  4, 8, 12, 16, 20, 18, 14, 10, 6, 10, 14, 18, 20, 16, 12, 8,
  4, 8, 12, 16, 20, 18, 14, 10, 6, 10, 14, 18, 20, 16, 12, 8, 
  4, 8, 12, 16, 20, 18, 14, 10, 6, 10, 14, 18, 20, 16, 12, 8 
];

// Function to generate SVG path data from heights
const generatePathData = (heights: number[], maxSvgHeight: number): string => {
  let path = `M 0 ${maxSvgHeight}`; // Start at bottom-left
  heights.forEach((h, i) => {
    const barHeight = Math.max(1, h); // Ensure minimum visible height
    const y = maxSvgHeight - barHeight;
    path += ` M ${i} ${maxSvgHeight}`; 
    path += ` L ${i} ${y}`;        // Line to top-left
    path += ` L ${i + 0.8} ${y}`;  // Line to top-right (0.8 controls bar width)
    path += ` L ${i + 0.8} ${maxSvgHeight}`; // Line down to bottom-right
    path += ` Z`; 
  });
  return path;
};

const SVG_VIEWBOX_HEIGHT = 20; // Max height in SVG coordinate system
const waveformPathData = generatePathData(waveformBarHeights, SVG_VIEWBOX_HEIGHT);

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, durationMs }) => {
  // Get context state and setter
  const { currentlyPlayingSrc, setCurrentlyPlayingSrc } = usePlaybackContext();

  const [isPlaying, setIsPlaying] = useState(false);
  // Initialize duration state directly from the prop (converted to seconds)
  const initialDurationSeconds = Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : null;
  const [duration, setDuration] = useState<number | null>(initialDurationSeconds);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);

  // Effect to pause this player if another one starts playing
  useEffect(() => {
    if (currentlyPlayingSrc && currentlyPlayingSrc !== src && isPlaying) {
      console.log(`AudioPlayer (${src}): Pausing because another player (${currentlyPlayingSrc}) started.`);
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }, [currentlyPlayingSrc, src, isPlaying]);

  // Effect to primarily handle event listeners and potentially update currentTime if needed
  useEffect(() => {
    const audio = audioRef.current;

    // This function is now less critical for setting duration state,
    // but can still log browser-reported duration or handle other metadata.
    const handleMetadata = () => {
      if (!audio) return;
      const browserDuration = audio.duration;
      console.log(`AudioPlayer: Metadata/DurationChange event. Browser duration: ${browserDuration}, Ready state: ${audio.readyState}`);
      // We don't set the duration state here anymore as it comes from props.
      // We could potentially verify if browserDuration roughly matches prop duration if needed.

      // Update current time display if needed (e.g., if audio loaded paused at a non-zero time)
       if (Number.isFinite(audio.currentTime)) {
            setCurrentTime(audio.currentTime);
       }
    };

    if (audio) {
      // Reset playback state when src changes
      setIsPlaying(false);
      // Reset duration based on the potentially new prop value
      const newInitialDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : null;
      setDuration(newInitialDuration);
      setCurrentTime(0); // Reset currentTime

      console.log(`AudioPlayer: Adding event listeners for src: ${src}. Known durationMs: ${durationMs}`);
      audio.addEventListener('loadedmetadata', handleMetadata);
      audio.addEventListener('durationchange', handleMetadata); // Can still log changes
      audio.addEventListener('error', (e) => console.error("Audio Error:", e));

      // Check initial ready state
      console.log(`AudioPlayer: Initial readyState: ${audio.readyState}`);
      if (audio.readyState >= 1) {
          console.log("AudioPlayer: Initial readyState >= 1, calling handleMetadata.");
          handleMetadata();
      }

      return () => {
        console.log(`AudioPlayer: Removing event listeners for src: ${src}`);
        audio.removeEventListener('loadedmetadata', handleMetadata);
        audio.removeEventListener('durationchange', handleMetadata);
        // audio.removeEventListener('error', ...); // Decide if error listener needs removal
      };
    }
  // Depend on durationMs as well, so state resets if the prop changes for the same src (unlikely but safe)
  }, [src, durationMs]);

  // Effect for time updates
  useEffect(() => {
    const audio = audioRef.current;
    const updateCurrentTime = () => {
      if (!isSeeking && audio) {
           const time = audio.currentTime;
           // console.log(`AudioPlayer: timeupdate: ${time}`); // Optional: uncomment for verbose logging
           setCurrentTime(time);
      }
    };
    if (audio) {
      audio.addEventListener('timeupdate', updateCurrentTime);
      return () => audio.removeEventListener('timeupdate', updateCurrentTime);
    }
  }, [isSeeking]); // Re-add listener if seeking state changes

  // Effect for ending playback
  useEffect(() => {
    const audio = audioRef.current;
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      // Optional: Clear the context if this player finishes naturally
      if (currentlyPlayingSrc === src) {
        setCurrentlyPlayingSrc(null);
      }
    };
    if (audio) {
      audio.addEventListener('ended', handleEnded);
      return () => audio.removeEventListener('ended', handleEnded);
    }
  }, [currentlyPlayingSrc, setCurrentlyPlayingSrc, src]); // Add dependencies

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    
    const willPlay = !isPlaying;

    if (willPlay) {
      // *** Notify context that this player is starting ***
      setCurrentlyPlayingSrc(src);
      audioRef.current.play().catch(error => {
          console.error("Error playing audio:", error);
          setIsPlaying(false);
          // If play fails, revoke context claim
          if (currentlyPlayingSrc === src) {
            setCurrentlyPlayingSrc(null);
          }
      });
    } else {
      audioRef.current.pause();
      // If pausing manually, clear context claim only if this was the active player
      if (currentlyPlayingSrc === src) {
          setCurrentlyPlayingSrc(null);
      }
    }
    setIsPlaying(willPlay);
  }, [isPlaying, src, currentlyPlayingSrc, setCurrentlyPlayingSrc]); // Add context dependencies

  const handleSeek = (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement> | globalThis.MouseEvent | globalThis.TouchEvent) => {
    if (!waveformContainerRef.current || duration === null || duration <= 0) return;

    const rect = waveformContainerRef.current.getBoundingClientRect();
    const clientX = 'touches' in event ? (event as React.TouchEvent<HTMLDivElement> | globalThis.TouchEvent).touches[0].clientX : (event as React.MouseEvent<HTMLDivElement> | globalThis.MouseEvent).clientX;
    const offsetX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, offsetX / rect.width));
    const newTime = percentage * duration;
    
    if (audioRef.current) {
        audioRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  const handleWaveformMouseDown = (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      setIsSeeking(true);
      handleSeek(event);

      const handleMouseMove = (moveEvent: globalThis.MouseEvent | globalThis.TouchEvent) => {
        handleSeek(moveEvent);
      };

      const handleMouseUp = () => {
        setIsSeeking(false);
        window.removeEventListener('mousemove', handleMouseMove as EventListener);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleMouseMove as EventListener);
        window.removeEventListener('touchend', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove as EventListener);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove as EventListener);
      window.addEventListener('touchend', handleMouseUp);
  };

  const progressPercentage = (currentTime / (duration ?? 1)) * 100;
  const clipPathId = useCallback(() => `clipPath-${src.replace(/[^a-zA-Z0-9]/g, '')}`, [src]);

  return (
    <div className="bg-gray-100 p-3 rounded-lg shadow w-full mx-auto my-2">
      <audio key={src} ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center space-x-2">
        <button
          onClick={togglePlayPause}
          className="text-gray-800 p-1.5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors flex-shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z" />
            </svg>
          )}
        </button>

        <div
          ref={waveformContainerRef}
          className="relative flex-grow h-10 bg-transparent cursor-pointer"
          onMouseDown={handleWaveformMouseDown}
          onTouchStart={handleWaveformMouseDown}
        >
          <svg 
            width="100%" 
            height="100%" 
            viewBox={`0 0 ${waveformBarHeights.length} ${SVG_VIEWBOX_HEIGHT}`} 
            preserveAspectRatio="none" 
            className="absolute inset-0 pointer-events-none"
          >
            <defs>
              <clipPath id={clipPathId()}>
                <rect x="0" y="0" width={`${Math.min(100, progressPercentage)}%`} height={SVG_VIEWBOX_HEIGHT} />
              </clipPath>
            </defs>

            <path 
              d={waveformPathData}
              fill="#D1D5DB"
            />
            
            <path 
              d={waveformPathData}
              fill="#EF4444"
              clipPath={`url(#${clipPathId()})`}
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer; 