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
  { id: 'auto', name: 'Automatyczny (z serwera IPTV)', url: '', description: 'Używa EPG dostarczonego przez Twój serwer IPTV' },
  { id: 'epg_ovh_pl', name: 'EPG OVH (Polska)', url: 'https://epg.ovh/pl.xml', description: 'EPG dla polskich kanałów TV' },
  { id: 'epg_share', name: 'EPG Share (epg-share.com)', url: 'https://epgshare01.online/epg_ripper_US_LOCALS2.xml.gz', description: 'Darmowy EPG głównie dla kanałów USA' },
  { id: 'github_epg', name: 'IPTV Org EPG', url: 'https://epg.pw/xmltv.xml.gz', description: 'EPG z iptv-org.github.io - globalne kanały' },
  { id: 'custom', name: 'Własny URL', url: '', description: 'Wprowadź własny adres URL do pliku XMLTV' },
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

