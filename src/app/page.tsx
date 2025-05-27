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
import { MIN_VALID_DURATION_MS, PAGE_LIMIT, LOADING_DELAY_MS } from '@/config/constants';

// Define types for the feed data and tabs
type FeedSet = {
  id: string;
  created_at: string;
  audio_url: string;
  duration_ms: number;
  user_id: string;
  username?: string;
  up_votes: number;
  down_votes: number;
  user_vote: 1 | -1 | null;
  waveform_peaks: number[] | null;
};

type ActiveTab = 'New' | 'Top' | 'Worst';

export type AppState = 'idle' | 'recording' | 'uploading' | 'limitReached';

export default function Home() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nextPostAvailableAtUTC, setNextPostAvailableAtUTC] = useState<string | null>(null);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  
  // Feed State
  const [activeTab, setActiveTab] = useState<ActiveTab>('New');
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

  const observerTarget = useRef<HTMLDivElement>(null); 
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

  const checkUserPostLimit = useCallback(async () => {
    if (user && !user.is_anonymous && supabase) {
      try {
        const { data: rpcResponseArray, error: rpcError } = await supabase.rpc(
          'check_daily_post_limit_with_time'
        );
        if (rpcError) {
          console.error("checkUserPostLimit: Error calling RPC:", rpcError);
          setErrorMessage("Could not verify your post limit. Please try again.");
          setNextPostAvailableAtUTC(null);
          return;
        }
        if (!rpcResponseArray || rpcResponseArray.length === 0) {
          console.error("checkUserPostLimit: RPC returned empty or invalid response.");
          setErrorMessage("Failed to get post limit status.");
          setNextPostAvailableAtUTC(null);
          return;
        }
        const rpcResult = rpcResponseArray[0];
        const { can_post: canPost, next_post_available_at_utc: nextAvailableTime } = rpcResult;
        setNextPostAvailableAtUTC(nextAvailableTime);
        if (canPost === false) {
          // setAppState('limitReached'); // Daily limit is currently disabled for testing
        } else {
          if (appState === 'limitReached') {
            setAppState('idle');
          }
        }
      } catch (error) {
        console.error("checkUserPostLimit: Exception:", error);
        setErrorMessage("An unexpected error occurred while checking your post limit.");
        setNextPostAvailableAtUTC(null);
      }
    }
  }, [user, appState, setAppState, setErrorMessage, setNextPostAvailableAtUTC]);

  useEffect(() => {
    const setupUser = async () => {
      let currentUserToSet: User | null = null;
      try {
        const { data: { user: fetchedUser }, error: getUserError } = await supabase.auth.getUser();
        if (getUserError) {
          console.warn("Auth: Error getting user, attempting anonymous sign-in:", getUserError.message);
          const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError) {
            console.error("Auth: Error signing in anonymously after getUser error:", signInError);
          } else {
            currentUserToSet = signInData?.user ?? null;
            // console.log("Auth: Signed in anonymously after initial getUser error.");
          }
        } else if (fetchedUser) {
          currentUserToSet = fetchedUser;
          // console.log("Auth: User session found.");
        } else {
          // console.log("Auth: No initial user found, attempting anonymous sign-in.");
          const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError) {
            console.error("Auth: Error signing in anonymously (no initial user found):", signInError);
          } else {
            currentUserToSet = signInData?.user ?? null;
            // console.log("Auth: Signed in anonymously as no initial user was found.");
          }
        }
      } catch (e) {
        console.error("Auth: Exception during setupUserSession:", e);
      } finally {
        setUser(currentUserToSet);
        setIsAuthLoading(false);
        // console.log(`Auth: setupUser finished. User: ${currentUserToSet?.id ?? 'null'}. Auth loading: false.`);
      }
    };
    setupUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      // console.log(`Auth: onAuthStateChange event - ${_event}. Session user: ${session?.user?.id ?? 'null'}`);
      const newAuthUser = session?.user ?? null;
      setUser(newAuthUser);
      if (!newAuthUser && appState !== 'recording' && appState !== 'uploading') {
        setAppState('idle');
        setNextPostAvailableAtUTC(null);
      }
    });
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [appState]); // appState is used in onAuthStateChange, keeping it.

  useEffect(() => {
    if (!isAuthLoading) {
      if (user && !user.is_anonymous) {
        // console.log("Auth complete, non-anonymous user. Triggering post limit check.");
        checkUserPostLimit();
      } else {
        if (appState === 'limitReached') {
          // console.log("User is null or anonymous. Resetting appState from 'limitReached' to 'idle'.");
          setAppState('idle');
        }
        setNextPostAvailableAtUTC(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthLoading, checkUserPostLimit, appState /*, setAppState, setNextPostAvailableAtUTC */]);
  // setAppState and setNextPostAvailableAtUTC are stable, can be omitted if preferred, but exhaustive-deps includes them.
  // Keeping for clarity given the comment about managed circular dependency.

  const handleStartSet = async () => {
    setErrorMessage(null);
    if (isAuthLoading) {
      setErrorMessage("Please wait, verifying authentication...");
      return;
    }
    if (!user || user.is_anonymous === true) {
      router.push('/login');
      return;
    }
    try {
      // console.log("handleStartSet: Explicitly re-checking daily post limit...");
      const { data: rpcResponseArray, error: rpcError } = await supabase.rpc(
        'check_daily_post_limit_with_time'
      );
      if (rpcError) {
        console.error("handleStartSet: Error calling RPC:", rpcError);
        setErrorMessage("Could not verify your post limit. Please try again.");
        setNextPostAvailableAtUTC(null);
        return;
      }
      if (!rpcResponseArray || rpcResponseArray.length === 0) {
        console.error("handleStartSet: RPC returned empty or invalid response.");
        setErrorMessage("Failed to get post limit status for starting set.");
        setNextPostAvailableAtUTC(null);
        return;
      }
      const rpcResult = rpcResponseArray[0];
      const { can_post: canPost, next_post_available_at_utc: nextAvailableTime } = rpcResult;
      setNextPostAvailableAtUTC(nextAvailableTime);
      if (canPost === false) {
        // console.log("handleStartSet: Daily limit confirmed reached. (Bypassed for testing).");
        // setAppState('limitReached'); // Daily limit enforcement is off for testing
        // return; 
      }
      // console.log("handleStartSet: Limit OK. Opening warning modal.");
      setIsWarningModalOpen(true);
    } catch (error) {
      console.error("handleStartSet: Exception:", error);
      setErrorMessage("An unexpected error occurred while checking your post limit before recording.");
      setNextPostAvailableAtUTC(null);
    }
  };

  const handleConfirmRecord = () => {
    setIsWarningModalOpen(false);
    setAppState('recording');
  };

  const handleCancelWarning = () => {
    setIsWarningModalOpen(false);
  };

  const handleRecordingComplete = async (
    audioBlob: Blob, 
    durationMs: number, 
    waveformPeaks: number[],
    actualMimeType: string
  ) => {
    setErrorMessage(null);
    if (!user) {
        console.error("handleRecordingComplete: User not authenticated.");
        setErrorMessage("Authentication error. Please refresh and try again.");
        setAppState('idle');
        return;
    }
    if (durationMs < MIN_VALID_DURATION_MS) {
        console.warn(`handleRecordingComplete: Recording duration ${durationMs}ms is less than required ${MIN_VALID_DURATION_MS}ms. Discarding.`);
        setErrorMessage(`Your set was too short. It must be at least ${MIN_VALID_DURATION_MS / 1000} seconds long.`);
        setAppState('idle');
        return;
    }
    if (!audioBlob || audioBlob.size === 0) {
        console.error("handleRecordingComplete: Audio blob is missing or empty.");
        setErrorMessage("Recording failed: No audio data captured.");
        setAppState('idle');
        return;
    }
    setAppState('uploading');
    setShowUploadingIndicator(true);

    let fileExtension = '.webm';
    if (actualMimeType) {
        if (actualMimeType.includes('mp4')) fileExtension = '.mp4';
        else if (actualMimeType.includes('aac')) fileExtension = '.m4a';
        else if (actualMimeType.includes('wav')) fileExtension = '.wav';
        else if (actualMimeType.includes('ogg')) fileExtension = '.ogg';
        else if (actualMimeType.includes('mpeg')) fileExtension = '.mp3';
    }
    // console.log(`handleRecordingComplete: MimeType: "${actualMimeType}", extension: "${fileExtension}"`);
    const fileName = `${user.id}/${new Date().toISOString()}${fileExtension}`;
    let publicUrl: string | undefined = undefined;
    let insertedSetId: string | undefined = undefined;
    try {
      const { error: uploadError } = await supabase.storage
        .from('recordings') 
        .upload(fileName, audioBlob, { cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(fileName);
      publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error("Failed to retrieve audio URL after upload.");
      const { data: insertData, error: dbError } = await supabase
        .from('sets') 
        .insert({
            user_id: user.id,
            audio_url: publicUrl, 
            duration_ms: durationMs, 
            waveform_peaks: waveformPeaks, 
            is_public: true 
        })
        .select('id') 
        .single(); 
      if (dbError) throw dbError;
      if (!insertData || !insertData.id) {
        throw new Error("Failed to insert set or retrieve its ID.");
      }
      insertedSetId = insertData.id;
      console.log(`Set ${insertedSetId} created successfully.`);
      if (insertedSetId && user) {
        // console.log(`Automatically upvoting set ${insertedSetId} for user ${user.id}.`);
        await handleVote(insertedSetId, 1);
      }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred during upload or set creation.';
        console.error("handleRecordingComplete: Error:", message);
        setErrorMessage(message);
    } finally {
        setShowUploadingIndicator(false);
        setAppState('idle'); 
        // console.log("handleRecordingComplete: Process finished, forcing feed refresh.");
        await fetchFeed(true);
    }
  };

  const fetchFeed = useCallback(async (refresh = false) => {
    const doFetchSets = async (currentOffsetFromState: number, currentHasMoreFromState: boolean) => {
      const userIdForRPC = user?.id ?? null;
      let currentOffsetForQuery: number;
      if (refresh) {
        // console.log(`doFetchSets: Refreshing. User: ${userIdForRPC}, Tab: ${activeTab}`);
        setIsLoadingFeed(true);
        setFeedError(null);
        setFeedSets([]);
        setOffset(0);
        setHasMore(true);
        currentOffsetForQuery = 0;
        if (initialLoadTimerRef.current) clearTimeout(initialLoadTimerRef.current);
        initialLoadTimerRef.current = setTimeout(() => setShowInitialLoadIndicator(true), LOADING_DELAY_MS);
      } else {
        if (loadingMoreRef.current || !currentHasMoreFromState) return;
        // console.log(`doFetchSets: Paginating. User: ${userIdForRPC}, Tab: ${activeTab}, Offset: ${currentOffsetFromState}`);
        loadingMoreRef.current = true;
        setIsLoadingMore(true);
        currentOffsetForQuery = currentOffsetFromState;
        if (moreLoadTimerRef.current) clearTimeout(moreLoadTimerRef.current);
        moreLoadTimerRef.current = setTimeout(() => setShowMoreLoadIndicator(true), LOADING_DELAY_MS);
      }
      // console.log(`doFetchSets: Calling RPC get_feed_sets. User: ${userIdForRPC}, Tab: ${activeTab}, Offset: ${currentOffsetForQuery}, Limit: ${PAGE_LIMIT + 1}`);
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
        // console.log(`doFetchSets: Fetched ${currentPageDisplaySets.length} display sets. RPC raw: ${fetchedSetsRaw.length}. Has more: ${newHasMoreItems}`);
        // if (currentPageDisplaySets.length > 0) { console.log("First fetched set:", JSON.stringify(currentPageDisplaySets[0])); }
        if (refresh) {
          setFeedSets(currentPageDisplaySets);
        } else {
          setFeedSets(prevSets => {
            const prevSetIds = new Set(prevSets.map((s: FeedSet) => s.id));
            const uniqueNewPageSets = currentPageDisplaySets.filter((newItem: FeedSet) => !prevSetIds.has(newItem.id));
            if (uniqueNewPageSets.length !== currentPageDisplaySets.length) {
                console.warn(`doFetchSets: Filtered ${currentPageDisplaySets.length - uniqueNewPageSets.length} duplicates during pagination.`);
            }
            return [...prevSets, ...uniqueNewPageSets];
          });
        }
        setHasMore(newHasMoreItems);
        setOffset(currentOffsetForQuery + currentPageDisplaySets.length);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An unknown error occurred";
        console.error('fetchFeed: Error:', message);
        setFeedError(`Failed to load feed: ${message}`);
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
    }; 
    await doFetchSets(offset, hasMore);
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [activeTab, user]); // PAGE_LIMIT is a constant, doesn't need to be here.

  useEffect(() => {
    if (!isAuthLoading) {
      // console.log(`Feed Effect: User ID: ${user?.id ?? 'null'}, Tab: ${activeTab}. Auth loaded. Fetching feed.`);
      fetchFeed(true);
    } else {
      // console.log(`Feed Effect: Waiting for auth. User ID: ${user?.id ?? 'null'}, Tab: ${activeTab}.`);
    }
  }, [activeTab, user, isAuthLoading, fetchFeed]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingFeed && !isLoadingMore) {
          // console.log("Observer intersected, fetching more...");
          fetchFeed(false);
        }
      },
      { threshold: 1.0 }
    );
    const target = observerTarget.current;
    if (target) observer.observe(target);
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasMore, isLoadingFeed, isLoadingMore, fetchFeed]); 

  const handleVote = async (setId: string, voteValue: 1 | -1) => {
    const currentUser = user;
    if (!currentUser) {
        console.error("handleVote: User not available. Aborting.");
        return;
    }
    // console.log(`handleVote: Initiated for set ${setId}, vote ${voteValue}, user ${currentUser.id}.`);
    const currentSetIndex = feedSets.findIndex(s => s.id === setId);
    let currentSet: FeedSet | undefined = currentSetIndex !== -1 ? feedSets[currentSetIndex] : undefined;
    if (currentSet) {
        // console.log(`handleVote: Set ${setId} found locally. Current user vote: ${currentSet.user_vote}. Optimistic update.`);
        let optimisticUpVotes = currentSet.up_votes;
        let optimisticDownVotes = currentSet.down_votes;
        let optimisticUserVote: 1 | -1 | null = currentSet.user_vote;
        if (currentSet.user_vote === voteValue) { 
          optimisticUserVote = null;
          if (voteValue === 1) optimisticUpVotes--; else optimisticDownVotes--;
        } else { 
          optimisticUserVote = voteValue;
          if (voteValue === 1) optimisticUpVotes++; else optimisticDownVotes++;
          if (currentSet.user_vote === 1) optimisticUpVotes--;
          if (currentSet.user_vote === -1) optimisticDownVotes--;
        }
        const optimisticSet = { 
            ...currentSet, 
            up_votes: Math.max(0, optimisticUpVotes),
            down_votes: Math.max(0, optimisticDownVotes),
            user_vote: optimisticUserVote
        };
        setFeedSets(currentSets => currentSets.map(s => s.id === setId ? optimisticSet : s));
    } else {
        // console.log(`handleVote: Set ${setId} not found locally. Skipping optimistic UI update (e.g. auto-vote).`);
    }
    // console.log(`handleVote: Proceeding to RPC for set ${setId}, user: ${currentUser.id}.`);
    try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('handle_vote', { 
            set_id_input: setId, 
            vote_value_input: voteValue 
        });
        if (rpcError) {
            console.error("handleVote: Error calling RPC:", rpcError);
            if (currentSet) setFeedSets(currentSets => currentSets.map(s => s.id === setId ? currentSet : s)); // Revert optimistic
            setFeedError("Vote failed. Please try again.");
            return;
        }
        // console.log(`handleVote: Vote RPC successful for set ${setId}.`);
        if (currentSet && rpcData && rpcData.length > 0) {
            const finalState = rpcData[0];
            // console.log(`handleVote: Syncing local set ${setId} with RPC state:`, finalState);
            const syncedSet = { 
                ...currentSet, 
                up_votes: finalState.new_up_votes,
                down_votes: finalState.new_down_votes,
                user_vote: finalState.user_vote_value
            };
            setFeedSets(currentSets => currentSets.map(s => s.id === setId ? syncedSet : s));
        } else if (currentSet) {
             console.warn(`handleVote: Vote RPC for set ${setId} did not return expected data for sync after optimistic update.`);
        }
    } catch (error) {
        console.error("handleVote: Generic catch block error:", error);
        setFeedError("Vote failed due to an unexpected error. Please try again.");
        if (currentSet) setFeedSets(currentSets => currentSets.map(s => s.id === setId ? currentSet : s)); // Revert optimistic
    }
  };

  const handleTabChange = (tab: ActiveTab) => {
    if (isLoadingFeed || isLoadingMore) return;
    setActiveTab(tab);
  };

  useEffect(() => {
    if (isAuthLoading) return;
    const activeTabIndex = ['New', 'Top', 'Worst'].indexOf(activeTab);
    const activeTabElement = tabsRef.current[activeTabIndex];
    const containerElement = tabsContainerRef.current;
    if (activeTabElement && containerElement) {
      const containerRect = containerElement.getBoundingClientRect();
      const tabRect = activeTabElement.getBoundingClientRect();
      const left = tabRect.left - containerRect.left;
      const width = tabRect.width;
      if (width > 0) setSliderStyle({ left, width });
      // else { console.log("Slider Calculation - Width is 0, not setting style."); }
    } // else { console.log("Slider Calculation - Skipped, elements not ready."); }
  }, [activeTab, isAuthLoading /*, tabsRef, tabsContainerRef removed as they are refs */]);

  const mainContainerClasses = `flex flex-col items-center min-h-screen bg-white text-gray-900 p-4 md:p-8 pt-20 ${ 
    (isAuthLoading || appState === 'recording' || appState === 'uploading') ? 'justify-center' : '' 
  }`;

  if (isAuthLoading) {
    return (
      <div className={mainContainerClasses}>
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
          nextPostAvailableAtUTC={nextPostAvailableAtUTC}
        />
        {(appState === 'idle' || appState === 'limitReached') && (
          <div className="w-full max-w-2xl mt-12">
             <FeedTabs 
              activeTab={activeTab} 
              setActiveTab={handleTabChange} 
              sliderStyle={sliderStyle}
              tabsRef={tabsRef}
              tabsContainerRef={tabsContainerRef}
            />
            {isLoadingFeed && showInitialLoadIndicator && (
              <div className="text-center py-10">
                <p className="text-gray-600">Loading feed...</p>
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
