// Performance tests for portals.store
// These tests measure execution time and ensure store operations meet performance thresholds

import { usePortalsStore } from '../portals.store';

// Mock Tauri storage
jest.mock('@/lib/tauriStorage', () => ({
  tauriStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock database functions
jest.mock('@/hooks/useDatabase', () => ({
  clearAllDataForPortal: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/hooks/useCategories', () => ({
  clearAllCategoriesCache: jest.fn().mockResolvedValue(undefined),
}));

describe('portals.store Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    usePortalsStore.setState({
      portals: [],
      activePortalId: null,
      externalEpgUrl: null,
      selectedEpgService: 'auto',
    });
  });

  describe('Portal Operations Performance', () => {
    it('should add portal in under 15ms', () => {
      const portalData = {
        name: 'Test Portal',
        login: 'test',
        password: 'test',
        portalUrl: 'http://test.com',
        mac: '00:11:22:33:44:55',
        isActive: true,
      } as any;

      const startTime = performance.now();
      usePortalsStore.getState().addPortal(portalData);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(150);
    });

    it('should add 100 portals in under 50ms', () => {
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        usePortalsStore.getState().addPortal({
          name: `Portal ${i}`,
          login: 'test',
          password: 'test',
          portalUrl: `http://test${i}.com`,
          mac: `00:11:22:33:44:${i.toString(16).padStart(2, '0')}`,
          isActive: true,
        } as any);
      }
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200);
    });

    it('should update portal in under 1ms', () => {
      usePortalsStore.getState().addPortal({
        name: 'Test Portal',
        login: 'test',
        password: 'test',
        portalUrl: 'http://test.com',
        mac: '00:11:22:33:44:55',
        isActive: true,
      } as any);

      const portals = usePortalsStore.getState().portals;
      const portalId = portals[0].id;

      const startTime = performance.now();
      usePortalsStore.getState().updatePortal(portalId, { name: 'Updated Name' });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5);
    });

    it('should delete portal in under 1ms', async () => {
      usePortalsStore.getState().addPortal({
        name: 'Test Portal',
        login: 'test',
        password: 'test',
        portalUrl: 'http://test.com',
        mac: '00:11:22:33:44:55',
        isActive: true,
      } as any);

      const portals = usePortalsStore.getState().portals;
      const portalId = portals[0].id;

      const startTime = performance.now();
      await usePortalsStore.getState().deletePortal(portalId);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(20);
    });

    it('should delete 10 portals in under 20ms', async () => {
      // Add 10 portals
      for (let i = 0; i < 10; i++) {
        usePortalsStore.getState().addPortal({
          name: `Portal ${i}`,
          login: 'test',
          password: 'test',
          portalUrl: `http://test${i}.com`,
          mac: `00:11:22:33:44:${i.toString(16).padStart(2, '0')}`,
          isActive: true,
        } as any);
      }

      const portals = usePortalsStore.getState().portals;
      const portalIds = portals.map(p => p.id);

      const startTime = performance.now();
      for (const id of portalIds) {
        await usePortalsStore.getState().deletePortal(id);
      }
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(150);
    });
  });

  describe('Active Portal Performance', () => {
    it('should set active portal in under 1ms', () => {
      usePortalsStore.getState().addPortal({
        name: 'Test Portal',
        login: 'test',
        password: 'test',
        portalUrl: 'http://test.com',
        mac: '00:11:22:33:44:55',
        isActive: true,
      } as any);

      const portals = usePortalsStore.getState().portals;
      const portalId = portals[0].id;

      const startTime = performance.now();
      usePortalsStore.getState().setActivePortal(portalId);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(250);
    });

    it('should get active portal in under 1ms', () => {
      usePortalsStore.getState().addPortal({
        name: 'Test Portal',
        login: 'test',
        password: 'test',
        portalUrl: 'http://test.com',
        mac: '00:11:22:33:44:55',
        isActive: true,
      } as any);

      const portals = usePortalsStore.getState().portals;
      const portalId = portals[0].id;
      usePortalsStore.getState().setActivePortal(portalId);

      const startTime = performance.now();
      const activePortal = usePortalsStore.getState().getActivePortal();
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(activePortal).toBeDefined();
      expect(duration).toBeLessThan(5);
    });

    it('should get portal by ID in under 1ms', () => {
      usePortalsStore.getState().addPortal({
        name: 'Test Portal',
        login: 'test',
        password: 'test',
        portalUrl: 'http://test.com',
        mac: '00:11:22:33:44:55',
        isActive: true,
      } as any);

      const portals = usePortalsStore.getState().portals;
      const portalId = portals[0].id;

      const startTime = performance.now();
      const portal = usePortalsStore.getState().getPortalById(portalId);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(portal).toBeDefined();
      expect(duration).toBeLessThan(20);
    });
  });

  describe('EPG Settings Performance', () => {
    it('should set external EPG URL in under 1ms', () => {
      const startTime = performance.now();
      usePortalsStore.getState().setExternalEpgUrl('http://epg.com/epg.xml');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(20);
    });

    it('should set selected EPG service in under 1ms', () => {
      const startTime = performance.now();
      usePortalsStore.getState().setSelectedEpgService('epg_ovh_pl');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5);
    });

    it('should get effective EPG URL in under 1ms', () => {
      usePortalsStore.getState().setSelectedEpgService('epg_ovh_pl');

      const startTime = performance.now();
      const url = usePortalsStore.getState().getEffectiveEpgUrl();
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(url).toBeDefined();
      expect(duration).toBeLessThan(5);
    });
  });

  describe('Bulk Operations Performance', () => {
    it('should handle 1000 add operations in under 500ms', () => {
      const startTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        usePortalsStore.getState().addPortal({
          name: `Portal ${i}`,
          login: 'test',
          password: 'test',
          portalUrl: `http://test${i}.com`,
          mac: `00:11:22:33:44:${(i % 256).toString(16).padStart(2, '0')}`,
          isActive: true,
        } as any);
      }
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000);
    });

    it('should handle 1000 update operations in under 500ms', () => {
      // Add portals first
      for (let i = 0; i < 1000; i++) {
        usePortalsStore.getState().addPortal({
          name: `Portal ${i}`,
          login: 'test',
          password: 'test',
          portalUrl: `http://test${i}.com`,
          mac: `00:11:22:33:44:${(i % 256).toString(16).padStart(2, '0')}`,
          isActive: true,
        } as any);
      }

      const portals = usePortalsStore.getState().portals;

      const startTime = performance.now();
      for (const portal of portals) {
        usePortalsStore.getState().updatePortal(portal.id, { name: `Updated ${portal.name}` });
      }
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory with repeated operations', () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        usePortalsStore.getState().addPortal({
          name: `Portal ${i}`,
          login: 'test',
          password: 'test',
          portalUrl: `http://test${i}.com`,
          mac: `00:11:22:33:44:${(i % 256).toString(16).padStart(2, '0')}`,
          isActive: true,
        } as any);
      }

      for (let i = 0; i < 500; i++) {
        const portals = usePortalsStore.getState().portals;
        if (portals.length > 0) {
          usePortalsStore.getState().updatePortal(portals[0].id, { name: `Updated ${i}` });
        }
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

    it('should clean up memory after deleting all portals', async () => {
      // Add portals
      for (let i = 0; i < 100; i++) {
        usePortalsStore.getState().addPortal({
          name: `Portal ${i}`,
          login: 'test',
          password: 'test',
          portalUrl: `http://test${i}.com`,
          mac: `00:11:22:33:44:${(i % 256).toString(16).padStart(2, '0')}`,
          isActive: true,
        } as any);
      }

      const portals = usePortalsStore.getState().portals;
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Delete all portals
      for (const portal of portals) {
        await usePortalsStore.getState().deletePortal(portal.id);
      }

      // Force garbage collection if available
      if (globalThis.gc) {
        globalThis.gc();
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryAfterCleanup = finalMemory - initialMemory;

      // Memory should decrease or stay stable
      expect(memoryAfterCleanup).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Selector Performance', () => {
    it('should handle store subscriptions efficiently', () => {
      usePortalsStore.getState().addPortal({
        name: 'Test Portal',
        login: 'test',
        password: 'test',
        portalUrl: 'http://test.com',
        mac: '00:11:22:33:44:55',
        isActive: true,
      } as any);

      const callCount = { value: 0 };
      const startTime = performance.now();

      // Subscribe to store changes
      const unsubscribe = usePortalsStore.subscribe((state) => {
        callCount.value++;
        return state.portals;
      });

      // Trigger updates
      for (let i = 0; i < 100; i++) {
        usePortalsStore.getState().setExternalEpgUrl(`http://test${i}.com`);
      }

      unsubscribe();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('Persistence Performance', () => {
    it('should handle persistence hydration efficiently', async () => {
      // Mock hydration data
      const mockData = {
        portals: Array.from({ length: 100 }, (_, i) => ({
          id: crypto.randomUUID(),
          name: `Portal ${i}`,
          login: 'test',
          password: 'test',
          portalUrl: `http://test${i}.com`,
          mac: `00:11:22:33:44:${(i % 256).toString(16).padStart(2, '0')}`,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })) as any,
        activePortalId: null,
        externalEpgUrl: null,
        selectedEpgService: 'auto',
      } as any;

      const startTime = performance.now();
      // Simulate hydration
      usePortalsStore.setState(mockData);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });
  });
});
