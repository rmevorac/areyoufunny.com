"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePlaybackContext } from '@/contexts/PlaybackContext'; // Import the context hook

interface AudioPlayerProps {
  src: string;
  createdAt: string; // Expecting ISO string or date object string representation
  durationMs: number; // Known duration in milliseconds from DB
}

// Helper function to format time (MM:SS)
const formatTime = (timeInSeconds: number | null): string => {
  // Handle null, NaN, or Infinity
  if (timeInSeconds === null || !Number.isFinite(timeInSeconds)) {
    return '--:--'; // Or '0:00' if preferred for unknown duration
  }
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, createdAt, durationMs }) => {
  // Get context state and setter
  const { currentlyPlayingSrc, setCurrentlyPlayingSrc } = usePlaybackContext();

  const [isPlaying, setIsPlaying] = useState(false);
  // Initialize duration state directly from the prop (converted to seconds)
  const initialDurationSeconds = Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : null;
  const [duration, setDuration] = useState<number | null>(initialDurationSeconds);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLInputElement>(null); // Ref for the progress bar input

  const formattedDate = createdAt ? new Date(createdAt).toLocaleString() : 'Date unavailable';

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

  const handleProgressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(event.target.value);
    setCurrentTime(newTime); // Update UI immediately
  };

  const handleSeekMouseDown = () => {
    setIsSeeking(true); // Indicate user is actively seeking
  };

  const handleSeekMouseUp = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = currentTime; // Set the actual audio time
    }
    setIsSeeking(false);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow w-full mx-auto my-4">
      <p className="text-sm text-gray-400 mb-3">
        Recorded on: {formattedDate}
      </p>
      {/* Hidden audio element */}
      <audio key={src} ref={audioRef} src={src} preload="metadata" />

      {/* Custom Controls */}
      <div className="flex items-center space-x-3">
        <button
          onClick={togglePlayPause}
          className="text-white p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            // Pause Icon (example using SVG or text)
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
            </svg>
          ) : (
            // Play Icon (example using SVG or text)
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z" />
            </svg>
          )}
        </button>

        <span className="text-xs text-gray-400 w-10 text-right">{formatTime(currentTime)}</span>

        <input
          ref={progressBarRef}
          type="range"
          value={currentTime}
          // Use actual duration state (now reliably set from prop)
          // Fallback to 1 only if duration somehow still ends up null (shouldn't happen)
          max={duration ?? 1}
          step="0.01"
          onMouseDown={handleSeekMouseDown}
          onChange={handleProgressChange}
          onMouseUp={handleSeekMouseUp}
          onTouchStart={handleSeekMouseDown} // Add touch events for mobile
          onTouchEnd={handleSeekMouseUp}
          className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          // Disable seeking if the duration isn't known (prop was invalid/missing)
          disabled={duration === null}
          aria-label="Audio progress"
        />

        {/* Display rounded-up duration */}
        <span className="text-xs text-gray-400 w-10">
          {formatTime(duration !== null ? Math.ceil(duration) : null)}
        </span>
      </div>
    </div>
  );
};

export default AudioPlayer; 