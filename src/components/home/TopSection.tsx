"use client";

import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import RecordingInterface from '@/components/recording/RecordingInterface';
import AudioPlayer from '@/components/audio/AudioPlayer';
import Button from '@/components/ui/Button';
import { PlaybackContextProvider } from '@/contexts/PlaybackContext';
import type { AppState } from '@/app/page';

interface TopSectionProps {
  appState: AppState; // This will now use the imported AppState
  user: User | null;
  errorMessage: string | null;
  showUploadingIndicator: boolean;
  onStartSet: () => void;
  onRecordingComplete: (blob: Blob, durationMs: number, waveformPeaks: number[]) => void;
  onCancelCountdown: () => void;
  nextPostAvailableAtUTC?: string | null;
}

// Helper function to format remaining time
const formatTimeLeft = (timeLeftMs: number): string => {
  if (timeLeftMs <= 0) return "00:00:00";
  const totalSeconds = Math.floor(timeLeftMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const TopSection: React.FC<TopSectionProps> = ({
  appState,
  user,
  errorMessage,
  showUploadingIndicator,
  onStartSet,
  onRecordingComplete,
  onCancelCountdown,
  nextPostAvailableAtUTC,
}) => {
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (appState === 'limitReached' && nextPostAvailableAtUTC) {
      const calculateTimeLeft = () => {
        const now = new Date().getTime();
        const nextPostTime = new Date(nextPostAvailableAtUTC).getTime();
        const timeLeft = nextPostTime - now;

        if (timeLeft <= 0) {
          setCountdown("It should be your time to shine again soon!");
          if (intervalId) clearInterval(intervalId);
        } else {
          setCountdown(formatTimeLeft(timeLeft));
        }
      };

      calculateTimeLeft();
      intervalId = setInterval(calculateTimeLeft, 1000);
    } else {
      setCountdown("");
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [appState, nextPostAvailableAtUTC]);

  // Display error message prominently if it exists
  if (errorMessage) {
    return (
      <div className="text-center p-8 bg-red-100 border border-red-300 rounded-lg w-full max-w-md">
        <p className="text-red-700 font-semibold mb-2">Oops! Something went wrong.</p>
        <p className="text-gray-700 mb-4">{errorMessage}</p>
      </div>
    );
  }

  // Render based on App State
  switch (appState) {
    case 'recording':
      return <RecordingInterface 
                targetDurationMs={60000} 
                onRecordingComplete={onRecordingComplete} 
                onCancelCountdown={onCancelCountdown}
              />;
              
    case 'uploading':
      return showUploadingIndicator ? <p className="text-xl">Uploading & Posting your set...</p> : null;
      
    case 'limitReached':
      return (
        <div className="text-center w-full pt-16">
          <h1 className="text-5xl font-bold mb-4">Patience, Grasshopper!</h1>
          <p className="text-lg text-gray-600 mb-2">
            You&apos;ve dropped your mic for today.
          </p>
          {countdown ? (
            <p className="text-2xl text-red-600 font-mono my-4">
              Next set in: {countdown}
            </p>
          ) : (
            <p className="text-xl text-gray-700 font-semibold my-4">
              Come back tomorrow for another go!
            </p>
          )}
          <p className="text-sm text-gray-500">
            (Daily limit resets at midnight UTC)
          </p>
        </div>
      );
      
    case 'idle':
    default:
      return (
        <div className="text-center w-full pt-16">
          <h1 className="text-5xl font-bold mb-4">You think you&apos;re funny?</h1>
          <p className="text-lg text-gray-600 mb-2">
            Test your stand-up with 1 minute on the mic. No crowd, just you
            and your best material.
          </p>
          <p className="text-lg text-gray-600 mb-8">
            One shot per day.
          </p>
          <Button
            onClick={onStartSet}
            disabled={!user} 
            variant={!user ? 'secondary' : 'primary'}
            className={`${!user ? 'cursor-not-allowed' : '' }`}
          >
            {/* Consider changing button text if !user means "not logged in" vs. "user state still loading" */}
            {/* For instance, if user is definitively null (not just loading), a more direct CTA like "Login to Start" might be clearer */}
            {/* However, current onStartSet logic handles redirecting, so this is a minor UX note */}
            {!user ? 'Loading...' : 'Start Your Set'}
          </Button>
        </div>
      );
  }
};

export default TopSection; 