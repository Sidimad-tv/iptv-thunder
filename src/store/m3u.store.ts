import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { M3uAccount } from '@/features/m3u/m3u.types';
import { createLogger } from '@/lib/logger';
import { tauriStorage } from '@/lib/tauriStorage';
const logger = createLogger('M3U');

interface M3uState {
  accounts: M3uAccount[];
  activeM3uId: string | null;

  // Actions
  addM3u: (data: Omit<M3uAccount, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateM3u: (id: string, updates: Partial<M3uAccount>) => void;
  deleteM3u: (id: string) => void;
  setActiveM3u: (id: string | null) => void;
  getActiveM3u: () => M3uAccount | null;
  deduplicateM3u: () => void;
  removeNonWorkingM3u: () => void;
}

export const useM3uStore = create<M3uState>()(
  persist(
    immer((set, get) => ({
    accounts: [],
    activeM3uId: null,

    addM3u: (data) => {
      set((state) => {
        const dup = state.accounts.some(
          p => (p.url && data.url && p.url === data.url) ||
               (p.serverUrl && data.serverUrl && p.serverUrl === data.serverUrl && p.username === data.username)
        );
        if (dup) return;
        state.accounts.push({
          ...data,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as M3uAccount);
      });
    },

    updateM3u: (id, updates) => {
      set((state) => {
        const acct = state.accounts.find((p) => p.id === id);
        if (acct) Object.assign(acct, updates, { updatedAt: new Date() });
      });
    },

    deleteM3u: (id) => {
      set((state) => {
        const idx = state.accounts.findIndex((p) => p.id === id);
        if (idx > -1) state.accounts.splice(idx, 1);
        if (state.activeM3uId === id) state.activeM3uId = null;
      });
    },

    setActiveM3u: (id) => {
      set((state) => { state.activeM3uId = id; });
    },

    getActiveM3u: () => {
      const { accounts, activeM3uId } = get();
      return accounts.find((a) => a.id === activeM3uId) || null;
    },

    deduplicateM3u: () => {
      set((state) => {
        const byUrl = new Map<string, M3uAccount[]>();
        for (const a of state.accounts) {
          const key = a.url || a.serverUrl || a.id;
          const group = byUrl.get(key) || [];
          group.push(a);
          byUrl.set(key, group);
        }
        const toRemove: string[] = [];
        for (const [, group] of byUrl) {
          if (group.length <= 4) continue;
          group.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          for (let i = 4; i < group.length; i++) toRemove.push(group[i].id);
        }
        if (toRemove.length > 0) {
          state.accounts = state.accounts.filter((a) => !toRemove.includes(a.id));
          logger.debug(`Removed ${toRemove.length} duplicate M3U(s)`);
        }
      });
    },

    removeNonWorkingM3u: () => {
      const { accounts, activeM3uId } = get();
      const toKeep = accounts.filter((a) => !/test|demo|sample/i.test(a.name));
      if (toKeep.length < accounts.length) {
        set((state) => {
          state.accounts = toKeep;
          if (activeM3uId && !toKeep.some((a) => a.id === activeM3uId)) state.activeM3uId = null;
        });
        logger.debug(`Removed ${accounts.length - toKeep.length} test M3U(s)`);
      }
    },
  })),
  {
    name: 'm3u-accounts',
    storage: tauriStorage,
    partialize: (state) => ({
      ...state,
      accounts: state.accounts.map((acct) => {
        if (acct.sourceType === 'file') return acct;
        const { channels: _ch, ...rest } = acct;
        return rest;
      }),
    }),
  }
  )
);
