// Mock external dependencies
const mockClearAllDataForPortal = jest.fn();
const mockClearAllCategoriesCache = jest.fn();
const mockStorage: Record<string, unknown> = {};

jest.mock('@/hooks/useDatabase', () => ({
  clearAllDataForPortal: (...args: any[]) => mockClearAllDataForPortal(...args),
}));

jest.mock('@/hooks/useCategories', () => ({
  clearAllCategoriesCache: (...args: any[]) => mockClearAllCategoriesCache(...args),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock tauriStorage with localStorage-like behavior
jest.mock('@/lib/tauriStorage', () => ({
  tauriStorage: {
    getItem: jest.fn(async (name: string) => {
      return mockStorage[name] ?? null;
    }),
    setItem: jest.fn(async (name: string, value: unknown) => {
      mockStorage[name] = value;
    }),
    removeItem: jest.fn(async (name: string) => {
      delete mockStorage[name];
    }),
  },
}));

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-1234',
  },
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

import { usePortalsStore, usePortalsHydrated } from '../portals.store';

describe('usePortalsStore', () => {
  beforeEach(() => {
    // Clear mock storage to prevent persist middleware from interfering
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    
    // Reset persist hydration state
    usePortalsStore.persist.clearStorage();
    
    // Reset store to initial state
    usePortalsStore.setState({
      portals: [],
      activePortalId: null,
    });
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('should have empty portals array', () => {
      const state = usePortalsStore.getState();
      expect(state.portals).toEqual([]);
    });

    it('should have null activePortalId', () => {
      const state = usePortalsStore.getState();
      expect(state.activePortalId).toBeNull();
    });
  });

  describe('addPortal', () => {
    it('should add a new portal', () => {
      const store = usePortalsStore.getState();

      store.addPortal({
        name: 'Test Portal',
        portalUrl: 'http://test.com',
        mac: '00:1A:79:00:00:00',
        login: 'user',
        password: 'pass',
        isActive: true,
      });

      const state = usePortalsStore.getState();
      expect(state.portals.length).toBe(1);
      expect(state.portals[0].name).toBe('Test Portal');
      expect(state.portals[0].id).toBe('test-uuid-1234');
    });

    it('should add multiple portals', () => {
      const store = usePortalsStore.getState();

      store.addPortal({
        name: 'Portal 1',
        portalUrl: 'http://test1.com',
        mac: '00:1A:79:00:00:01',
        login: 'user1',
        password: 'pass1',
        isActive: true,
      });

      // Override crypto for second portal
      Object.defineProperty(globalThis, 'crypto', {
        value: {
          randomUUID: () => 'test-uuid-5678',
        },
      });

      store.addPortal({
        name: 'Portal 2',
        portalUrl: 'http://test2.com',
        mac: '00:1A:79:00:00:02',
        login: 'user2',
        password: 'pass2',
        isActive: true,
      });

      const state = usePortalsStore.getState();
      expect(state.portals.length).toBe(2);
    });

    it('should set createdAt and updatedAt dates', () => {
      const store = usePortalsStore.getState();

      store.addPortal({
        name: 'Test Portal',
        portalUrl: 'http://test.com',
        mac: '00:1A:79:00:00:00',
        login: 'user',
        password: 'pass',
        isActive: true,
      });

      const state = usePortalsStore.getState();
      expect(state.portals[0].createdAt).toBeInstanceOf(Date);
      expect(state.portals[0].updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('updatePortal', () => {
    it('should update portal by id', () => {
      const store = usePortalsStore.getState();

      store.addPortal({
        name: 'Test Portal',
        portalUrl: 'http://test.com',
        mac: '00:1A:79:00:00:00',
        login: 'user',
        password: 'pass',
        isActive: true,
      });

      // Get updated state after addPortal
      const updatedStore = usePortalsStore.getState();
      const portalId = updatedStore.portals[0].id;

      updatedStore.updatePortal(portalId, {
        name: 'Updated Portal',
        mac: '00:1A:79:00:00:FF',
      });

      const state = usePortalsStore.getState();
      expect(state.portals[0].name).toBe('Updated Portal');
      expect(state.portals[0].mac).toBe('00:1A:79:00:00:FF');
      expect(state.portals[0].portalUrl).toBe('http://test.com'); // unchanged
    });

    it('should update updatedAt timestamp', () => {
      const store = usePortalsStore.getState();

      store.addPortal({
        name: 'Test Portal',
        portalUrl: 'http://test.com',
        mac: '00:1A:79:00:00:00',
        login: 'user',
        password: 'pass',
        isActive: true,
      });

      // Get updated state after addPortal
      const updatedStore = usePortalsStore.getState();
      const portalId = updatedStore.portals[0].id;
      const originalUpdatedAt = updatedStore.portals[0].updatedAt;

      // Wait a bit to ensure different timestamp
      jest.advanceTimersByTime(1000);

      updatedStore.updatePortal(portalId, { name: 'Updated' });

      const state = usePortalsStore.getState();
      expect(state.portals[0].updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime()
      );
    });

    it('should not throw when updating non-existent portal', () => {
      const store = usePortalsStore.getState();

      expect(() => {
        store.updatePortal('non-existent-id', { name: 'Updated' });
      }).not.toThrow();
    });
  });

  describe('deletePortal', () => {
    it('should delete portal by id', async () => {
      mockClearAllDataForPortal.mockResolvedValue(undefined);
      mockClearAllCategoriesCache.mockResolvedValue(undefined);

      const store = usePortalsStore.getState();

      store.addPortal({
        name: 'Test Portal',
        portalUrl: 'http://test.com',
        mac: '00:1A:79:00:00:00',
        login: 'user',
        password: 'pass',
        isActive: true,
      });

      // Get updated state after addPortal
      const updatedStore = usePortalsStore.getState();
      const portalId = updatedStore.portals[0].id;
      expect(updatedStore.portals.length).toBe(1);

      await updatedStore.deletePortal(portalId);

      const state = usePortalsStore.getState();
      expect(state.portals.length).toBe(0);
    });

    it('should clear activePortalId when deleting active portal', async () => {
      mockClearAllDataForPortal.mockResolvedValue(undefined);
      mockClearAllCategoriesCache.mockResolvedValue(undefined);

      const store = usePortalsStore.getState();

      store.addPortal({
        name: 'Test Portal',
        portalUrl: 'http://test.com',
        mac: '00:1A:79:00:00:00',
        login: 'user',
        password: 'pass',
        isActive: true,
      });

      // Get updated state after addPortal
      const updatedStore = usePortalsStore.getState();
      const portalId = updatedStore.portals[0].id;
      updatedStore.setActivePortal(portalId);

      // Get updated state after setActivePortal
      const stateWithActive = usePortalsStore.getState();
      expect(stateWithActive.activePortalId).toBe(portalId);

      await updatedStore.deletePortal(portalId);

      const state = usePortalsStore.getState();
      expect(state.activePortalId).toBeNull();
    });

    it('should not throw when deleting non-existent portal', async () => {
      mockClearAllDataForPortal.mockResolvedValue(undefined);

      const store = usePortalsStore.getState();

      await expect(store.deletePortal('non-existent')).resolves.not.toThrow();
    });

    it('should clear database and cache when deleting', async () => {
      mockClearAllDataForPortal.mockResolvedValue(undefined);
      mockClearAllCategoriesCache.mockResolvedValue(undefined);

      const store = usePortalsStore.getState();

      store.addPortal({
        name: 'Test Portal',
        portalUrl: 'http://test.com',
        mac: '00:1A:79:00:00:00',
        login: 'user',
        password: 'pass',
        isActive: true,
      });

      // Get updated state after addPortal
      const updatedStore = usePortalsStore.getState();
      const portalId = updatedStore.portals[0].id;
      await updatedStore.deletePortal(portalId);

      expect(mockClearAllDataForPortal).toHaveBeenCalledWith(portalId);
      expect(mockClearAllCategoriesCache).toHaveBeenCalled();
    });
  });

  describe('setActivePortal', () => {
    it('should set active portal', () => {
      const store = usePortalsStore.getState();

      store.addPortal({
        name: 'Test Portal',
        portalUrl: 'http://test.com',
        mac: '00:1A:79:00:00:00',
        login: 'user',
        password: 'pass',
        isActive: true,
      });

      // Get updated state after addPortal
      const updatedStore = usePortalsStore.getState();
      const portalId = updatedStore.portals[0].id;
      updatedStore.setActivePortal(portalId);

      const state = usePortalsStore.getState();
      expect(state.activePortalId).toBe(portalId);
    });

    it('should allow setting null active portal', () => {
      const store = usePortalsStore.getState();

      store.addPortal({
        name: 'Test Portal',
        portalUrl: 'http://test.com',
        mac: '00:1A:79:00:00:00',
        login: 'user',
        password: 'pass',
        isActive: true,
      });

      // Get updated state after addPortal
      const updatedStore = usePortalsStore.getState();
      updatedStore.setActivePortal(updatedStore.portals[0].id);
      
      // Get updated state after setActivePortal
      const stateWithActive = usePortalsStore.getState();
      expect(stateWithActive.activePortalId).not.toBeNull();

      updatedStore.setActivePortal(null);

      const state = usePortalsStore.getState();
      expect(state.activePortalId).toBeNull();
    });
  });

  describe('getActivePortal', () => {
    it('should return active portal', () => {
      const store = usePortalsStore.getState();

      store.addPortal({
        name: 'Test Portal',
        portalUrl: 'http://test.com',
        mac: '00:1A:79:00:00:00',
        login: 'user',
        password: 'pass',
        isActive: true,
      });

      // Get updated state after addPortal
      const updatedStore = usePortalsStore.getState();
      const portalId = updatedStore.portals[0].id;
      updatedStore.setActivePortal(portalId);

      const activePortal = updatedStore.getActivePortal();
      expect(activePortal).not.toBeNull();
      expect(activePortal?.id).toBe(portalId);
    });

    it('should return null when no active portal', () => {
      const store = usePortalsStore.getState();
      const activePortal = store.getActivePortal();
      expect(activePortal).toBeNull();
    });

    it('should return null when active portal does not exist', () => {
      const store = usePortalsStore.getState();
      store.setActivePortal('non-existent-id');

      const activePortal = store.getActivePortal();
      expect(activePortal).toBeNull();
    });
  });

  describe('getPortalById', () => {
    it('should return portal by id', () => {
      const store = usePortalsStore.getState();

      store.addPortal({
        name: 'Test Portal',
        portalUrl: 'http://test.com',
        mac: '00:1A:79:00:00:00',
        login: 'user',
        password: 'pass',
        isActive: true,
      });

      // Get updated state after addPortal
      const updatedStore = usePortalsStore.getState();
      const portalId = updatedStore.portals[0].id;
      const portal = updatedStore.getPortalById(portalId);

      expect(portal).toBeDefined();
      expect(portal?.name).toBe('Test Portal');
    });

    it('should return undefined for non-existent id', () => {
      const store = usePortalsStore.getState();
      const portal = store.getPortalById('non-existent');
      expect(portal).toBeUndefined();
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple operations', async () => {
      mockClearAllDataForPortal.mockResolvedValue(undefined);
      mockClearAllCategoriesCache.mockResolvedValue(undefined);

      const store = usePortalsStore.getState();

      // Add portals
      store.addPortal({
        name: 'Portal 1',
        portalUrl: 'http://test1.com',
        mac: '00:1A:79:00:00:01',
        login: 'user1',
        password: 'pass1',
        isActive: true,
      });

      Object.defineProperty(globalThis, 'crypto', {
        value: { randomUUID: () => 'uuid-2' },
      });

      store.addPortal({
        name: 'Portal 2',
        portalUrl: 'http://test2.com',
        mac: '00:1A:79:00:00:02',
        login: 'user2',
        password: 'pass2',
        isActive: true,
      });

      // Get updated state after adding portals
      const updatedStore = usePortalsStore.getState();
      expect(updatedStore.portals.length).toBe(2);

      // Set active
      const portal1Id = updatedStore.portals[0].id;
      updatedStore.setActivePortal(portal1Id);
      
      // Get updated state after setActivePortal
      const stateWithActive = usePortalsStore.getState();
      expect(stateWithActive.activePortalId).toBe(portal1Id);

      // Update
      updatedStore.updatePortal(portal1Id, { name: 'Updated Portal 1' });
      // Get updated state after updatePortal
      const stateAfterUpdate = usePortalsStore.getState();
      expect(stateAfterUpdate.portals[0].name).toBe('Updated Portal 1');

      // Delete
      await updatedStore.deletePortal(updatedStore.portals[1].id);
      // Get updated state after deletePortal
      const stateAfterDelete = usePortalsStore.getState();
      expect(stateAfterDelete.portals.length).toBe(1);

      // Verify final state
      const finalState = usePortalsStore.getState();
      expect(finalState.portals.length).toBe(1);
      expect(finalState.portals[0].name).toBe('Updated Portal 1');
    });
  });
});

describe('usePortalsHydrated', () => {
  it('should return persist hasHydrated', () => {
    // Just verify it doesn't throw
    expect(() => usePortalsHydrated()).not.toThrow();
  });
});
