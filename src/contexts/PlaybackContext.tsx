"use client";

import React, { createContext, useState, useContext, ReactNode } from 'react';

interface PlaybackContextType {
  currentlyPlayingSrc: string | null;
  setCurrentlyPlayingSrc: (src: string | null) => void;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

export const PlaybackContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentlyPlayingSrc, setCurrentlyPlayingSrc] = useState<string | null>(null);

  const value = {
    currentlyPlayingSrc,
    setCurrentlyPlayingSrc,
  };

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
};

export const usePlaybackContext = (): PlaybackContextType => {
  const context = useContext(PlaybackContext);
  if (context === undefined) {
    throw new Error('usePlaybackContext must be used within a PlaybackContextProvider');
  }
  return context;
}; 