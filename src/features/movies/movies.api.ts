// =========================
// 🎬 MOVIES API (Simplified)
// =========================
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerVOD, StalkerGenre } from '@/types';

// ─── Layer 1: API Fetcher ─────────────────────────────────────────────────────

export interface FetchVODPagesOptions {
  signal?: AbortSignal;
  onProgress?: (items: StalkerVOD[], loadedPages: number, totalPages: number) => void;
  search?: string;
}

/**
 * Fetch all VOD pages from API with progressive hydration support
 * Layer 1: Pure API fetching without transformation
 */
export async function fetchVODPages(
  client: StalkerClient,
  categoryId: string,
  options?: FetchVODPagesOptions,
): Promise<StalkerVOD[]> {
  const { signal, onProgress, search } = options || {};

  // Check if aborted before starting
  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }

  const first = await client.getVODListWithPagination(categoryId, 1, { signal, search });

  if (!first.hasMore || first.items.length === 0) {
    return first.items;
  }

  // Determine total pages from totalItems and maxPageItems
  const totalPages = first.totalItems > 0 && first.maxPageItems > 0
    ? Math.ceil(first.totalItems / first.maxPageItems)
    : undefined;

  if (totalPages) {
    // Progressive fetch: load pages in parallel with concurrency limit
    const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    let allItems = [...first.items];

    // Emit first page immediately for progressive hydration
    if (onProgress) {
      onProgress(first.items, 1, totalPages);
    }

    // Parallel fetching with conservative concurrency to avoid 503 errors
    const CONCURRENCY_LIMIT = 3;

    for (let i = 0; i < pageNums.length; i += CONCURRENCY_LIMIT) {
      const batch = pageNums.slice(i, i + CONCURRENCY_LIMIT);

      if (signal?.aborted) {
        throw new DOMException('aborted', 'AbortError');
      }

      try {
        const batchPromises = batch.map(async (page) => {
          try {
            const pageData = await client.getVODListWithPagination(categoryId, page, { signal, search });
            return { page, items: pageData.items };
          } catch (e) {
            console.error(`Failed to fetch page ${page}:`, e);
            return { page, items: [] };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        // Merge results and emit progress
        const newItems = batchResults.flatMap(r => r.items);
        allItems = [...allItems, ...newItems];

        if (onProgress) {
          onProgress(allItems, i + batch.length, totalPages);
        }

        // Small delay between batches to avoid server overload
        await new Promise(r => setTimeout(r, 50));
      } catch (e) {
        console.error('Batch fetch error:', e);
      }
    }

    return allItems;
  }

  return first.items;
}

// ─── Layer 2: Normalizer ───────────────────────────────────────────────────────

/**
 * Normalize VOD data from API format
 * Handles deduplication, timestamp precomputation, and sorting
 * Layer 2: Pure data transformation without side effects
 */
export function normalizeVod(items: StalkerVOD[]): StalkerVOD[] {
  // Deduplicate by id (pages can overlap on some servers)
  const map = new Map<string, StalkerVOD>();
  for (const item of items) {
    // Clone object to avoid mutating API response
    const cloned = {
      ...item,
      name: item.o_name && item.o_name !== item.name ? item.o_name : item.name,
    };
    map.set(String(item.id), cloned);
  }
  const uniqueItems = Array.from(map.values());

  // Precompute timestamps to avoid O(n log n) Date parsing in comparator
  const withTimestamps = uniqueItems.map(item => ({
    ...item,
    _ts: item.added ? new Date(item.added).getTime() : 0,
  }));

  // Sort by precomputed timestamp - newest first
  // Using Intl.Collator for better performance on large arrays
  withTimestamps.sort((a, b) => b._ts - a._ts);

  return withTimestamps as StalkerVOD[];
}

/**
 * Normalize DB format to StalkerVOD format
 */
export function normalizeDbVod(items: any[]): StalkerVOD[] {
  return items.map(v => ({
    id: Number(v.id),
    name: v.name,
    description: v.description,
    logo: v.posterUrl,
    poster: v.posterUrl,
    cmd: v.streamUrl,
    year: v.year,
    rating_imdb: v.rating,
    rating_kinopoisk: undefined,
    length: v.duration,
    genre: v.genre,
    director: v.director,
    actors: v.actors,
    added: v.added ? new Date(v.added).toISOString() : undefined,
    censored: false,
    _ts: v.added ? new Date(v.added).getTime() : 0,
  } as StalkerVOD & { _ts: number })).sort((a, b) => b._ts - a._ts) as StalkerVOD[];
}

// ─── Layer 3: Persistence ─────────────────────────────────────────────────────

// Write queue to prevent race conditions in DB writes
const writeQueue = new Map<string, Promise<void>>();

/**
 * Persist VOD data to SQLite with queuing to prevent race conditions
 * Layer 3: Pure persistence without business logic
 */
export async function persistVodQueue(
  vodList: any[],
  accountId: string,
  categoryId: string,
  saveVodFn: (vodList: any[], accountId: string, categoryId: string) => Promise<void>,
): Promise<void> {
  const queueKey = `${accountId}:${categoryId}`;

  // If there's already a write in progress for this category, wait for it
  const existingWrite = writeQueue.get(queueKey);
  if (existingWrite) {
    await existingWrite;
  }

  // Create new write promise
  const writePromise = saveVodFn(vodList, accountId, categoryId).finally(() => {
    // Remove from queue when done
    writeQueue.delete(queueKey);
  });

  writeQueue.set(queueKey, writePromise);
  return writePromise;
}

// ─── Existing API functions ────────────────────────────────────────────────────

export const getMovieCategories = async (client: StalkerClient): Promise<StalkerGenre[]> => {
  return client.getVODCategories();
};

export const getMovieDetails = async (client: StalkerClient, movieId: string): Promise<StalkerVOD> => {
  return client.getVODDetails(movieId);
};

export const getMovieStream = async (client: StalkerClient, cmd: string): Promise<string> => {
  return client.getVODUrl(cmd);
};
