import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_STREAMS = 200;
const STORAGE_KEY = 'stream-ranking';

// Clear storage on init if quota exceeded
try {
  const test = localStorage.getItem(STORAGE_KEY);
  if (test) {
    // Try to parse and check size
    const parsed = JSON.parse(test);
    const size = new Blob([JSON.stringify(parsed)]).size;
    // If larger than 2MB, clear it
    if (size > 2 * 1024 * 1024) {
      console.warn('Stream store too large, clearing:', size, 'bytes');
      localStorage.removeItem(STORAGE_KEY);
    }
  }
} catch (err) {
  // Only clear storage on quota or parsing errors, not other errors
  const errorMessage = err instanceof Error ? err.message : String(err);
  if (errorMessage.includes('quota') || errorMessage.includes('storage') || err instanceof SyntaxError) {
    console.error('Storage quota or parse error, clearing:', err);
    localStorage.removeItem(STORAGE_KEY);
  } else {
    console.error('Error checking stream store size (not clearing storage):', err);
  }
}

type StreamStats = {
  readonly url: string;
  readonly successRate: number;
  readonly successes: number;
  readonly fails: number;
  readonly lastSuccess?: number;
};

// Helper function to validate URL
const isValidUrl = (url: unknown): url is string => {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Helper function to trim streams to MAX_STREAMS by lastSuccess
const trimStreams = (streams: Record<string, StreamStats>): Record<string, StreamStats> => {
  const entries = Object.entries(streams);
  if (entries.length <= MAX_STREAMS) return streams;

  const sorted = entries.toSorted((a, b) => {
    const aTime = a[1].lastSuccess || 0;
    const bTime = b[1].lastSuccess || 0;
    return bTime - aTime;
  });

  const trimmed = sorted.slice(0, MAX_STREAMS);
  const newStreams: Record<string, StreamStats> = {};
  for (const [url, stats] of trimmed) {
    newStreams[url] = stats;
  }
  return newStreams;
};

type Store = {
  readonly streams: Record<string, StreamStats>;
  success: (url: string) => void;
  fail: (url: string) => void;
  cleanup: () => void;
  clear: () => void;
  // Selector methods for common queries
  getStreamStats: (url: string) => StreamStats | undefined;
  getTopStreams: (limit?: number) => StreamStats[];
  getStreamCount: () => number;
  getAverageSuccessRate: () => number;
};

export const useStreamStore = create<Store>()(
  persist(
    (set, get) => ({
      streams: {},

      success: (url: string) => {
        if (!isValidUrl(url)) return;
        const { streams } = get();
        const s: StreamStats = streams[url] || {
          url,
          successRate: 0,
          successes: 0,
          fails: 0,
        };

        const successes = s.successes + 1;
        const total = successes + s.fails;

        const updatedStream: StreamStats = {
          ...s,
          successes,
          successRate: successes / total,
          lastSuccess: Date.now(),
        };

        const trimmed = trimStreams(streams);
        trimmed[url] = updatedStream;
        try {
          set({ streams: trimmed });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          if (errorMessage.includes('quota') || errorMessage.includes('storage')) {
            console.error('Storage quota exceeded in success:', err);
            // Trigger cleanup to free space
            get().cleanup();
          } else {
            console.error('Error updating stream stats:', err);
          }
        }
      },

      fail: (url: string) => {
        if (!isValidUrl(url)) return;
        const { streams } = get();
        const s: StreamStats = streams[url] || {
          url,
          successRate: 0,
          successes: 0,
          fails: 0,
        };

        const fails = s.fails + 1;
        const total = fails + s.successes;

        try {
          set({
            streams: {
              ...streams,
              [url]: {
                ...s,
                fails,
                successRate: s.successes / total,
              }
            }
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          if (errorMessage.includes('quota') || errorMessage.includes('storage')) {
            console.error('Storage quota exceeded in fail:', err);
            // Trigger cleanup to free space
            get().cleanup();
          } else {
            console.error('Error updating stream stats:', err);
          }
        }
      },

      cleanup: () => {
        const streams = get().streams;
        const trimmed = trimStreams(streams);
        try {
          set({ streams: trimmed });
        } catch (err) {
          console.error('Error during cleanup:', err);
        }
      },

      clear: () => {
        set({ streams: {} });
      },

      // Selector methods for common queries
      getStreamStats: (url: string) => {
        if (!isValidUrl(url)) return undefined;
        const { streams } = get();
        return streams[url];
      },

      getTopStreams: (limit: number = 10) => {
        const { streams } = get();
        const entries = Object.entries(streams);
        const sorted = entries.toSorted((a, b) => b[1].successRate - a[1].successRate);
        return sorted.slice(0, limit).map(([, stats]) => stats);
      },

      getStreamCount: () => {
        const { streams } = get();
        return Object.keys(streams).length;
      },

      getAverageSuccessRate: () => {
        const { streams } = get();
        const entries = Object.entries(streams);
        if (entries.length === 0) return 0;
        const total = entries.reduce((sum, [, stats]) => sum + stats.successRate, 0);
        return total / entries.length;
      },
    }),
    { name: STORAGE_KEY }
  )
);
