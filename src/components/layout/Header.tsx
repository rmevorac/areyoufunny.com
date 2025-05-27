'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

interface ProfileWithScore {
  username: string;
  pop_score: number;
  // is_eighteen_or_older: boolean; // Add if you select and use it from the view
}

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileWithScore | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const initialAuthEventReceived = useRef(false);

  const fetchProfileAndScore = useCallback(async (userId: string) => {
    console.log(`Header: fetchProfileAndScore called for userId: ${userId}`);
    setProfile(null);
    try {
      const { data, error } = await supabase
        .from('user_profile_with_score')
        .select('username, pop_score')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Header: Supabase error fetching profile with score:', error.message);
      } else if (data) {
        console.log('Header: Profile data fetched:', data);
        setProfile(data as ProfileWithScore);
      } else {
        console.log(`Header: No profile found for user ID: ${userId} (data was null).`);
      }
    } catch (e: unknown) {
      let errorMessage = 'Exception caught in fetchProfileAndScore';
      let errorStack = undefined;
      if (e instanceof Error) {
        errorMessage = e.message;
        errorStack = e.stack;
      }
      console.error('Header: Exception caught in fetchProfileAndScore:', errorMessage, errorStack);
    } finally {
      console.log('Header: fetchProfileAndScore finished (finally block executed).');
    }
  }, []);

  useEffect(() => {
    console.log("Header: useEffect initiated. Setting authLoading true, initialAuthEventReceived false.");
    setAuthLoading(true);
    initialAuthEventReceived.current = false;

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Header: onAuthStateChange event:', event, { session });
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (!initialAuthEventReceived.current) {
        console.log("Header: First onAuthStateChange event received. Setting authLoading to false.");
        setAuthLoading(false);
        initialAuthEventReceived.current = true;
      } else {
        console.log("Header: Subsequent onAuthStateChange event received.");
      }

      if (currentUser) {
        console.log('Header: User session identified by onAuthStateChange, calling fetchProfileAndScore.');
        fetchProfileAndScore(currentUser.id);
      } else {
        console.log('Header: No user session identified by onAuthStateChange, clearing profile.');
        setProfile(null);
      }
    });

    return () => {
      console.log('Header: Unsubscribing auth listener');
      authListener?.subscription?.unsubscribe();
    };
  }, [fetchProfileAndScore]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error.message);
    } else {
      router.push('/login'); 
      router.refresh(); 
    }
  };

  if (authLoading) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 bg-white text-gray-700 p-4 flex justify-between items-center shadow-sm">
        <Link href="/" className="text-xl font-bold text-red-600 hover:text-red-700">
          areufunny.com
        </Link>
        <div className="text-sm text-gray-500">Loading user...</div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white text-gray-700 p-4 flex justify-between items-center shadow-sm">
      <Link href="/" className="text-xl font-bold text-red-600 hover:text-red-700">
        areufunny.com
      </Link>
      <div className="text-sm">
        {user && profile ? (
          <div className="flex flex-col items-end">
            <div className="text-right">
              <p className="text-gray-600">{profile.username}</p>
              <p className="text-gray-600">Pop Score: {profile.pop_score ?? 0}</p>
            </div>
            <button
              onClick={handleLogout}
              className="mt-1 bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
            >
              Logout
            </button>
          </div>
        ) : (
          <Link href="/login" className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-opacity-50">
            Log In
          </Link>
        )}
      </div>
    </header>
  );
} 