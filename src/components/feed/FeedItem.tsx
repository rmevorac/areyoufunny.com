"use client";

import React from 'react';
import AudioPlayer from '@/components/audio/AudioPlayer';
import { User } from '@supabase/supabase-js'; // Import User type if not already
// import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';

// Define type for a single set item (matching page.tsx FeedSet)
// Re-declare or import if shared
interface FeedSet {
  id: string;
  audio_url: string;
  created_at: string;
  duration_ms: number;
  up_votes: number;
  down_votes: number;
  user_id: string; // User who posted the set
  username?: string; // Username of the user who posted the set
  user_vote: 1 | -1 | null; // Current logged-in user's vote on this set
  waveform_peaks: number[] | null;
}

// Helper (can be moved to a utils file)
const formatUserId = (userId: string | undefined): string => {
  if (!userId) return "Anon #????";
  return `Anon #${userId.substring(0, 4).toUpperCase()}`;
};

interface FeedItemProps {
  set: FeedSet;
  handleVote: (setId: string, voteValue: 1 | -1) => void;
  currentUser: User | null;
}

const FeedItem: React.FC<FeedItemProps> = ({ set, handleVote, currentUser }) => {
  // Enhanced Diagnostic Log
  console.log(
    `FeedItem RENDER - ID: ${set.id}, ` +
    `Received user_vote: ${set.user_vote}, ` +
    `Received Up: ${set.up_votes}, Received Down: ${set.down_votes}, ` +
    `currentUser: ${currentUser ? currentUser.id : 'null'}`
  );

  const score = set.up_votes - set.down_votes;
  const isUpvoted = set.user_vote === 1;
  const isDownvoted = set.user_vote === -1;

  const upvoteButtonClasses = `p-1 rounded disabled:opacity-50 text-xl ${
    isUpvoted 
      ? 'bg-green-100 text-green-600' 
      : 'text-gray-500 hover:bg-green-50 hover:text-green-600'
  }`;

  const downvoteButtonClasses = `p-1 rounded disabled:opacity-50 text-xl ${
    isDownvoted
      ? 'bg-red-100 text-red-600'
      : 'text-gray-500 hover:bg-red-50 hover:text-red-600'
  }`;

  const displayUsername = set.username || formatUserId(set.user_id);

  return (
    <li className="bg-white border border-gray-200 p-3 rounded-lg shadow flex justify-between items-center gap-4">
      
      {/* Left Section: Stack Player and User ID Vertically */}
      <div className="flex flex-col flex-grow min-w-0">
          {/* Player Wrapper - Use w-full */} 
          <div className="w-full"> 
              <AudioPlayer 
                  src={set.audio_url} 
                  createdAt={set.created_at} 
                  durationMs={set.duration_ms}
                  waveformPeaks={set.waveform_peaks}
              />
          </div>
          {/* User Info - Below player, remove flex properties, add margin */}
          <div className="mt-1"> 
            <p className="text-xs font-medium text-gray-600"> {/* Adjusted size/color */} 
              {displayUsername}
            </p>
           </div>
      </div>
      
      {/* Right Section: Vertical Votes */}
      <div className="flex flex-col items-center space-y-1 flex-shrink-0">
          <button 
              onClick={() => handleVote(set.id, 1)} 
              className={upvoteButtonClasses}
              title="Upvote (Celebrate!)"
              aria-label="Upvote (Celebrate!)"
              disabled={!currentUser}
          >
              <span role="img" aria-label="Party Popper">🎉</span>
          </button>
          <span className="text-sm font-bold text-gray-900 min-w-[30px] text-center" title={`Score: ${score}`}>
              {score} 
          </span>
          <button 
              onClick={() => handleVote(set.id, -1)}
              className={downvoteButtonClasses}
              title="Downvote (Bomb)" 
              aria-label="Downvote (Bomb)"
              disabled={!currentUser}
          >
              <span role="img" aria-label="Bomb">💣</span>
          </button>
      </div>
    </li>
  );
};

export default FeedItem; 