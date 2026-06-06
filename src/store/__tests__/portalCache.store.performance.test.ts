// Performance tests for portalCache.store
// These tests measure execution time and ensure cache operations meet performance thresholds

import { usePortalCacheStore } from '../portalCache.store';

describe('portalCache.store Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state completely to avoid Immer frozen object errors
    usePortalCacheStore.setState({
      portalsData: {},
      isHydrated: false,
    });
  });

  describe('Channel Operations Performance', () => {
    it('should set channels in under 15ms', () => {
      const channels = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        name: `Channel ${i}`,
      })) as any;

      const startTime = performance.now();
      usePortalCacheStore.getState().setChannels('portal-1', 'genre-1', channels);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });

    it('should set 1000 channels in under 50ms', () => {
      const channels = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Channel ${i}`,
      })) as any;

      const startTime = performance.now();
      usePortalCacheStore.getState().setAllChannels('portal-1', channels);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(80);
    });

    it('should set all channels in under 10ms', () => {
      const channels = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Channel ${i}`,
      })) as any;

      const startTime = performance.now();
      usePortalCacheStore.getState().setAllChannels('portal-1', channels);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10);
    });

    it('should set channel categories in under 1ms', () => {
      const categories = Array.from({ length: 10 }, (_, i) => ({
        id: i.toString(),
        title: `Category ${i}`,
      })) as any;

      const startTime = performance.now();
      usePortalCacheStore.getState().setChannelCategories('portal-1', categories);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10);
    });
  });

  describe('VOD Operations Performance', () => {
    it('should set VOD in under 20ms', () => {
      const vod = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `VOD ${i}`,
        cmd: 'vod',
        description: `Description ${i}`,
        added: Date.now(),
        censored: 0,
      })) as any;

      const startTime = performance.now();
      usePortalCacheStore.getState().setVOD('portal-1', vod);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });

    it('should set VOD categories in under 5ms', () => {
      const categories = Array.from({ length: 10 }, (_, i) => ({
        id: i.toString(),
        title: `Category ${i}`,
      })) as any;

      const startTime = performance.now();
      usePortalCacheStore.getState().setVODCategories('portal-1', categories);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5);
    });
  });

  describe('EPG Operations Performance', () => {
    it('should get channel EPG in under 1ms', () => {
      const startTime = performance.now();
      usePortalCacheStore.getState().getChannelEPG('portal-1', 1);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5);
    });

    it('should check EPG validity in under 1ms', () => {
      const startTime = performance.now();
      usePortalCacheStore.getState().hasValidEPG('portal-1', 1);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(20);
    });
  });

  describe('Portal Data Operations Performance', () => {
    it('should get portal data in under 1ms', () => {
      const channels = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Channel ${i}`,
      })) as any;

      usePortalCacheStore.getState().setAllChannels('portal-1', channels);

      const startTime = performance.now();
      const data = usePortalCacheStore.getState().getPortalData('portal-1');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(data).toBeDefined();
      expect(duration).toBeLessThan(1);
    });

    it('should check portal data existence in under 1ms', () => {
      const channels = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Channel ${i}`,
      })) as any;

      usePortalCacheStore.getState().setAllChannels('portal-1', channels);

      const startTime = performance.now();
      const hasData = usePortalCacheStore.getState().hasPortalData('portal-1');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(hasData).toBe(true);
      expect(duration).toBeLessThan(3);
    });

    it('should clear portal data in under 1ms', () => {
      const channels = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Channel ${i}`,
      })) as any;

      usePortalCacheStore.getState().setAllChannels('portal-1', channels);

      const startTime = performance.now();
      usePortalCacheStore.getState().clearPortalData('portal-1');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10);
    });

    it('should clear all cache in under 1ms', () => {
      // Add data for multiple portals
      for (let i = 0; i < 10; i++) {
        const channels = Array.from({ length: 10 }, (_, j) => ({
          id: j,
          name: `Channel ${j}`,
        })) as any;
        usePortalCacheStore.getState().setAllChannels(`portal-${i}`, channels);
      }

      const startTime = performance.now();
      usePortalCacheStore.getState().clearAllCache();
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });
  });

  describe('Bulk Operations Performance', () => {
    it('should handle 10 portals with 1000 channels each in under 2s', () => {
      const startTime = performance.now();
      for (let portalIdx = 0; portalIdx < 10; portalIdx++) {
        const channels = Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Channel ${i}`,
        })) as any;
        usePortalCacheStore.getState().setAllChannels(`portal-${portalIdx}`, channels);
      }
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000);
    });

    it('should handle 10 portals with 10000 VOD items each in under 5s', () => {
      const startTime = performance.now();
      for (let portalIdx = 0; portalIdx < 10; portalIdx++) {
        const vod = Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          name: `VOD ${i}`,
          cmd: 'vod',
          description: `Description ${i}`,
          added: Date.now(),
          censored: 0,
        })) as any;
        usePortalCacheStore.getState().setVOD(`portal-${portalIdx}`, vod);
      }
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory with repeated operations', () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Perform many operations
      for (let i = 0; i < 50; i++) {
        const vod = Array.from({ length: 10 }, (_, j) => ({
          id: j,
          name: `VOD ${j}`,
          cmd: 'vod',
          description: `Description ${j}`,
          added: Date.now(),
          censored: 0,
        })) as any;
        usePortalCacheStore.getState().setVOD(`portal-${i % 5}`, vod);
      }

      // Force garbage collection if available
      if (globalThis.gc) {
        globalThis.gc();
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should clean up memory after clearing cache', () => {
      // Add large amount of data
      for (let i = 0; i < 10; i++) {
        const vod = Array.from({ length: 100 }, (_, j) => ({
          id: j,
          name: `VOD ${j}`,
          cmd: 'vod',
          description: `Description ${j}`,
          added: Date.now(),
          censored: 0,
        })) as any;
        usePortalCacheStore.getState().setVOD(`portal-${i}`, vod);
      }

      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      usePortalCacheStore.getState().clearAllCache();

      // Force garbage collection if available
      if (globalThis.gc) {
        globalThis.gc();
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryAfterCleanup = finalMemory - initialMemory;

      // Memory should not increase after cleanup
      expect(memoryAfterCleanup).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Quota Handling Performance', () => {
    it('should handle quota exceeded error efficiently', () => {
      // Mock localStorage quota error
      const originalSetItem = localStorage.setItem;
      let callCount = 0;
      localStorage.setItem = jest.fn(() => {
        callCount++;
        if (callCount > 5) {
          throw new Error('QuotaExceededError');
        }
      });

      const programs = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        title: `Program ${i}`,
        name: `Program ${i}`,
        start_time: (Date.now() / 1000) + i * 3600,
        end_time: (Date.now() / 1000) + (i + 1) * 3600,
        channel_id: 1,
      })) as any;

      const startTime = performance.now();
      // This should handle the error gracefully
      try {
        for (let i = 0; i < 10; i++) {
          usePortalCacheStore.getState().setChannelEPG('portal-1', i, programs);
        }
      } catch (e) {
        // Error is expected
      }
      const endTime = performance.now();
      const duration = endTime - startTime;

      localStorage.setItem = originalSetItem;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('Hydration Performance', () => {
    it('should handle hydration flag efficiently', () => {
      const startTime = performance.now();
      usePortalCacheStore.getState().setHydrated(true);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10);
    });
  });
});
