import { useState, useCallback, useRef, useEffect } from 'react';
import { getSetting } from '@/hooks/useSettings';
import { QueryClient } from '@tanstack/react-query';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerChannel, StalkerVOD } from '@/types';
import { usePlaybackStore } from '@/store/playback.store';
import { addRecentViewed } from '@/hooks/useRecentItems';
import { getSeriesInfo } from '@/features/series/series.api';
import { useTranslation } from '@/hooks/useTranslation';

interface UsePlaybackManagerProps {
  client: StalkerClient | null;
  activePortal: any;
  selectedSeries: StalkerVOD | null;
  queryClient: QueryClient;
}

export const usePlaybackManager = ({
  client,
  activePortal,
  selectedSeries,
  queryClient,
}: UsePlaybackManagerProps) => {
  const { t } = useTranslation();
  const episodesRef = useRef<StalkerVOD[]>([]);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const currentEpisodeIndexRef = useRef(currentEpisodeIndex);
  const autoplayEpisodeIndexRef = useRef(0);
  const autoplayTokenRef = useRef<symbol | null>(null);
  const autoPlayRef = useRef<boolean | null>(null);
  const seriesCacheRef = useRef<Record<string, any>>({});
  const abortRef = useRef<AbortController | null>(null);

  // Keep ref in sync with state - CRITICAL for autoplay
  useEffect(() => {
    currentEpisodeIndexRef.current = currentEpisodeIndex;
  }, [currentEpisodeIndex]);

  // Clear series cache when portal changes to prevent stale data
  useEffect(() => {
    seriesCacheRef.current = {};
  }, [activePortal?.id]);

  // Cleanup on unmount - cancel all pending requests
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  // Single player manager (store)
  const player = usePlaybackStore();

  const play = async (channel: StalkerChannel, vodFlag: boolean = false, resumePos: number = 0, movieId?: string) => {
    if (!client) return;

    // Cancel any previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    player.setBuffering(true);

    try {
      // Ensure authentication before getting stream URL
      await client.ensureAuthenticated();

      // Invalidate stream cache to get fresh URL with correct MAC
      const accountId = client?.['account']?.id || 'default';
      const lastAccount = sessionStorage.getItem('playerLastAccountId');
      if (lastAccount && lastAccount !== accountId) {
        queryClient.removeQueries({ queryKey: ['stream'], exact: false });
      }
      sessionStorage.setItem('playerLastAccountId', accountId);

      const queryKey = vodFlag ? ['series-stream', channel.id] : ['stream', channel.id, accountId];

      const url = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => client.getStreamUrl(channel.cmd, {
          signal: controller.signal,
          genreId: channel.tv_genre_id?.toString() || (channel as any).genreId?.toString()
        }),
        staleTime: 0, // Always fetch fresh stream URL to get valid token
      });

      // Check if request was aborted before continuing
      if (controller.signal.aborted) return;

      // Clean portalUrl - extract valid URL and ignore trailing garbage
      const rawPortalUrl = client.getAccount()?.portalUrl || '';
      let cleanPortalUrl = rawPortalUrl;

      // Use URL constructor for proper URL parsing
      try {
        const u = new URL(rawPortalUrl);
        cleanPortalUrl = u.origin + '/';
      } catch {
        // Fallback: remove any trailing characters that are not URL-safe
        cleanPortalUrl = cleanPortalUrl.replace(/[^a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/, '');
        // Ensure it ends with /
        if (!cleanPortalUrl.endsWith('/')) {
          cleanPortalUrl += '/';
        }
      }

      const genreId = (channel.tv_genre_id || (channel as any).genreId)?.toString();

      player.setMedia({
        url,
        name: channel.name,
        channelId: Number.parseInt(String(channel.id)),
        isVod: vodFlag,
        movieId,
        resumePosition: resumePos,
        portalUrl: cleanPortalUrl,
        mac: client.getAccount()?.mac || '',
        token: client.token || '',
        genreId,
      });
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Failed to play channel:', error);
      }
    } finally {
      player.setBuffering(false);
    }
  };

  const handleChannelSelect = useCallback((channel: StalkerChannel) => {
    if (client && activePortal) {
      player.setContentType('tv');
      play(channel, false);
      const genreId = (channel.tv_genre_id || (channel as any).genreId)?.toString();
      addRecentViewed(activePortal.id, 'live', String(channel.id), {
        name: channel.name,
        poster: client.resolveLogoUrl(channel.logo),
        cmd: channel.cmd,
        genre_id: genreId,
      });
      // Invalidate recent viewed queries to update ForYouSection
      queryClient.invalidateQueries({ queryKey: ['recent-viewed'] });
    }
  }, [client, queryClient, activePortal]);

  const handleMoviePlay = useCallback((movie: StalkerVOD, resumePosition?: number) => {
    if (client && activePortal) {
      player.setContentType('movies');
      play(movie as any, true, resumePosition || 0, String(movie.id));
      addRecentViewed(activePortal.id, 'vod', String(movie.id), {
        name: movie.name,
        poster: client.resolvePosterUrl(movie),
        cmd: movie.cmd,
      });
      // Invalidate recent viewed queries to update ForYouSection
      queryClient.invalidateQueries({ queryKey: ['recent-viewed'] });
    }
  }, [client, queryClient, activePortal]);

  const deduplicateEpisodes = (episodes: StalkerVOD[]): StalkerVOD[] => {
    const map = new Map<string, StalkerVOD>();
    for (const ep of episodes) {
      map.set(String(ep.id), ep);
    }
    return Array.from(map.values());
  };

  const findEpisodeIndex = (episodes: StalkerVOD[], episode: StalkerVOD): number => {
    return episodes.findIndex((ep: StalkerVOD) => String(ep.id) === String(episode.id));
  };

  const fetchSeriesData = async (seriesId: string): Promise<any> => {
    // Check cache first
    const cached = seriesCacheRef.current[seriesId];
    if (cached) {
      return cached;
    }

    // Fetch and cache the data
    const rawData = await queryClient.fetchQuery({
      queryKey: ['series', seriesId, 'info'],
      queryFn: async () => {
        return await getSeriesInfo(client!, seriesId);
      },
    });

    // Process and cache the result
    const uniqueEpisodes = deduplicateEpisodes(rawData.episodes);
    const processedData = {
      raw: rawData,
      episodes: uniqueEpisodes,
    };

    seriesCacheRef.current[seriesId] = processedData;

    // Prevent unbounded cache growth
    if (Object.keys(seriesCacheRef.current).length > 20) {
      seriesCacheRef.current = {};
    }

    return processedData;
  };

  const fetchStreamUrl = async (episode: StalkerVOD, signal?: AbortSignal): Promise<string> => {
    return await client!.getEpisodeStream(episode.cmd, episode.episode || '1', { signal });
  };

  const buildEpisodeName = (episode: StalkerVOD): string => {
    const seriesName = selectedSeries?.name || '';
    const episodeName = `${t('season')} ${episode.season || 1} - ${t('episode')} ${episode.episode || 1}`;
    return seriesName ? `${seriesName} - ${episodeName}` : episodeName;
  };

  const prepareEpisodesData = (episodes: StalkerVOD[]) => {
    return episodes.map((ep) => ({
      id: ep.id,
      url: '',
      name: `${t('season')} ${ep.season || 1} - ${t('episode')} ${ep.episode || 1}`,
      season: ep.season,
      episode: ep.episode,
      cmd: ep.cmd,
      description: ep.description || '',
      added: ep.added || '',
      censored: ep.censored ?? false,
    }));
  };

  const updateEpisodesList = async (episode: StalkerVOD, explicitIndex?: number): Promise<{ episodes: StalkerVOD[], index: number } | null> => {
    if (!selectedSeries?.id) return null;

    try {
      const cachedData = await fetchSeriesData(String(selectedSeries.id));
      if (!cachedData?.episodes) return null;

      const uniqueEpisodes = cachedData.episodes; // Already deduplicated
      
      // Sort episodes chronologically: by season (ascending), then by episode (ascending)
      const sortedEpisodes = [...uniqueEpisodes].sort((a, b) => {
        const seasonA = Number.parseInt(String(a.season ?? 1));
        const seasonB = Number.parseInt(String(b.season ?? 1));
        const episodeA = Number.parseInt(String(a.episode ?? 1));
        const episodeB = Number.parseInt(String(b.episode ?? 1));
        
        if (seasonA !== seasonB) {
          return seasonA - seasonB;
        }
        return episodeA - episodeB;
      });
      
      const episodeIndex = explicitIndex ?? findEpisodeIndex(sortedEpisodes, episode);
      
      if (episodeIndex !== -1) {
        episodesRef.current = sortedEpisodes;
        setCurrentEpisodeIndex(episodeIndex);
        currentEpisodeIndexRef.current = episodeIndex;
        return { episodes: sortedEpisodes, index: episodeIndex };
      }
      return null;
    } catch (e) {
      console.error('Failed to fetch series episodes for auto-play:', e);
      return null;
    }
  };

  const handleEpisodeSelect = useCallback(async (episode: StalkerVOD, resumePosition?: number, explicitIndex?: number) => {
    if (!client) return;

    // Cancel any previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    player.setBuffering(true);

    const result = await updateEpisodesList(episode, explicitIndex);

    // Reset autoplay index when manually selecting an episode
    autoplayEpisodeIndexRef.current = explicitIndex ?? currentEpisodeIndexRef.current;

    try {
      // Ensure authentication before getting stream URL
      await client.ensureAuthenticated();

      const url = await queryClient.fetchQuery({
        queryKey: ['series-stream', String(episode.id)],
        queryFn: () => fetchStreamUrl(episode, controller.signal),
        staleTime: 0, // Always fetch fresh stream URL to get valid token
      });

      if (controller.signal.aborted) return;

      const fullName = buildEpisodeName(episode);

      // Cache autoplay setting to avoid repeated async calls
      autoPlayRef.current ??= await getSetting('autoPlayEpisodes');

      // Use returned data instead of stale state
      const localEpisodes = result?.episodes ?? [];
      const localIndex = result?.index ?? 0;

      // Single source of truth - always update episodesRef with result data
      episodesRef.current = localEpisodes;

      const episodesData = prepareEpisodesData(localEpisodes);

      player.setContentType('series');
      player.setMedia({
        url,
        name: fullName,
        channelId: Number.parseInt(String(episode.id)),
        isVod: true,
        movieId: String(episode.id),
        resumePosition: resumePosition || 0,
        episodes: episodesData,
        currentEpisodeIndex: explicitIndex ?? localIndex,
        autoPlayEpisodes: autoPlayRef.current,
      });

      const seriesInfo = selectedSeries;
      if (seriesInfo) {
        await addRecentViewed(activePortal!.id, 'series', String(seriesInfo.id), {
          name: seriesInfo.name,
          poster: client.resolvePosterUrl(seriesInfo),
          cmd: seriesInfo.cmd,
          season: episode.season !== undefined ? Number(episode.season) : undefined,
          episode: episode.episode !== undefined ? Number(episode.episode) : undefined,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['recent-viewed'] });
    } catch (error) {
      console.error('❌ Failed to play episode:', error);
    }
  }, [client, queryClient, selectedSeries, activePortal, t]);

  const playNextEpisode = useCallback(async () => {
    const episodes = episodesRef.current;
    if (!selectedSeries || episodes.length === 0) {
      return;
    }

    const autoplayEpisodeIndex = autoplayEpisodeIndexRef.current;
    const originalCurrentIndex = currentEpisodeIndexRef.current;
    
    if (autoplayEpisodeIndex >= episodes.length - 1) {
      return;
    }

    const nextEpisode = episodes[autoplayEpisodeIndex + 1];
    if (!nextEpisode) {
      return;
    }

    autoplayEpisodeIndexRef.current = autoplayEpisodeIndex + 1;

    const nextIndex = episodes.findIndex(ep => 
      ep.id === nextEpisode.id || 
      (ep.season === nextEpisode.season && ep.episode === nextEpisode.episode)
    );

    if (nextIndex === -1) {
      return;
    }

    const currentAutoplayToken = Symbol();
    autoplayTokenRef.current = currentAutoplayToken;

    try {
      setCurrentEpisodeIndex(nextIndex);
      currentEpisodeIndexRef.current = nextIndex;
      await handleEpisodeSelect(nextEpisode, 0, nextIndex);

      if (autoplayTokenRef.current !== currentAutoplayToken) {
        return;
      }
    } catch (error) {
      console.error('Failed to play next episode:', error);
      autoplayEpisodeIndexRef.current = autoplayEpisodeIndex;
      currentEpisodeIndexRef.current = originalCurrentIndex;
    }
  }, [selectedSeries, handleEpisodeSelect]);

  const handleEpisodeEnded = useCallback(async () => {
    // Cache autoplay setting to avoid repeated async calls
    autoPlayRef.current ??= await getSetting('autoPlayEpisodes');

    const episodes = episodesRef.current;
    if (!autoPlayRef.current || !selectedSeries || episodes.length === 0) {
      return;
    }

    // Use autoplayEpisodeIndexRef for consistent autoplay tracking
    const autoplayEpisodeIndex = autoplayEpisodeIndexRef.current;
    const originalCurrentIndex = currentEpisodeIndexRef.current;
    
    if (autoplayEpisodeIndex >= episodes.length - 1) {
      return;
    }

    const nextEpisode = episodes[autoplayEpisodeIndex + 1];
    if (!nextEpisode) {
      console.error('Next episode not found at autoplay index', autoplayEpisodeIndex + 1);
      return;
    }

    // Update autoplay index BEFORE calling next episode
    autoplayEpisodeIndexRef.current = autoplayEpisodeIndex + 1;

    // Find the episode in the episodes to get the correct index
    const nextIndex = episodes.findIndex(ep => 
      ep.id === nextEpisode.id || 
      (ep.season === nextEpisode.season && ep.episode === nextEpisode.episode)
    );

    if (nextIndex === -1) {
      console.error('Next episode not found in episodes');
      return;
    }

    // Prevent race conditions with user interactions
    const currentAutoplayToken = Symbol();
    autoplayTokenRef.current = currentAutoplayToken;

    try {
      setCurrentEpisodeIndex(nextIndex);
      currentEpisodeIndexRef.current = nextIndex;
      await handleEpisodeSelect(nextEpisode, 0, nextIndex);

      // Check if another autoplay or user interaction occurred during async operation
      if (autoplayTokenRef.current !== currentAutoplayToken) {
        return;
      }
    } catch (error) {
      console.error('Failed to autoplay next episode:', error);
      // Revert refs on error
      autoplayEpisodeIndexRef.current = autoplayEpisodeIndex;
      currentEpisodeIndexRef.current = originalCurrentIndex;
    }
  }, [selectedSeries, handleEpisodeSelect]);

  const close = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    player.close();
  };

  return {
    player,
    handleChannelSelect,
    handleMoviePlay,
    handleEpisodeSelect,
    handleEpisodeEnded,
    playNextEpisode,
    close,
  };
};
