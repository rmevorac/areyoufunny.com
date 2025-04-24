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
  // Observer target ref is not used internally here anymore
  // const observerTarget = useRef<HTMLDivElement>(null);

  return (
    <div>
      {/* Loading/Error Indicators - Adjust text colors */}
      {showInitialLoadIndicator && <p className="text-center text-gray-600 py-4">Loading feed...</p>}
      {feedError && <p className="text-center text-red-600 py-4">{feedError}</p>}
      
      {/* Feed List Content */} 
      {sets.length > 0 && !feedError && (
          <PlaybackContextProvider>
              <ul className="space-y-4">
                  {sets.map((set) => (
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
      {!showInitialLoadIndicator && !feedError && sets.length === 0 && (
         <p className="text-center text-gray-700 py-4">No sets found for this category.</p>
      )}

      {/* More Loading / End of list indicators - Adjust text colors */} 
      {showMoreLoadIndicator && <p className="text-center text-gray-600 py-4">Loading more...</p>}
      {!hasMore && !showInitialLoadIndicator && !showMoreLoadIndicator && sets.length > 0 && <p className="text-center text-gray-700 py-4">No more sets.</p>}
    </div>
  );
};

export default FeedList; 