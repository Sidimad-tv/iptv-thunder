// =========================
// 🪝 SERIES HOOKS — load all at once (based on movies.hooks.ts)
// =========================
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerVOD } from '@/types';
import { saveSeries, getSeries } from '@/hooks/useDatabase';
import { useCategories } from '@/hooks/useCategories';
import { 
  getSeries as getSeriesFromApi, 
  getSeriesWithPagination, 
  getSeriesDetails, 
  getSeriesInfo,
  getSeriesStream,
  getSeriesCategories
} from './series.api';

// ─── Non-progressive fetch (for background refresh when cache exists) ───────
async function fetchAllSeriesSilent(
  client: StalkerClient,
  categoryId: string,
  signal?: AbortSignal,
): Promise<StalkerVOD[]> {
  const first = await getSeriesWithPagination(client, categoryId, 1, signal);

  if (!first.hasMore || first.items.length === 0) {
    return first.items;
  }

  const allItems = [...first.items];
  const totalPages = Math.ceil(first.totalItems / first.maxPageItems) || 1;

  if (totalPages > 1) {
    // Parallel fetching with concurrency limit
    const CONCURRENCY_LIMIT = 3;
    const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

    for (let i = 0; i < pageNums.length; i += CONCURRENCY_LIMIT) {
      if (signal?.aborted) break;

      const batch = pageNums.slice(i, i + CONCURRENCY_LIMIT);
      const batchPromises = batch.map(async (page) => {
        try {
          const result = await getSeriesWithPagination(client, categoryId, page, signal);
          return result.items;
        } catch (e) {
          console.error(`Failed to fetch series page ${page}:`, e);
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      allItems.push(...batchResults.flat());

      // Small delay between batches
      await new Promise(r => setTimeout(r, 50));
    }
  }

  return sortAndDedupe(allItems);
}
async function fetchBatch(
  client: StalkerClient,
  categoryId: string,
  pageNums: number[],
  signal?: AbortSignal,
): Promise<StalkerVOD[]> {
  const batchPromises = pageNums.map(async (page) => {
    try {
      const result = await getSeriesWithPagination(client, categoryId, page, signal);
      return result.items;
    } catch (e) {
      console.error(`Failed to fetch series page ${page}:`, e);
      return [];
    }
  });

  const batchResults = await Promise.all(batchPromises);
  return batchResults.flat();
}

async function fetchRemainingBatches(
  client: StalkerClient,
  categoryId: string,
  queryKey: string[],
  allItems: StalkerVOD[],
  totalPages: number,
  queryClient: ReturnType<typeof useQueryClient>,
  signal?: AbortSignal,
): Promise<void> {
  const CONCURRENCY_LIMIT = 3;
  const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

  for (let i = 0; i < pageNums.length; i += CONCURRENCY_LIMIT) {
    if (signal?.aborted) return;

    const batch = pageNums.slice(i, i + CONCURRENCY_LIMIT);
    const newItems = await fetchBatch(client, categoryId, batch, signal);

    if (newItems.length > 0) {
      allItems.push(...newItems);
    }

    if (!shouldUpdateCache(signal, queryClient, queryKey)) return;

    queryClient.setQueryData(queryKey, sortAndDedupe(allItems));

    await new Promise(r => setTimeout(r, 50));
  }
}

function shouldUpdateCache(
  signal?: AbortSignal,
  queryClient?: ReturnType<typeof useQueryClient>,
  queryKey?: string[],
): boolean {
  if (signal?.aborted) return false;
  if (!queryClient || !queryKey) return false;
  const currentData = queryClient.getQueryData(queryKey);
  return !!currentData;
}

async function fetchAllSeriesProgressive(
  client: StalkerClient,
  categoryId: string,
  accountId: string,
  queryClient: ReturnType<typeof useQueryClient>,
  signal?: AbortSignal,
): Promise<StalkerVOD[]> {
  const first = await getSeriesWithPagination(client, categoryId, 1, signal);
  const queryKey = ['series-all', accountId, categoryId];

  if (!first.hasMore || first.items.length === 0) {
    return first.items;
  }

  const allItems = [...first.items];
  queryClient.setQueryData(queryKey, sortAndDedupe(allItems));

  const totalPages = Math.ceil(first.totalItems / first.maxPageItems) || 1;

  if (totalPages > 1) {
    await fetchRemainingBatches(
      client,
      categoryId,
      queryKey,
      allItems,
      totalPages,
      queryClient,
      signal,
    );
  }

  return sortAndDedupe(allItems);
}

// Helper to sort and deduplicate
function sortAndDedupe(items: StalkerVOD[]): StalkerVOD[] {
  const map = new Map<string, StalkerVOD>();
  for (const item of items) {
    map.set(String(item.id), item);
  }
  const uniqueItems = Array.from(map.values());
  return uniqueItems.sort((a, b) => {
    const dateA = a.added ? new Date(a.added).getTime() : 0;
    const dateB = b.added ? new Date(b.added).getTime() : 0;
    return dateB - dateA;
  });
}

// ─── Main hook: useSeriesAll (SQLite first, then API refresh with progressive loading) ─────────────────
export const useSeriesAll = (client: StalkerClient, categoryId?: string, search?: string) => {
  const accountId = client?.getAccount()?.id ?? 'default';
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Treat undefined, empty, or '*' as "all series" - use consistent cache key
  const effectiveCategoryId = (!categoryId || categoryId === '*') ? '' : categoryId;

  // Debounce search to avoid too many API calls while typing
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search?.trim() || '');
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Include search in cache key to separate cached results from search results
  const effectiveSearch = debouncedSearch;

  const query = useQuery({
    queryKey: ['series-all', accountId, categoryId, effectiveSearch],
    queryFn: async ({ signal }) => {
      // When search is active, bypass SQLite cache and query API directly
      if (effectiveSearch) {
        const result = await getSeriesWithPagination(client, effectiveCategoryId, 1, signal, effectiveSearch);
        return result.items;
      }

      // 1. First, try to load from SQLite (fast, offline-friendly)
      const cachedItems = await getSeries(accountId, effectiveCategoryId);
      const hasCache = cachedItems.length > 0;

      if (hasCache) {
        // 🔥 Background refresh (SWR) - silent, no progressive UI updates
        // Only run once per day (24 hours)
        const needsRefresh = shouldBackgroundRefresh(accountId, effectiveCategoryId);
        const queryKey = ['series-all', accountId, effectiveCategoryId, ''];

        if (needsRefresh) {
          setIsRefreshing(true);
          fetchAllSeriesSilent(client, effectiveCategoryId, signal)
            .then(items => {
              // 🛡️ Guard: don't update if user switched category (race condition)
              if (signal?.aborted) return;
              const currentData = queryClient.getQueryData(queryKey);
              if (!currentData) return;
              saveSeriesToDb(items, effectiveCategoryId, accountId);
              queryClient.setQueryData(queryKey, items);
              setLastFetchTime(accountId, effectiveCategoryId);
            })
            .catch(() => {})
            .finally(() => setIsRefreshing(false));
        }
        
        // Return cached data mapped to StalkerVOD format
        const sortedItems = [...cachedItems].sort((a, b) => (b.added || 0) - (a.added || 0));
        return sortedItems.map(s => {
          const vod = {
            id: Number.parseInt(s.id, 10) || 0,
            name: s.name,
            cmd: '', // ❗ Never use cached cmd - always fetch fresh (session-based)
            description: s.description || '',
            logo: s.posterUrl,
            poster: s.posterUrl,
            year: s.year,
          } as any;
          // Resolve poster URL from client to ensure full URL
          vod.poster = client.resolvePosterUrl(vod);
          vod.logo = client.resolveLogoUrl(vod.logo);
          return {
            ...vod,
            rating_imdb: s.rating,
            genre: s.genre,
            added: s.added || '',
            censored: false,
          } as StalkerVOD;
        });
      }

      // 2. No cache - fetch with PROGRESSIVE loading (first page shows immediately)
      const items = await fetchAllSeriesProgressive(client, effectiveCategoryId, accountId, queryClient, signal);
      saveSeriesToDb(items, effectiveCategoryId, accountId);
      setLastFetchTime(accountId, effectiveCategoryId);
      return items;
    },
    enabled: !!accountId && accountId !== 'default',
    staleTime: 0,
    gcTime:    30 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    ...query,
    series: query.data ?? [],
    isRefreshing,
  };
};

// Throttling map for DB saves
const lastSaveTime = new Map<string, number>();
const SAVE_THROTTLE_MS = 30 * 1000; // 30 seconds

// Background refresh - once per day (24 hours)
const LAST_FETCH_KEY = 'series_last_fetch';
const BACKGROUND_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getLastFetchTime(accountId: string, categoryId: string): number {
  try {
    const key = `${LAST_FETCH_KEY}:${accountId}:${categoryId}`;
    const stored = localStorage.getItem(key);
    return stored ? Number.parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

function setLastFetchTime(accountId: string, categoryId: string): void {
  try {
    const key = `${LAST_FETCH_KEY}:${accountId}:${categoryId}`;
    localStorage.setItem(key, Date.now().toString());
  } catch {
    // Ignore storage errors
  }
}

function shouldBackgroundRefresh(accountId: string, categoryId: string): boolean {
  const lastFetch = getLastFetchTime(accountId, categoryId);
  const timeSinceLastFetch = Date.now() - lastFetch;
  return timeSinceLastFetch >= BACKGROUND_REFRESH_INTERVAL_MS;
}

// Helper to save series to SQLite (throttled)
function saveSeriesToDb(items: StalkerVOD[], categoryId: string, accountId: string) {
  const key = `${accountId}:${categoryId}`;
  const now = Date.now();
  const lastSave = lastSaveTime.get(key) || 0;
  
  if (now - lastSave < SAVE_THROTTLE_MS) return;

  lastSaveTime.set(key, now);
  
  saveSeries(
    items.map(s => ({
      id: s.id?.toString() || '',
      name: s.name || '',
      description: s.description || '',
      posterUrl: s.logo || s.poster || '',
      year: s.year,
      rating: s.rating_imdb || s.rating_kinopoisk,
      genre: s.genre,
      categoryId: categoryId,
      added: s.added ? new Date(s.added).getTime() : undefined,
      cmd: undefined, // ❗ Don't save cmd to DB - it's session-based
    })),
    accountId,
    categoryId,
  ).catch(() => {});
}

// ─── Categories ───────────────────────────────────────────────────────────────
export const useSeriesCategories = (client: StalkerClient) => {
  const portalId = client?.getAccount()?.id || 'default';

  const { categories, isLoading, refresh, isRefreshing, error } = useCategories(
    'series',
    portalId,
    async () => await getSeriesCategories(client),
  );

  return {
    data: categories,
    isLoading,
    refetch: refresh,
    isRefetching: isRefreshing,
    error,
  };
};

// ─── Legacy hooks (kept for compatibility) ───────────────────────────────────
export const useSeries = (client: StalkerClient, categoryId: string = '', page: number = 1) => {
  return useQuery({
    queryKey: ['series', categoryId, page],
    queryFn: () => getSeriesFromApi(client, categoryId, page),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useSeriesWithPagination = (client: StalkerClient, categoryId: string = '', page: number = 1) => {
  return useQuery({
    queryKey: ['series', 'paginated', categoryId, page],
    queryFn: () => getSeriesWithPagination(client, categoryId, page),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// ─── Series info with episodes ──────────────────────────────────────────────
export const useSeriesInfo = (client: StalkerClient, seriesId: string) => {
  return useQuery({
    queryKey: ['series-info', seriesId],
    queryFn: async () => {
      if (!seriesId) {
        return { series: null as any, seasons: [], episodes: [] };
      }
      return await getSeriesInfo(client, seriesId);
    },
    enabled: !!seriesId,
    staleTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

// ─── Series details ───────────────────────────────────────────────────────────
export const useSeriesDetails = (client: StalkerClient, seriesId: string) => {
  return useQuery({
    queryKey: ['series-details', seriesId],
    queryFn: async () => {
      if (!seriesId) return null;
      const result = await getSeriesDetails(client, seriesId);
      // Ensure we always return a value (not undefined) to avoid React Query warnings
      return result ?? null;
    },
    enabled: !!seriesId,
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
  });
};

// ─── Prefetch stream URL ──────────────────────────────────────────────────────
// Module-level tracking to prevent request flooding when entering a category
const inFlightSeriesPrefetches = new Set<string>();
const MAX_CONCURRENT_SERIES_PREFETCHES = 5;
const SERIES_PREFETCH_DEBOUNCE_MS = 1000;
const lastSeriesPrefetch = new Map<string, number>();

export const usePrefetchSeriesStream = (client: StalkerClient) => {
  const queryClient = useQueryClient();

  return React.useCallback(
    (episode: StalkerVOD) => {
      if (!episode.cmd) return;
      const episodeId = String(episode.id);
      const queryKey = ['series-stream', episodeId];
      const now = Date.now();

      // Check if already fetching
      const state = queryClient.getQueryState(queryKey);
      if (state?.fetchStatus === 'fetching') return;

      // Per-episode debounce
      const lastTime = lastSeriesPrefetch.get(episodeId);
      if (lastTime && now - lastTime < SERIES_PREFETCH_DEBOUNCE_MS) return;

      // Limit concurrent prefetches
      if (inFlightSeriesPrefetches.size >= MAX_CONCURRENT_SERIES_PREFETCHES) return;

      lastSeriesPrefetch.set(episodeId, now);
      inFlightSeriesPrefetches.add(episodeId);

      queryClient.prefetchQuery({
        queryKey,
        queryFn: () => getSeriesStream(client, episode.cmd, episode.episode).finally(() => {
          inFlightSeriesPrefetches.delete(episodeId);
        }),
        staleTime: 5 * 60 * 1000,
      }).then(() => {
        inFlightSeriesPrefetches.delete(episodeId);
      }).catch(() => {
        inFlightSeriesPrefetches.delete(episodeId);
      });
    },
    [client, queryClient],
  );
};

// ─── Series stream ───────────────────────────────────────────────────────────
export const useSeriesStream = (client: StalkerClient, episodeId: string, cmd: string) => {
  return useQuery({
    queryKey: ['series-stream', episodeId],
    queryFn: () => getSeriesStream(client, cmd),
    enabled: !!episodeId && !!cmd,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
