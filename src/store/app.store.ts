import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface AppState {
  isFullscreen: boolean;
  isPip: boolean;

  setFullscreen: (value: boolean) => void;
  setPip: (value: boolean) => void;
}

export type AppActions = Pick<AppState, 'setFullscreen' | 'setPip'>;

export const initialState: Pick<AppState, 'isFullscreen' | 'isPip'> = {
  isFullscreen: false,
  isPip: false,
};

export const useAppStore = create<AppState>()(
  immer((set) => ({
    ...initialState,

    setFullscreen: (value: boolean) => {
      set((state) => {
        state.isFullscreen = value;
      });
    },

    setPip: (value: boolean) => {
      set((state) => {
        state.isPip = value;
      });
    },
  }))
);

