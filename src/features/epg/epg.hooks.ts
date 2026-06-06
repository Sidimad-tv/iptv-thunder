// =========================
// 🪝 EPG HOOKS
// =========================
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerChannel, StalkerEPG } from '@/types';
import { usePortalsStore, PREDEFINED_EPG_SERVICES, EpgService } from '@/store/portals.store';
import { usePortalCacheStore } from '@/store/portalCache.store';
import { useTranslation } from '@/hooks/useTranslation';
import { TranslationKey } from '@/lib/translations';
import {
  getChannelEPG,
  getChannelsEPG,
  getCurrentProgram,
  getNextProgram,
  getProgramsForTimeRange,
  getEPGTimeRange,
  fetchExternalEPG,
  clearEpgCache
} from './epg.api';

const EPG_SERVICE_NAME_KEYS: Record<string, TranslationKey> = {
  auto: 'epgServiceAuto',
  epg_ovh_pl: 'epgServiceOvhPl',
  epg_share: 'epgServiceShare',
  github_epg: 'epgServiceGithub',
  custom: 'epgServiceCustom',
};

const EPG_SERVICE_DESC_KEYS: Record<string, TranslationKey> = {
  auto: 'epgServiceAutoDesc',
  epg_ovh_pl: 'epgServiceOvhPlDesc',
  epg_share: 'epgServiceShareDesc',
  github_epg: 'epgServiceGithubDesc',
  custom: 'epgServiceCustomDesc',
};

/** Hook that returns EPG services with translated names and descriptions */
export const useEpgServices = (): EpgService[] => {
  const { t } = useTranslation();
  return PREDEFINED_EPG_SERVICES.map((service) => ({
    ...service,
    name: t(EPG_SERVICE_NAME_KEYS[service.id]),
    description: service.description
      ? t(EPG_SERVICE_DESC_KEYS[service.id])
      : undefined,
  }));
};

/** Global hook to manage EPG cache invalidation - should be called only once at app root */
export const useEpgCacheManager = () => {
  const queryClient = useQueryClient();
  const effectiveEpgUrl = usePortalsStore((state) => state.getEffectiveEpgUrl());
  const portalId = usePortalsStore((state) => state.activePortalId);
  const clearAllEPG = usePortalCacheStore((state) => state.clearAllEPG);
  
  const prevEpgUrl = React.useRef<string | null>(null);
  const prevPortalId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!portalId) return;
    
    const urlChanged = effectiveEpgUrl !== prevEpgUrl.current;
    const portalChanged = portalId !== prevPortalId.current;
    
    if (urlChanged || portalChanged) {
      clearEpgCache(); // Clear in-memory API cache
      clearAllEPG(portalId); // Clear persistent store cache
      queryClient.invalidateQueries({ queryKey: ['epg'] });
      
      prevEpgUrl.current = effectiveEpgUrl;
      prevPortalId.current = portalId;
    }
  }, [effectiveEpgUrl, portalId, clearAllEPG, queryClient]);
};

export const useChannelEPG = (client: StalkerClient | undefined, channelId: number, channelName?: string, hours: number = 24, enabled: boolean = true) => {
  const effectiveEpgUrl = usePortalsStore((state) => state.getEffectiveEpgUrl());
  const portalId = usePortalsStore((state) => state.activePortalId);
  
  const { from, to } = React.useMemo(() => getEPGTimeRange(hours), [hours]);
  const getCachedEPG = usePortalCacheStore((state) => state.getChannelEPG);
  const setCachedEPG = usePortalCacheStore((state) => state.setChannelEPG);

  // Get cached data immediately if available
  const cachedData = React.useMemo(() => 
    portalId ? getCachedEPG(portalId, channelId) : null
  , [portalId, channelId, getCachedEPG]);

  return useQuery({
    queryKey: ['epg', 'channel', channelId, channelName, hours, effectiveEpgUrl, from],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('StalkerClient is required');

      let result: StalkerEPG[] = [];

      try {
        if (effectiveEpgUrl) {
          result = await fetchExternalEPG(effectiveEpgUrl, channelId, from, to, channelName, signal);
        } else {
          result = await getChannelEPG(client, channelId, from, to);
        }
      } catch (error) {
        // Silent fail
      }

      if (portalId) {
        setCachedEPG(portalId, channelId, result);
      }

      return result;
    },
    enabled: !!channelId && enabled && !!client,
    staleTime: 30 * 60 * 1000,
    placeholderData: cachedData ?? undefined,
    refetchOnWindowFocus: false,
    refetchInterval: 60 * 1000, // Refetch every 60 seconds to update EPG when programs change
    networkMode: 'always',
  });
};

export const useChannelsEPG = (client: StalkerClient, channels: StalkerChannel[], hours: number = 24) => {
  const { from, to } = getEPGTimeRange(hours);
  const channelIds = channels.map(ch => Number.parseInt(String(ch.id))).filter(id => !Number.isNaN(id));
  
  return useQuery({
    queryKey: ['epg', 'channels', channelIds.join(','), from, to],
    queryFn: () => getChannelsEPG(client, channelIds, from, to),
    enabled: channelIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCurrentProgram = (client: StalkerClient, channelId: number, channelName?: string, enabled: boolean = true) => {
  const { data: epg } = useChannelEPG(client, channelId, channelName, 2, enabled);

  return useQuery({
    queryKey: ['epg', 'current', channelId, channelName],
    queryFn: () => epg ? getCurrentProgram(epg) : null,
    enabled: !!epg && enabled,
    staleTime: 30 * 1000,
  });
};

export const useNextProgram = (client: StalkerClient, channelId: number, channelName?: string) => {
  const { data: epg } = useChannelEPG(client, channelId, channelName, 4);
  
  return useQuery({
    queryKey: ['epg', 'next', channelId, channelName],
    queryFn: () => epg ? getNextProgram(epg) : null,
    enabled: !!epg,
    staleTime: 60 * 1000,
  });
};

export const useEPGForTimeRange = (client: StalkerClient, channelId: number, from: number, to: number) => {
  return useQuery({
    queryKey: ['epg', 'range', channelId, from, to],
    queryFn: async () => {
      const epg = await getChannelEPG(client, channelId, from, to);
      return getProgramsForTimeRange(epg, from, to);
    },
    enabled: !!channelId && !!from && !!to,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const usePrefetchEPG = (client: StalkerClient) => {
  const queryClient = useQueryClient();
  const portalId = usePortalsStore((state) => state.activePortalId);
  const setCachedEPG = usePortalCacheStore((state) => state.setChannelEPG);
  const hasValidEPG = usePortalCacheStore((state) => state.hasValidEPG);

  return (channelId: number, hours: number = 24) => {
    // Skip if we already have valid cached EPG
    if (portalId && hasValidEPG(portalId, channelId)) {
      return;
    }

    const { from, to } = getEPGTimeRange(hours);
    const queryKey = ['epg', 'channel', channelId, from, to];
    const state = queryClient.getQueryState(queryKey);
    if (state?.fetchStatus === 'fetching') return;
    queryClient.prefetchQuery({
      queryKey,
      queryFn: async () => {
        const result = await getChannelEPG(client, channelId, from, to);
        // Save to persistent cache
        if (portalId) {
          setCachedEPG(portalId, channelId, result);
        }
        return result;
      },
      staleTime: 30 * 60 * 1000,
    });
  };
};

export const usePrefetchChannelsEPG = (client: StalkerClient) => {
  const queryClient = useQueryClient();
  const portalId = usePortalsStore((state) => state.activePortalId);
  const setCachedEPG = usePortalCacheStore((state) => state.setChannelEPG);
  const hasValidEPG = usePortalCacheStore((state) => state.hasValidEPG);

  return async (channelIds: number[], hours: number = 24, batchSize: number = 5) => {
    if (!portalId) return;

    const { from, to } = getEPGTimeRange(hours);

    // Filter out channels with valid cached EPG
    const idsToFetch = channelIds.filter(id => !hasValidEPG(portalId, id));

    // Fetch in batches to avoid overwhelming the API
    for (let i = 0; i < idsToFetch.length; i += batchSize) {
      const batch = idsToFetch.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (channelId) => {
          try {
            const result = await getChannelEPG(client, channelId, from, to);
            // Save to persistent cache immediately
            setCachedEPG(portalId, channelId, result);

            // Also update React Query cache
            queryClient.setQueryData(
              ['epg', 'channel', channelId, from, to],
              result
            );
          } catch (error) {
            console.error(`Failed to prefetch EPG for channel ${channelId}:`, error);
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < idsToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  };
};
