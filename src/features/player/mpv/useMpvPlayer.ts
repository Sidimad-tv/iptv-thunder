import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { useStreamStore } from '@/store/stream.store';
import { usePlaybackStore } from '@/store/playback.store';
import { getSetting } from '@/hooks/useSettings';
import {
  init, observeProperties, command, setProperty, destroy,
} from 'tauri-plugin-libmpv-api';
import { MAX_RETRIES_PER_URL, DEAD_TIMEOUT_MS, OBSERVED_PROPERTIES } from './mpv.config';
import { StreamState, Track } from './mpv.types';
import { currentTimeStore } from './mpv.utils';

interface UseMpvPlayerReturn {
  streamState: StreamState;
  setStreamState: (state: StreamState) => void;
  currentUrlIdx: number;
  totalRetries: number;
  statusMsg: string;
  setStatusMsg: (msg: string) => void;
  errorMsg: string | null;
  usingMpv: boolean;
  videoParams: { width?: number; height?: number; fps?: number } | null;
  currentTime: number;
  duration: number;
  isPaused: boolean;
  isLoading: boolean;
  tracks: Track[];
  currentAudioId: string | null;
  currentSubId: string | null;
  handleManualRetry: (preserveIndex?: boolean) => void;
  loadUrl: (streamUrl: string, urlIdx: number, retry: number) => Promise<void>;
  cleanup: (savePosition?: boolean) => Promise<void>;
  getRankedUrls: () => string[];
  setAudioTrack: (id: string) => Promise<void>;
  setSubTrack: (id: string) => Promise<void>;
}

export function useMpvPlayer(
  url: string,
  isVod: boolean,
  movieId: string | undefined,
  setPosition: (id: string, pos: number, duration?: number) => void,
  onEnded?: () => void,
  markAsWatched?: (movieId: string, duration: number) => void,
  resumePosition: number = 0
): UseMpvPlayerReturn {
  const isMountedRef = useRef(true);
  const mpvRunningRef = useRef(false);
  const currentIdxRef = useRef(0);
  const retryCountRef = useRef(0);
  const allUrlsRef = useRef<string[]>([url]);
  const connTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingTokenRef = useRef<symbol | null>(null);
  const lifecycleQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const currentTimeRef = useRef(0);
  const lastTimeUpdateRef = useRef(Date.now());
  const durationRef = useRef(0);
  const unobserveRef = useRef<(() => void) | null>(null);
  const requestIdRef = useRef(0);
  const lastRetryRef = useRef(0);
  const lastManualRetryRef = useRef(0);
  const handleManualRetryRef = useRef<((preserveIndex?: boolean) => void) | null>(null);
  const onEndedRef = useRef<(() => void) | undefined>(onEnded);
  const lastBufferingRef = useRef(0);
  const videoParamsReceivedRef = useRef(false);
  const firstTimePosRef = useRef(0);
  const currentCacheSecsRef = useRef(10);
  const isEndedRef = useRef(false);
  const isPausedRef = useRef(false);
  const volumeRef = useRef(0.8);
  const failedSeekRecoveryRef = useRef(0);
  const hwAccelEnabledRef = useRef(true);
  const movieIdRef = useRef(movieId);
  const isVodRef = useRef(isVod);
  const lastSavedMovieIdRef = useRef<string | null>(null);
  const resumePositionRef = useRef(resumePosition);

  // Smart retry metrics per URL
  interface UrlMetrics {
    latency: number;      // avg latency in ms
    lastSuccess: number;  // timestamp of last success
    errorCount: number;   // consecutive errors
    successCount: number; // total successes
    lastUsed: number;     // last attempt timestamp
    bufferingCount: number; // number of buffering events
    avgBitrate: number;   // average bitrate in kbps
    bitrateSampleCount: number; // number of bitrate samples
  }
  const urlMetricsRef = useRef<Map<string, UrlMetrics>>(new Map());
  const urlStartTimeRef = useRef<Map<string, number>>(new Map());
  const MAX_URL_METRICS = 100; // Prevent memory leak in long-running sessions

  const [streamState, setStreamState] = useState<StreamState>('connecting');
  const [currentUrlIdx, setCurrentUrlIdx] = useState(0);
  const [totalRetries, setTotalRetries] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Connecting…');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [usingMpv, setUsingMpv] = useState(false);
  const [videoParams, setVideoParams] = useState<{ width?: number; height?: number; fps?: number } | null>(null);
  const currentTime = useSyncExternalStore(currentTimeStore.subscribe, currentTimeStore.getSnapshot);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [currentSubId, setCurrentSubId] = useState<string | null>(null);

  // Track mount state to prevent state updates on unmounted component
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Read settings once at hook initialization to avoid repeated API calls on retries
  // Use persisted volume from playback store for consistency with player controls
  const persistedVolume = usePlaybackStore(state => state.settings.volume);
  useEffect(() => {
    volumeRef.current = persistedVolume;
  }, [persistedVolume]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const hwAccelEnabled = await getSetting('hardwareAcceleration');
        hwAccelEnabledRef.current = hwAccelEnabled;
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    };
    void loadSettings();
  }, []);

  // Update refs when props change to avoid stale closure values
  useEffect(() => {
    movieIdRef.current = movieId;
  }, [movieId]);

  useEffect(() => {
    isVodRef.current = isVod;
  }, [isVod]);

  useEffect(() => {
    resumePositionRef.current = resumePosition;
  }, [resumePosition]);

  // Simple URL return - no ranking needed for single URL
  const getRankedUrls = useCallback(() => {
    return [url];
  }, [url]);

  // Sync allUrlsRef with props and apply adaptive ranking
  useEffect(() => {
    allUrlsRef.current = getRankedUrls();
  }, [url, getRankedUrls]);

  // Update metrics on URL attempt start
  const recordUrlStart = (streamUrl: string) => {
    urlStartTimeRef.current.set(streamUrl, Date.now());
  };

  // Helper: prune URL metrics to prevent memory leak
  const pruneUrlMetrics = () => {
    const metrics = urlMetricsRef.current;
    if (metrics.size <= MAX_URL_METRICS) return;

    // Sort by lastUsed timestamp (LRU)
    const entries = Array.from(metrics.entries())
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    // Remove oldest entries to stay under limit
    const toRemove = entries.slice(0, metrics.size - MAX_URL_METRICS);
    for (const [url] of toRemove) {
      metrics.delete(url);
      urlStartTimeRef.current.delete(url);
    }
  };

  // Update metrics on success
  const recordUrlSuccess = (streamUrl: string) => {
    const startTime = urlStartTimeRef.current.get(streamUrl);
    const latency = startTime ? Date.now() - startTime : 0;

    const existing = urlMetricsRef.current.get(streamUrl);
    if (existing) {
      // Exponential moving average for latency
      const newLatency = existing.latency * 0.7 + latency * 0.3;
      urlMetricsRef.current.set(streamUrl, {
        latency: newLatency,
        lastSuccess: Date.now(),
        errorCount: 0,
        successCount: existing.successCount + 1,
        lastUsed: Date.now(),
        bufferingCount: existing.bufferingCount,
        avgBitrate: existing.avgBitrate,
        bitrateSampleCount: existing.bitrateSampleCount,
      });
    } else {
      urlMetricsRef.current.set(streamUrl, {
        latency,
        lastSuccess: Date.now(),
        errorCount: 0,
        successCount: 1,
        lastUsed: Date.now(),
        bufferingCount: 0,
        avgBitrate: 0,
        bitrateSampleCount: 0,
      });
    }

    pruneUrlMetrics();
  };

  // Update metrics on failure
  const recordUrlFailure = (streamUrl: string) => {
    const existing = urlMetricsRef.current.get(streamUrl);
    if (existing) {
      urlMetricsRef.current.set(streamUrl, {
        ...existing,
        errorCount: existing.errorCount + 1,
        lastUsed: Date.now(),
      });
    } else {
      urlMetricsRef.current.set(streamUrl, {
        latency: 5000, // assume high latency
        lastSuccess: 0,
        errorCount: 1,
        successCount: 0,
        lastUsed: Date.now(),
        bufferingCount: 0,
        avgBitrate: 0,
        bitrateSampleCount: 0,
      });
    }

    pruneUrlMetrics();
  };

  // Update metrics on buffering event
  const recordBufferingEvent = (streamUrl: string) => {
    const existing = urlMetricsRef.current.get(streamUrl);
    if (existing) {
      const newBufferingCount = existing.bufferingCount + 1;
      urlMetricsRef.current.set(streamUrl, {
        ...existing,
        bufferingCount: newBufferingCount,
        lastUsed: Date.now(),
      });

      // Adaptive buffering: increase cache-secs based on buffering events
      // Base: 10s, increase by 2s per buffering event, max 60s
      const newCacheSecs = Math.min(10 + newBufferingCount * 2, 60);
      if (newCacheSecs !== currentCacheSecsRef.current) {
        currentCacheSecsRef.current = newCacheSecs;
        void setProperty('cache-secs', newCacheSecs.toString());
      }

      pruneUrlMetrics();
    }
  };

  // Update metrics on bitrate change
  const recordBitrate = (streamUrl: string, bitrate: number) => {
    const existing = urlMetricsRef.current.get(streamUrl);
    if (existing) {
      // Weighted average based on sample count to handle irregular events
      const sampleCount = existing.bitrateSampleCount;
      const newBitrate = sampleCount === 0
        ? bitrate
        : (existing.avgBitrate * sampleCount + bitrate) / (sampleCount + 1);
      urlMetricsRef.current.set(streamUrl, {
        ...existing,
        avgBitrate: newBitrate,
        bitrateSampleCount: sampleCount + 1,
        lastUsed: Date.now(),
      });

      pruneUrlMetrics();
    }
  };

  // Property handlers for observeProperties callback
  const handleTimePos = useCallback((data: unknown) => {
    if (typeof data !== 'number') return;
    currentTimeRef.current = data;
    currentTimeStore.setValue(data);
    lastTimeUpdateRef.current = Date.now();
    // Track first time-pos for fallback success detection
    if (firstTimePosRef.current === 0 && data > 0) {
      firstTimePosRef.current = Date.now();
    }
    // Fallback: if video-params never received, trigger success after 2s of playback
    if (onSuccessRef.current && data > 0 && !videoParamsReceivedRef.current && firstTimePosRef.current > 0) {
      const now = Date.now();
      if (now - firstTimePosRef.current > 2000) {
        onSuccessRef.current();
      }
    }
  }, []);

  const handleDuration = useCallback((data: unknown) => {
    if (typeof data !== 'number') return;
    setDuration(data);
    durationRef.current = data;
  }, []);

  const handleVideoParams = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const params = data as { w?: number; h?: number; fps?: number };
    setVideoParams(prev => {
      if (prev?.width === params.w && prev?.height === params.h && prev?.fps === params.fps) return prev;
      return { width: params.w, height: params.h, fps: Math.round(params.fps ?? 0) };
    });
    // Mark that we received video params (primary success indicator)
    videoParamsReceivedRef.current = true;
    // Video actually started rendering - success!
    if (onSuccessRef.current) {
      onSuccessRef.current();
    }
  }, []);

  const handlePause = useCallback((data: unknown) => {
    if (typeof data !== 'boolean') return;
    setIsPaused(data);
    isPausedRef.current = data;
  }, []);

  const handleTrackList = useCallback((data: unknown) => {
    if (!Array.isArray(data)) return;
    const parsedTracks: Track[] = data.map((t: any) => ({
      id: String(t.id),
      type: t.type,
      title: t.title,
      lang: t.lang,
      selected: t.selected,
    }));

    // Diff check to prevent render spam from noisy MPV track-list events
    const currentTracks = tracksRef.current;
    if (parsedTracks.length === currentTracks.length) {
      const isSame = parsedTracks.every((track, i) => 
        track.id === currentTracks[i].id &&
        track.type === currentTracks[i].type &&
        track.title === currentTracks[i].title &&
        track.lang === currentTracks[i].lang &&
        track.selected === currentTracks[i].selected
      );
      if (isSame) return;
    }

    setTracks(parsedTracks);
  }, []);

  const handleAid = useCallback((data: unknown) => {
    if (data === null || data === undefined) {
      setCurrentAudioId(null);
      return;
    }
    if (typeof data === 'string' || typeof data === 'number') {
      setCurrentAudioId(String(data));
    }
  }, []);

  const handleSid = useCallback((data: unknown) => {
    if (data === null || data === undefined) {
      setCurrentSubId(null);
      return;
    }
    if (typeof data === 'string' || typeof data === 'number') {
      setCurrentSubId(String(data));
    }
  }, []);

  const handleCacheBufferingState = useCallback((data: unknown) => {
    if (typeof data !== 'number') return;
    // Track buffering events - state > 0 means buffering (debounced to 2s)
    if (data > 0) {
      const now = Date.now();
      if (now - lastBufferingRef.current > 2000) {
        lastBufferingRef.current = now;
        recordBufferingEvent(currentStreamUrlRef.current);
      }
    }
  }, []);

  const handleVideoBitrate = useCallback((data: unknown) => {
    if (typeof data !== 'number') return;
    // Track bitrate (in bits per second, convert to kbps)
    recordBitrate(currentStreamUrlRef.current, data / 1000);
  }, []);

  // Helper: finalize playback - centralized completion handler
  const finalizePlayback = useCallback((_reason: 'end-file' | 'near-end' | 'timeout') => {
    if (isEndedRef.current) return;
    isEndedRef.current = true;

    // Mark as watched for VOD when video ended (end-file) or near-end detected
    // near-end sets isEndedRef=true which blocks the subsequent end-file event, so both must mark as watched
    // Use refs instead of props to avoid stale closure when movieId changes during autoplay
    if (isVodRef.current && movieIdRef.current && markAsWatched && durationRef.current > 0) {
      markAsWatched(movieIdRef.current, durationRef.current);
    }

    // Trigger onEnded callback
    if (onEndedRef.current) {
      onEndedRef.current();
    }

  }, [markAsWatched]);

  const handleEndFile = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const endData = data as { reason: number };
    // reason 0 = EOF (normal end), 3 = quit, etc.
    // Only trigger onEnded for normal end (reason 0)
    if (endData.reason === 0) {
      finalizePlayback('end-file');
    }
  }, [finalizePlayback]);

  const clearAllTimers = useCallback(() => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (connTimeoutRef.current) { clearTimeout(connTimeoutRef.current); connTimeoutRef.current = null; }
  }, []);

  const safeDestroyMpv = useCallback(async () => {
    if (!mpvRunningRef.current) return;
    mpvRunningRef.current = false;
    try { await destroy(); } catch { /* already dead */ }
  }, []);

  const cleanup = useCallback(async (savePosition: boolean = false) => {
    // Save position ONLY when explicitly requested (player close, not URL change)
    // This prevents saving old time from previous episode when autoplay changes episode
    if (savePosition && isVodRef.current && movieIdRef.current && currentTimeRef.current > 30) {
      if (lastSavedMovieIdRef.current !== movieIdRef.current) {
        setPosition(movieIdRef.current, currentTimeRef.current, durationRef.current);
        lastSavedMovieIdRef.current = movieIdRef.current;
      }
    }
    // Reset refs after setPosition to prevent old values being used for next stream
    currentTimeRef.current = 0;
    durationRef.current = 0;
    lastTimeUpdateRef.current = Date.now();
    if (unobserveRef.current) {
      unobserveRef.current();
      unobserveRef.current = null;
    }
    clearAllTimers();
    await safeDestroyMpv();
    // Clear loading token - cleanup complete
    loadingTokenRef.current = null;
  }, [setPosition, clearAllTimers, safeDestroyMpv]);

  // Success callback - defined outside loadUrl to avoid closure staleness
  const onSuccessRef = useRef<(() => void) | null>(null);
  const currentStreamUrlRef = useRef<string>('');
  const successCalledRef = useRef(false);
  const loadUrlRef = useRef<((streamUrl: string, urlIdx: number, retry: number) => Promise<void>) | null>(null);

  const streamStateRef = useRef(streamState);
  useEffect(() => { streamStateRef.current = streamState; }, [streamState]);

  const tracksRef = useRef<Track[]>([]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  // Helper: validate request is still current
  const isRequestCurrent = useCallback((requestId: number) => {
    return isMountedRef.current && requestId === requestIdRef.current;
  }, []);

  // Helper: validate loading token is still current
  const isTokenCurrent = useCallback((token: symbol) => {
    return loadingTokenRef.current === token;
  }, []);

  // Helper: generate status message based on retry/fallback state
  const getStatusMessage = useCallback((retry: number, urlIdx: number) => {
    if (retry > 0) {
      const fallbackMsg = urlIdx > 0 ? ` (fallback ${urlIdx})` : '';
      return `Retry ${retry}/${MAX_RETRIES_PER_URL}${fallbackMsg}…`;
    }
    if (urlIdx > 0) {
      return `Fallback ${urlIdx}…`;
    }
    return 'Connecting…';
  }, []);

  // Helper: handle success callback logic
  const handleSuccess = useCallback((requestId: number, loadingToken: symbol) => {
    if (!isRequestCurrent(requestId) || !isTokenCurrent(loadingToken)) return;
    if (successCalledRef.current) return;
    successCalledRef.current = true;

    if (connTimeoutRef.current) {
      clearTimeout(connTimeoutRef.current);
      connTimeoutRef.current = null;
    }

    retryCountRef.current = 0;
    setStreamState('playing');
    setStatusMsg('');

    // Clear loading token - playback is now stable
    loadingTokenRef.current = null;

    try {
      useStreamStore.getState().success(currentStreamUrlRef.current);
      recordUrlSuccess(currentStreamUrlRef.current);
    } catch (err) {
      console.error('Store operation failed:', err);
    }
  }, [isRequestCurrent, isTokenCurrent]);

  // Helper: prepare for new load - reset state and cleanup
  const prepareLoad = useCallback((loadingToken: symbol) => {
    if (!isTokenCurrent(loadingToken)) {
      // Clear loading token - request invalidated
      loadingTokenRef.current = null;
      return false;
    }

    currentTimeRef.current = 0;
    durationRef.current = 0;
    lastTimeUpdateRef.current = Date.now();
    successCalledRef.current = false;
    failedSeekRecoveryRef.current = 0;
    lastSavedMovieIdRef.current = null; // Reset saved movieId for new episode

    clearAllTimers();
    if (unobserveRef.current) {
      unobserveRef.current();
      unobserveRef.current = null;
    }

    return true;
  }, [isTokenCurrent, clearAllTimers]);

  // Helper: set up UI state for loading
  const setupLoadingState = useCallback((retry: number, urlIdx: number, streamUrl: string) => {
    setStreamState('connecting');
    setStatusMsg(getStatusMessage(retry, urlIdx));
    setErrorMsg(null);

    videoParamsReceivedRef.current = false;
    firstTimePosRef.current = 0;
    currentCacheSecsRef.current = 20;
    isEndedRef.current = false;
    lastStallPositionRef.current = 0;
    stallCountAtPositionRef.current = 0;

    recordUrlStart(streamUrl);
  }, [getStatusMessage]);

  // Helper: handle load failure
  const handleLoadFailure = useCallback((streamUrl: string, errorMsg: string, loadingToken: symbol) => {
    if (!isTokenCurrent(loadingToken)) return;

    recordUrlFailure(streamUrl);
    mpvRunningRef.current = false;
    setUsingMpv(false);
    setStreamState('dead');
    setErrorMsg(errorMsg);

    // Clear loading token - load failed
    loadingTokenRef.current = null;
  }, [isTokenCurrent]);

  // Helper: calculate exponential backoff delay for retries
  const getRetryDelay = useCallback((retryCount: number) => {
    // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
    return Math.min(1000 * Math.pow(2, retryCount), 10000);
  }, []);

  // Helper: schedule retry or fallback
  const scheduleRetry = useCallback((
    streamUrl: string,
    urlIdx: number,
    requestId: number,
    loadingToken: symbol
  ) => {
    if (!isRequestCurrent(requestId) || !isTokenCurrent(loadingToken)) return;

    if (retryCountRef.current < MAX_RETRIES_PER_URL) {
      setStreamState('retrying');
      const delay = getRetryDelay(retryCountRef.current);
      retryTimerRef.current = setTimeout(() => {
        loadUrlRef.current?.(streamUrl, urlIdx, retryCountRef.current);
      }, delay);
      return;
    }

    currentIdxRef.current++;

    if (currentIdxRef.current < allUrlsRef.current.length) {
      setStatusMsg(`Switching to fallback ${currentIdxRef.current}…`);
      retryCountRef.current = 0;
      setCurrentUrlIdx(currentIdxRef.current);
      // Use minimal delay for fallback switching (different URL, not same retry)
      retryTimerRef.current = setTimeout(() => {
        loadUrlRef.current?.(
          allUrlsRef.current[currentIdxRef.current],
          currentIdxRef.current,
          0
        );
      }, 1000);
    } else {
      handleLoadFailure(streamUrl, 'All streams failed', loadingToken);
    }
  }, [isRequestCurrent, isTokenCurrent, getRetryDelay, handleLoadFailure]);

  // Helper: handle timeout retry/fallback logic (defined before loadUrl to avoid circular dependency)
  const handleTimeoutRetry = useCallback((
    streamUrl: string,
    urlIdx: number,
    requestId: number,
    loadingToken: symbol
  ) => {
    if (!isRequestCurrent(requestId) || !isTokenCurrent(loadingToken)) return;

    console.warn('⏱ Connection timeout');
    recordUrlFailure(streamUrl);
    retryCountRef.current++;
    setTotalRetries(prev => prev + 1);

    // Delegate to scheduleRetry for retry/fallback logic
    // Don't clear loading token here - scheduleRetry will handle it properly
    scheduleRetry(streamUrl, urlIdx, requestId, loadingToken);
  }, [isRequestCurrent, isTokenCurrent, scheduleRetry]);

  // Helper: initialize MPV and setup property observers
  const initializeMpv = useCallback(async (
    streamUrl: string,
    volume: number,
    hwAccelEnabled: boolean,
    requestId: number,
    loadingToken: symbol
  ) => {
    if (!isRequestCurrent(requestId) || !isTokenCurrent(loadingToken)) {
      await safeDestroyMpv();
      return false;
    }

    mpvRunningRef.current = true;

    // Read MPV settings from store for configurable values
    let cacheSecs = '30', networkTimeout = '120', demuxerReadahead = '5';
    let streamBufferSize = '8M', reconnectDelayMax = '10', hwdecValue = hwAccelEnabled ? 'auto-safe' : 'no';
    try {
      const { getSetting } = await import('@/hooks/useSettings');
      cacheSecs = String(await getSetting('mpvCacheSecs'));
      networkTimeout = String(await getSetting('mpvNetworkTimeout'));
      demuxerReadahead = String(await getSetting('mpvDemuxerReadahead'));
      streamBufferSize = await getSetting('mpvStreamBufferSize');
      reconnectDelayMax = String(await getSetting('mpvReconnectDelayMax'));
      const enableHwdec = await getSetting('mpvEnableHwdec');
      hwdecValue = enableHwdec ? 'auto-safe' : 'no';
    } catch {
      // Fall back to defaults if settings unavailable
    }

    const mpvConfig = {
      initialOptions: {
        'hwdec': hwdecValue,
        'keep-open': 'yes',
        'cache': 'yes',
        'cache-secs': cacheSecs,
        'demuxer-readahead-secs': demuxerReadahead,
        'demuxer-max-bytes': '100MiB',
        'demuxer-max-back-bytes': '50MiB',
        'network-timeout': networkTimeout,
        'stream-buffer-size': streamBufferSize,
        'aid': 'auto',
        'sid': 'no',
        'sub-auto': 'no',
        'stream-lavf-o': [
          'reconnect=1',
          'reconnect_streamed=1',
          'reconnect_on_network_error=1',
          'reconnect_on_http_error=4xx,5xx',
          `reconnect_delay_max=${reconnectDelayMax}`,
          'timeout=30000000',
        ].join(','),
      },
      observedProperties: OBSERVED_PROPERTIES,
    };

    await init(mpvConfig);

    if (!isRequestCurrent(requestId) || !isTokenCurrent(loadingToken)) {
      await safeDestroyMpv();
      return false;
    }

    let unobserve: (() => void) | null = null;
    try {
      // Property handler map for cleaner, more extensible property handling
      const propertyHandlers: Record<string, (data: unknown) => void> = {
        'time-pos': handleTimePos,
        'duration': handleDuration,
        'video-params': handleVideoParams,
        'pause': handlePause,
        'track-list': handleTrackList,
        'aid': handleAid,
        'sid': handleSid,
        'cache-buffering-state': handleCacheBufferingState,
        'video-bitrate': handleVideoBitrate,
        'end-file': handleEndFile,
      };

      unobserve = await observeProperties(OBSERVED_PROPERTIES, ({ name, data }) => {
        if (!isMountedRef.current) return;

        propertyHandlers[name]?.(data);
      });
      unobserveRef.current = unobserve;
    } catch (e) {
      try { unobserve?.(); } catch {}
      unobserveRef.current = null;
      console.error('❌ observeProperties failed:', e);
      handleLoadFailure(streamUrl, 'Observer setup failed. Native player required.', loadingToken);
      // Destroy MPV to prevent partially initialized instance
      await safeDestroyMpv();
      return false;
    }

    if (!isRequestCurrent(requestId) || !isTokenCurrent(loadingToken)) {
      await safeDestroyMpv();
      return false;
    }

    // Use start option to begin at resume position, avoiding flash of first second
    const startTime = resumePositionRef.current > 0 ? resumePositionRef.current : 0;
    if (startTime > 0) {
      await setProperty('start', startTime.toString());
      // Reduce cache for faster resume
      await setProperty('cache-secs', '5');
      await setProperty('demuxer-readahead-secs', '2');
    }
    await command('loadfile', [streamUrl]);
    await setProperty('volume', Math.round(volume * 100));
    return true;
  }, [isRequestCurrent, isTokenCurrent, safeDestroyMpv, handleLoadFailure]);

  // Note: recordUrlStart, recordUrlSuccess, recordUrlFailure are intentionally
  // excluded from deps - they are memoized via useCallback([]) with stable refs.
  // clearAllTimers and safeDestroyMpv also use refs internally, making them safe.
  const loadUrl = useCallback(async (streamUrl: string, urlIdx: number, retry: number) => {
    const requestId = ++requestIdRef.current;
    const loadingToken = Symbol();
    currentStreamUrlRef.current = streamUrl;
    successCalledRef.current = false;

    // Set loading token for this operation
    loadingTokenRef.current = loadingToken;

    if (!isMountedRef.current) {
      return;
    }

    const localRequestId = requestId;

    // Step 1: Prepare for load (reset state and cleanup)
    if (!prepareLoad(loadingToken)) {
      return;
    }

    // Step 2: Set up UI state and metrics BEFORE init
    // This ensures callbacks are ready before MPV starts firing events
    setupLoadingState(retry, urlIdx, streamUrl);

    // Step 3: Set up success callback BEFORE init
    // This prevents lost success events from race condition
    onSuccessRef.current = () => handleSuccess(requestId, loadingToken);

    // Step 4: Set up timeout callback
    connTimeoutRef.current = setTimeout(() => {
      handleTimeoutRetry(streamUrl, urlIdx, requestId, loadingToken);
    }, DEAD_TIMEOUT_MS);

    // Step 5: Serialize MPV lifecycle operations to prevent race conditions
    // This ensures destroy+init don't overlap with other lifecycle operations
    const currentPromise = lifecycleQueueRef.current;
    const newPromise = currentPromise.then(async () => {
      if (!isTokenCurrent(loadingToken)) {
        return false;
      }

      // Destroy old MPV instance
      await safeDestroyMpv();
      if (!isTokenCurrent(loadingToken)) {
        return false;
      }

      // Initialize new MPV instance
      const volume = volumeRef.current;
      const hwAccelEnabled = hwAccelEnabledRef.current;
      return await initializeMpv(streamUrl, volume, hwAccelEnabled, localRequestId, loadingToken);
    }).catch(err => {
      console.error('Lifecycle error:', err);
      return false;
    }).finally(() => {
      // Reset queue to prevent Promise chain from growing indefinitely
      // Only reset if this is still the current queue (no newer queue started)
      if (lifecycleQueueRef.current === newPromise) {
        lifecycleQueueRef.current = Promise.resolve(true);
      }
    });

    lifecycleQueueRef.current = newPromise;

    const initialized = await lifecycleQueueRef.current;
    if (!initialized) {
      // Clear loading token - init failed
      loadingTokenRef.current = null;
      return;
    }

    // Set MPV as active after successful init
    setUsingMpv(true);
  }, [prepareLoad, safeDestroyMpv, setupLoadingState, handleSuccess, initializeMpv, handleLoadFailure, isTokenCurrent, handleTimeoutRetry]);

  // Update loadUrlRef after loadUrl is defined to avoid circular dependency
  useEffect(() => {
    loadUrlRef.current = loadUrl;
  }, [loadUrl]);

  const handleManualRetry = useCallback((preserveIndex = false) => {
    // Throttle manual retries to prevent chaos
    if (Date.now() - lastManualRetryRef.current < 2000) return;
    lastManualRetryRef.current = Date.now();

    allUrlsRef.current = getRankedUrls();

    if (!preserveIndex) {
      currentIdxRef.current = 0;
      retryCountRef.current = 0;
      setCurrentUrlIdx(0);
    }

    setTotalRetries(0);
    void loadUrl(allUrlsRef.current[currentIdxRef.current], currentIdxRef.current, 0);
  }, [getRankedUrls, loadUrl]);

  // Keep handleManualRetryRef updated
  useEffect(() => {
    handleManualRetryRef.current = handleManualRetry;
  }, [handleManualRetry]);

  // Keep onEndedRef updated to avoid stale closure
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const isLoading = streamState === 'connecting' || streamState === 'retrying' || streamState === 'stalled';

  // Helper: check if stall detection should be skipped
  const shouldSkipStallCheck = useCallback(() => {
    // If there's no active loading token, we're not loading
    const isCurrentlyLoading = loadingTokenRef.current !== null;
    return (
      streamStateRef.current !== 'playing' ||
      isCurrentlyLoading ||
      !mpvRunningRef.current ||
      retryCountRef.current > 0 ||
      isEndedRef.current ||
      isPausedRef.current
    );
  }, []);

  // Helper: check VOD end and trigger onEnded if appropriate
  const checkVodEnd = useCallback(() => {
    const isNearEnd = durationRef.current > 0 && currentTimeRef.current > durationRef.current * 0.998;
    const secondsFromEnd = durationRef.current - currentTimeRef.current;
    const isActuallyEnding = isNearEnd || (durationRef.current > 0 && secondsFromEnd < 11);

    if (isActuallyEnding) {
      finalizePlayback('near-end');
      return true;
    }

    const isApproachingEnd = durationRef.current > 0 && currentTimeRef.current > durationRef.current * 0.95;
    if (isApproachingEnd) return true;

    return false;
  }, [finalizePlayback]);

  // Track stall position to detect repeated stalls at same spot
  const lastStallPositionRef = useRef<number>(0);
  const stallCountAtPositionRef = useRef(0);

  // Helper: handle stall recovery — for live TV just increase cache (no seek, which causes chop)
  const handleStallRecovery = useCallback((stallTimeout: number, now: number) => {
    if (now - lastRetryRef.current < 20000) return;
    lastRetryRef.current = now;

    const currentPos = currentTimeRef.current || 0;
    console.warn(`⚠️ Stream stalled - no time update for ${stallTimeout / 1000}s at position ${currentPos.toFixed(1)}s`);
    setStreamState('stalled');

    // For live TV: just increase cache and wait — no seek (seeking forward causes the chop/glitch)
    if (!isVodRef.current) {
      const recoveryCacheSecs = Math.min(currentCacheSecsRef.current + 10, 60);
      void setProperty('cache-secs', recoveryCacheSecs.toString());
      return;
    }

    // Check if stalling at same position repeatedly - restart from beginning
    const hasPlaybackStarted = firstTimePosRef.current > 0;
    const isBeyondInitialPosition = currentPos > 0;
    if (hasPlaybackStarted && isBeyondInitialPosition && Math.abs(currentPos - lastStallPositionRef.current) < 10) {
      stallCountAtPositionRef.current++;
      console.warn(`📍 Same position stall detected: count=${stallCountAtPositionRef.current}`);
      if (stallCountAtPositionRef.current >= 2) {
        console.warn('🔄 Stalling at same position, restarting stream from beginning');
        stallCountAtPositionRef.current = 0;
        lastStallPositionRef.current = 0;
        void setProperty('cache-secs', '5');
        void command('seek', [0, 'absolute']);
        return;
      }
    } else {
      stallCountAtPositionRef.current = 0;
    }
    lastStallPositionRef.current = currentPos;

    if (failedSeekRecoveryRef.current >= 2) {
      console.warn('🔄 Multiple seek recoveries failed, doing full retry');
      failedSeekRecoveryRef.current = 0;
      handleManualRetryRef.current?.(true);
      return;
    }

    const recoveryCacheSecs = Math.min(currentCacheSecsRef.current + 10, 60);
    void setProperty('cache-secs', recoveryCacheSecs.toString());

    const seekTarget = Math.max(0, currentPos + 5);

    void command('seek', [seekTarget, 'absolute']).then(async () => {
      setStreamState('playing');
      failedSeekRecoveryRef.current = 0;
      if (currentAudioId) {
        try {
          await setProperty('aid', currentAudioId);
        } catch (e) {
          console.warn('⚠️ Audio track reinit failed:', e);
        }
      }
    }).catch(() => {
      console.warn('⏱ Seek recovery failed, falling back to retry');
      failedSeekRecoveryRef.current++;
      handleManualRetryRef.current?.(true);
    });
  }, [currentAudioId]);

  // Stall detection watchdog + End detection for VOD
  useEffect(() => {
    const interval = setInterval(() => {
      if (shouldSkipStallCheck()) return;

      const now = Date.now();
      const timeSinceLastUpdate = now - lastTimeUpdateRef.current;

      if (isVod) {
        if (checkVodEnd()) return;
      }

      const stallTimeout = isVod ? 25000 : 20000;

      if (timeSinceLastUpdate > stallTimeout) {
        handleStallRecovery(stallTimeout, now);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isVod, shouldSkipStallCheck, checkVodEnd, handleStallRecovery]);

  const setAudioTrack = useCallback(async (id: string) => {
    try {
      await setProperty('aid', id);
    } catch (e) { console.error('Set audio track failed:', e); }
  }, []);

  const setSubTrack = useCallback(async (id: string) => {
    try {
      await setProperty('sid', id);
    } catch (e) { console.error('Set sub track failed:', e); }
  }, []);

  return {
    streamState,
    setStreamState,
    currentUrlIdx,
    totalRetries,
    statusMsg,
    setStatusMsg,
    errorMsg,
    usingMpv,
    videoParams,
    currentTime,
    duration,
    isPaused,
    isLoading,
    tracks,
    currentAudioId,
    currentSubId,
    handleManualRetry,
    loadUrl,
    cleanup,
    getRankedUrls,
    setAudioTrack,
    setSubTrack,
  };
}
