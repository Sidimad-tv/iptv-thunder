import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type WatchStatus = 'not_started' | 'in_progress' | 'watched';

interface MovieProgress {
  position: number; // time in seconds
  duration: number; // total duration in seconds
  status: WatchStatus;
  lastWatched: number; // timestamp
  percentage: number; // 0-100
}

interface ResumeState {
  movies: Record<string, MovieProgress>; // movieId -> full progress data
  setPosition: (movieId: string, time: number, duration?: number) => void;
  getPosition: (movieId: string) => number;
  getProgress: (movieId: string) => MovieProgress | undefined;
  clearPosition: (movieId: string) => void;
  markAsWatched: (movieId: string, duration: number) => void;
  getWatchStatus: (movieId: string) => WatchStatus;
  getInProgressMovies: () => { movieId: string; progress: MovieProgress }[];
  getWatchedMovies: () => { movieId: string; progress: MovieProgress }[];
  cleanupOldEntries: () => void;
}

const WATCHED_THRESHOLD = 90; // 90% ukończenia = obejrzane
const MIN_WATCH_TIME = 30; // Minimum 30 sec
const ENTRY_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Helper function to validate movieId
const validateMovieId = (movieId: string): boolean => {
  return typeof movieId === 'string' && movieId.length > 0;
};

// Helper function to check if entry is expired
const isEntryExpired = (lastWatched: number): boolean => {
  return Date.now() - lastWatched > ENTRY_TTL;
};

export const useResumeStore = create<ResumeState>()(
  persist(
    (set, get) => ({
      movies: {},

      setPosition: (movieId, time, duration = 0) => {
        if (!validateMovieId(movieId)) return;
        if (time > 0 && time < MIN_WATCH_TIME) return; // Don't save if less than 30 seconds

        const percentage = duration > 0 ? Math.round((time / duration) * 100) : 0;

        // Determine status
        let status: WatchStatus = 'not_started';
        if (percentage >= WATCHED_THRESHOLD) {
          status = 'watched';
        } else if (time >= MIN_WATCH_TIME) {
          status = 'in_progress';
        }

        // Preserve 'watched' status if already set (e.g., from markAsWatched called when video ended naturally)
        const existingProgress = get().movies[movieId];
        if (existingProgress?.status === 'watched') {
          status = 'watched';
        }

        // If time is 0, clear the progress
        if (time === 0) {
          set((state) => {
            const { [movieId]: _, ...restMovies } = state.movies;
            return { movies: restMovies };
          });
          return;
        }

        const progress: MovieProgress = {
          position: time,
          duration,
          status,
          lastWatched: Date.now(),
          percentage,
        };

        set((state) => ({
          movies: { ...state.movies, [movieId]: progress },
        }));
      },

      getPosition: (movieId) => {
        return get().movies[movieId]?.position || 0;
      },

      getProgress: (movieId) => {
        return get().movies[movieId];
      },

      clearPosition: (movieId) => {
        if (!validateMovieId(movieId)) return;
        set((state) => {
          const { [movieId]: _, ...restMovies } = state.movies;
          return { movies: restMovies };
        });
      },

      markAsWatched: (movieId, duration) => {
        if (!validateMovieId(movieId)) return;
        const progress: MovieProgress = {
          position: duration,
          duration,
          status: 'watched',
          lastWatched: Date.now(),
          percentage: 100,
        };

        set((state) => ({
          movies: { ...state.movies, [movieId]: progress },
        }));
      },

      getWatchStatus: (movieId) => {
        return get().movies[movieId]?.status || 'not_started';
      },

      getInProgressMovies: () => {
        const state = get();
        return Object.entries(state.movies)
          .filter(([_, progress]) => progress.status === 'in_progress')
          .sort((a, b) => b[1].lastWatched - a[1].lastWatched)
          .map(([movieId, progress]) => ({ movieId, progress }));
      },

      getWatchedMovies: () => {
        const state = get();
        return Object.entries(state.movies)
          .filter(([_, progress]) => progress.status === 'watched')
          .sort((a, b) => b[1].lastWatched - a[1].lastWatched)
          .map(([movieId, progress]) => ({ movieId, progress }));
      },

      cleanupOldEntries: () => {
        set((state) => {
          const filteredMovies = Object.entries(state.movies)
            .filter(([_, progress]) => !isEntryExpired(progress.lastWatched))
            .reduce((acc, [movieId, progress]) => {
              acc[movieId] = progress;
              return acc;
            }, {} as Record<string, MovieProgress>);
          return { movies: filteredMovies };
        });
      },
    }),
    {
      name: 'iptv-resume-positions',
      storage: createJSONStorage(() => {
        try {
          return localStorage;
        } catch (error) {
          console.error('localStorage access failed:', error);
          // Fallback to in-memory storage if localStorage fails
          const inMemoryStorage: Storage = {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
            clear: () => {},
            get length() { return 0; },
            key: () => null,
          };
          return inMemoryStorage;
        }
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Cleanup old entries on rehydration
          state.movies = Object.entries(state.movies)
            .filter(([_, progress]) => !isEntryExpired(progress.lastWatched))
            .reduce((acc, [movieId, progress]) => {
              acc[movieId] = progress;
              return acc;
            }, {} as Record<string, MovieProgress>);
        }
      },
    }
  )
);
