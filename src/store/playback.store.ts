// =========================
// 🎬 PLAYBACK STORE (Zustand v5 + Immer)
// =========================
// Single player manager to avoid side-effect conflicts from multiple player instances

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { StalkerVOD } from '@/types';

interface PlayerMedia {
  url: string;
  name: string;
  channelId?: number;
  isVod?: boolean;
  movieId?: string;
  resumePosition?: number;
  portalUrl?: string;
  mac?: string;
  token?: string;
  genreId?: string;
  episodes?: StalkerVOD[];
  currentEpisodeIndex?: number;
  autoPlayEpisodes?: boolean;
}

interface PlaybackSettings {
  volume: number;
  muted: boolean;
}

export interface PlaybackState {
  // Current media
  current: PlayerMedia | null;
  buffering: boolean;
  error: string | null;

  // Content type tracking
  contentType: 'tv' | 'movies' | 'series' | null;

  // Settings (persisted)
  settings: PlaybackSettings;

  // Actions
  setMedia: (media: PlayerMedia | null) => void;
  setBuffering: (value: boolean) => void;
  setContentType: (type: 'tv' | 'movies' | 'series' | null) => void;
  setError: (error: string | null) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  stop: () => void;
  close: () => void;
}

export const usePlaybackStore = create<PlaybackState>()(
  persist(
    immer((set) => ({
      current: null,
      buffering: false,
      error: null,
      contentType: null,
      settings: {
        volume: 1,
        muted: false,
      },

      setMedia: (media) => {
        set((state) => {
          state.current = media;
          state.error = null;
        });
      },

      setBuffering: (value) => {
        set((state) => {
          state.buffering = value;
        });
      },

      setContentType: (type) => {
        set((state) => {
          state.contentType = type;
        });
      },

      setError: (error) => {
        set((state) => {
          state.error = error;
        });
      },

      setVolume: (volume) => {
        set((state) => {
          state.settings.volume = volume;
        });
      },

      setMuted: (muted) => {
        set((state) => {
          state.settings.muted = muted;
        });
      },

      stop: () => {
        set((state) => {
          state.current = null;
          state.buffering = false;
          state.error = null;
        });
      },

      close: () => {
        set((state) => {
          state.current = null;
          state.buffering = false;
          state.error = null;
          state.contentType = null;
        });
      },
    })),
    {
      name: 'playback-storage',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
