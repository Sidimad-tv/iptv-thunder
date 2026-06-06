// =========================
// 🎬 EXO PLAYER (Android TV Only)
// =========================

import React, { useMemo } from 'react';
import { platform } from '@tauri-apps/plugin-os';
import { createLogger } from '@/lib/logger';
import { usePlaybackStore } from '@/store/playback.store';
import { usePortalsStore } from '@/store/portals.store';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { getChannelEPG, getCurrentProgram, getNextProgram, formatEPGTime } from '@/features/epg/epg.api';
import { useChannels } from '@/features/tv/tv.hooks';
import { useRecentViewed } from '@/hooks/useRecentItems';

const logger = createLogger('ExoPlayer');

// Helper to check if running on Android
const isAndroid = () => {
  try {
    return platform() === 'android';
  } catch {
    return false;
  }
};

// Helper to fetch EPG data for a channel
const fetchEPGData = async (channelId: number, isVod: boolean) => {
  if (isVod || !channelId) {
    return {};
  }

  try {
    const activePortal = usePortalsStore.getState().getActivePortal();
    if (!activePortal) {
      return {};
    }

    const client = new StalkerClient(activePortal as any);
    logger.info('[ExoPlayer] Fetching EPG data for channel:', channelId);
    const epg = await getChannelEPG(client, channelId);

    if (!epg || epg.length === 0) {
      return {};
    }

    const currentProgram = getCurrentProgram(epg);
    const nextProgram = getNextProgram(epg);

    const result: any = {};
    if (currentProgram) {
      result.epgTitle = currentProgram.name || '';
      result.epgStart = formatEPGTime(currentProgram.start_time);
      result.epgEnd = formatEPGTime(currentProgram.end_time);
      result.epgCategory = currentProgram.category || '';
      logger.info('[ExoPlayer] Current program:', result.epgTitle, result.epgStart, '-', result.epgEnd, result.epgCategory);
    }

    if (nextProgram) {
      result.epgNextTitle = nextProgram.name || '';
      result.epgNextStart = formatEPGTime(nextProgram.start_time);
      result.epgNextEnd = formatEPGTime(nextProgram.end_time);
      result.epgNextCategory = nextProgram.category || '';
      logger.info('[ExoPlayer] Next program:', result.epgNextTitle, result.epgNextStart, result.epgNextCategory);
    }

    return result;
  } catch (error) {
    logger.error('[ExoPlayer] Failed to fetch EPG data, continuing without EPG:', error);
    return {};
  }
};

// Helper to validate player params
const validatePlayerParams = (params: any) => {
  if (!params?.channelId || !params?.portalUrl || !params?.mac || !params?.token) {
    logger.error('[ExoPlayer] Invalid params object:', {
      hasParams: !!params,
      channelId: params?.channelId,
      portalUrl: params?.portalUrl,
      mac: params?.mac,
      token: params?.token
    });
    return false;
  }
  return true;
};

// Helper to load and send EPG data to Android player
const loadEpgData = async (channelId: number | undefined, isVod: boolean | undefined) => {
  try {
    const epgData = await fetchEPGData(channelId || 0, isVod || false);

    if (!epgData || Object.keys(epgData).length === 0) {
      return;
    }

    const exoPlayer = (globalThis.window as any).ExoPlayer;
    if (!exoPlayer || typeof exoPlayer.update_epg !== 'function') {
      return;
    }

    exoPlayer.update_epg(
      epgData.epgTitle || '',
      epgData.epgStart || '',
      epgData.epgEnd || '',
      epgData.epgNextTitle || '',
      epgData.epgNextStart || '',
      epgData.epgNextEnd || '',
      epgData.epgCategory || '',
      epgData.epgNextCategory || ''
    );
    logger.info('[ExoPlayer] EPG data sent to Android player');
  } catch (e) {
    logger.warn('[ExoPlayer] Background EPG loading failed:', e);
  }
};

// Helper to refresh EPG data periodically
const refreshEpgData = async (channelId: number) => {
  try {
    const epgData = await fetchEPGData(channelId, false);
    if (!epgData || Object.keys(epgData).length === 0) {
      return;
    }

    const exoPlayer = (globalThis.window as any).ExoPlayer;
    if (!exoPlayer || typeof exoPlayer.update_epg !== 'function') {
      return;
    }

    exoPlayer.update_epg(
      epgData.epgTitle || '',
      epgData.epgStart || '',
      epgData.epgEnd || '',
      epgData.epgNextTitle || '',
      epgData.epgNextStart || '',
      epgData.epgNextEnd || '',
      epgData.epgCategory || '',
      epgData.epgNextCategory || ''
    );
    logger.info('[ExoPlayer] EPG data refreshed and sent to Android player');
  } catch (e) {
    logger.warn('[ExoPlayer] Periodic EPG refresh failed:', e);
  }
};

export interface ExoPlayerProps {
  url: string;
  name?: string;
  channelId?: number;
  client?: any;
  buffering?: boolean;
  isVod?: boolean;
  movieId?: string;
  resumePosition?: number;
  setPosition: (id: string, pos: number, duration?: number) => void;
  genreId?: string;
  onChannelChange?: (channel: any) => void;
  onClose: () => void;
  onEnded?: () => void;
}

export const ExoPlayer: React.FC<ExoPlayerProps> = ({
  url,
  name = 'Unknown Channel',
  channelId,
  isVod,
  movieId,
  resumePosition = 0,
  genreId,
  client,
  setPosition,
  onClose,
  onChannelChange,
  onEnded: _onEnded
}) => {
  // Fetch channels from the same category/genre for carousel (only for TV channels, not VOD/movies)
  // Only enable when we have a valid genreId
  const { data: categoryChannels } = useChannels(
    client!,
    isVod ? undefined : genreId,
    false, // Disable EPG prefetching when playing from for-you/recent-channels
    !isVod && !!genreId // Only enabled for TV when we have a valid genreId
  );
  
  logger.info('[ExoPlayer] categoryChannels:', categoryChannels?.length || 0, 'genreId:', genreId);

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

  // Use refs to avoid triggering useEffect when channel data changes
  const categoryChannelsRef = React.useRef(categoryChannels);
  const recentChannelsRef = React.useRef(recentChannels);

  React.useEffect(() => {
    categoryChannelsRef.current = categoryChannels;
  }, [categoryChannels]);

  React.useEffect(() => {
    recentChannelsRef.current = recentChannels;
  }, [recentChannels]);

  const hasOpenedRef = React.useRef(false);
  const lastChannelIdRef = React.useRef<number | undefined>(undefined);
  const [playerOpened, setPlayerOpened] = React.useState(false);
  const lastSavedMovieIdRef = React.useRef<string | null>(null);
  const epgIntervalRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Register onChannelChange bridge for Android player - resolves URL when user switches channel
  React.useEffect(() => {
    if (!isAndroid()) return;

    if ((globalThis.window as any).onChannelChange) return;

    (globalThis.window as any).onChannelChange = async (channelId: number, cmd: string, name: string, genreId: string): Promise<string> => {
      try {
        logger.info('[ExoPlayer] onChannelChange called for channel:', channelId, name);

        if (!client) {
          logger.error('[ExoPlayer] No client for onChannelChange');
          return cmd;
        }

        // Resolve URL using create_link (this triggers the single create_link request)
        let streamUrl = cmd;
        if (cmd && (cmd.startsWith('ffmpeg ') || cmd.startsWith('vlc ') || cmd.startsWith('ffplay '))) {
          try {
            streamUrl = await client.getStreamUrl(cmd, { genreId });
            logger.info('[ExoPlayer] URL resolved for channel:', channelId, name);
          } catch (e) {
            logger.warn('[ExoPlayer] Failed to resolve URL for channel:', channelId, e);
            streamUrl = '';
          }
        }

        // Also call React onChannelChange if provided
        if (onChannelChange) {
          onChannelChange({ id: channelId, cmd, name, tv_genre_id: genreId });
        }

        return streamUrl;
      } catch (e) {
        logger.error('[ExoPlayer] onChannelChange failed:', e);
        return cmd;
      }
    };

    logger.info('[ExoPlayer] onChannelChange bridge registered globally');
  }, [client, onChannelChange]);

  // Register onSavePosition bridge for Android player - saves position when player closes
  React.useEffect(() => {
    if (!isAndroid()) return;

    if ((globalThis.window as any).onSavePosition) return;

    (globalThis.window as any).onSavePosition = (movieId: string, time: number, duration: number) => {
      try {
        logger.info('[ExoPlayer] onSavePosition called:', { movieId, time, duration });

        // Prevent saving the same movieId twice (e.g., when autoplay changes episode)
        if (lastSavedMovieIdRef.current === movieId) {
          logger.info('[ExoPlayer] Skipping save - already saved for:', movieId);
          return;
        }

        // Only save if watched more than 30 seconds
        if (time > 30 && movieId && setPosition) {
          setPosition(movieId, time, duration);
          lastSavedMovieIdRef.current = movieId;
          logger.info('[ExoPlayer] Position saved for:', movieId);
        }
      } catch (e) {
        logger.error('[ExoPlayer] onSavePosition failed:', e);
      }
    };

    logger.info('[ExoPlayer] onSavePosition bridge registered globally');
  }, [setPosition]);

  // Open native player first
  React.useEffect(() => {
    // Prevent multiple calls
    if (hasOpenedRef.current) {
      return;
    }
    hasOpenedRef.current = true;

    // Reset tracking on new player open
    lastChannelIdRef.current = undefined;
    lastSavedMovieIdRef.current = null; // Reset saved movieId for new session
    setPlayerOpened(true);

    const openNativePlayer = async () => {
      if (!isAndroid()) {
        logger.warn('ExoPlayer is only available on Android. Use MpvPlayer on desktop.');
        onClose();
        return;
      }

      const player = usePlaybackStore.getState().current;
      if (!player) {
        logger.error('[ExoPlayer] No player data in playback store, cannot open native player');
        onClose();
        return;
      }

      const portalUrl = player?.portalUrl || '';
      const mac = player?.mac || '';
      const token = player?.token || '';

      if (!portalUrl || !mac || !token) {
        logger.error('[ExoPlayer] Missing required player data: portalUrl, mac, or token');
        onClose();
        return;
      }

      const episodes = player?.episodes || [];
      const currentEpisodeIndex = player?.currentEpisodeIndex || 0;
      const autoPlayEpisodes = player?.autoPlayEpisodes ?? true;

      // Get volume from persisted store
      const volume = Math.round((usePlaybackStore.getState().settings.volume) * 100) || 80;

      // Open player immediately with minimal data
      const exoPlayer = (globalThis.window as any).ExoPlayer;
      if (!exoPlayer || typeof exoPlayer.open_compose_player !== 'function') {
        logger.error('ExoPlayer.open_compose_player method not available');
        onClose();
        return;
      }

      const params = {
        url,
        channelName: name,
        channelId: channelId?.toString() || '',
        portalUrl,
        mac,
        token,
        isVod: isVod || false,
        movieId: movieId || '',
        resumePosition: resumePosition || 0,
        episodesJson: JSON.stringify(episodes),
        currentEpisodeIndex,
        autoPlayEpisodes,
        channelsJson: '[]',
        recentChannelsJson: '[]',
        volume,
        epgTitle: '',
        epgStart: '',
        epgEnd: '',
        epgCategory: '',
        epgNextTitle: '',
        epgNextStart: '',
        epgNextEnd: '',
        epgNextCategory: ''
      };

      if (!validatePlayerParams(params)) {
        onClose();
        return;
      }

      try {
        exoPlayer.open_compose_player(JSON.stringify(params));
      } catch (error) {
        console.error('[ExoPlayer] Error calling open_compose_player:', error);
        logger.error(`Error calling open_compose_player: ${error}`);
        onClose();
        return;
      }

      // Load EPG data in background (non-blocking)
      loadEpgData(channelId, isVod);

      // Start periodic EPG refresh (every 30 seconds for live TV)
      if (!isVod && channelId) {
        epgIntervalRef.current = setInterval(() => refreshEpgData(channelId), 30000);
      }
    };

    // Open player immediately
    openNativePlayer();
  }, [url, name, channelId, isVod, genreId, client]);

  // Send channels to Android after player is opened (non-blocking)
  React.useEffect(() => {
    logger.info('[ExoPlayer] Channel sending useEffect triggered: isVod=' + isVod + ', genreId=' + genreId + ', client=' + !!client + ', categoryChannels=' + (categoryChannels?.length || 0) + ', playerOpened=' + playerOpened);
    
    if (isVod || !client) {
      logger.warn('[ExoPlayer] Skipping channel send: isVod or no client');
      // Close immediately if we're not sending channels
      onClose();
      return;
    }
    
    // Wait for player to be opened and channels to be loaded
    if (!playerOpened) {
      logger.warn('[ExoPlayer] Player not opened yet, waiting...');
      return;
    }
    
    // Wait for category channels to be loaded (if we have genreId)
    if (genreId && (!categoryChannels || categoryChannels.length === 0)) {
      logger.warn('[ExoPlayer] Category channels not loaded yet, waiting...');
      return;
    }
    
    // Send channels immediately without delay - player is already open
    const exoPlayer = (globalThis.window as any).ExoPlayer;
    if (!exoPlayer || typeof (exoPlayer as any).update_channels !== 'function') {
      logger.warn('[ExoPlayer] ExoPlayer.update_channels not available yet, closing');
      onClose();
      return;
    }
    
    // Send channels WITHOUT resolving URLs - Android player will handle URL resolution via get_order_list
    (async () => {
      try {
        // Wait a bit for NativePlayerActivity to be created (reduced from 500ms to 100ms)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        let categoryChannelsToSend: any[] = [];
        
        // Only send category channels if we have genreId and categoryChannels
        if (genreId && categoryChannels && categoryChannels.length > 0) {
          categoryChannelsToSend = categoryChannels
            .filter((ch: any) => !ch.name.startsWith('#####'))
            .map((channel: any) => ({
              ...channel,
              stream_url: channel.cmd // Send raw cmd, let Android resolve via get_order_list
            }));
        }
        
        const recentChannelsToSend = recentChannels
          .filter((ch: any) => !ch.name.startsWith('#####') && ch.id !== channelId)
          .map((channel: any) => ({
            ...channel,
            stream_url: channel.cmd // Send raw cmd, let Android resolve via get_order_list
          })) || [];
        
        logger.info('[ExoPlayer] Sending channels via useEffect: category=' + categoryChannelsToSend.length + ', recent=' + recentChannelsToSend.length);
        
        (exoPlayer as any).update_channels(JSON.stringify(categoryChannelsToSend), JSON.stringify(recentChannelsToSend));
        
        // Close after sending channels
        onClose();
      } catch (e) {
        logger.warn('[ExoPlayer] Failed to send channels via useEffect:', e);
        onClose();
      }
    })();
  }, [categoryChannels, recentChannels, genreId, isVod, client, channelId, onClose, playerOpened]);

  // Cleanup EPG interval on unmount
  React.useEffect(() => {
    return () => {
      if (epgIntervalRef.current) {
        clearInterval(epgIntervalRef.current);
        epgIntervalRef.current = null;
        logger.info('[ExoPlayer] EPG refresh interval cleared');
      }
    };
  }, []);

  return null;
};
