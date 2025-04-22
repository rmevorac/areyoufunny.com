"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import RecordingInterface from '@/components/RecordingInterface';
import AudioPlayer from '@/components/AudioPlayer';
import { PlaybackContextProvider } from '@/contexts/PlaybackContext';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';

type AppState = 'idle' | 'recording' | 'uploading' | 'finished' | 'limitReached';

export default function Home() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [user, setUser] = useState<User | null>(null);
  const [lastSetUrl, setLastSetUrl] = useState<string | null>(null);
  const [hasPerformedToday, setHasPerformedToday] = useState(false); 
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSetData, setLastSetData] = useState<{url: string; createdAt: string; durationMs: number} | null>(null);

  const checkDailyLimit = useCallback(async (userId: string) => {
    // Actual implementation:
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    console.log(`Checking for sets created after: ${twentyFourHoursAgo} for user ${userId}`);

    // Use head: true to only get the count, not the full data
    const { error, count } = await supabase
      .from('sets') 
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', twentyFourHoursAgo);

    if (error) {
      console.error('Error checking daily limit:', error);
      // Decide on failure behavior. Failing open might let users record multiple times on error.
      // Failing closed might block users unnecessarily.
      // Let's fail open for now, but log the error.
      return false; 
    }

    console.log(`Found ${count} sets in the last 24 hours.`);
    return (count ?? 0) > 0;
  }, []);

  // Auth effect
  useEffect(() => {
    const setupUser = async () => {
      let currentUser: User | null = null;
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        console.error("Error getting user:", error);
        // Attempt anonymous sign in if no user
        const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
          console.error("Error signing in anonymously:", signInError);
        } else {
          currentUser = signInData?.user ?? null;
          console.log("Signed in anonymously:", currentUser?.id);
        }
      } else if (user) {
        currentUser = user;
        console.log("User already logged in:", currentUser.id);
      } else {
         // Attempt anonymous sign in if no user
        const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
          console.error("Error signing in anonymously:", signInError);
        } else {
          currentUser = signInData?.user ?? null;
          console.log("Signed in anonymously:", currentUser?.id);
        }
      }

      // Set the user state here, but wait for onAuthStateChange to confirm session before checking limit
      setUser(currentUser);

      // REMOVED: Logic to check daily limit here to avoid race condition
      // if (currentUser) {
      //   const limitReached = await checkDailyLimit(currentUser.id);
      //   setHasPerformedToday(limitReached);
      //   if (limitReached) {
      //       setAppState('limitReached');
      //   }
      // }
    };

    setupUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      // Setting user state here is also fine, ensures consistency
      setUser(currentUser);
      console.log('Auth state changed:', _event, currentUser?.id);
      if (currentUser) {
        // --- Daily Limit Check Disabled for Testing ---
        // Check the limit *after* auth state change confirms a user
        // const limitReached = await checkDailyLimit(currentUser.id);
        // setHasPerformedToday(limitReached);
        // Adjust app state based on limit, preserving 'finished' state if already there
        // if (limitReached && appState !== 'finished') {
        //      setAppState('limitReached');
        // } else if (!limitReached && appState === 'limitReached') {
        //      // Reset to idle only if the limit expired *and* we were in the limitReached state
        //      setAppState('idle');
        // }
        // --- End Daily Limit Check Disabled ---
      } else {
        // No user, reset relevant states
        setHasPerformedToday(false); // Still reset this if user logs out
        // Reset to idle if logged out, unless perhaps mid-recording/upload?
        // Consider edge cases here - for now, reset to idle.
        if (appState !== 'recording' && appState !== 'uploading') {
             setAppState('idle');
        }
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const handleStartSet = () => {
    setErrorMessage(null); // Clear errors when starting
    if (!user) {
        console.error("User not authenticated");
        return;
    }
    // --- Daily Limit Check Disabled for Testing ---
    // if (hasPerformedToday) {
    //     setAppState('limitReached');
    //     return;
    // }
    // --- End Daily Limit Check Disabled ---
    // TODO: Add pre-set countdown logic here (e.g., another state)
    setAppState('recording');
  };

  const handleRecordingComplete = async (audioBlob: Blob, durationMs: number) => {
    setErrorMessage(null);
    if (!user) {
        console.error("User not authenticated during upload attempt.");
        setErrorMessage("Authentication error. Please refresh and try again.");
        setAppState('idle');
        return;
    }
    setAppState('uploading');
    console.log(`Uploading audio (${durationMs}ms)...`);

    const fileName = `${user.id}/${new Date().toISOString()}.webm`;
    let publicUrl: string | undefined = undefined;

    try {
        // Upload
        const { data: uploadData, error: uploadError } = await supabase.storage
        .from('recordings') 
        .upload(fileName, audioBlob, {
            cacheControl: '3600',
            upsert: false, 
        });

        if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
        }
        console.log('Upload successful:', uploadData);

        // Get URL
        const { data: urlData } = supabase.storage
            .from('recordings')
            .getPublicUrl(fileName);
        
        publicUrl = urlData?.publicUrl;
        if (!publicUrl) {
            // This case might indicate an issue with storage setup or timing
            // Attempt cleanup if possible
            console.warn("Upload succeeded but failed to get public URL immediately. Attempting cleanup/rollback logic if needed.");
            // await supabase.storage.from('recordings').remove([fileName]); // Optional: attempt to remove the orphaned file
            throw new Error("Failed to retrieve audio URL after upload.");
        }
        console.log('Public URL:', publicUrl);

        // Save metadata USING THE PASSED durationMs
        console.log(`Saving set metadata with duration: ${durationMs}`);
        const { error: dbError } = await supabase
        .from('sets') 
        .insert({
            user_id: user.id,
            audio_url: publicUrl, 
            duration_ms: durationMs // Use the dynamic duration here
        });

        if (dbError) {
            // If DB insert fails, try to clean up the uploaded file
            console.warn("DB insert failed after successful upload. Attempting to remove uploaded file.", dbError);
            // await supabase.storage.from('recordings').remove([fileName]); // Attempt removal
            throw new Error(`Failed to save set details: ${dbError.message}`);
        }

        console.log("Set metadata saved successfully.");
        setLastSetData({ 
            url: publicUrl, 
            createdAt: new Date().toISOString(),
            durationMs: durationMs // Store the dynamic duration for the player
        });
        setAppState('finished');
        setHasPerformedToday(true); // Assuming daily limit logic still applies based on attempt

    } catch (error: any) {
        console.error("Error during recording complete process:", error);
        setErrorMessage(error.message || "An unexpected error occurred during upload.");
        setAppState('idle'); // Revert to idle state on error
        // Consider more specific error states if needed
    }
  };

  const renderContent = () => {
    // Display error message prominently if it exists
    if (errorMessage) {
        return (
            <div className="text-center p-8 bg-red-900/50 border border-red-700 rounded-lg">
                <p className="text-red-400 font-semibold mb-2">Oops! Something went wrong.</p>
                <p className="text-gray-200 mb-4">{errorMessage}</p>
                <button 
                    onClick={() => { 
                        setErrorMessage(null);
                        setAppState('idle'); // Ensure state is reset
                        // Optionally force a reload or specific state reset
                    }} 
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
                >
                    Try Again
                </button>
            </div>
        );
    }

    switch (appState) {
      case 'recording':
        return <RecordingInterface 
                 targetDurationMs={RECORDING_DURATION_MS} 
                 onRecordingComplete={handleRecordingComplete} 
               />;
      case 'uploading':
        return <p className="text-xl">Uploading your set...</p>;
      case 'finished':
        return (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Nice set!</h2>
            <p className="text-lg mb-6">Come back tomorrow to try again.</p>
            {lastSetData?.url && (
                <PlaybackContextProvider>
                    <AudioPlayer 
                        src={lastSetData.url} 
                        createdAt={lastSetData.createdAt} 
                        durationMs={lastSetData.durationMs} 
                    />
                </PlaybackContextProvider>
            )}
            <Link href="/history" className="text-red-500 hover:underline mt-4 inline-block">
                See Past Sets
            </Link>
          </div>
        );
       case 'limitReached':
         return (
           <div className="text-center">
             <h1 className="text-5xl font-bold mb-4">You think you're funny?</h1>
             <p className="text-lg mb-8">
               Test your stand-up with 1 minute on the mic. No crowd, just you
               and your best material. One shot per day.
             </p>
             {/* --- Daily Limit Check Disabled for Testing --- */}
             {/* <p className="text-yellow-500 text-xl">
                You've already performed today. Come back tomorrow!
             </p> */}
             <p className="text-yellow-500 text-xl">
                (Daily limit currently disabled for testing)
             </p>
             {/* --- End Daily Limit Check Disabled --- */}
           </div>
         );
      case 'idle':
      default:
        return (
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-4">You think you're funny?</h1>
            <p className="text-lg mb-8">
              Test your stand-up with 1 minute on the mic. No crowd, just you
              and your best material. One shot per day.
            </p>
            <button
              onClick={handleStartSet}
              disabled={!user} // Disable if user is not loaded yet
              className={`px-8 py-3 text-lg font-semibold rounded-md transition-colors duration-200 ${ 
                !user 
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                  : 'bg-red-600 hover:bg-red-700 text-white' 
              }`}
            >
              {!user ? 'Loading...' : 'Start Your Set'}
            </button>
          </div>
        );
    }
  };

  const RECORDING_DURATION_MS = 60000; // Keep this constant here for now as the *target*

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-24">
      {/* Add History Button Top Right */}
      <div className="absolute top-4 right-4">
          <Link href="/history" className="text-black hover:underline">
              View History
          </Link>
      </div>
      {renderContent()}
    </main>
  );
}
