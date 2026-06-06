import { usePortalCacheStore } from '../portalCache.store';
import type { StalkerChannel, StalkerVOD, StalkerGenre, StalkerEPG } from '@/types';

// Mock console.log to avoid noise in tests
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

describe('portalCache.store', () => {
  beforeEach(() => {
    usePortalCacheStore.getState().clearAllCache();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockClear();
  });

  describe('setChannels', () => {
    it('should set channels for a genre', () => {
      const channels: StalkerChannel[] = [
        { id: 1, name: 'Channel 1', cmd: '', logo: '', number: 1, censored: false },
        { id: 2, name: 'Channel 2', cmd: '', logo: '', number: 2, censored: false },
      ];

      usePortalCacheStore.getState().setChannels('portal1', 'genre1', channels);

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      expect(portalData?.channelsByGenre['genre1']).toEqual(channels);
    });

    it('should create portal data if not exists', () => {
      const channels: StalkerChannel[] = [{ id: 1, name: 'Channel 1', cmd: '', logo: '', number: 1, censored: false }];

      usePortalCacheStore.getState().setChannels('portal1', 'genre1', channels);

      expect(usePortalCacheStore.getState().hasPortalData('portal1')).toBe(true);
    });

    it('should update lastUpdated timestamp', () => {
      const channels: StalkerChannel[] = [{ id: 1, name: 'Channel 1', cmd: '', logo: '', number: 1, censored: false }];
      const before = Date.now();

      usePortalCacheStore.getState().setChannels('portal1', 'genre1', channels);

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      expect(portalData?.lastUpdated).toBeGreaterThanOrEqual(before);
    });
  });

  describe('setAllChannels', () => {
    it('should set all channels', () => {
      const channels: StalkerChannel[] = [
        { id: 1, name: 'Channel 1', cmd: '', logo: '', number: 1, censored: false },
        { id: 2, name: 'Channel 2', cmd: '', logo: '', number: 2, censored: false },
      ];

      usePortalCacheStore.getState().setAllChannels('portal1', channels);

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      expect(portalData?.allChannels).toEqual(channels);
    });

    it('should update lastUpdated timestamp', () => {
      const channels: StalkerChannel[] = [{ id: 1, name: 'Channel 1', cmd: '', logo: '', number: 1, censored: false }];
      const before = Date.now();

      usePortalCacheStore.getState().setAllChannels('portal1', channels);

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      expect(portalData?.lastUpdated).toBeGreaterThanOrEqual(before);
    });
  });

  describe('setChannelCategories', () => {
    it('should set channel categories', () => {
      const categories: StalkerGenre[] = [
        { id: '1', title: 'Genre 1', alias: 'genre1' },
        { id: '2', title: 'Genre 2', alias: 'genre2' },
      ];

      usePortalCacheStore.getState().setChannelCategories('portal1', categories);

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      expect(portalData?.channelCategories).toEqual(categories);
    });
  });

  describe('setVOD', () => {
    it('should set VOD items', () => {
      const vod: StalkerVOD[] = [
        { id: 1, name: 'VOD 1', cmd: '', description: '', added: '123', censored: false },
        { id: 2, name: 'VOD 2', cmd: '', description: '', added: '124', censored: false },
      ];

      usePortalCacheStore.getState().setVOD('portal1', vod);

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      expect(portalData?.vod).toEqual(vod);
    });
  });

  describe('setVODForCategory', () => {
    it('should set VOD for a category', () => {
      const vod: StalkerVOD[] = [
        { id: 1, name: 'VOD 1', cmd: '', description: '', added: '123', censored: false },
      ];

      usePortalCacheStore.getState().setVODForCategory('portal1', 'cat1', vod);

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      expect(portalData?.vodByCategory['cat1']).toEqual(vod);
    });
  });

  describe('appendVODPage', () => {
    it('should append VOD items to existing category', () => {
      const existingVod: StalkerVOD[] = [
        { id: 1, name: 'VOD 1', cmd: '', description: '', added: '123', censored: false },
      ];
      const newVod: StalkerVOD[] = [
        { id: 2, name: 'VOD 2', cmd: '', description: '', added: '124', censored: false },
      ];

      usePortalCacheStore.getState().setVODForCategory('portal1', 'cat1', existingVod);
      usePortalCacheStore.getState().appendVODPage('portal1', 'cat1', 2, newVod);

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      expect(portalData?.vodByCategory['cat1']).toHaveLength(2);
    });

    it('should not append duplicate items', () => {
      const existingVod: StalkerVOD[] = [
        { id: 1, name: 'VOD 1', cmd: '', description: '', added: '123', censored: false },
      ];
      const newVod: StalkerVOD[] = [
        { id: 1, name: 'VOD 1', cmd: '', description: '', added: '123', censored: false },
      ];

      usePortalCacheStore.getState().setVODForCategory('portal1', 'cat1', existingVod);
      usePortalCacheStore.getState().appendVODPage('portal1', 'cat1', 2, newVod);

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      expect(portalData?.vodByCategory['cat1']).toHaveLength(1);
    });

    it('should sort items by added date', () => {
      const existingVod: StalkerVOD[] = [
        { id: 1, name: 'VOD 1', cmd: '', description: '', added: '124', censored: false },
      ];
      const newVod: StalkerVOD[] = [
        { id: 2, name: 'VOD 2', cmd: '', description: '', added: '123', censored: false },
      ];

      usePortalCacheStore.getState().setVODForCategory('portal1', 'cat1', existingVod);
      usePortalCacheStore.getState().appendVODPage('portal1', 'cat1', 2, newVod);

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      const vodList = portalData?.vodByCategory['cat1'] || [];
      expect(vodList[0].id).toBe(1); // Later added date (newer)
      expect(vodList[1].id).toBe(2); // Earlier added date (older)
    });

    it('should log appended items', () => {
      const vod: StalkerVOD[] = [{ id: 1, name: 'VOD 1', cmd: '', description: '', added: '123', censored: false }];

      usePortalCacheStore.getState().appendVODPage('portal1', 'cat1', 1, vod);

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('clearVODForCategory', () => {
    it('should clear VOD for a category', () => {
      const vod: StalkerVOD[] = [{ id: 1, name: 'VOD 1', cmd: '', description: '', added: '123', censored: false }];

      usePortalCacheStore.getState().setVODForCategory('portal1', 'cat1', vod);
      usePortalCacheStore.getState().clearVODForCategory('portal1', 'cat1');

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      expect(portalData?.vodByCategory['cat1']).toBeUndefined();
    });

    it('should log clear action', () => {
      const vod: StalkerVOD[] = [{ id: 1, name: 'VOD 1', cmd: '', description: '', added: '123', censored: false }];

      usePortalCacheStore.getState().setVODForCategory('portal1', 'cat1', vod);
      usePortalCacheStore.getState().clearVODForCategory('portal1', 'cat1');

      expect(consoleLogSpy).toHaveBeenCalledWith('[PortalCache] Cleared VOD cache for category:', 'cat1');
    });
  });

  describe('setVODCategories', () => {
    it('should set VOD categories', () => {
      const categories: StalkerGenre[] = [
        { id: '1', title: 'Category 1', alias: 'cat1' },
        { id: '2', title: 'Category 2', alias: 'cat2' },
      ];

      usePortalCacheStore.getState().setVODCategories('portal1', categories);

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      expect(portalData?.vodCategories).toEqual(categories);
    });
  });

  describe('setChannelEPG', () => {
    it('should set EPG programs for a channel', () => {
      const programs: StalkerEPG[] = [
        { id: 1, name: 'Program 1', channel_id: 1, start_time: '123', end_time: '124' },
        { id: 2, name: 'Program 2', channel_id: 1, start_time: '124', end_time: '125' },
      ];

      usePortalCacheStore.getState().setChannelEPG('portal1', 1, programs);

      const epg = usePortalCacheStore.getState().getChannelEPG('portal1', 1);
      expect(epg).toEqual(programs);
    });

    it('should set timestamp', () => {
      const programs: StalkerEPG[] = [{ id: 1, name: 'Program 1', channel_id: 1, start_time: '123', end_time: '124' }];
      const before = Date.now();

      usePortalCacheStore.getState().setChannelEPG('portal1', 1, programs);

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      const cached = portalData?.epgCache?.[1];
      expect(cached?.timestamp).toBeGreaterThanOrEqual(before);
    });
  });

  describe('getChannelEPG', () => {
    it('should return EPG programs for a channel', () => {
      const programs: StalkerEPG[] = [{ id: 1, name: 'Program 1', channel_id: 1, start_time: '123', end_time: '124' }];

      usePortalCacheStore.getState().setChannelEPG('portal1', 1, programs);

      const epg = usePortalCacheStore.getState().getChannelEPG('portal1', 1);
      expect(epg).toEqual(programs);
    });

    it('should return null if EPG not found', () => {
      const epg = usePortalCacheStore.getState().getChannelEPG('portal1', 1);
      expect(epg).toBeNull();
    });
  });

  describe('hasValidEPG', () => {
    it('should return true for valid EPG', () => {
      const programs: StalkerEPG[] = [{ id: 1, name: 'Program 1', channel_id: 1, start_time: '123', end_time: '124' }];

      usePortalCacheStore.getState().setChannelEPG('portal1', 1, programs);

      const isValid = usePortalCacheStore.getState().hasValidEPG('portal1', 1);
      expect(isValid).toBe(true);
    });

    it('should return false for expired EPG', () => {
      const programs: StalkerEPG[] = [{ id: 1, name: 'Program 1', channel_id: 1, start_time: '123', end_time: '124' }];

      usePortalCacheStore.getState().setChannelEPG('portal1', 1, programs);

      // Mock Date.now to return a time in the future
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 60 * 60 * 1000); // 1 hour in the future

      const isValid = usePortalCacheStore.getState().hasValidEPG('portal1', 1, 30 * 60 * 1000);
      expect(isValid).toBe(false);

      Date.now = originalDateNow;
    });

    it('should return false if EPG not found', () => {
      const isValid = usePortalCacheStore.getState().hasValidEPG('portal1', 1);
      expect(isValid).toBe(false);
    });
  });

  describe('clearChannelEPG', () => {
    it('should clear EPG for a channel', () => {
      const programs: StalkerEPG[] = [{ id: 1, name: 'Program 1', channel_id: 1, start_time: '123', end_time: '124' }];

      usePortalCacheStore.getState().setChannelEPG('portal1', 1, programs);
      usePortalCacheStore.getState().clearChannelEPG('portal1', 1);

      const epg = usePortalCacheStore.getState().getChannelEPG('portal1', 1);
      expect(epg).toBeNull();
    });

    it('should log clear action', () => {
      const programs: StalkerEPG[] = [{ id: 1, name: 'Program 1', channel_id: 1, start_time: '123', end_time: '124' }];

      usePortalCacheStore.getState().setChannelEPG('portal1', 1, programs);
      usePortalCacheStore.getState().clearChannelEPG('portal1', 1);

      expect(consoleLogSpy).toHaveBeenCalledWith('[PortalCache] Cleared EPG cache for channel:', 1);
    });
  });

  describe('clearAllEPG', () => {
    it('should clear all EPG for a portal', () => {
      const programs: StalkerEPG[] = [{ id: 1, name: 'Program 1', channel_id: 1, start_time: '123', end_time: '124' }];

      usePortalCacheStore.getState().setChannelEPG('portal1', 1, programs);
      usePortalCacheStore.getState().setChannelEPG('portal1', 2, programs);
      usePortalCacheStore.getState().clearAllEPG('portal1');

      const epg1 = usePortalCacheStore.getState().getChannelEPG('portal1', 1);
      const epg2 = usePortalCacheStore.getState().getChannelEPG('portal1', 2);
      expect(epg1).toBeNull();
      expect(epg2).toBeNull();
    });
  });

  describe('getPortalData', () => {
    it('should return portal data', () => {
      const channels: StalkerChannel[] = [{ id: 1, name: 'Channel 1', cmd: '', logo: '', number: 1, censored: false }];

      usePortalCacheStore.getState().setChannels('portal1', 'genre1', channels);

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      expect(portalData).toBeDefined();
      expect(portalData?.channelsByGenre['genre1']).toEqual(channels);
    });

    it('should return null if portal not found', () => {
      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      expect(portalData).toBeNull();
    });
  });

  describe('hasPortalData', () => {
    it('should return true if portal has all channels', () => {
      const channels: StalkerChannel[] = [{ id: 1, name: 'Channel 1', cmd: '', logo: '', number: 1, censored: false }];

      usePortalCacheStore.getState().setAllChannels('portal1', channels);

      const hasData = usePortalCacheStore.getState().hasPortalData('portal1');
      expect(hasData).toBe(true);
    });

    it('should return true if portal has channels by genre', () => {
      const channels: StalkerChannel[] = [{ id: 1, name: 'Channel 1', cmd: '', logo: '', number: 1, censored: false }];

      usePortalCacheStore.getState().setChannels('portal1', 'genre1', channels);

      const hasData = usePortalCacheStore.getState().hasPortalData('portal1');
      expect(hasData).toBe(true);
    });

    it('should return false if portal has no channel data', () => {
      const hasData = usePortalCacheStore.getState().hasPortalData('portal1');
      expect(hasData).toBe(false);
    });
  });

  describe('clearPortalData', () => {
    it('should clear portal data', () => {
      const channels: StalkerChannel[] = [{ id: 1, name: 'Channel 1', cmd: '', logo: '', number: 1, censored: false }];

      usePortalCacheStore.getState().setChannels('portal1', 'genre1', channels);
      usePortalCacheStore.getState().clearPortalData('portal1');

      const portalData = usePortalCacheStore.getState().getPortalData('portal1');
      expect(portalData).toBeNull();
    });
  });

  describe('clearAllCache', () => {
    it('should clear all cache', () => {
      const channels: StalkerChannel[] = [{ id: 1, name: 'Channel 1', cmd: '', logo: '', number: 1, censored: false }];

      usePortalCacheStore.getState().setChannels('portal1', 'genre1', channels);
      usePortalCacheStore.getState().setChannels('portal2', 'genre1', channels);
      usePortalCacheStore.getState().clearAllCache();

      const portalData1 = usePortalCacheStore.getState().getPortalData('portal1');
      const portalData2 = usePortalCacheStore.getState().getPortalData('portal2');
      expect(portalData1).toBeNull();
      expect(portalData2).toBeNull();
    });
  });

  describe('setHydrated', () => {
    it('should set hydrated state', () => {
      usePortalCacheStore.getState().setHydrated(true);

      expect(usePortalCacheStore.getState().isHydrated).toBe(true);
    });
  });
});
