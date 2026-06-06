// =========================
// 📦 PORTAL DATA CACHE STORE
// =========================
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { StalkerChannel, StalkerVOD, StalkerGenre, StalkerEPG } from '@/types';

interface PortalData {
  channelsByGenre: Record<string, StalkerChannel[]>;
  allChannels: StalkerChannel[];
  channelCategories: StalkerGenre[];
  vod: StalkerVOD[];
  vodByCategory: Record<string, StalkerVOD[]>;
  vodCategories: StalkerGenre[];
  epgCache: Record<number, { programs: StalkerEPG[]; timestamp: number }>;
  lastUpdated: number;
}

interface PortalCacheState {
  portalsData: Record<string, PortalData>;
  isHydrated: boolean;
  
  // Actions
  setChannels: (portalId: string, genreId: string, channels: StalkerChannel[]) => void;
  setAllChannels: (portalId: string, channels: StalkerChannel[]) => void;
  setChannelCategories: (portalId: string, categories: StalkerGenre[]) => void;
  setVOD: (portalId: string, vod: StalkerVOD[]) => void;
  setVODForCategory: (portalId: string, categoryId: string, vod: StalkerVOD[]) => void;
  appendVODPage: (portalId: string, categoryId: string, page: number, items: StalkerVOD[]) => void;
  clearVODForCategory: (portalId: string, categoryId: string) => void;
  setVODCategories: (portalId: string, categories: StalkerGenre[]) => void;
  setChannelEPG: (portalId: string, channelId: number, programs: StalkerEPG[]) => void;
  getChannelEPG: (portalId: string, channelId: number) => StalkerEPG[] | null;
  hasValidEPG: (portalId: string, channelId: number, maxAgeMs?: number) => boolean;
  clearChannelEPG: (portalId: string, channelId: number) => void;
  clearAllEPG: (portalId: string) => void;
  getPortalData: (portalId: string) => PortalData | null;
  hasPortalData: (portalId: string) => boolean;
  clearPortalData: (portalId: string) => void;
  clearAllCache: () => void;
  setHydrated: (value: boolean) => void;
}

export const usePortalCacheStore = create<PortalCacheState>()(
  immer((set, get) => ({
    portalsData: {},
    isHydrated: false,

    setChannels: (portalId, genreId, channels) => {
        set((state) => {
          if (!state.portalsData[portalId]) {
            state.portalsData[portalId] = {
              channelsByGenre: {},
              allChannels: [],
              channelCategories: [],
              vod: [],
              vodByCategory: {},
              vodCategories: [],
              epgCache: {},
              lastUpdated: 0,
            };
          }
          state.portalsData[portalId].channelsByGenre[genreId] = channels;
          state.portalsData[portalId].lastUpdated = Date.now();
        });
      },
      
      setAllChannels: (portalId, channels) => {
        set((state) => {
          if (!state.portalsData[portalId]) {
            state.portalsData[portalId] = {
              channelsByGenre: {},
              allChannels: [],
              channelCategories: [],
              vod: [],
              vodByCategory: {},
              vodCategories: [],
              epgCache: {},
              lastUpdated: 0,
            };
          }
          state.portalsData[portalId].allChannels = channels;
          state.portalsData[portalId].lastUpdated = Date.now();
        });
      },
      
      setChannelCategories: (portalId, categories) => {
        set((state) => {
          if (!state.portalsData[portalId]) {
            state.portalsData[portalId] = {
              channelsByGenre: {},
              allChannels: [],
              channelCategories: [],
              vod: [],
              vodByCategory: {},
              vodCategories: [],
              epgCache: {},
              lastUpdated: 0,
            };
          }
          state.portalsData[portalId].channelCategories = categories;
          state.portalsData[portalId].lastUpdated = Date.now();
        });
      },
      
      setVOD: (portalId, vod) => {
        set((state) => {
          if (!state.portalsData[portalId]) {
            state.portalsData[portalId] = {
              channelsByGenre: {},
              allChannels: [],
              channelCategories: [],
              vod: [],
              vodByCategory: {},
              vodCategories: [],
              epgCache: {},
              lastUpdated: 0,
            };
          }
          state.portalsData[portalId].vod = vod;
          state.portalsData[portalId].lastUpdated = Date.now();
        });
      },
      
      setVODForCategory: (portalId, categoryId, vod) => {
        set((state) => {
          if (!state.portalsData[portalId]) {
            state.portalsData[portalId] = {
              channelsByGenre: {},
              allChannels: [],
              channelCategories: [],
              vod: [],
              vodByCategory: {},
              vodCategories: [],
              epgCache: {},
              lastUpdated: 0,
            };
          }
          if (!state.portalsData[portalId].vodByCategory) {
            state.portalsData[portalId].vodByCategory = {};
          }
          state.portalsData[portalId].vodByCategory[categoryId] = vod;
          state.portalsData[portalId].lastUpdated = Date.now();
        });
      },
      
      appendVODPage: (portalId, categoryId, page, items) => {
        set((state) => {
          if (!state.portalsData[portalId]) {
            state.portalsData[portalId] = {
              channelsByGenre: {},
              allChannels: [],
              channelCategories: [],
              vod: [],
              vodByCategory: {},
              vodCategories: [],
              epgCache: {},
              lastUpdated: 0,
            };
          }
          if (!state.portalsData[portalId].vodByCategory) {
            state.portalsData[portalId].vodByCategory = {};
          }
          const existing = state.portalsData[portalId].vodByCategory[categoryId] || [];
          const existingIds = new Set(existing.map(v => v.id));
          const newItems = items.filter(v => !existingIds.has(v.id));
          
          if (newItems.length === 0) {
            return;
          }
          
          // Insert new items in sorted position (maintains sort without full resort)
          const merged = [...existing];
          for (const item of newItems) {
            const itemDate = Number(item.added) || 0;
            const insertIndex = merged.findIndex(v => (Number(v.added) || 0) < itemDate);
            if (insertIndex === -1) {
              merged.push(item);
            } else {
              merged.splice(insertIndex, 0, item);
            }
          }
          
          state.portalsData[portalId].vodByCategory[categoryId] = merged;
          state.portalsData[portalId].lastUpdated = Date.now();
          console.log('[PortalCache] Appended', newItems.length, 'items (page', page, ') for', categoryId, '- total:', merged.length);
        });
      },
      
      clearVODForCategory: (portalId, categoryId) => {
        set((state) => {
          if (state.portalsData[portalId]?.vodByCategory?.[categoryId]) {
            delete state.portalsData[portalId].vodByCategory[categoryId];
            state.portalsData[portalId].lastUpdated = Date.now();
            console.log('[PortalCache] Cleared VOD cache for category:', categoryId);
          }
        });
      },
      
      setVODCategories: (portalId, categories) => {
        set((state) => {
          if (!state.portalsData[portalId]) {
            state.portalsData[portalId] = {
              channelsByGenre: {},
              allChannels: [],
              channelCategories: [],
              vod: [],
              vodByCategory: {},
              vodCategories: [],
              epgCache: {},
              lastUpdated: 0,
            };
          }
          state.portalsData[portalId].vodCategories = categories;
          state.portalsData[portalId].lastUpdated = Date.now();
        });
      },

      setChannelEPG: (portalId, channelId, programs) => {
        set((state) => {
          if (!state.portalsData[portalId]) {
            state.portalsData[portalId] = {
              channelsByGenre: {},
              allChannels: [],
              channelCategories: [],
              vod: [],
              vodByCategory: {},
              vodCategories: [],
              epgCache: {},
              lastUpdated: 0,
            };
          }
          if (!state.portalsData[portalId].epgCache) {
            state.portalsData[portalId].epgCache = {};
          }
          state.portalsData[portalId].epgCache[channelId] = {
            programs,
            timestamp: Date.now(),
          };
        });
      },

      getChannelEPG: (portalId, channelId) => {
        return get().portalsData[portalId]?.epgCache?.[channelId]?.programs || null;
      },

      hasValidEPG: (portalId, channelId, maxAgeMs = 30 * 60 * 1000) => {
        const cached = get().portalsData[portalId]?.epgCache?.[channelId];
        if (!cached) return false;
        return Date.now() - cached.timestamp < maxAgeMs;
      },

      clearChannelEPG: (portalId, channelId) => {
        set((state) => {
          if (state.portalsData[portalId]?.epgCache?.[channelId]) {
            delete state.portalsData[portalId].epgCache[channelId];
            console.log('[PortalCache] Cleared EPG cache for channel:', channelId);
          }
        });
      },

      clearAllEPG: (portalId) => {
        set((state) => {
          if (state.portalsData[portalId]?.epgCache) {
            state.portalsData[portalId].epgCache = {};
          }
        });
      },

      getPortalData: (portalId) => {
        return get().portalsData[portalId] || null;
      },
      
      hasPortalData: (portalId) => {
        const data = get().portalsData[portalId];
        return !!data && (data.allChannels.length > 0 || Object.keys(data.channelsByGenre).length > 0);
      },
      
      clearPortalData: (portalId) => {
        set((state) => {
          delete state.portalsData[portalId];
        });
      },
      
      clearAllCache: () => {
        set((state) => {
          state.portalsData = {};
        });
      },
      
      setHydrated: (value) => {
        set((state) => {
          state.isHydrated = value;
        });
      },
    }))
);

