// =========================
// 🪝 MOVIES HOOKS — load all at once
// =========================
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerVOD } from '@/types';
import { saveVod, getVod } from '@/hooks/useDatabase';
import { useCategories } from '@/hooks/useCategories';
import { fetchVODPages, normalizeVod, normalizeDbVod, persistVodQueue } from './movies.api';

// ─── Main hook ────────────────────────────────────────────────────────────────

export const useMoviesAll = (client: StalkerClient, categoryId?: string, search?: string) => {
  const account = client?.getAccount();
  const accountId = account?.id ?? 'default';
  const enabled = !!client; // Require client, allow loading all movies when categoryId is undefined/empty
  const queryClient = useQueryClient();

  const effectiveCategoryId = (!categoryId || categoryId === '*') ? '' : categoryId;

  // Debounce search to avoid too many API calls while typing
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search?.trim() || '');
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  const effectiveSearch = debouncedSearch;

  // Streaming state for progressive loading
  const [streamingState, setStreamingState] = React.useState({
    isStreaming: false,
    loadedPages: 0,
    totalPages: 0,
  });

  const query = useQuery({
    queryKey: ['movies-all', accountId, categoryId, effectiveSearch],
    queryFn: async ({ signal }) => {
      // When search is active, bypass SQLite cache and query API directly
      if (effectiveSearch) {
        const result = await fetchVODPages(client, effectiveCategoryId, { signal, search: effectiveSearch });
        return result.map(v => ({
          id: v.id?.toString() || '',
          name: v.o_name || v.name || '',
          description: v.description || '',
          posterUrl: v.logo || v.poster || '',
          streamUrl: v.cmd || '',
          year: v.year,
          rating: v.rating_imdb || v.rating_kinopoisk,
          duration: v.length,
          genre: v.genres_str || '',
          director: v.director,
          actors: v.actors,
          added: v.added ? new Date(v.added).getTime() : undefined,
        }));
      }

      // Try SQLite cache first - return immediately if exists
      const cached = await getVod(accountId, effectiveCategoryId);

      if (cached.length > 0) {
        // Return cached data immediately, then fetch fresh data in background
        fetchVODPages(client, effectiveCategoryId, { signal })
          .then(items => {
            const normalized = normalizeVod(items);
            if (normalized.length > 0) {
              // Compare cache with API results
              const cachedIds = new Set(cached.map((c: any) => c.id));
              const apiIds = new Set(normalized.map((v: any) => String(v.id)));
              
              // Find new items (in API but not in cache)
              const newItems = normalized.filter((v: any) => !cachedIds.has(String(v.id)));
              // Find removed items (in cache but not in API)
              const removedItems = cached.filter((c: any) => !apiIds.has(c.id));
              
              if (newItems.length > 0 || removedItems.length > 0) {
                // Save to DB silently - don't update UI, next visit will use fresh cache
                const vodData = normalized.map(vod => ({
                  id: vod.id?.toString() || '',
                  name: vod.o_name || vod.name || '',
                  description: vod.description || '',
                  posterUrl: vod.logo || vod.poster || '',
                  streamUrl: vod.cmd || '',
                  year: vod.year,
                  rating: vod.rating_imdb || vod.rating_kinopoisk,
                  duration: vod.length,
                  genre: vod.genres_str || '',
                  director: vod.director,
                  actors: vod.actors,
                  added: vod.added ? new Date(vod.added).getTime() : undefined,
                }));
                persistVodQueue(vodData, accountId, effectiveCategoryId, saveVod)
                  .catch(() => {});
              }
            }
          })
          .catch(() => {});
        
        return cached;
      }

      // Reset streaming state
      setStreamingState({ isStreaming: true, loadedPages: 0, totalPages: 0 });

      // Layer 1: Fetch from API with progressive hydration
      const items = await fetchVODPages(client, effectiveCategoryId, {
        signal,
        search: effectiveSearch,
        onProgress: (progressItems, loadedPages, totalPages) => {
          // Layer 2: Normalize and update UI progressively
          if (signal?.aborted) return;
          if (queryClient) {
            const normalized = normalizeVod(progressItems);
            queryClient.setQueryData(['movies-all', accountId, effectiveCategoryId], normalized);
            // Update streaming state
            setStreamingState({ isStreaming: loadedPages < totalPages, loadedPages, totalPages });
          }
        },
      });

      // Layer 2: Normalize API data
      const normalized = normalizeVod(items);

      // Mark streaming as complete
      setStreamingState({ isStreaming: false, loadedPages: streamingState.totalPages || 1, totalPages: streamingState.totalPages || 1 });

      // Layer 3: Persist to SQLite (queued to prevent race conditions)
      if (normalized.length > 0) {
        const vodData = normalized.map(vod => ({
          id: vod.id?.toString() || '',
          name: vod.o_name || vod.name || '',
          description: vod.description || '',
          posterUrl: vod.logo || vod.poster || '',
          streamUrl: vod.cmd || '',
          year: vod.year,
          rating: vod.rating_imdb || vod.rating_kinopoisk,
          duration: vod.length,
          genre: vod.genres_str || '',
          director: vod.director,
          actors: vod.actors,
          added: vod.added ? new Date(vod.added).getTime() : undefined,
        }));

        persistVodQueue(vodData, accountId, effectiveCategoryId, saveVod)
          .catch(err => console.error('[DB] Failed to save VOD:', err));
      }

      return normalized;
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 min cache - prevents refetch on scroll/remount
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Transform cached data in useMemo to prevent GC spikes on mount
  const movies = React.useMemo(() => {
    const data = query.data;
    if (!data || data.length === 0) return [];

    // Type guard to check if data is from DB (has streamUrl property)
    const isDbVod = (x: any): x is { streamUrl: string; posterUrl: string } => {
      return typeof x.streamUrl === 'string' && typeof x.posterUrl === 'string';
    };

    const isRawDbData = data.length > 0 && isDbVod(data[0]);

    if (isRawDbData) {
      // Layer 2: Normalize DB format to StalkerVOD
      return normalizeDbVod(data as any[]);
    }

    // Data is already normalized (from API)
    return data as StalkerVOD[];
  }, [query.data]);

  return {
    ...query,
    movies,
    streamingState,
  };
};

// ─── Categories ───────────────────────────────────────────────────────────────

export const useMovieCategories = (client: StalkerClient) => {
  const portalId = client?.getAccount()?.id || 'default';

  const { categories, isLoading, refresh, isRefreshing } = useCategories(
    'vod',
    portalId,
    async () => {
      return await client.getVODCategories();
    },
  );

  return {
    data: categories,
    isLoading,
    refetch: refresh,
    isRefetching: isRefreshing,
    error: null,
  };
};

export const useMovieCategoriesWithError = (client: StalkerClient) => {
  const portalId = client?.getAccount()?.id || 'default';

  const { categories, isLoading, refresh, isRefreshing } = useCategories(
    'vod',
    portalId,
    async () => {
      return await client.getVODCategories();
    },
  );

  return {
    data: categories,
    isLoading,
    refetch: refresh,
    isRefetching: isRefreshing,
  };
};

// ─── Movie details ────────────────────────────────────────────────────────────

export const useMovieDetails = (client: StalkerClient, movieId?: string, cmd?: string) => {
  return useQuery({
    queryKey: ['movie-details', movieId, cmd],
    queryFn: async () => {
      // Try to get details by ID first
      if (movieId && movieId !== '0' && movieId !== 'NaN') {
        const result = await client.getVODDetails(movieId);
        // Ensure we never return undefined
        return result ?? null;
      }
      // Return null as fallback (React Query doesn't allow undefined)
      return null;
    },
    enabled: !!movieId,
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
  });
};

// ─── Prefetch stream URL ──────────────────────────────────────────────────────

// Module-level tracking to prevent request flooding when entering a category
const inFlightPrefetches = new Set<string>();
const MAX_CONCURRENT_PREFETCHES = 5; // Optimal for ~50-100 items

export const usePrefetchMovieStream = (client: StalkerClient) => {
  const queryClient = useQueryClient();
  const lastPrefetch = React.useRef(new Map<string, number>());
  const PREFETCH_DEBOUNCE_MS = 1000; // 1 second debounce per movie
  const PREFETCH_STALE_MS = 5 * 60 * 1000; // 5 minutes stale time
  const TTL_MS = 10 * 60 * 1000; // 10 minutes TTL for cleanup

  return React.useCallback(
    (movie: StalkerVOD) => {
      if (!movie.cmd) return;
      const movieId = String(movie.id);
      const queryKey = ['movie-stream', movieId];
      const now = Date.now();

      // Cleanup old entries (TTL) to prevent memory leaks
      for (const [id, time] of lastPrefetch.current.entries()) {
        if (now - time > TTL_MS) {
          lastPrefetch.current.delete(id);
        }
      }

      // Check if already fetching
      const state = queryClient.getQueryState(queryKey);
      if (state?.fetchStatus === 'fetching') return;

      // Per-movie debounce: check if we prefetched recently
      const lastPrefetchTime = lastPrefetch.current.get(movieId);
      if (lastPrefetchTime && now - lastPrefetchTime < PREFETCH_DEBOUNCE_MS) {
        return; // Skip prefetch if we recently prefetched this movie
      }

      // Stale avoidance: check if data is still fresh
      if (state?.dataUpdatedAt && now - state.dataUpdatedAt < PREFETCH_STALE_MS) {
        return; // Skip prefetch if data is still fresh
      }

      // Limit concurrent prefetches to prevent flooding when entering category
      if (inFlightPrefetches.size >= MAX_CONCURRENT_PREFETCHES) {
        return; // Skip if too many prefetches in flight
      }

      // Update last prefetch time
      lastPrefetch.current.set(movieId, now);
      inFlightPrefetches.add(movieId);

      // Prefetch the stream URL
      queryClient.prefetchQuery({
        queryKey,
        queryFn: () => client.getVODUrl(movie.cmd).finally(() => {
          inFlightPrefetches.delete(movieId);
        }),
        staleTime: PREFETCH_STALE_MS,
      }).then(() => {
        inFlightPrefetches.delete(movieId);
      }).catch(() => {
        inFlightPrefetches.delete(movieId);
      });
    },
    [client, queryClient],
  );
};