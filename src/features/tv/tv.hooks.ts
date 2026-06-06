// =========================
// 🪝 MODERN TV HOOKS with Cache
// =========================
import React, { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerChannel } from '@/types';
import { usePortalCacheStore } from '@/store/portalCache.store';
import { saveChannels, upsertChannels, getChannels as getChannelsFromDB, searchChannels } from '@/hooks/useDatabase';
import { getChannelEPG, getEPGTimeRange } from '@/features/epg/epg.api';
import { getGenres, getChannels } from './tv.api';

export const useChannels = (client: StalkerClient, genreId?: string, prefetchEPG: boolean = true, enabled: boolean = true) => {
  const accountId = client?.['account']?.id || 'default';
  const prevSignatureRef = useRef<string>('');

  const query = useQuery({
    queryKey: ['channels', accountId, genreId],
    enabled: enabled && !!client,
    queryFn: async ({ signal }) => {
      // Always use paginated fetching - get_all_channels endpoint is deprecated
      const targetGenreId = genreId || '*';
      
      // Fetch page 1 first to determine total count
      const firstPage = await getChannels(client, {
        genre: targetGenreId,
        page: 1,
        sortby: 'number',
        signal
      });
      
      if (signal?.aborted) return [];
      
      const allChannels: StalkerChannel[] = [...firstPage.channels];
      
      if (!firstPage.hasMore || firstPage.totalItems <= firstPage.channels.length) {
        // Deduplicate even for single page (safety check)
        const uniqueChannels = new Map<string, StalkerChannel>();
        for (const ch of allChannels) {
          uniqueChannels.set(String(ch.id), ch);
        }
        return Array.from(uniqueChannels.values());
      }
      
      // Calculate remaining pages based on total count
      const itemsPerPage = firstPage.channels.length || 14;
      // Safety limit: max ~1000 channels for EPG (prevents UI freeze with 80k channels)
      const MAX_CHANNELS = 1000;
      const maxPages = Math.ceil(MAX_CHANNELS / itemsPerPage);
      const totalPages = Math.min(Math.ceil(firstPage.totalItems / itemsPerPage), maxPages);
      const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      
      // Fetch remaining pages in batches with throttling to avoid overwhelming the portal
      const BATCH = 5;
      for (let i = 0; i < remainingPages.length; i += BATCH) {
        if (signal?.aborted) break;
        
        const batch = remainingPages.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(page => getChannels(client, {
            genre: targetGenreId,
            page,
            sortby: 'number',
            signal
          }))
        );
        
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            allChannels.push(...result.value.channels);
          }
        });
        
        // Throttle between batches (abortable)
        if (i + BATCH < remainingPages.length && !signal?.aborted) {
          await Promise.race([
            new Promise(r => setTimeout(r, 100)),
            new Promise((_, reject) => {
              if (!signal) return;
              const onAbort = () => reject(new Error('aborted'));
              signal.addEventListener('abort', onAbort, { once: true });
            })
          ]).catch(() => { /* aborted */ });
        }
      }

      // Deduplicate channels by ID (Stalker API often returns duplicates across pages)
      const uniqueChannels = new Map<string, StalkerChannel>();
      for (const ch of allChannels) {
        uniqueChannels.set(String(ch.id), ch);
      }

      return Array.from(uniqueChannels.values());
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  
  // Save channels to SQLite when data changes (replaces onSuccess callback)
  useEffect(() => {
    const data = query.data;
    if (!data || data.length === 0) return;

    // Lightweight signature: count + first ID + last ID (detects add/remove/reorder)
    const signature = `${data.length}-${data[0]?.id}-${data.at(-1)?.id}`;
    if (signature === prevSignatureRef.current) return;
    prevSignatureRef.current = signature;

    // Check if we already saved this exact data (prevents re-save after player close)
    const savedSignatureKey = `iptv-channels-saved-${accountId}-${genreId || '*'}`;
    const alreadySaved = localStorage.getItem(savedSignatureKey);
    if (alreadySaved === signature) {
      return;
    }

    saveChannels(data.map(ch => ({
      id: ch.id?.toString() || '',
      name: ch.name || '',
      streamUrl: ch.cmd || '',
      iconUrl: ch.logo_url || ch.logo || '',
      genreId: genreId || ch.tv_genre_id?.toString(),
      orderNum: ch.number || 0,
    })), accountId).then(() => {
      // Mark as saved
      localStorage.setItem(savedSignatureKey, signature);
    }).catch(err => console.error('[DB] Failed to save channels:', err));
  }, [query.data, accountId, genreId]);
  
  // Pre-fetch EPG for channels (only for first 20 visible channels)
  const hasValidEPG = usePortalCacheStore(s => s.hasValidEPG);
  const setChannelEPG = usePortalCacheStore(s => s.setChannelEPG);
  const prefetchedEPG = useRef<Map<number, number>>(new Map());
  const EPG_TTL = 10 * 60 * 1000; // 10 minutes
  
  useEffect(() => {
    const channels = query.data;
    if (!channels || channels.length === 0 || !client || !prefetchEPG) return;

    const { from, to } = getEPGTimeRange(4);
    const channelsToPrefetch = channels.slice(0, 20);

    if (channelsToPrefetch.length === 0) return;

    let cancelled = false;
    const BATCH = 3;

    const cleanupPrefetchedEPG = () => {
      if (prefetchedEPG.current.size > 200) {
        const entries = Array.from(prefetchedEPG.current.entries())
          .sort((a, b) => a[1] - b[1])
          .slice(-100);
        prefetchedEPG.current = new Map(entries);
      }
    };

    const prefetchChannelEPG = async (ch: any) => {
      const channelId: number = Number(ch.id);
      const now = Date.now();
      
      const lastPrefetch = prefetchedEPG.current.get(channelId);
      if (lastPrefetch && now - lastPrefetch < EPG_TTL) return;
      
      if (hasValidEPG(accountId, channelId, EPG_TTL)) return;

      prefetchedEPG.current.set(channelId, now);

      try {
        const epg = await getChannelEPG(client, channelId, from, to);
        if (!cancelled) {
          setChannelEPG(accountId, channelId, epg);
          cleanupPrefetchedEPG();
        }
      } catch (err) {
        console.warn('Failed to prefetch EPG for channel', ch.id, err);
        prefetchedEPG.current.delete(channelId);
      }
    };

    const processBatch = async (batch: any[]) => {
      await Promise.allSettled(batch.map(prefetchChannelEPG));
    };

    const prefetchBatch = async () => {
      for (let i = 0; i < channelsToPrefetch.length; i += BATCH) {
        if (cancelled) break;
        
        const batch = channelsToPrefetch.slice(i, i + BATCH);
        await processBatch(batch);
        
        if (i + BATCH < channelsToPrefetch.length && !cancelled) {
          await new Promise(r => setTimeout(r, 50));
        }
      }
    };

    prefetchBatch();
    return () => { cancelled = true; };
  }, [query.data, client, accountId, hasValidEPG, setChannelEPG]);
  
  return {
    ...query,
    data: query.data || [],
    isLoading: query.isLoading,
  };
};

// Pobierz kategorie kanałów (tylko w TanStack Query, bez Zustand cache)
export const useChannelCategories = (client: StalkerClient) => {
  const accountId = client?.['account']?.id || 'default';

  const query = useQuery({
    queryKey: ['channel-categories', accountId],
    queryFn: async () => {
      return await getGenres(client);
    },
    staleTime: 60 * 60 * 1000, // 1 hour - categories rarely change
    gcTime: 7 * 24 * 60 * 60 * 1000,
    enabled: !!client,
  });

  return {
    ...query,
    data: query.data || [],
    isLoading: query.isLoading,
  };
};

// Lazy loading hook - fetches pages on demand for infinite scroll
// For genreId='*' (All), caps at MAX_ALL_CHANNELS to prevent thousands of API requests
const MAX_ALL_CHANNELS = 1000;

export const useLazyChannels = (client: StalkerClient, genreId?: string) => {
  const isAllCategory = !genreId || genreId === '*';
  const accountId = client?.['account']?.id || 'default';
  const [allChannels, setAllChannels] = React.useState<StalkerChannel[]>([]);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const loadedPagesRef = React.useRef<Set<number>>(new Set());
  const loadingRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const generationRef = React.useRef(0);
  const prevSignatureRef = useRef<string>('');
  const initialLoadDoneRef = React.useRef(false);
  const pageRef = React.useRef(1);
  const hasMoreRef = React.useRef(true);
  const autoLoadTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalExpectedRef = React.useRef<number | null>(null);

  const shouldSkipLoad = () => {
    return !client || !hasMoreRef.current || loadingRef.current;
  };

  const isPageAlreadyLoaded = (page: number) => {
    return loadedPagesRef.current.has(page);
  };

  const isStaleRequest = (currentGen: number) => {
    return !mountedRef.current || generationRef.current !== currentGen;
  };

  const handleChannelData = (result: any, pageToLoad: number) => {
    if (result.totalItems > 0) {
      totalExpectedRef.current = result.totalItems;
      const cacheKey = `iptv-channels-total-${accountId}-${genreId || '*'}`;
      localStorage.setItem(cacheKey, String(result.totalItems));
    }
    if (result.maxPageItems > 0) {
      const pageSizeKey = `iptv-channels-pagesize-${accountId}-${genreId || '*'}`;
      localStorage.setItem(pageSizeKey, String(result.maxPageItems));
    }

    loadedPagesRef.current.add(pageToLoad);
    pageRef.current = pageToLoad + 1;

    setAllChannels(prev => {
      const newChannels = [...prev, ...result.channels];
      const unique = new Map<string, StalkerChannel>();
      newChannels.forEach(ch => unique.set(String(ch.id), ch));
      const arr = Array.from(unique.values());
      // For 'All' category, cap at MAX_ALL_CHANNELS to avoid RAM overload
      return isAllCategory ? arr.slice(0, MAX_ALL_CHANNELS) : arr;
    });

    // For 'All' category: upsert each batch to SQLite immediately
    // so search can find channels even before loading is complete
    if (isAllCategory && result.channels.length > 0) {
      upsertChannels(result.channels.map((ch: StalkerChannel) => ({
        id: ch.id?.toString() || '',
        name: ch.name || '',
        streamUrl: ch.cmd || '',
        iconUrl: ch.logo_url || ch.logo || '',
        genreId: ch.tv_genre_id?.toString(),
        orderNum: ch.number || 0,
      })), accountId).catch(err => console.error('[DB] Failed to upsert channels:', err));
    }

    // Stop loading when API says no more, or when 'All' cap is reached
    const capReached = isAllCategory && (loadedPagesRef.current.size * (result.maxPageItems || 14)) >= MAX_ALL_CHANNELS;
    const shouldStop = !result.hasMore || capReached;
    hasMoreRef.current = !shouldStop;
    setHasMore(!shouldStop);

    if (shouldStop) {
      const savedSignatureKey = `iptv-channels-saved-${accountId}-${genreId || '*'}`;
      localStorage.removeItem(savedSignatureKey);
    }
  };

  const scheduleAutoLoad = () => {
    if (!mountedRef.current) return;
    
    if (autoLoadTimeoutRef.current) {
      clearTimeout(autoLoadTimeoutRef.current);
    }
    autoLoadTimeoutRef.current = setTimeout(() => {
      if (!loadingRef.current && mountedRef.current && hasMoreRef.current) {
        loadMore();
      }
    }, 100);
  };

  const resetLoadingState = (currentGen: number) => {
    if (generationRef.current === currentGen) {
      loadingRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const LOAD_BATCH = 5; // pages fetched in parallel per loadMore call

  const loadMore = React.useCallback(async () => {
    if (shouldSkipLoad()) return;

    const startPage = pageRef.current;
    if (isPageAlreadyLoaded(startPage)) return;

    const currentGen = generationRef.current;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch up to LOAD_BATCH pages in parallel
      const pagesToFetch: number[] = [];
      for (let p = startPage; p < startPage + LOAD_BATCH; p++) {
        if (!isPageAlreadyLoaded(p)) pagesToFetch.push(p);
      }

      const results = await Promise.allSettled(
        pagesToFetch.map(page =>
          getChannels(client, {
            genre: genreId || '*',
            page,
            sortby: 'number'
          })
        )
      );

      if (isStaleRequest(currentGen)) return;

      results.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          handleChannelData(res.value, pagesToFetch[idx]);
        } else {
          console.warn('[useLazyChannels] Failed to load page', pagesToFetch[idx], res.reason);
        }
      });

      if (hasMoreRef.current) {
        scheduleAutoLoad();
      }
    } catch (err) {
      if (isStaleRequest(currentGen)) return;
      console.error('[useLazyChannels] Failed to load pages starting at', startPage, err);
      setError(err instanceof Error ? err : new Error('Failed to load channels'));
    } finally {
      resetLoadingState(currentGen);
    }
  }, [client, genreId]);

  // Cleanup on unmount
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (autoLoadTimeoutRef.current) {
        clearTimeout(autoLoadTimeoutRef.current);
      }
    };
  }, []);

  // Reset when genre changes - load from SQLite first
  React.useEffect(() => {
    generationRef.current += 1; // Invalidate any in-flight requests
    setAllChannels([]);
    setHasMore(true);
    loadedPagesRef.current.clear();
    loadingRef.current = false;
    prevSignatureRef.current = '';
    initialLoadDoneRef.current = false;
    pageRef.current = 1;
    hasMoreRef.current = true;
    totalExpectedRef.current = null;
    // Clear any pending auto-load timeout
    if (autoLoadTimeoutRef.current) {
      clearTimeout(autoLoadTimeoutRef.current);
      autoLoadTimeoutRef.current = null;
    }
    // Try to load from SQLite first
    const loadFromCache = async () => {
      // Prevent double load
      if (initialLoadDoneRef.current) return;

      try {
        const cached = await getChannelsFromDB(accountId, genreId || undefined);
        if (cached && cached.length > 0) {
          // Convert DB format to StalkerChannel
          const channels: StalkerChannel[] = cached.map(ch => ({
            id: ch.id,
            name: ch.name,
            cmd: ch.streamUrl ?? '',
            logo: ch.iconUrl,
            tv_genre_id: ch.genreId ? Number.parseInt(ch.genreId) : undefined,
            number: ch.orderNum ?? 0,
            censored: false,
          }));
          setAllChannels(channels);
          initialLoadDoneRef.current = true;

          // Check if we have complete data from previous API session (use localStorage for persistence)
          const cacheKey = `iptv-channels-total-${accountId}-${genreId || '*'}`;
          const totalExpected = localStorage.getItem(cacheKey);
          const expectedCount = totalExpected ? Number.parseInt(totalExpected, 10) : 0;

          // If we have complete data (cached >= expected), or 'All' cap reached, skip API call
          const allCapReached = isAllCategory && channels.length >= MAX_ALL_CHANNELS;
          if (allCapReached || (expectedCount > 0 && channels.length >= expectedCount)) {
            hasMoreRef.current = false;
            setHasMore(false);
            return;
          }

          // Otherwise, continue loading from API to get remaining channels
          setHasMore(true);
          // Calculate which page to load next based on cached channels count
          // Use stored page size if available, otherwise fall back to 14
          const pageSizeKey = `iptv-channels-pagesize-${accountId}-${genreId || '*'}`;
          const storedPageSize = parseInt(localStorage.getItem(pageSizeKey) || '14', 10);
          pageRef.current = Math.ceil(channels.length / storedPageSize) + 1;
          setTimeout(async () => {
            if (!loadingRef.current && mountedRef.current) {
              await loadMore();
            }
          }, 100);
        } else if (client && !loadingRef.current && !initialLoadDoneRef.current) {
          // No cached data - load from API
          initialLoadDoneRef.current = true;
          await loadMore();
        }
      } catch (err) {
        // On error, load from API
        if (client && !loadingRef.current && !initialLoadDoneRef.current) {
          initialLoadDoneRef.current = true;
          await loadMore();
        }
      }
    };

    loadFromCache();
  }, [genreId, accountId, client]);

  // Save channels to SQLite only when fully loaded (avoid spamming DB during pagination)
  // For 'All' category, upsertChannels handles incremental saves per batch — skip the DELETE+INSERT here
  useEffect(() => {
    if (!allChannels || allChannels.length === 0) return;
    if (isAllCategory) return; // All category uses upsertChannels per batch instead
    // Only save when we have all channels (hasMore is false)
    // This prevents saving on every page during background loading
    if (hasMoreRef.current) return;

    // Lightweight signature: count + first ID + last ID
    const signature = `${allChannels.length}-${allChannels[0]?.id}-${allChannels.at(-1)?.id}`;
    if (signature === prevSignatureRef.current) return;
    prevSignatureRef.current = signature;

    // Check if we already saved this exact data (prevents re-save after player close)
    const savedSignatureKey = `iptv-channels-saved-${accountId}-${genreId || '*'}`;
    const alreadySaved = localStorage.getItem(savedSignatureKey);
    if (alreadySaved === signature) {
      return;
    }

    saveChannels(allChannels.map(ch => ({
      id: ch.id?.toString() || '',
      name: ch.name || '',
      streamUrl: ch.cmd || '',
      iconUrl: ch.logo_url || ch.logo || '',
      genreId: genreId || ch.tv_genre_id?.toString(),
      orderNum: ch.number || 0,
    })), accountId).then(() => {
      // Mark as saved
      localStorage.setItem(savedSignatureKey, signature);
    }).catch(err => console.error('[DB] Failed to save channels:', err));
  }, [allChannels, accountId, genreId]);

  return {
    channels: allChannels,
    isLoading,
    hasMore,
    loadMore,
    error,
  };
};

// SQLite-backed search across ALL channels (bypasses the 1000-channel 'All' cap)
// backgroundLoading: when true, re-runs search every 2s so results update as new channels arrive
export const useChannelSearch = (accountId: string, query: string, backgroundLoading = false) => {
  const [results, setResults] = React.useState<StalkerChannel[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const runSearch = React.useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    try {
      const rows = await searchChannels(q, accountId, 200);
      setResults(rows.map(ch => ({
        id: ch.id,
        name: ch.name,
        cmd: ch.streamUrl ?? '',
        logo: ch.iconUrl,
        tv_genre_id: ch.genreId ? Number.parseInt(ch.genreId) : undefined,
        number: ch.orderNum ?? 0,
        censored: false,
      })));
    } catch (err) {
      console.error('[useChannelSearch] SQLite search failed', err);
    }
  }, [accountId]);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!query || query.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      await runSearch(query);
      setIsSearching(false);

      // While background loading is active, refresh results every 2s
      if (backgroundLoading) {
        intervalRef.current = setInterval(() => {
          runSearch(query);
        }, 2000);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [query, accountId, backgroundLoading, runSearch]);

  // Stop interval when background loading finishes
  React.useEffect(() => {
    if (!backgroundLoading && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [backgroundLoading]);

  return { results, isSearching };
};

// Prefetch stream URL
// Module-level tracking to prevent request flooding when entering a category
const inFlightTvPrefetches = new Set<string>();
const MAX_CONCURRENT_TV_PREFETCHES = 5;

export const usePrefetchStream = (client: StalkerClient) => {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef<Map<string, number>>(new Map());
  const accountId = client?.['account']?.id || 'default';
  const TTL = 5 * 60 * 1000; // 5 minutes
  
  return useCallback((channel: StalkerChannel) => {
    if (!channel.cmd) return;
    
    const channelId = String(channel.id);
    const queryKey = ['stream', channel.id, accountId];
    const now = Date.now();
    
    // Check if prefetched within TTL
    const lastPrefetch = prefetchedRef.current.get(channelId);
    if (lastPrefetch && now - lastPrefetch < TTL) {
      return;
    }
    
    // Check if already cached in queryClient
    const cached = queryClient.getQueryData(queryKey);
    if (cached && !lastPrefetch) {
      // First time seeing cached data, mark as prefetched
      prefetchedRef.current.set(channelId, now);
      return;
    }
    
    // Limit concurrent prefetches to prevent flooding
    if (inFlightTvPrefetches.size >= MAX_CONCURRENT_TV_PREFETCHES) {
      return;
    }
    
    prefetchedRef.current.set(channelId, now);
    inFlightTvPrefetches.add(channelId);

    // Cleanup: keep only last 200 entries to prevent memory leak
    if (prefetchedRef.current.size > 500) {
      const entries = Array.from(prefetchedRef.current.entries())
        .sort((a, b) => a[1] - b[1])
        .slice(-200);
      prefetchedRef.current = new Map(entries);
    }

    // Skip if already fetching
    const state = queryClient.getQueryState(queryKey);
    if (state?.fetchStatus === 'fetching') return;

    queryClient.prefetchQuery({
      queryKey,
      queryFn: () => client.getStreamUrl(channel.cmd, {
        genreId: channel.tv_genre_id?.toString() || (channel as any).genreId?.toString()
      }).finally(() => {
        inFlightTvPrefetches.delete(channelId);
      }),
      retry: 2,
      retryDelay: attempt => Math.min(1000 * 2 ** attempt, 5000),
    }).then(() => {
      inFlightTvPrefetches.delete(channelId);
    }).catch(() => {
      inFlightTvPrefetches.delete(channelId);
    });
  }, [client, accountId, queryClient]);
};
