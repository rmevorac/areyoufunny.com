"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { PlaybackContextProvider } from '@/contexts/PlaybackContext';
import { User } from '@supabase/supabase-js';
import TopSection from '@/components/home/TopSection';
import FeedTabs from '@/components/feed/FeedTabs';
import FeedList from '@/components/feed/FeedList';

// Define types for the feed data and tabs
type FeedSet = {
  id: string;
  created_at: string;
  audio_url: string;
  duration_ms: number;
  user_id: string;
  up_votes: number;
  down_votes: number;
  user_vote: 1 | -1 | null; // User's vote status (1=up, -1=down, null=none)
};

type ActiveTab = 'Top' | 'Worst' | 'New';

type AppState = 'idle' | 'recording' | 'uploading' | 'finished' | 'limitReached';

// Update LastSetData type
type LastSetData = {id: string; url: string; createdAt: string; durationMs: number; fileName: string} | null;

const PAGE_LIMIT = 10;
const LOADING_DELAY_MS = 2000; // 2-second delay

export default function Home() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [user, setUser] = useState<User | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSetData, setLastSetData] = useState<LastSetData>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // To disable buttons
  
  // Feed State
  const [activeTab, setActiveTab] = useState<ActiveTab>('Top');
  const [feedSets, setFeedSets] = useState<FeedSet[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [showInitialLoadIndicator, setShowInitialLoadIndicator] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showMoreLoadIndicator, setShowMoreLoadIndicator] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  // Add back offset state declaration
  const [offset, setOffset] = useState(0);
  
  // Restore useRef for loadingMoreRef
  const loadingMoreRef = useRef(false); // Prevent multiple pagination fetches
  
  // Delayed Loading Indicators State
  const initialLoadTimerRef = useRef<NodeJS.Timeout | null>(null); 
  const moreLoadTimerRef = useRef<NodeJS.Timeout | null>(null); 

  // Delayed Uploading Indicator State
  const [showUploadingIndicator, setShowUploadingIndicator] = useState(false);
  const uploadingTimerRef = useRef<NodeJS.Timeout | null>(null); 

  // Intersection Observer Target
  const observerTarget = useRef<HTMLDivElement>(null); 

  // Tab Slider State
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Auth effect
  useEffect(() => {
    const setupUser = async () => {
      let currentUser: User | null = null;
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        console.error("Error getting user:", error);
        const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
          console.error("Error signing in anonymously:", signInError);
        } else {
          currentUser = signInData?.user ?? null;
        }
      } else if (user) {
        currentUser = user;
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
          console.error("Error signing in anonymously:", signInError);
        } else {
          currentUser = signInData?.user ?? null;
        }
      }
      setUser(currentUser);
    };

    setupUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (!currentUser) {
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
    setErrorMessage(null); 
    if (!user) {
        console.error("User not authenticated");
        setErrorMessage("Not logged in. Please wait or refresh."); // User-friendly message
        return;
    }
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
    if (uploadingTimerRef.current) clearTimeout(uploadingTimerRef.current);
    uploadingTimerRef.current = setTimeout(() => setShowUploadingIndicator(true), 500); 

    // Store fileName for potential scratch operation
    const fileName = `${user.id}/${new Date().toISOString()}.webm`;
    let publicUrl: string | undefined = undefined;
    let insertedSetId: string | undefined = undefined;
    let insertedCreatedAt: string | undefined = undefined;

    try {
        // Upload
        const { error: uploadError } = await supabase.storage
        .from('recordings') 
        .upload(fileName, audioBlob, { cacheControl: '3600', upsert: false });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        // Get URL
      const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(fileName);
        publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error("Failed to retrieve audio URL after upload.");

      // Save metadata (defaults is_public to false in DB)
      const { data: insertData, error: dbError } = await supabase
        .from('sets') 
        .insert({
            user_id: user.id,
            audio_url: publicUrl, 
          duration_ms: durationMs, 
          // is_public defaults to false in DB schema
        })
        .select('id, created_at') // Select ID and created_at
        .single(); // Ensure we get the single inserted row back

      if (dbError) {
        console.error("Database insert failed after upload. Attempting cleanup:", dbError);
        await supabase.storage.from('recordings').remove([fileName]); // Attempt cleanup
        throw new Error(`Database error: ${dbError.message}`);
      }

      // Store details needed for post/scratch
      insertedSetId = insertData?.id;
      insertedCreatedAt = insertData?.created_at;
      if (!insertedSetId) {
          throw new Error("Failed to get ID of inserted set.");
      }
        
      // Update state after successful upload and DB insert
      setLastSetData({ 
          id: insertedSetId, 
          url: publicUrl, 
          createdAt: insertedCreatedAt ?? new Date().toISOString(), 
          durationMs: durationMs, 
          fileName: fileName // Store the filename
      }); 
      setAppState('finished');

      // Optionally, refresh the 'New' feed if it's active?
      if (activeTab === 'New') {
          fetchFeed(true); // Force refresh
      }

    } catch (error) {
      console.error("Error during upload/DB insert:", error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Upload failed: ${message}`);
      setAppState('idle'); 
    } finally {
      if (uploadingTimerRef.current) clearTimeout(uploadingTimerRef.current);
      setShowUploadingIndicator(false);
    }
  };

  // fetchFeed function - Modified for delayed indicators
  const fetchFeed = useCallback(async (refresh = false) => {
    // Clear previous timers
    if (initialLoadTimerRef.current) clearTimeout(initialLoadTimerRef.current);
    if (moreLoadTimerRef.current) clearTimeout(moreLoadTimerRef.current);
    setShowInitialLoadIndicator(false); // Ensure indicators are hidden initially
    setShowMoreLoadIndicator(false);

    let currentOffset = offset;
    if (refresh) {
      console.log("Fetching feed with refresh=true");
      setIsLoadingFeed(true); // Set initial loading state
      setFeedSets([]); // Clear existing sets for new tab/refresh
      setOffset(0);
      currentOffset = 0; // Use 0 for the fetch call
      setHasMore(true); 
      setFeedError(null);
      // Start timer for initial load indicator
      initialLoadTimerRef.current = setTimeout(() => {
          console.log("Initial load timer fired");
          setShowInitialLoadIndicator(true); 
      }, LOADING_DELAY_MS);
    } else {
        // This is pagination
        if (loadingMoreRef.current || !hasMore) return; // Exit if already loading more or no more pages
        console.log("Fetching more feed items (pagination)");
        loadingMoreRef.current = true;
        setIsLoadingMore(true); // Set pagination loading state
        // Start timer for pagination load indicator
        moreLoadTimerRef.current = setTimeout(() => {
            console.log("More load timer fired");
            setShowMoreLoadIndicator(true); 
        }, LOADING_DELAY_MS);
    }

    console.log(`Fetching sets for tab: ${activeTab}, offset: ${currentOffset}, limit: ${PAGE_LIMIT}`);

    try {
      const { data, error } = await supabase.rpc('get_feed_sets', { 
         p_tab: activeTab,
          p_limit: PAGE_LIMIT + 1, // Fetch one extra to check if more exist
          p_offset: currentOffset
      });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
          const hasMoreItems = data.length > PAGE_LIMIT;
          setHasMore(hasMoreItems);
          const setsToAdd = hasMoreItems ? data.slice(0, PAGE_LIMIT) : data;
          
          setFeedSets(prevSets => currentOffset === 0 ? setsToAdd : [...prevSets, ...setsToAdd]);
          if (currentOffset === 0) { // Update offset only after initial load completes
              setOffset(setsToAdd.length); 
          } else {
              setOffset(prevOffset => prevOffset + setsToAdd.length); // Update offset for pagination
          }
      } else {
          setHasMore(false); // No data returned means no more pages
          if (currentOffset === 0) {
              setFeedSets([]); // Ensure sets are empty if first fetch returns nothing
          }
      }
    } catch (error) {
      console.error(`Error fetching ${activeTab} sets:`, error);
      setErrorMessage(`Failed to load sets. Please try again.`);
      setHasMore(false); 
    } finally {
       // Clear relevant timer and hide indicator
       if (refresh) {
           if (initialLoadTimerRef.current) clearTimeout(initialLoadTimerRef.current);
           setShowInitialLoadIndicator(false);
           setIsLoadingFeed(false); // Clear initial loading state
       } else {
           if (moreLoadTimerRef.current) clearTimeout(moreLoadTimerRef.current);
           setShowMoreLoadIndicator(false);
           setIsLoadingMore(false); // Clear pagination loading state
           loadingMoreRef.current = false; // Allow next pagination fetch
       }
    }
  // Include user? Not needed for RPC, but offset/activeTab are key
  }, [activeTab, offset, hasMore]); // Add offset and hasMore dependencies

  // Effect to fetch feed on mount and tab change 
  useEffect(() => {
    fetchFeed(true); // Initial fetch (refresh=true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]); // Re-run only when activeTab changes

  // handleVote function (keep as is)
  const handleVote = async (setId: string, voteValue: 1 | -1) => {
    const currentUser = user;
    if (!currentUser) {
        console.error("User not available for voting.");
        return;
    }

    // Find the current state of the set locally for optimistic update
    const currentSetIndex = feedSets.findIndex(s => s.id === setId);
    if (currentSetIndex === -1) return; // Should not happen
    const currentSet = feedSets[currentSetIndex];
    const currentUserVote = currentSet.user_vote;

    console.log(`Attempting vote: set=${setId}, user=${currentUser.id}, value=${voteValue}, currentVote=${currentUserVote}`);

    // --- New Optimistic UI Update Logic ---
    let optimisticUpVotes = currentSet.up_votes;
    let optimisticDownVotes = currentSet.down_votes;
    let optimisticUserVote: 1 | -1 | null = currentUserVote;

    if (currentUserVote === voteValue) { 
      // Unvoting
      optimisticUserVote = null;
      if (voteValue === 1) optimisticUpVotes--;
      else optimisticDownVotes--;
    } else { 
      // New vote or changing vote
      optimisticUserVote = voteValue;
      if (voteValue === 1) optimisticUpVotes++;
      else optimisticDownVotes++;
      // If changing vote, decrement the previous vote count
      if (currentUserVote === 1) optimisticUpVotes--;
      if (currentUserVote === -1) optimisticDownVotes--;
    }

    const optimisticSet = { 
        ...currentSet, 
        up_votes: Math.max(0, optimisticUpVotes), // Ensure counts don't go below 0
        down_votes: Math.max(0, optimisticDownVotes),
        user_vote: optimisticUserVote
    };

    // Update local state
    setFeedSets(currentSets => [
        ...currentSets.slice(0, currentSetIndex),
        optimisticSet,
        ...currentSets.slice(currentSetIndex + 1)
    ]);
    // --- End Optimistic UI Update ---

    try {
        // Call the NEW RPC function
        const { data, error } = await supabase.rpc('handle_vote', { 
            set_id_input: setId, 
            vote_value_input: voteValue 
        });

        if (error) {
            console.error("Error calling vote RPC:", error);
            throw error; // Let catch block handle it
        }

        // --- Sync with RPC result --- 
        // The RPC returns the guaranteed final state
        if (data && data.length > 0) {
            const finalState = data[0];
            console.log(`Vote RPC successful for set ${setId}. Final state:`, finalState);
            const syncedSet = { 
                ...currentSet, // Use currentSet as base, RPC only returns counts/vote
                up_votes: finalState.new_up_votes,
                down_votes: finalState.new_down_votes,
                user_vote: finalState.user_vote_value
            };
            setFeedSets(currentSets => currentSets.map(s => s.id === setId ? syncedSet : s));
        } else {
             console.warn("Vote RPC did not return expected data. Refetching for safety.");
             fetchFeed(false); // Fallback to refetch if RPC return is unexpected
        }
        // --- End Sync --- 
        
    } catch (error) {
        console.error("Vote failed:", error);
        setFeedError("Vote failed. Please try again."); 
        fetchFeed(false);
    }
  };

  // Callback for Intersection Observer
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      // Trigger fetch only when intersecting, more exist, and not already loading more
      if (target.isIntersecting && hasMore && !isLoadingMore && !loadingMoreRef.current) {
          console.log("Observer triggered, calling fetchFeed(false)");
          fetchFeed(false); // Call fetchFeed for pagination
      }
  }, [fetchFeed, hasMore, isLoadingMore]); // Dependencies updated

  // Effect for Intersection Observer setup (keep as is)
  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, { threshold: 1.0 });
    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }
    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [handleObserver, observerTarget]); 

  // handleTabChange function - Simplified, just sets tab, effect handles fetch
  const handleTabChange = (tab: ActiveTab) => {
    if (tab !== activeTab) {
        console.log("Tab changed to:", tab);
        setActiveTab(tab);
        // No need to manually reset state here, the useEffect[activeTab] handles it via fetchFeed(true)
    }
  };

  // Effect for Tab Slider Position (keep as is)
  useEffect(() => {
    const activeTabIndex = ['Top', 'Worst', 'New'].indexOf(activeTab);
    const activeTabElement = tabsRef.current[activeTabIndex];
    const containerElement = tabsContainerRef.current;

    if (activeTabElement && containerElement) {
        const containerRect = containerElement.getBoundingClientRect();
        const tabRect = activeTabElement.getBoundingClientRect();
        
        // Calculate left relative to the container
        const left = tabRect.left - containerRect.left;
        const width = tabRect.width;

        console.log(`Slider update: left=${left}, width=${width}`);
        setSliderStyle({ left, width });
    }
  // Depend on activeTab and potentially feedSets if list loading changes layout significantly (less likely here)
  }, [activeTab]); 

  const handleCancelCountdown = () => {
    console.log("Countdown cancelled by user.");
    setAppState('idle'); // Go back to idle state
  };

  const handlePostSet = async () => {
    if (!lastSetData || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    console.log(`Posting set ID: ${lastSetData.id}`);

    try {
      const { error } = await supabase
        .from('sets')
        .update({ is_public: true })
        .eq('id', lastSetData.id);

      if (error) {
        throw error;
      }

      console.log(`Set ${lastSetData.id} successfully posted.`);
      // Optionally update UI further, e.g., show a persistent success message
      // or change appState? For now, keep appState as 'finished'
      // but maybe disable the 'Post' button after success.
      // We can add a new field to lastSetData like `isPosted: true` if needed.
      alert("Set posted successfully!"); // Simple feedback for now
      // How to disable button? We can modify lastSetData state, or add another state.
      // Simplest for now might be to clear lastSetData so buttons disappear,
      // though this prevents further scratching. Let's keep it for now.

    } catch (error) {
      console.error("Error posting set:", error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Failed to post set. Please try again: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScratchSet = async () => {
    if (!lastSetData || isSubmitting) return;

    setIsSubmitting(true);
                        setErrorMessage(null);
    console.log(`Scratching set ID: ${lastSetData.id} (Database record only)`);

    try {
      // Only delete the record from the database
      const { error: dbError } = await supabase
        .from('sets')
        .delete()
        .eq('id', lastSetData.id);

      if (dbError) {
        throw new Error(`Database delete failed: ${dbError.message}`);
      }

      console.log(`Set ${lastSetData.id} database record successfully scratched.`);
      // Reset state to allow re-recording
      setAppState('idle');
      setLastSetData(null);

    } catch (error) {
      console.error("Error scratching set database record:", error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Failed to scratch set: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamic classes for the main container
  const mainContainerClasses = `flex flex-col items-center min-h-screen bg-white text-gray-900 p-4 md:p-8 ${
    (appState === 'recording' || appState === 'uploading') ? 'justify-center' : '' 
  }`;

  return (
    <PlaybackContextProvider> 
      {/* Apply dynamic classes */}
      <div className={mainContainerClasses}>
        <TopSection 
          appState={appState}
          user={user}
          lastSetData={lastSetData}
          errorMessage={errorMessage}
          showUploadingIndicator={showUploadingIndicator}
          onStartSet={handleStartSet}
          onRecordingComplete={handleRecordingComplete}
          onCancelCountdown={handleCancelCountdown}
          onPostSet={handlePostSet} 
          onScratchSet={handleScratchSet}
          isSubmittingPostOrScratch={isSubmitting}
        />

        {/* Conditionally render the Feed Section */}
        {(appState === 'idle' || appState === 'finished' || appState === 'limitReached') && (
          <div className="w-full max-w-2xl mt-12">
            <FeedTabs 
              activeTab={activeTab} 
              setActiveTab={handleTabChange} // Use handler function
              sliderStyle={sliderStyle}
              tabsRef={tabsRef}
              tabsContainerRef={tabsContainerRef}
            />
            
            {/* === Conditional Feed Content Area === */} 

            {/* 1. Show Initial Loading Indicator (Delayed) */} 
            {isLoadingFeed && showInitialLoadIndicator && (
              <div className="text-center py-10">
                <p className="text-gray-600">Loading feed...</p>
              </div>
            )}

            {/* 2. Render FeedList and Observer only when NOT initial loading */} 
            {!isLoadingFeed && (
              <>
                <FeedList 
                  sets={feedSets}
                  handleVote={handleVote} 
                  currentUser={user}
                  showInitialLoadIndicator={showInitialLoadIndicator} // Still pass, FeedList might use for internal logic
                  showMoreLoadIndicator={showMoreLoadIndicator}
                  feedError={feedError}
                  hasMore={hasMore}
                />

                {/* Observer Target for Infinite Scroll */}
                {/* Render only if more exist (FeedList might render end message based on hasMore) */} 
                {hasMore && (
                    <div ref={observerTarget} style={{ height: '1px' }} />
                )}
              </>
            )}
            
            {/* === End Conditional Feed Content Area === */} 

          </div>
        )}
      </div>
    </PlaybackContextProvider>
  );
}
