"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import AudioPlayer from '@/components/audio/AudioPlayer';
import { PlaybackContextProvider } from '@/contexts/PlaybackContext';

interface Set {
  id: string;
  created_at: string;
  audio_url: string;
  duration_ms: number;
}

export default function HistoryPage() {
  const [, setUser] = useState<User | null>(null);
  const [sets, setSets] = useState<Set[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);

  useEffect(() => {
    const checkUserAndFetchSets = async () => {
      setLoading(true);
      setError(null);
      setLoginRequired(false);

      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        console.error("User not logged in for history page", userError);
        setUser(null);
        setLoginRequired(true); // Set flag to show specific message
        setLoading(false);
        return;
      }
      
      setUser(currentUser);

      try {
        const { data: setsData, error: setsError } = await supabase
          .from('sets')
          .select('id, created_at, audio_url, duration_ms')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (setsError) {
          throw setsError;
        }

        setSets(setsData || []);
      } catch (err: any) {
        console.error("Error fetching sets:", err);
        setError("Failed to load your past sets. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    checkUserAndFetchSets();
  }, []);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Past Sets</h1>
        <Link href="/" className="text-red-500 hover:underline">
          &larr; Back to Record
        </Link>
      </div>

      {loading && <p>Loading your history...</p>}

      {error && <p className="text-red-500">{error}</p>}

      {loginRequired && (
         <div className="text-center p-8 bg-yellow-900/30 border border-yellow-700 rounded-lg">
             <p className="text-yellow-400 font-semibold mb-2">Login Required</p>
             <p className="text-gray-200">Please go back and start a session to view history.</p>
             {/* Optionally add a button to go back if needed */}
         </div>
      )}

      {!loading && !error && !loginRequired && sets.length === 0 && (
        <p>You haven&apos;t recorded any sets yet.</p>
      )}

      {!loading && !error && !loginRequired && sets.length > 0 && (
        <PlaybackContextProvider>
          <ul className="space-y-4">
            {sets.map((set) => (
              <li key={set.id}>
                <AudioPlayer 
                    src={set.audio_url} 
                    createdAt={set.created_at} 
                    durationMs={set.duration_ms}
                />
              </li>
            ))}
          </ul>
        </PlaybackContextProvider>
      )}
    </div>
  );
} 