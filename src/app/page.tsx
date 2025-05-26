"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { PlaybackContextProvider } from '@/contexts/PlaybackContext';
import { User } from '@supabase/supabase-js';
import TopSection from '@/components/home/TopSection';
import FeedTabs from '@/components/feed/FeedTabs';
import FeedList from '@/components/feed/FeedList';
import WarningModal from '@/components/modal/WarningModal';
import { useRouter } from 'next/navigation';

// Define types for the feed data and tabs
type FeedSet = {
  id: string;
  created_at: string;
  audio_url: string;
  duration_ms: number;
  user_id: string;
  username?: string; // ADDED: Username of the set poster
  up_votes: number;
  down_votes: number;
  user_vote: 1 | -1 | null; // User's vote status (1=up, -1=down, null=none)
  waveform_peaks: number[] | null; // Add this for the stored peaks
};

type ActiveTab = 'New' | 'Top' | 'Worst'; // Updated order

export type AppState = 'idle' | 'recording' | 'uploading' | 'limitReached'; // Removed 'checkingLimit'

// Remove LastSetData type as it's no longer needed
// type LastSetData = {id: string; url: string; createdAt: string; durationMs: number; fileName: string} | null;

const PAGE_LIMIT = 10;
const LOADING_DELAY_MS = 2000; // 2-second delay

export default function Home() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nextPostAvailableAtUTC, setNextPostAvailableAtUTC] = useState<string | null>(null); // New state for countdown target
  // Add state for modal visibility
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  // Remove lastSetData state
  // const [lastSetData, setLastSetData] = useState<LastSetData>(null);
  // Remove isSubmitting state
  // const [isSubmitting, setIsSubmitting] = useState(false); // To disable buttons
  
  // Feed State
  const [activeTab, setActiveTab] = useState<ActiveTab>('New'); // Default to New
  const [feedSets, setFeedSets] = useState<FeedSet[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [showInitialLoadIndicator, setShowInitialLoadIndicator] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showMoreLoadIndicator, setShowMoreLoadIndicator] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  
  const [offset, setOffset] = useState(0);
  
  const loadingMoreRef = useRef(false); 
  
  const initialLoadTimerRef = useRef<NodeJS.Timeout | null>(null); 
  const moreLoadTimerRef = useRef<NodeJS.Timeout | null>(null); 

  const [showUploadingIndicator, setShowUploadingIndicator] = useState(false);
  const uploadingTimerRef = useRef<NodeJS.Timeout | null>(null); 

  const observerTarget = useRef<HTMLDivElement>(null); 

  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const router = useRouter(); // Ensure router is initialized

  // Helper function to check post limit and update state, wrapped in useCallback
  const checkUserPostLimit = useCallback(async () => {
    if (user && !user.is_anonymous && supabase) {
      try {
        console.log("PAGE.TSX: checkUserPostLimit - Checking daily post limit (with time)...");
        // Call the new RPC function
        const { data: rpcResponseArray, error: rpcError } = await supabase.rpc(
          'check_daily_post_limit_with_time'
        );

        if (rpcError) {
          console.error("PAGE.TSX: checkUserPostLimit - Error calling RPC:", rpcError);
          setErrorMessage("Could not verify your post limit. Please try again.");
          setNextPostAvailableAtUTC(null); // Clear any previous time
          return;
        }

        // RPC returns an array with one object: [{ can_post: boolean, next_post_available_at_utc: string }]
        if (!rpcResponseArray || rpcResponseArray.length === 0) {
          console.error("PAGE.TSX: checkUserPostLimit - RPC returned empty or invalid response.");
          setErrorMessage("Failed to get post limit status.");
          setNextPostAvailableAtUTC(null);
          return;
        }

        const rpcResult = rpcResponseArray[0];
        const canPost = rpcResult.can_post;
        const nextAvailableTime = rpcResult.next_post_available_at_utc;

        console.log(`PAGE.TSX: checkUserPostLimit - Result: canPost: ${canPost}, nextAvailable: ${nextAvailableTime}`);
        setNextPostAvailableAtUTC(nextAvailableTime); // Store the timestamp

        if (canPost === false) {
          // console.log("PAGE.TSX: checkUserPostLimit - Daily limit reached. AppState would be set to limitReached (COMMENTED OUT FOR TESTING).");
          // setAppState('limitReached'); // COMMENTED OUT FOR TESTING
        } else {
          if (appState === 'limitReached') {
            setAppState('idle');
          }
        }
      } catch (error) {
        console.error("PAGE.TSX: checkUserPostLimit - Exception during RPC call:", error);
        setErrorMessage("An unexpected error occurred while checking your post limit.");
        setNextPostAvailableAtUTC(null);
      }
    }
  }, [user, appState, setAppState, setErrorMessage, setNextPostAvailableAtUTC]);

  // Auth effect
  useEffect(() => {
    const setupUser = async () => {
      //setIsAuthLoading(true); // Already true by default, no need to set again here
      let currentUserToSet: User | null = null;
      try {
        const { data: { user: fetchedUser }, error: getUserError } = await supabase.auth.getUser();

        if (getUserError) {
          console.error("Error getting user:", getUserError);
        const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
            console.error("Error signing in anonymously after getUser error:", signInError);
          } else {
            currentUserToSet = signInData?.user ?? null;
            console.log("Auth: Signed in anonymously after getUser error.");
          }
        } else if (fetchedUser) {
          currentUserToSet = fetchedUser;
          console.log("Auth: User session found.");
        } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
            console.error("Error signing in anonymously (no initial user):", signInError);
        } else {
            currentUserToSet = signInData?.user ?? null;
            console.log("Auth: Signed in anonymously (no initial user).");
          }
        }
      } catch (e) {
        console.error("Auth: Exception in setupUser", e);
      } finally {
        setUser(currentUserToSet);
        setIsAuthLoading(false); // Crucial: set to false after attempting to get/set user
        console.log(`Auth: setupUser finished. User set to: ${currentUserToSet?.id ?? 'null'}. Auth loading: false.`);
      }
    };

    setupUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log(`Auth: onAuthStateChange event - ${_event}. Session user: ${session?.user?.id ?? 'null'}`);
      const newAuthUser = session?.user ?? null;
      setUser(newAuthUser); // Update user state first
      
      // If user logs out, ensure app state is reasonable
      if (!newAuthUser) {
        if (appState !== 'recording' && appState !== 'uploading') {
             setAppState('idle');
        }
      }
      // Proactive check happens in the other useEffect based on user change
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []); // Main auth setup runs once

  // Effect to check post limit when user is loaded/changed and auth is complete
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isAuthLoading) {
      if (user && !user.is_anonymous) {
        console.log("PAGE.TSX: Auth complete and user is non-anonymous. Triggering post limit check directly.");
        checkUserPostLimit(); // Call directly. It will set appState to 'idle' or 'limitReached'.
      } else {
        // User is null or anonymous.
        if (appState === 'limitReached') { // Only reset if it was 'limitReached'
          console.log("PAGE.TSX: User logged out/anonymous. Resetting from limitReached to idle.");
          setAppState('idle');
        }
        setNextPostAvailableAtUTC(null); // Clear countdown time
      }
    }
  }, [user, isAuthLoading, checkUserPostLimit, appState, setAppState, setNextPostAvailableAtUTC]);
  // Note: checkUserPostLimit itself depends on appState for one of its conditions. This circular dependency is managed by useCallback for checkUserPostLimit
  // and by the conditional logic within this useEffect and checkUserPostLimit to prevent infinite loops.

  // Original handleStartSet now opens the modal
  const handleStartSet = async () => {
    setErrorMessage(null);

    if (isAuthLoading) {
      console.log("PAGE.TSX: handleStartSet - Auth is still loading.");
      setErrorMessage("Please wait, verifying authentication...");
      return;
    }

    if (!user || user.is_anonymous === true) {
      console.log("PAGE.TSX: handleStartSet - User not authenticated or is anonymous. Redirecting to login.");
      router.push('/login');
      return;
    }

    try {
      console.log("PAGE.TSX: handleStartSet - Explicitly re-checking daily post limit (with time)...");
      const { data: rpcResponseArray, error: rpcError } = await supabase.rpc(
        'check_daily_post_limit_with_time'
      );

      if (rpcError) {
        console.error("PAGE.TSX: handleStartSet - Error calling RPC:", rpcError);
        setErrorMessage("Could not verify your post limit. Please try again.");
        setNextPostAvailableAtUTC(null); // Clear time on error
        return;
    }

      if (!rpcResponseArray || rpcResponseArray.length === 0) {
        console.error("PAGE.TSX: handleStartSet - RPC returned empty or invalid response.");
        setErrorMessage("Failed to get post limit status for starting set.");
        setNextPostAvailableAtUTC(null);
        return;
      }
      
      const rpcResult = rpcResponseArray[0];
      const canPost = rpcResult.can_post;
      const nextAvailableTime = rpcResult.next_post_available_at_utc;

      setNextPostAvailableAtUTC(nextAvailableTime); // Update timestamp from this check too

      if (canPost === false) {
        console.log("PAGE.TSX: handleStartSet - Daily limit confirmed reached. Proceeding anyway for testing (COMMENTED OUT BLOCK).");
        // setAppState('limitReached'); // COMMENTED OUT FOR TESTING
        // return; // COMMENTED OUT FOR TESTING
      }

      console.log("PAGE.TSX: handleStartSet - Authenticated user, limit NOT reached (or bypassed for testing). Opening warning modal.");
      setIsWarningModalOpen(true);

    } catch (error) {
      console.error("PAGE.TSX: handleStartSet - Exception during RPC call:", error);
      setErrorMessage("An unexpected error occurred while checking your post limit before recording.");
      setNextPostAvailableAtUTC(null);
    }
  };

  // New handler for when user confirms from modal
  const handleConfirmRecord = () => {
    setIsWarningModalOpen(false);
    setAppState('recording'); // Proceed to recording state
  };

  // New handler for when user cancels from modal
  const handleCancelWarning = () => {
    setIsWarningModalOpen(false);
  };

  const handleRecordingComplete = async (audioBlob: Blob, durationMs: number, waveformPeaks: number[]) => {
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

    const fileName = `${user.id}/${new Date().toISOString()}.webm`;
    let publicUrl: string | undefined = undefined;
    let insertedSetId: string | undefined = undefined;

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

      // Save metadata, now including waveform_peaks and making it public
      const { data: insertData, error: dbError } = await supabase
        .from('sets') 
        .insert({
            user_id: user.id,
            audio_url: publicUrl, 
            duration_ms: durationMs, 
            waveform_peaks: waveformPeaks, // Add collected peaks here
            is_public: true // Ensure the set is public on creation
        })
        .select('id') 
        .single(); 

      if (dbError) throw dbError;
      if (!insertData || !insertData.id) {
        throw new Error("Failed to insert set or retrieve its ID after database operation.");
      }
      
      insertedSetId = insertData.id;
      console.log(`PAGE.TSX: Set ${insertedSetId} created successfully and set to public.`);

      // --- Add automatic upvote for the new set ---
      if (insertedSetId && user) { // Ensure we have the ID and user
        console.log(`PAGE.TSX: Automatically upvoting set ${insertedSetId} for user ${user.id}.`);
        await handleVote(insertedSetId, 1); // Call handleVote to upvote
      }
      // --- End of automatic upvote ---

    } catch (err: unknown) {
        let errorMessage = 'An unexpected error occurred during upload or set creation.';
        if (err instanceof Error) {
            errorMessage = err.message;
        }
        console.error("Error during recording complete process:", errorMessage);
        setErrorMessage(errorMessage);
    } finally {
        if (uploadingTimerRef.current) {
            clearTimeout(uploadingTimerRef.current);
            uploadingTimerRef.current = null;
        }
        setShowUploadingIndicator(false);
        setAppState('idle'); 
        console.log("PAGE.TSX: Recording complete process finished, forcing feed refresh.");
        await fetchFeed(true); // Refresh feed to show new set / reflect any changes
    }
  };

  // fetchFeed function
  const fetchFeed = useCallback(async (refresh = false) => {
    // Inner function to contain the actual fetching logic
    // This allows the outer useCallback to have fewer dependencies.
    const doFetchSets = async (currentOffsetFromState: number, currentHasMoreFromState: boolean) => {
      const userIdForRPC = user?.id ?? null;
      let currentOffsetForQuery: number;

      if (refresh) {
        console.log(`PAGE.TSX: doFetchSets(refresh=true) - Refreshing. User: ${userIdForRPC}, Tab: ${activeTab}`);
        setIsLoadingFeed(true);
        setFeedError(null);
        setFeedSets([]);
        setOffset(0); // Reset offset state for the refresh action itself
        setHasMore(true); // Optimistically set to true for refresh, fetch will confirm
        currentOffsetForQuery = 0;

        if (initialLoadTimerRef.current) clearTimeout(initialLoadTimerRef.current);
        initialLoadTimerRef.current = setTimeout(() => {
          console.log("Initial load timer fired for refresh");
          setShowInitialLoadIndicator(true);
        }, LOADING_DELAY_MS);
      } else { // Pagination
        if (loadingMoreRef.current || !currentHasMoreFromState) { // Use passed currentHasMoreFromState
          console.log(`PAGE.TSX: doFetchSets(refresh=false) - PAGINATION ATTEMPT BLOCKED. loadingMoreRef.current: ${loadingMoreRef.current}, currentHasMoreFromState: ${currentHasMoreFromState}`);
          return;
        }
        console.log(`PAGE.TSX: doFetchSets(refresh=false) - PAGINATION ATTEMPT PROCEEDING. User: ${userIdForRPC}, Tab: ${activeTab}, currentOffsetFromState: ${currentOffsetFromState}`);
        loadingMoreRef.current = true;
        setIsLoadingMore(true);
        currentOffsetForQuery = currentOffsetFromState; // Use passed currentOffsetFromState

        if (moreLoadTimerRef.current) clearTimeout(moreLoadTimerRef.current);
        moreLoadTimerRef.current = setTimeout(() => {
          console.log("More load timer fired for pagination");
          setShowMoreLoadIndicator(true);
        }, LOADING_DELAY_MS);
      }

      console.log(`PAGE.TSX: doFetchSets - Calling RPC. p_user_id: ${userIdForRPC}, p_tab: ${activeTab}, p_offset: ${currentOffsetForQuery}, p_limit: ${PAGE_LIMIT + 1}`);

      try {
        const { data, error } = await supabase.rpc('get_feed_sets', {
          p_tab: activeTab,
          p_limit: PAGE_LIMIT + 1,
          p_offset: currentOffsetForQuery,
          p_user_id: userIdForRPC
        });

        if (error) throw error;

        const fetchedSetsRaw = data || [];
        const newHasMoreItems = fetchedSetsRaw.length > PAGE_LIMIT;
        const currentPageDisplaySets = newHasMoreItems ? fetchedSetsRaw.slice(0, PAGE_LIMIT) : fetchedSetsRaw;

        console.log(`PAGE.TSX: Fetched ${currentPageDisplaySets.length} display sets. RPC raw length: ${fetchedSetsRaw.length}. Has more: ${newHasMoreItems}`);
        if (currentPageDisplaySets.length > 0) {
          console.log("First fetched set (from fetchFeed):", JSON.stringify(currentPageDisplaySets[0]));
        }

        if (refresh) {
          setFeedSets(currentPageDisplaySets);
        } else {
          setFeedSets(prevSets => {
            const prevSetIds = new Set(prevSets.map((s: FeedSet) => s.id));
            const uniqueNewPageSets = currentPageDisplaySets.filter((newItem: FeedSet) => {
              if (prevSetIds.has(newItem.id)) {
                console.warn(`PAGE.TSX: FILTERING DUPLICATE from new page! Set ID '${newItem.id}' already exists.`);
                return false;
              }
              return true;
            });
            if (uniqueNewPageSets.length !== currentPageDisplaySets.length) {
                console.log(`PAGE.TSX: Filtered ${currentPageDisplaySets.length - uniqueNewPageSets.length} duplicates during pagination merge.`);
            }
            return [...prevSets, ...uniqueNewPageSets];
          });
        }
        setHasMore(newHasMoreItems);
        setOffset(currentOffsetForQuery + currentPageDisplaySets.length);

      } catch (err: unknown) {
        let feedErrorMessage = "An unknown error occurred";
        if (err instanceof Error) {
            feedErrorMessage = err.message;
        }
        console.error('Error fetching feed:', feedErrorMessage);
        setFeedError(`Failed to load feed: ${feedErrorMessage}`);
        setHasMore(false);
      } finally {
        if (initialLoadTimerRef.current) clearTimeout(initialLoadTimerRef.current);
        if (moreLoadTimerRef.current) clearTimeout(moreLoadTimerRef.current);
        setShowInitialLoadIndicator(false);
        setShowMoreLoadIndicator(false);
        setIsLoadingFeed(false);
        setIsLoadingMore(false);
        loadingMoreRef.current = false;
      }
    }; // End of doFetchSets

    // Call the inner function with current state values for offset and hasMore
    await doFetchSets(offset, hasMore);

    // useCallback wrapper for fetchFeed. Deps only include things that define *what* to fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [activeTab, user, PAGE_LIMIT]); // offset and hasMore are NOT dependencies here. supabase also removed.

  // Effect to fetch feed when tab changes, user changes, OR auth loading finishes
  useEffect(() => {
    if (!isAuthLoading) { 
      console.log(`PAGE.TSX: Feed Effect - User ID: ${user?.id ?? 'null'}, Tab: ${activeTab}. Auth IS loaded. Triggering feed fetch.`);
      fetchFeed(true);
    } else {
      console.log(`PAGE.TSX: Feed Effect - Waiting for auth. User ID: ${user?.id ?? 'null'}, Tab: ${activeTab}.`);
    }
  }, [activeTab, user, isAuthLoading, fetchFeed]); // fetchFeed is now more stable

  // Intersection Observer for Infinite Scroll (keep as is)
  useEffect(() => {
    // ... existing observer logic ...
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingFeed && !isLoadingMore) {
          console.log("Observer intersected, fetching more...");
          fetchFeed(false); // Fetch next page
        }
      },
      { threshold: 1.0 }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [hasMore, isLoadingFeed, isLoadingMore, fetchFeed]); 

  // handleVote function
  const handleVote = async (setId: string, voteValue: 1 | -1) => {
    const currentUser = user;
    if (!currentUser) {
        console.error("PAGE.TSX: handleVote - User not available for voting. Aborting.");
        return;
    }

    console.log(`PAGE.TSX: handleVote - Initiated for set ${setId}, vote ${voteValue}, user ${currentUser.id}.`);

    // Attempt to find the set for local optimistic updates (but don't stop RPC if not found)
    const currentSetIndex = feedSets.findIndex(s => s.id === setId);
    let currentSet: FeedSet | undefined = undefined;
    // let currentUserVote: 1 | -1 | null = null; // Not needed here, get from currentSet

    if (currentSetIndex !== -1) {
        currentSet = feedSets[currentSetIndex];
        const currentUserVote = currentSet.user_vote; // Get it here
        console.log(`PAGE.TSX: handleVote - Set ${setId} found locally. Current user vote: ${currentUserVote}. Proceeding with optimistic update.`);

        // --- Optimistic UI Update Logic (only if set is already in feed) ---
        let optimisticUpVotes = currentSet.up_votes;
        let optimisticDownVotes = currentSet.down_votes;
        let optimisticUserVote: 1 | -1 | null = currentUserVote;

        if (currentUserVote === voteValue) { 
          optimisticUserVote = null;
          if (voteValue === 1) optimisticUpVotes--;
          else optimisticDownVotes--;
        } else { 
          optimisticUserVote = voteValue;
          if (voteValue === 1) optimisticUpVotes++;
          else optimisticDownVotes++;
          if (currentUserVote === 1) optimisticUpVotes--; // Correct previous vote
          if (currentUserVote === -1) optimisticDownVotes--; // Correct previous vote
        }

        const optimisticSet = { 
            ...currentSet, 
            up_votes: Math.max(0, optimisticUpVotes),
            down_votes: Math.max(0, optimisticDownVotes),
            user_vote: optimisticUserVote
        };
        setFeedSets(currentSets => [
            ...currentSets.slice(0, currentSetIndex),
            optimisticSet,
            ...currentSets.slice(currentSetIndex + 1)
        ]);
        // --- End Optimistic UI Update ---
    } else {
        console.log(`PAGE.TSX: handleVote - Set ${setId} not found in local feedSets. Skipping optimistic UI update (expected for auto-vote on new set).`);
    }

    // Always proceed to RPC call if user is present
    // The previous log for this was removed as this one is more encompassing
    console.log(`PAGE.TSX: handleVote - Proceeding to RPC call for set ${setId}, vote ${voteValue}. User: ${currentUser.id}. (Local presence: ${currentSetIndex !== -1})`);
    try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('handle_vote', { 
            set_id_input: setId, 
            vote_value_input: voteValue 
        });

        if (rpcError) {
            console.error("PAGE.TSX: handleVote - Error calling vote RPC:", rpcError);
            // Revert optimistic update if it happened and RPC failed
            if (currentSetIndex !== -1 && currentSet) { // only revert if optimistic update was applied
                 setFeedSets(currentSets => currentSets.map(s => s.id === setId ? currentSet : s)); // Revert to original currentSet
            }
            setFeedError("Vote failed. Please try again."); // Show generic error
            return; // Stop further processing in handleVote on RPC error
        }

        console.log(`PAGE.TSX: handleVote - Vote RPC successful for set ${setId}.`);

        // Sync with RPC result if the set was found locally and updated optimistically.
        // For auto-vote (set not found locally), fetchFeed(true) in handleRecordingComplete.finally will fetch the truth.
        if (currentSetIndex !== -1 && rpcData && rpcData.length > 0 && currentSet) {
            const finalState = rpcData[0];
            console.log(`PAGE.TSX: handleVote - Syncing local set ${setId} with RPC final state:`, finalState);
            const syncedSet = { 
                ...currentSet, 
                up_votes: finalState.new_up_votes,
                down_votes: finalState.new_down_votes,
                user_vote: finalState.user_vote_value
            };
            setFeedSets(currentSets => currentSets.map(s => s.id === setId ? syncedSet : s));
        } else if (currentSetIndex !== -1 && currentSet) { // Check currentSet to ensure it was defined for an optimistic update
             console.warn(`PAGE.TSX: handleVote - Vote RPC for set ${setId} did not return expected data for sync, but optimistic update was done.`);
        }
        // If currentSetIndex was -1 (auto-vote), we don't do anything with rpcData here.
        // The fetchFeed(true) in handleRecordingComplete.finally will fetch this new set with its correct state.
        
    } catch (error) { // Catch broader errors, e.g., network issues before RPC even called by supabase-js
        console.error("PAGE.TSX: handleVote - Generic catch block error:", error);
        setFeedError("Vote failed due to an unexpected error. Please try again.");
        if (currentSetIndex !== -1 && currentSet) { // Revert optimistic if applicable
            setFeedSets(currentSets => currentSets.map(s => s.id === setId ? currentSet : s));
        }
    }
  };

  // handleTabChange function (keep as is)
  const handleTabChange = (tab: ActiveTab) => {
    if (isLoadingFeed || isLoadingMore) return; // Prevent changing tab while loading
    setActiveTab(tab);
    // Feed fetch is handled by the useEffect watching activeTab
  };

  // Effect for Tab Slider Position
  useEffect(() => {
    // Ensure FeedTabs are likely rendered (i.e., main auth loading is complete)
    if (isAuthLoading) {
      console.log("PAGE.TSX: Slider Calculation - Skipped due to isAuthLoading.");
      // Optionally set to a default state or clear if needed, though it might be better to just wait
      // setSliderStyle({ left: 0, width: 0 }); 
      return;
    }

    const activeTabIndex = ['New', 'Top', 'Worst'].indexOf(activeTab);
    const activeTabElement = tabsRef.current[activeTabIndex];
    const containerElement = tabsContainerRef.current;

    if (activeTabElement && containerElement) {
      const containerRect = containerElement.getBoundingClientRect();
      const tabRect = activeTabElement.getBoundingClientRect();
      
      const left = tabRect.left - containerRect.left;
      const width = tabRect.width;

      console.log(`PAGE.TSX: Slider Calculation - Tab: ${activeTab}, Left: ${left}, Width: ${width}, AuthLoaded: ${!isAuthLoading}`);
      // Only set if width is plausible (tabs have rendered with actual width)
      if (width > 0) {
        setSliderStyle({ left, width });
      } else {
        console.log(`PAGE.TSX: Slider Calculation - Width is 0, not setting style. Tab: ${activeTab}`);
      }
    } else {
      console.log(`PAGE.TSX: Slider Calculation - Skipped. activeTabElement: ${!!activeTabElement}, containerElement: ${!!containerElement}, AuthLoaded: ${!isAuthLoading}`);
    }
  }, [activeTab, isAuthLoading, tabsRef, tabsContainerRef]); // Dependencies for slider effect
  // The refs (tabsRef, tabsContainerRef) are included to re-run if their underlying DOM elements might 
  // become available/change, though typically effects don't re-run for .current changes. 
  // isAuthLoading is the more critical addition for initial render.

  const handleCancelCountdown = () => {
    console.log("Countdown cancelled by user.");
    setAppState('idle'); // Go back to idle state
  };

  // Dynamic classes for the main container (keep as is)
  const mainContainerClasses = `flex flex-col items-center min-h-screen bg-white text-gray-900 p-4 md:p-8 ${
    (appState === 'recording' || appState === 'uploading' || isAuthLoading) ? 'justify-center' : '' 
  }`;

  // Conditional rendering for initial auth loading state
  if (isAuthLoading) {
        return (
      <div className={mainContainerClasses}> {/* Use same centering classes */} 
        <p className="text-xl text-gray-700">Loading your comedy experience...</p>
            </div>
        );
    }

        return (
    <PlaybackContextProvider>
      <div className={mainContainerClasses}>
        <TopSection 
          appState={appState}
          user={user}
          errorMessage={errorMessage}
          showUploadingIndicator={showUploadingIndicator}
          onStartSet={handleStartSet}
          onRecordingComplete={handleRecordingComplete}
          onCancelCountdown={handleCancelCountdown}
          nextPostAvailableAtUTC={nextPostAvailableAtUTC}
        />

        {/* Conditional Feed Section - Remove check for 'finished' state */}
        {(appState === 'idle' || appState === 'limitReached') && (
          <div className="w-full max-w-2xl mt-12">
            {/* ... FeedTabs and FeedList rendering ... */}
             <FeedTabs 
              activeTab={activeTab} 
              setActiveTab={handleTabChange} 
              sliderStyle={sliderStyle}
              tabsRef={tabsRef}
              tabsContainerRef={tabsContainerRef}
            />
            
            {isLoadingFeed && showInitialLoadIndicator && (
              <div className="text-center py-10">
                <p className="text-gray-600\">Loading feed...</p>
              </div>
            )}

            {!isLoadingFeed && (
              <>
                <FeedList 
                  sets={feedSets}
                  handleVote={handleVote} 
                  currentUser={user}
                  showInitialLoadIndicator={showInitialLoadIndicator} 
                  showMoreLoadIndicator={showMoreLoadIndicator}
                  feedError={feedError}
                  hasMore={hasMore}
                />

                {hasMore && (
                    <div ref={observerTarget} style={{ height: '1px' }} />
                )}
              </>
            )}
          </div>
        )}

        {/* Render the Modal */}
        <WarningModal 
          isOpen={isWarningModalOpen}
          onConfirm={handleConfirmRecord}
          onCancel={handleCancelWarning}
          message={"This is your one shot.\nOnce you finish recording, your bit will be automatically published."}
        />
           </div>
    </PlaybackContextProvider>
  );
}
