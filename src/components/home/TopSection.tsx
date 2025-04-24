"use client";

import React from 'react';
import { User } from '@supabase/supabase-js';
import RecordingInterface from '@/components/recording/RecordingInterface';
import AudioPlayer from '@/components/audio/AudioPlayer';
import Button from '@/components/ui/Button';
import { PlaybackContextProvider } from '@/contexts/PlaybackContext';

// Re-declare types needed within this component
type AppState = 'idle' | 'recording' | 'uploading' | 'finished' | 'limitReached';
type LastSetData = {
    id: string;
    url: string; 
    createdAt: string; 
    durationMs: number;
    fileName: string; 
    isPosted?: boolean; // Added optional flag
} | null;

interface TopSectionProps {
  appState: AppState;
  user: User | null;
  lastSetData: LastSetData;
  errorMessage: string | null;
  showUploadingIndicator: boolean;
  onStartSet: () => void;
  onRecordingComplete: (blob: Blob, durationMs: number) => void;
  onCancelCountdown: () => void;
  onPostSet: () => void;
  onScratchSet: () => void;
  isSubmittingPostOrScratch: boolean;
}

const TopSection: React.FC<TopSectionProps> = ({
  appState,
  user,
  lastSetData,
  errorMessage,
  showUploadingIndicator,
  onStartSet,
  onRecordingComplete,
  onCancelCountdown,
  onPostSet,
  onScratchSet,
  isSubmittingPostOrScratch,
}) => {

  // Internal constant, assuming 60s for now, could be passed as prop later
  const RECORDING_DURATION_MS = 60000; 

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
                targetDurationMs={RECORDING_DURATION_MS} 
                onRecordingComplete={onRecordingComplete} 
                onCancelCountdown={onCancelCountdown}
              />;
              
    case 'uploading':
      return showUploadingIndicator ? <p className="text-xl">Uploading your set...</p> : null;
      
    case 'finished':
      if (!lastSetData) {
        return <p>Loading details...</p>; 
      }
      return (
        <div className="text-center w-full max-w-xl mx-auto flex flex-col items-center space-y-4">
          <h2 className="text-2xl font-semibold mb-2">Set Recorded!</h2>
          
          <div className="w-full">
              <PlaybackContextProvider>
                  <AudioPlayer 
                      src={lastSetData.url} 
                      createdAt={lastSetData.createdAt} 
                      durationMs={lastSetData.durationMs}
                  />
              </PlaybackContextProvider>
          </div>

          <div className="flex space-x-4 mt-4">
              <Button 
                onClick={onPostSet}
                disabled={isSubmittingPostOrScratch || lastSetData.isPosted}
                variant="primary"
              >
                {lastSetData.isPosted ? "Posted!" : "Post to Feed"} 
              </Button>
              <Button 
                onClick={onScratchSet}
                disabled={isSubmittingPostOrScratch}
                variant="secondary"
              >
                Scratch It
              </Button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
              Posting makes your set public. Scratching deletes it and lets you re-record immediately.
          </p>
        </div>
      );
      
    case 'limitReached':
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
          <p className="text-yellow-600 text-xl">
              (Daily limit currently disabled for testing)
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
            {!user ? 'Loading...' : 'Start Your Set'}
          </Button>
        </div>
      );
  }
};

export default TopSection; 