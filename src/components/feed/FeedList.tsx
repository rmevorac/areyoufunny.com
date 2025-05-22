"use client";

import React from 'react';
import FeedItem from './FeedItem'; // Import FeedItem
import { PlaybackContextProvider } from '@/contexts/PlaybackContext';
import { User } from '@supabase/supabase-js'; // Import User type

// Re-declare or import FeedSet type
type FeedSet = {
  id: string;
  created_at: string;
  audio_url: string;
  duration_ms: number;
  user_id: string;
  up_votes: number;
  down_votes: number;
  user_vote: 1 | -1 | null; 
  waveform_peaks: number[] | null;
};

interface FeedListProps {
  sets: FeedSet[];
  handleVote: (setId: string, voteValue: 1 | -1) => void;
  currentUser: User | null; // Use specific type for currentUser
  showInitialLoadIndicator: boolean;
  showMoreLoadIndicator: boolean;
  feedError: string | null;
  hasMore: boolean;
}

const FeedList: React.FC<FeedListProps> = ({
  sets,
  handleVote,
  currentUser,
  showInitialLoadIndicator,
  showMoreLoadIndicator,
  feedError,
  hasMore
}) => {
  // Create a new array with unique sets based on id to prevent React key errors
  const uniqueSetsMap = new Map<string, FeedSet>();
  sets.forEach(set => {
    if (!uniqueSetsMap.has(set.id)) {
      uniqueSetsMap.set(set.id, set);
    } else {
      // This log is important! It means the parent (page.tsx) is still sending duplicates.
      console.warn(`FeedList.tsx: Duplicate set ID received and will be filtered: ${set.id}. Original sets prop length: ${sets.length}`);
    }
  });
  const uniqueSets = Array.from(uniqueSetsMap.values());

  if (sets.length > 0 && sets.length !== uniqueSets.length) {
      console.warn(`FeedList.tsx: Rendered ${uniqueSets.length} unique sets out of ${sets.length} received due to duplicate IDs in props.`);
  }

  return (
    <div>
      {/* Loading/Error Indicators - Adjust text colors */}
      {showInitialLoadIndicator && <p className="text-center text-gray-600 py-4">Loading feed...</p>}
      {feedError && <p className="text-center text-red-600 py-4">{feedError}</p>}
      
      {/* Feed List Content */} 
      {uniqueSets.length > 0 && !feedError && (
          <PlaybackContextProvider>
              <ul className="space-y-4">
                  {uniqueSets.map((set) => (
                      <FeedItem 
                          key={set.id} 
                          set={set} 
                          handleVote={handleVote} 
                          currentUser={currentUser}
                      />
                  ))}
              </ul>
          </PlaybackContextProvider>
      )}
      
      {/* No sets message - Adjust text color */}
      {!showInitialLoadIndicator && !feedError && uniqueSets.length === 0 && (
         <p className="text-center text-gray-700 py-4">No sets found for this category.</p>
      )}

      {/* More Loading / End of list indicators - Adjust text colors */} 
      {showMoreLoadIndicator && <p className="text-center text-gray-600 py-4">Loading more...</p>}
      {!hasMore && !showInitialLoadIndicator && !showMoreLoadIndicator && uniqueSets.length > 0 && <p className="text-center text-gray-700 py-4">No more sets.</p>}
    </div>
  );
};

export default FeedList; 