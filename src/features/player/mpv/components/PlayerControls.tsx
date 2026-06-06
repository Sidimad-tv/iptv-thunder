import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { StreamState, Track } from '../mpv.types';
import { formatDurationTime } from '../mpv.utils';
import { ChannelLogo } from '@/features/tv/ChannelLogo';

interface PlayerControlsProps {
  isVod: boolean;
  streamState: StreamState;
  isFullscreen: boolean;
  isPip: boolean;
  showUi: boolean;
  isPaused: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  tracks: Track[];
  currentAudioId: string | null;
  currentSubId: string | null;
  onPlayPause: () => void;
  onFullscreen: () => void;
  onPip: () => void;
  onClose: () => void;
  onVolumeChange: (v: number) => void;
  onProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onShowEPG: () => void;
  onSetAudioTrack: (id: string) => void;
  onSetSubTrack: (id: string) => void;
  onSeekToBeginning?: () => void;
  onNextEpisode?: () => void;
  categoryChannels?: any[];
  recentChannels?: any[];
  currentChannelId?: number;
  onChannelSelect?: (channel: any) => void;
}

export const PlayerControls = React.memo<PlayerControlsProps>(({
  isVod, streamState, isFullscreen, isPip, showUi, isPaused, volume,
  currentTime, duration, tracks, currentAudioId, currentSubId,
  onPlayPause, onFullscreen, onPip, onClose,
  onVolumeChange, onProgressClick, onShowEPG, onSetAudioTrack, onSetSubTrack, onSeekToBeginning,
  onNextEpisode,
  categoryChannels, recentChannels, currentChannelId, onChannelSelect
}) => {
  const { t } = useTranslation();
  const [showTrackMenu, setShowTrackMenu] = useState(false);
  const [showCategoryChannelsMenu, setShowCategoryChannelsMenu] = useState(false);
  const [showRecentChannelsMenu, setShowRecentChannelsMenu] = useState(false);
  const audioTracks = tracks.filter(t => t.type === 'audio');
  const subTracks = tracks.filter(t => t.type === 'sub');
  const hasTracks = audioTracks.length > 1 || subTracks.length > 0;

  // Refs for scroll position preservation
  const categoryCarouselRef = useRef<HTMLDivElement>(null);
  const recentCarouselRef = useRef<HTMLDivElement>(null);
  const categoryScrollPosRef = useRef(0);
  const recentScrollPosRef = useRef(0);
  const categoryOpenedOnceRef = useRef(false);
  const recentOpenedOnceRef = useRef(false);

  // Save scroll position when category menu closes
  useEffect(() => {
    if (!showCategoryChannelsMenu && categoryCarouselRef.current) {
      categoryScrollPosRef.current = categoryCarouselRef.current.scrollLeft;
    }
  }, [showCategoryChannelsMenu]);

  // Restore scroll position when category menu opens
  useEffect(() => {
    if (showCategoryChannelsMenu && categoryCarouselRef.current) {
      if (categoryOpenedOnceRef.current && categoryScrollPosRef.current > 0) {
        // Restore saved position
        categoryCarouselRef.current.scrollLeft = categoryScrollPosRef.current;
      } else {
        // First open - scroll to current channel
        const currentChannelElement = categoryCarouselRef.current.querySelector(
          `[data-tv-id*="tv-channel-${currentChannelId}"]`
        ) as HTMLElement;
        if (currentChannelElement) {
          const containerWidth = categoryCarouselRef.current.clientWidth;
          const elementLeft = currentChannelElement.offsetLeft;
          const elementWidth = currentChannelElement.clientWidth;
          const targetScroll = elementLeft - (containerWidth / 2) + (elementWidth / 2);
          categoryCarouselRef.current.scrollLeft = Math.max(0, targetScroll);
        }
        categoryOpenedOnceRef.current = true;
      }
    }
  }, [showCategoryChannelsMenu, currentChannelId]);

  // Save scroll position when recent menu closes
  useEffect(() => {
    if (!showRecentChannelsMenu && recentCarouselRef.current) {
      recentScrollPosRef.current = recentCarouselRef.current.scrollLeft;
    }
  }, [showRecentChannelsMenu]);

  // Restore scroll position when recent menu opens
  useEffect(() => {
    if (showRecentChannelsMenu && recentCarouselRef.current) {
      if (recentOpenedOnceRef.current && recentScrollPosRef.current > 0) {
        // Restore saved position
        recentCarouselRef.current.scrollLeft = recentScrollPosRef.current;
      } else {
        // First open - scroll to current channel
        const currentChannelElement = recentCarouselRef.current.querySelector(
          `[data-tv-id*="recent-${currentChannelId}"]`
        ) as HTMLElement;
        if (currentChannelElement) {
          const containerWidth = recentCarouselRef.current.clientWidth;
          const elementLeft = currentChannelElement.offsetLeft;
          const elementWidth = currentChannelElement.clientWidth;
          const targetScroll = elementLeft - (containerWidth / 2) + (elementWidth / 2);
          recentCarouselRef.current.scrollLeft = Math.max(0, targetScroll);
        }
        recentOpenedOnceRef.current = true;
      }
    }
  }, [showRecentChannelsMenu, currentChannelId]);
  // Filter channels for carousel (exclude hidden and current channel)
  const filteredCategoryChannels = categoryChannels?.filter(channel => 
    !channel.name.startsWith('#####') && channel.id !== currentChannelId
  ) || [];

  const hasCategoryChannels = filteredCategoryChannels.length > 0;

  // Filter recent channels (exclude hidden channels and current channel)
  const filteredRecentChannels = recentChannels?.filter(channel => 
    !channel.name.startsWith('#####') && channel.id !== currentChannelId
  ) || [];

  const hasRecentChannels = filteredRecentChannels.length > 0;

  if (streamState !== 'playing' || (isFullscreen && !showUi)) return null;

  return (
    <div className="flex-shrink-0 z-20"
      style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)',
        padding: '16px 20px 20px',
      }}>
      <div className="flex items-center justify-between">
        {/* Left: Controls */}
        <div className="flex items-center gap-3">
          {/* From Beginning Button - VOD only */}
          {isVod && onSeekToBeginning && (
            <button
              data-tv-focusable
              tabIndex={0}
              onClick={onSeekToBeginning}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              title="Od początku"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
              </svg>
            </button>
          )}

          {/* Play/Pause - VOD only */}
          {isVod && (
            <button
              data-tv-focusable
              tabIndex={0}
              onClick={onPlayPause}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              title={isPaused ? 'Play' : 'Pause'}
            >
              {isPaused ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              )}
            </button>
          )}

          {/* Next Episode Button - Series only */}
          {isVod && onNextEpisode && (
            <button
              data-tv-focusable
              tabIndex={0}
              onClick={onNextEpisode}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              title={t('nextEpisode')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>
          )}

          {/* EPG Button - Live TV only */}
          {!isVod && (
            <button
              data-tv-focusable
              tabIndex={0}
              onClick={onShowEPG}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              title="Program TV (EPG)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3h2v2h-2V6zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zM7 6h2v2H7V6zm0 4h2v2H7v-2zm0 4h2v2H7v-2zm10 4h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V6h2v2z"/>
              </svg>
            </button>
          )}

          {/* Category Channels Button - Live TV only */}
          {!isVod && hasCategoryChannels && (
            <button
              data-tv-focusable
              tabIndex={0}
              onClick={() => { setShowCategoryChannelsMenu(!showCategoryChannelsMenu); setShowRecentChannelsMenu(false); }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                showCategoryChannelsMenu ? 'bg-green-500/80 hover:bg-green-500' : 'bg-white/20 hover:bg-white/30'
              }`}
              title={t('categoryChannels')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/>
              </svg>
            </button>
          )}

          {/* Recent Channels Button - Live TV only */}
          {!isVod && hasRecentChannels && (
            <button
              data-tv-focusable
              tabIndex={0}
              onClick={() => { setShowRecentChannelsMenu(!showRecentChannelsMenu); setShowCategoryChannelsMenu(false); }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                showRecentChannelsMenu ? 'bg-blue-500/80 hover:bg-blue-500' : 'bg-white/20 hover:bg-white/30'
              }`}
              title={t('recentChannels') || 'Ostatnie kanały'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
              </svg>
            </button>
          )}

          {/* Track Selection Button */}
          {hasTracks && (
            <div className="relative">
              <button
                data-tv-focusable
                tabIndex={0}
                onClick={() => setShowTrackMenu(!showTrackMenu)}
                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                title={t('trackSelection')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
                </svg>
              </button>

              {showTrackMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-900/95 border border-slate-700 rounded-lg shadow-xl p-3 z-50">
                  {/* Audio Tracks */}
                  {audioTracks.length > 1 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 uppercase mb-1">Audio</p>
                      {audioTracks.map(track => (
                        <button
                          key={track.id}
                          onClick={() => { onSetAudioTrack(track.id); setShowTrackMenu(false); }}
                          className={`w-full text-left px-2 py-1.5 rounded text-sm ${
                            currentAudioId === track.id
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-300 hover:bg-slate-800'
                          }`}
                        >
                          {track.lang || track.title || `${t('audioTrack')} ${track.id}`}
                          {currentAudioId === track.id && ' ✓'}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Subtitle Tracks */}
                  {subTracks.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-1">{t('subtitles')}</p>
                      <button
                        onClick={() => { onSetSubTrack('no'); setShowTrackMenu(false); }}
                        className={`w-full text-left px-2 py-1.5 rounded text-sm ${
                          currentSubId === 'no' || !currentSubId
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:bg-slate-800'
                        }`}
                      >
                        {t('disabled')}
                        {(currentSubId === 'no' || !currentSubId) && ' ✓'}
                      </button>
                      {subTracks.map(track => (
                        <button
                          key={track.id}
                          onClick={() => { onSetSubTrack(track.id); setShowTrackMenu(false); }}
                          className={`w-full text-left px-2 py-1.5 rounded text-sm ${
                            currentSubId === track.id
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-300 hover:bg-slate-800'
                          }`}
                        >
                          {track.lang || track.title || `${t('subtitleTrack')} ${track.id}`}
                          {currentSubId === track.id && ' ✓'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center: Progress Bar (VOD only) */}
        {isVod ? (
          <div className="flex-1 mx-4 h-10 flex flex-col justify-center relative">
            <span className="absolute -left-2 top-0 text-white text-xs">{formatDurationTime(currentTime)}</span>
            <span className="absolute -right-2 top-0 text-white text-xs">{formatDurationTime(duration)}</span>
            <div className="h-1 bg-gray-600 rounded cursor-pointer relative group" onClick={onProgressClick}>
              <div className="h-full bg-red-600 rounded transition-all duration-100"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
              <div className="absolute top-1/2 w-4 h-4 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%`, transform: 'translate(-50%, -50%)' }} />
            </div>
          </div>
        ) : <div className="flex-1" />}

        {/* Volume */}
        <div className="flex items-center gap-2 max-w-[140px] mr-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          <input type="range" min="0" max="100" value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="flex-1 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
            style={{ accentColor: 'white' }} />
        </div>

        {/* Right: Fullscreen, PiP & Close */}
        <div className="flex items-center gap-3">
          <button onClick={onFullscreen} data-tv-focusable tabIndex={0}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            {isFullscreen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            )}
          </button>
          <button onClick={onPip} data-tv-focusable tabIndex={0}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isPip ? 'bg-blue-500/80 hover:bg-blue-500' : 'bg-white/20 hover:bg-white/30'}`}
            title={t('pip')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/>
            </svg>
          </button>
          <button onClick={onClose} data-tv-focusable tabIndex={0}
            className="w-10 h-10 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-colors"
            title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Category Channels Carousel - Live TV only */}
      {showCategoryChannelsMenu && !isVod && hasCategoryChannels && (
        <div className="mt-4 border-t border-gray-700/50 pt-4">
          <div
            ref={categoryCarouselRef}
            className="flex items-center gap-4 overflow-x-auto px-2 pb-2"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#4b5563 transparent',
            }}
          >
            {filteredCategoryChannels.map((channel) => {
              const isCurrent = channel.id === currentChannelId;
              return (
                <button
                  key={channel.id}
                  onClick={() => {
                    if (onChannelSelect && !isCurrent) {
                      onChannelSelect(channel);
                    }
                    setShowCategoryChannelsMenu(false);
                  }}
                  disabled={isCurrent}
                  className={`flex-shrink-0 w-[140px] p-3 rounded-lg transition-all flex flex-col items-center gap-2 ${
                    isCurrent
                      ? 'bg-green-600/30 border-2 border-green-500 cursor-not-allowed'
                      : 'bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700 hover:border-green-500 cursor-pointer'
                  }`}
                  data-tv-focusable
                  tabIndex={0}
                >
                  <div className="w-16 h-16 flex items-center justify-center">
                    <ChannelLogo logo={channel.logo} name={channel.name} />
                  </div>
                  <span className={`text-xs text-center line-clamp-2 ${
                    isCurrent ? 'text-green-400 font-medium' : 'text-gray-200'
                  }`}>
                    {channel.name}
                  </span>
                  {isCurrent && (
                    <span className="text-xs text-green-400">🔴</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Channels Carousel - Live TV only */}
      {showRecentChannelsMenu && !isVod && hasRecentChannels && (
        <div className="mt-4 border-t border-gray-700/50 pt-4">
          <div className="px-2 pb-2 text-xs text-gray-400">
            {t('recentChannels') || 'Ostatnie kanały'}
          </div>
          <div
            ref={recentCarouselRef}
            className="flex items-center gap-4 overflow-x-auto px-2 pb-2"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#4b5563 transparent',
            }}
          >
            {filteredRecentChannels.map((channel) => {
              const isCurrent = channel.id === currentChannelId;
              return (
                <button
                  key={`recent-${channel.id}`}
                  onClick={() => {
                    if (onChannelSelect && !isCurrent) {
                      onChannelSelect(channel);
                    }
                    setShowRecentChannelsMenu(false);
                  }}
                  disabled={isCurrent}
                  className={`flex-shrink-0 w-[140px] p-3 rounded-lg transition-all flex flex-col items-center gap-2 ${
                    isCurrent
                      ? 'bg-blue-600/30 border-2 border-blue-500 cursor-not-allowed'
                      : 'bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700 hover:border-blue-500 cursor-pointer'
                  }`}
                  data-tv-focusable
                  tabIndex={0}
                >
                  <div className="w-16 h-16 flex items-center justify-center">
                    <ChannelLogo logo={channel.logo} name={channel.name} />
                  </div>
                  <span className={`text-xs text-center line-clamp-2 ${
                    isCurrent ? 'text-blue-400 font-medium' : 'text-gray-200'
                  }`}>
                    {channel.name}
                  </span>
                  {isCurrent && (
                    <span className="text-xs text-blue-400">🔴</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
PlayerControls.displayName = 'PlayerControls';
