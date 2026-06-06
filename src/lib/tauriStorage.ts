import { Store } from '@tauri-apps/plugin-store';
import { PersistStorage, StorageValue } from 'zustand/middleware';

const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

let store: Store | null = null;
let storePromise: Promise<Store> | null = null;

async function getStore(): Promise<Store> {
  if (!isTauri) throw new Error('Not in Tauri environment');
  if (store) return store;
  storePromise ??= Store.load('stalker-portals').then(s => {
    store = s;
    return s;
  });
  return storePromise;
}

function getLocalStorageKey(name: string): string {
  return `tauri_fallback_${name}`;
}

export async function clearTauriStore(): Promise<void> {
  try {
    if (isTauri) {
      const s = await getStore();
      await s.clear();
      await s.save();
      store = null;
    }
  } catch (error) {
    console.error('[TauriStorage] clear error:', error);
  }
}

export const tauriStorage: PersistStorage<unknown> = {
  getItem: async (name: string): Promise<StorageValue<unknown> | null> => {
    try {
      if (isTauri) {
        const s = await getStore();
        const value = await s.get<StorageValue<unknown>>(name);
        return value ?? null;
      }
    } catch (error) {
      console.warn('[TauriStorage] Tauri storage unavailable, falling back to localStorage:', error);
    }
    try {
      const raw = localStorage.getItem(getLocalStorageKey(name));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setItem: async (name: string, value: StorageValue<unknown>): Promise<void> => {
    try {
      if (isTauri) {
        const s = await getStore();
        await s.set(name, value);
        await s.save();
        return;
      }
    } catch (error) {
      console.warn('[TauriStorage] Tauri storage unavailable, falling back to localStorage:', error);
    }
    try {
      localStorage.setItem(getLocalStorageKey(name), JSON.stringify(value));
    } catch (error) {
      console.error('[TauriStorage] localStorage setItem error:', error);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      if (isTauri) {
        const s = await getStore();
        await s.delete(name);
        await s.save();
        return;
      }
    } catch (error) {
      console.warn('[TauriStorage] Tauri storage unavailable, falling back to localStorage:', error);
    }
    try {
      localStorage.removeItem(getLocalStorageKey(name));
    } catch (error) {
      console.error('[TauriStorage] localStorage removeItem error:', error);
    }
  },
};
