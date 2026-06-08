// =========================
// 💾 MODERN PORTALS STORE (Zustand v5 + Immer)
// =========================
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { PortalAccount } from '@/features/portals/portals.types';
import { clearAllDataForPortal } from '@/hooks/useDatabase';
import { clearAllCategoriesCache } from '@/hooks/useCategories';
import { tauriStorage } from '@/lib/tauriStorage';
import { createLogger } from '@/lib/logger';
import { StalkerClient } from '@/lib/stalkerAPI_new';
const logger = createLogger('Portals');

// Predefined EPG services
export interface EpgService {
  id: string;
  name: string;
  url: string;
  description?: string;
}

export const PREDEFINED_EPG_SERVICES: EpgService[] = [
  { id: 'auto', name: 'Automatic (from IPTV server)', url: '', description: 'Uses EPG provided by your IPTV server' },
  { id: 'epg_ovh_pl', name: 'EPG OVH (Poland)', url: 'https://epg.ovh/pl.xml', description: 'EPG for Polish TV channels' },
  { id: 'epg_share', name: 'EPG Share (epg-share.com)', url: 'https://epgshare01.online/epg_ripper_US_LOCALS2.xml.gz', description: 'Free EPG mainly for US channels' },
  { id: 'github_epg', name: 'IPTV Org EPG', url: 'https://epg.pw/xmltv.xml.gz', description: 'EPG from iptv-org.github.io - global channels' },
  { id: 'custom', name: 'Custom URL', url: '', description: 'Enter your own XMLTV file URL' },
];

interface PortalsState {
  portals: PortalAccount[];
  activePortalId: string | null;

  // EPG Settings
  externalEpgUrl: string | null;
  selectedEpgService: string | null;

  // Actions
  addPortal: (portal: Omit<PortalAccount, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePortal: (id: string, updates: Partial<PortalAccount>) => void;
  deletePortal: (id: string) => Promise<void>;
  setActivePortal: (id: string | null) => void;
  getActivePortal: () => PortalAccount | null;
  getPortalById: (id: string) => PortalAccount | undefined;
  setExternalEpgUrl: (url: string | null) => void;
  setSelectedEpgService: (serviceId: string | null) => void;
  getEffectiveEpgUrl: () => string | null;
  deduplicatePortals: () => void;
  removeNonWorkingPortals: () => void;
}

export const usePortalsStore = create<PortalsState>()(
  persist(
    immer((set, get) => ({
      portals: [],
      activePortalId: null,
      externalEpgUrl: null,
      selectedEpgService: null,

      addPortal: (portalData) => {
        set((state) => {
          // Check for duplicate portal (same MAC and URL)
          const isDuplicate = state.portals.some(
            p => p.mac.toLowerCase() === portalData.mac.toLowerCase() &&
                 p.portalUrl === portalData.portalUrl
          );
          if (isDuplicate) {
            return;
          }

          const newPortal: PortalAccount = {
            ...portalData,
            id: crypto.randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          state.portals.push(newPortal);
        });
      },

      updatePortal: (id, updates) => {
        set((state) => {
          const portal = state.portals.find((p) => p.id === id);
          if (portal) {
            Object.assign(portal, updates, { updatedAt: new Date() });
          }
        });
      },

      deletePortal: async (id) => {
        // Check if portal exists before starting
        const portalExists = get().portals.some((p) => p.id === id);
        if (!portalExists) {
          logger.debug('Portal already deleted or does not exist:', id);
          return;
        }

        // Clear all database data for this portal first
        try {
          await clearAllDataForPortal(id);
          // Also clear categories cache to prevent stale data
          await clearAllCategoriesCache();
          // Clear React Query persisted cache from localStorage
          localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
          logger.debug('Database, categories cache, and React Query cache cleared for portal:', id);
        } catch (error: unknown) {
          // Ignore if database has old schema (missing portal_id column)
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('no such column') || errorMessage.includes('no such table')) {
            logger.debug('Database has old schema, skipping cleanup');
          } else {
            logger.error('Error clearing database for portal:', id, error);
          }
        }
        
        // Check again before set - portal might have been deleted during await
        const stillExists = get().portals.some((p) => p.id === id);
        if (!stillExists) {
          logger.debug('Portal was removed during cleanup, skipping set');
          return;
        }
        
        set((state) => {
          const index = state.portals.findIndex((p) => p.id === id);
          if (index > -1) {
            state.portals.splice(index, 1);
          }
          if (state.activePortalId === id) {
            state.activePortalId = null;
          }
        });
      },

      setActivePortal: (id) => {
        set((state) => {
          state.activePortalId = id;
        });
        
        // Fetch account info in background when portal becomes active
        if (id) {
          const portal = get().portals.find((p) => p.id === id);
          if (portal) {
            const client = new StalkerClient({
              id: portal.id,
              name: portal.name,
              portalUrl: portal.portalUrl,
              mac: portal.mac,
              login: portal.login,
              lastUsed: new Date(),
              isActive: true,
            });
            
            client.getAccountInfo().then((accountInfo) => {
              if (accountInfo?.phone) {
                const parsed = new Date(accountInfo.phone);
                if (!Number.isNaN(parsed.getTime())) {
                  get().updatePortal(id, { expiresAt: parsed });
                  logger.debug('Updated portal expiresAt from background test:', id, parsed);
                }
              }
            }).catch((err) => {
              logger.debug('Background account info fetch failed:', err);
            });
          }
        }
      },

      getActivePortal: () => {
        const { portals, activePortalId } = get();
        return portals.find((portal) => portal.id === activePortalId) || null;
      },

      getPortalById: (id) => {
        return get().portals.find((portal) => portal.id === id);
      },

      setExternalEpgUrl: (url) => {
        set((state) => {
          state.externalEpgUrl = url;
        });
      },

      setSelectedEpgService: (serviceId) => {
        set((state) => {
          state.selectedEpgService = serviceId;
        });
      },

      deduplicatePortals: () => {
        set((state) => {
          // Group portals by URL, keep at most 4 per URL (sorted by updatedAt desc)
          const byUrl = new Map<string, PortalAccount[]>();
          for (const p of state.portals) {
            const group = byUrl.get(p.portalUrl) || [];
            group.push(p);
            byUrl.set(p.portalUrl, group);
          }
          const toRemove: string[] = [];
          for (const [, group] of byUrl) {
            if (group.length <= 4) continue;
            group.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            // Keep first 4, remove the rest
            for (let i = 4; i < group.length; i++) {
              toRemove.push(group[i].id);
            }
          }
          if (toRemove.length > 0) {
            state.portals = state.portals.filter((p) => !toRemove.includes(p.id));
            logger.debug(`🧹 Removed ${toRemove.length} portal(s) — kept max 4 per URL`);
          }
        });
      },

      removeNonWorkingPortals: () => {
        const { portals, activePortalId } = get();
        const toKeep = portals.filter((p) => {
          const isTest = /test|demo|sample/i.test(p.name);
          const is3tv = p.portalUrl.includes('3tv.pro');
          return !isTest && !is3tv;
        });
        if (toKeep.length < portals.length) {
          set((state) => {
            state.portals = toKeep;
            if (activePortalId && !toKeep.some((p) => p.id === activePortalId)) {
              state.activePortalId = null;
            }
          });
          logger.debug(`🧹 Removed ${portals.length - toKeep.length} non-working/test portal(s)`);
        }
      },

      getEffectiveEpgUrl: () => {
        const state = get();
        const service = PREDEFINED_EPG_SERVICES.find(s => s.id === state.selectedEpgService);

        if (!service || service.id === 'auto') {
          return null;
        }
        if (service.id === 'custom') {
          return state.externalEpgUrl;
        }
        return service.url;
      },
    })),
    {
      name: 'portals-storage-v2',
      storage: tauriStorage,
      partialize: (state: PortalsState) => ({
        portals: state.portals,
        activePortalId: state.activePortalId,
        externalEpgUrl: state.externalEpgUrl,
        selectedEpgService: state.selectedEpgService,
      }),
    }
  )
);

// Hook to check if persist has hydrated - avoids re-renders on all subscribers
export const usePortalsHydrated = () =>
  usePortalsStore.persist.hasHydrated();

