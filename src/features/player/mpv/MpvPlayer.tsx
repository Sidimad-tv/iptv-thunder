// =========================
// 🎬 PLAYER — MPV Only
// =========================

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useChannelEPG } from '@/features/epg/epg.hooks';
import { getCurrentProgram } from '@/features/epg/epg.api';
import { useResumeStore } from '@/store/resume.store';
import { PlayerProps } from './mpv.types';
import { useMpvPlayer } from './useMpvPlayer';
import { usePlayerControls } from './usePlayerControls';
import { PlayerHeader } from './components/PlayerHeader';
import { PlayerControls } from './components/PlayerControls';
import { DeadState } from './components/DeadState';
import { EPGDetailsModal } from './components/EPGDetailsModal';
import { useChannels } from '@/features/tv/tv.hooks';
import { StalkerChannel } from '@/types';
import { useRecentViewed } from '@/hooks/useRecentItems';
import { usePortalsStore } from '@/store/portals.store';
import { usePlaybackStore } from '@/store/playback.store';

// ─── Main Component ───────────────────────────────────────────────────────────
const MpvPlayerComponent: React.FC<PlayerProps> = ({
  url, name, channelId, client, buffering = false, isVod = false, movieId, resumePosition = 0, genreId, onClose, onEnded, onNextEpisode, onChannelChange,
}) => {

  const { setPosition, markAsWatched } = useResumeStore();
  const mpv = useMpvPlayer(url, isVod, movieId, setPosition, onEnded, markAsWatched, resumePosition);
  const controls = usePlayerControls();

  // Single EPG query for 24 hours - used by both current program and EPG modal
  // Only fetch when we have a valid client
  const { data: channelEPG, isLoading: epgLoading } = useChannelEPG(
    client, channelId ?? 0, name, 24, !isVod && !!channelId && !!client
  );

  // Force current program recalculation every 30 seconds to handle program end transitions
  const [epgTick, setEpgTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setEpgTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Derive current program from channelEPG data instead of making separate query
  // Memoize it so it only recalculates when EPG data changes OR when epgTick updates (every 30s)
  const currentProgram = useMemo(() =>
    channelEPG ? getCurrentProgram(channelEPG) : null
  , [channelEPG, epgTick]);

  const [showEPGModal, setShowEPGModal] = useState(false);

  // Fetch channels from the same category/genre (only for TV channels, not VOD/movies)
  // Only enable when we have a valid genreId to avoid fetching ALL channels (category: "*")
  const { data: categoryChannels } = useChannels(
    client!,
    isVod ? undefined : genreId,
    false, // Disable EPG prefetching when playing from for-you/recent-channels
    !isVod && !!genreId // Only enabled for TV when we have a valid genreId
  );

  // Fetch recent channels for quick switching
  const activePortalId = usePortalsStore(s => s.activePortalId);
  const { recentItems: recentLiveItems } = useRecentViewed(activePortalId || '', 'live', 20);

  // Convert recent items to channel format for player
  const recentChannels = useMemo(() => {
    return recentLiveItems
      .filter(item => item.type === 'live' && item.cmd)
      .map(item => ({
        id: Number(item.item_id) || 0,
        name: item.name,
        cmd: item.cmd || '',
        logo: item.poster,
        number: 0,
        censored: false,
        tv_genre_id: item.genre_id ? Number.parseInt(item.genre_id) : undefined,
      }));
  }, [recentLiveItems]);
  const hasResumedRef = useRef(false);
  const hasEverPlayedRef = useRef(false);
  const urlChangeIdRef = useRef(0);

  // Cleanup on unmount and before page unload - empty deps to run once
  useEffect(() => {
    const cleanupRef = mpv.cleanup;
    const handleBeforeUnload = () => void cleanupRef(true); // Save position on close
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      void cleanupRef(true); // Save position on unmount
    };
  }, []);

  // Initial load on URL change
  useEffect(() => {
    const { cleanup, loadUrl, getRankedUrls, setStreamState, setStatusMsg } = mpv;
    hasResumedRef.current = false;
    hasEverPlayedRef.current = false;

    const requestId = ++urlChangeIdRef.current;

    const doLoad = async () => {
      if (requestId !== urlChangeIdRef.current) {
        return;
      }

      // Reset state for new stream
      setStreamState('connecting');
      setStatusMsg('Connecting…');
      // Use ranked URLs for smart priority ordering
      const ranked = getRankedUrls ? getRankedUrls() : [url];
      void loadUrl(ranked[0], 0, 0);
    };

    // Always cleanup before loading new URL to reset currentTimeRef
    // This prevents old time values from being used for new episodes
    // Don't save position on URL change (only on player close)
    void cleanup(false).then(() => doLoad()).catch(err => {
      console.error(`❌ cleanup failed: requestId=${requestId}`, err);
    });

    return () => {
      // Increment requestId to cancel pending load
      urlChangeIdRef.current++;
    };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track whether playback has ever started (to keep poster only on initial load)
  useEffect(() => {
    if (mpv.streamState === 'playing') {
      hasEverPlayedRef.current = true;
    }
  }, [mpv.streamState]);

  // Simple URL list
  const allUrls = useMemo(() => [url], [url]);

  // Determine if this is a series with a next episode available
  const contentType = usePlaybackStore(s => s.contentType);
  const episodes = usePlaybackStore(s => s.current?.episodes);
  const currentEpisodeIndex = usePlaybackStore(s => s.current?.currentEpisodeIndex);
  const hasNextEpisode = contentType === 'series' && episodes && currentEpisodeIndex !== undefined && currentEpisodeIndex < episodes.length - 1;

  const handleNextEpisode = useCallback(() => {
    if (onNextEpisode && hasNextEpisode) {
      onNextEpisode();
    }
  }, [onNextEpisode, hasNextEpisode]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (controls.isFullscreen) {
        void controls.handleFullscreen();
      } else {
        void controls.handleClose(onClose);
      }
    }
    if (e.key === 'f' || e.key === 'F') {
      void controls.handleFullscreen();
    }
    if (e.key === ' ') {
      e.preventDefault();
      void controls.handlePlayPause();
    }
    if (e.key === 'ArrowLeft' && isVod) {
      e.preventDefault();
      void controls.handleSeek(-10);
    }
    if (e.key === 'ArrowRight' && isVod) {
      e.preventDefault();
      void controls.handleSeek(10);
    }
    if ((e.key === 'n' || e.key === 'N') && hasNextEpisode && onNextEpisode) {
      e.preventDefault();
      onNextEpisode();
    }
  }, [controls.isFullscreen, controls.handleFullscreen, controls.handleClose, controls.handlePlayPause, controls.handleSeek, isVod, onClose, hasNextEpisode, onNextEpisode]);

  // Global keyboard handling
  useEffect(() => {
    globalThis.window.addEventListener('keydown', handleKeyDown);
    return () => globalThis.window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isVod || !mpv.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetTime = percentage * mpv.duration;
    void controls.seekTo(targetTime, mpv.duration);
  }, [isVod, mpv.duration, controls.seekTo]);

  const handleShowEPG = useCallback(() => {
    setShowEPGModal(true);
  }, []);

  const handleCloseEPGModal = useCallback(() => {
    setShowEPGModal(false);
  }, []);

  const handleChannelSelect = useCallback((channel: StalkerChannel) => {
    if (onChannelChange) {
      onChannelChange(channel);
    }
  }, [onChannelChange]);

  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

  const handleToggleAlwaysOnTop = useCallback(async () => {
    try {
      const w = getCurrentWindow();
      await w.setAlwaysOnTop(!isAlwaysOnTop);
      setIsAlwaysOnTop(!isAlwaysOnTop);
    } catch (e) {
      console.error('Toggle always on top failed', e);
    }
  }, [isAlwaysOnTop]);

  const handleRefreshStream = useCallback(() => {
    mpv.handleManualRetry();
  }, [mpv.handleManualRetry]);

  const handleClosePlayer = useCallback(() => {
    void controls.handleClose(onClose);
  }, [controls.handleClose, onClose]);

  const handlePlayPause = useCallback(() => void controls.handlePlayPause(), [controls.handlePlayPause]);
  const handleVolumeChange = useCallback((v: number) => void controls.handleVolumeChange(v), [controls.handleVolumeChange]);
  const handleSetAudioTrack = useCallback((id: string) => void mpv.setAudioTrack(id), [mpv.setAudioTrack]);
  const handleSetSubTrack = useCallback((id: string) => void mpv.setSubTrack(id), [mpv.setSubTrack]);
  const handleFullscreen = useCallback(() => void controls.handleFullscreen(), [controls.handleFullscreen]);
  const handlePip = useCallback(() => void controls.handlePip(), [controls.handlePip]);
  const handleSeekToBeginning = useCallback(() => void controls.seekTo(0, mpv.duration), [controls.seekTo, mpv.duration]);

  // Poster only on first connecting (before first playback ever starts)
  const showPoster = mpv.streamState === 'connecting' && !hasEverPlayedRef.current;
  // Small notification banner during retry/stall after playback has started
  const showRetryBanner = hasEverPlayedRef.current && (mpv.streamState === 'retrying' || mpv.streamState === 'stalled');
  const showConnectingBanner = hasEverPlayedRef.current && mpv.streamState === 'connecting';

  return (
    <main
      className={`fixed z-50 flex items-center justify-center ${controls.isFullscreen ? 'inset-0' : 'left-0 right-0 bottom-0'}`}
      style={{ background: 'transparent', top: controls.isFullscreen ? 0 : 40 }}
      aria-labelledby="player-title"
      role="application"
    >
      <div
        className="relative w-full h-full flex flex-col"
        style={{ background: 'transparent', cursor: controls.isFullscreen && !controls.showUi ? 'none' : 'auto' }}
        onMouseMove={controls.handleMouseMove}
      >
        {!controls.isPip ? (
          <PlayerHeader
            name={name}
            streamState={mpv.streamState}
            usingMpv={mpv.usingMpv}
            videoParams={mpv.videoParams}
            totalRetries={mpv.totalRetries}
            currentUrlIdx={mpv.currentUrlIdx}
            urlCount={allUrls.length}
            currentProgram={currentProgram}
            isVod={isVod}
            isLoading={mpv.isLoading || buffering}
            statusMsg={mpv.statusMsg}
            isFullscreen={controls.isFullscreen}
            showUi={controls.showUi}
          />
        ) : (
          <button
            onClick={handlePip}
            className="absolute bottom-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg transition-colors"
            title="Exit PiP"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
            </svg>
          </button>
        )}

        <div className="flex-1 relative overflow-hidden" style={{ background: 'transparent' }}>
          {/* Watermark — shown when playing */}
          {mpv.streamState === 'playing' && (
            <div className="absolute top-4 left-4 z-10 opacity-60 pointer-events-none">
              <img
                src="https://cdn.jsdelivr.net/gh/Sidimadtv/all/sidi/assets/images/logo.png"
                alt="S!d!m@dtv-STB"
                className="w-20 h-20 object-contain animate-spin"
                style={{ animationDuration: '6s' }}
              />
            </div>
          )}

          {/* Poster — full-screen splash on initial load only (before first play ever) */}
          {showPoster && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-4"
              style={{ background: 'rgba(0,0,0,0.85)' }}>
              <button
                onClick={handleClosePlayer}
                className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <img
                src="https://cdn.jsdelivr.net/gh/Sidimadtv/all/sidi/assets/images/logo.png"
                alt="S!d!m@dtv-STB"
                className="w-20 h-20 object-contain"
              />
              <p className="text-green-500 font-bold text-lg tracking-wider">S!d!m@dtv-STB</p>
              <div className="flex items-center gap-2 mt-1">
                <svg className="animate-spin" style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#333" strokeWidth="2" />
                  <path d="M12 2 A10 10 0 0 1 22 12" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p className="text-gray-300 text-sm">{mpv.statusMsg}</p>
              </div>
            </div>
          )}

          {/* Reconnecting banner — thin translucent bar at top during retry/buffer after playback started */}
          {(showRetryBanner || showConnectingBanner) && (
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 px-4 py-2"
              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)' }}>
              <svg className="animate-spin" style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#333" strokeWidth="2" />
                <path d="M12 2 A10 10 0 0 1 22 12" stroke="#D85A30" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-yellow-400 text-xs font-medium">{mpv.statusMsg || 'Reconnecting…'}</span>
            </div>
          )}

          {/* Dead state */}
          {mpv.streamState === 'dead' && (
            <DeadState
              errorMsg={mpv.errorMsg}
              onRetry={mpv.handleManualRetry}
              onClose={handleClosePlayer}
            />
          )}
        </div>

        {!controls.isPip && (
          <PlayerControls
            isVod={isVod}
            streamState={mpv.streamState}
            isFullscreen={controls.isFullscreen}
            isPip={controls.isPip}
            showUi={controls.showUi}
            isPaused={mpv.isPaused}
            volume={controls.volume}
            currentTime={mpv.currentTime}
            duration={mpv.duration}
            tracks={mpv.tracks}
            currentAudioId={mpv.currentAudioId}
            currentSubId={mpv.currentSubId}
            onPlayPause={handlePlayPause}
            onFullscreen={handleFullscreen}
            onPip={handlePip}
            onClose={handleClosePlayer}
            onVolumeChange={handleVolumeChange}
            onProgressClick={handleProgressClick}
            onShowEPG={handleShowEPG}
            onSetAudioTrack={handleSetAudioTrack}
            onSetSubTrack={handleSetSubTrack}
            onSeekToBeginning={handleSeekToBeginning}
            onNextEpisode={hasNextEpisode ? handleNextEpisode : undefined}
            categoryChannels={!isVod && genreId ? categoryChannels : undefined}
            recentChannels={!isVod ? recentChannels : undefined}
            currentChannelId={channelId}
            onChannelSelect={handleChannelSelect}
            onRefreshStream={handleRefreshStream}
            isAlwaysOnTop={isAlwaysOnTop}
            onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
          />
        )}

        <EPGDetailsModal
          isOpen={showEPGModal}
          onClose={handleCloseEPGModal}
          epgData={channelEPG}
          channelName={name}
          isLoading={epgLoading}
        />
      </div>
    </main>
  );
};

export const MpvPlayer = React.memo(MpvPlayerComponent);
