import {
  loadCategories,
  saveCategories,
  clearAllCategoriesCache,
} from '../useCategories';
import { getDB } from '../db';

// Mock the db module
jest.mock('../db', () => ({
  getDB: jest.fn(),
}));

// Mock the logger
jest.mock('../../lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('useCategories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadCategories', () => {
    it('should load categories for type and portal', async () => {
      const mockCategories = [
        { id: 1, type: 'live', portal_id: 'portal-1', name: 'Category 1', alias: 'cat1', parent_id: 0, updated_at: Date.now() },
      ];
      const mockDB = {
        select: jest.fn().mockResolvedValue(mockCategories),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await loadCategories('live', 'portal-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].title).toBe('Category 1');
    });

    it('should return empty array if no results', async () => {
      const mockDB = {
        select: jest.fn().mockResolvedValue([]),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await loadCategories('live', 'portal-1');

      expect(result).toEqual([]);
    });

    it('should return empty array if cache is expired', async () => {
      const oldTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      const mockCategories = [
        { id: 1, type: 'live', portal_id: 'portal-1', name: 'Category 1', alias: 'cat1', parent_id: 0, updated_at: oldTime },
      ];
      const mockDB = {
        select: jest.fn().mockResolvedValue(mockCategories),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await loadCategories('live', 'portal-1');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      const mockDB = {
        select: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await loadCategories('live', 'portal-1');

      expect(result).toEqual([]);
    });

    it('should handle force refresh with maxAge=0', async () => {
      const mockCategories = [
        { id: 1, type: 'live', portal_id: 'portal-1', name: 'Category 1', alias: 'cat1', parent_id: 0, updated_at: Date.now() },
      ];
      const mockDB = {
        select: jest.fn().mockResolvedValue(mockCategories),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await loadCategories('live', 'portal-1', 0);

      expect(result).toEqual([]);
    });
  });

  describe('saveCategories', () => {
    it('should save categories to database', async () => {
      const categories = [
        { id: '1', title: 'Category 1', alias: 'cat1', parent_id: 0 },
      ] as any;
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await saveCategories('live', 'portal-1', categories);

      expect(mockDB.execute).toHaveBeenCalled();
    });

    it('should skip categories with invalid ID', async () => {
      const categories = [
        { id: '*', title: 'All', alias: 'all', parent_id: 0 },
      ] as any;
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await saveCategories('live', 'portal-1', categories);

      expect(mockDB.execute).not.toHaveBeenCalled();
    });

    it('should skip categories with NaN ID', async () => {
      const categories = [
        { id: 'invalid', title: 'Category 1', alias: 'cat1', parent_id: 0 },
      ] as any;
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await saveCategories('live', 'portal-1', categories);

      expect(mockDB.execute).not.toHaveBeenCalled();
    });

    it('should handle batch size correctly', async () => {
      const categories = Array.from({ length: 150 }, (_, i) => ({
        id: (i + 1).toString(),
        title: `Category ${i + 1}`,
        alias: `cat${i + 1}`,
        parent_id: 0,
      })) as any;
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await saveCategories('live', 'portal-1', categories);

      // Should have 2 batches (100 + 50)
      expect(mockDB.execute).toHaveBeenCalledTimes(3); // 2 upserts + 1 delete
    });

    it('should cleanup old categories', async () => {
      const categories = [
        { id: '1', title: 'Category 1', alias: 'cat1', parent_id: 0 },
      ] as any;
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await saveCategories('live', 'portal-1', categories);

      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM categories'),
        expect.arrayContaining(['portal-1', 'live', 1])
      );
    });

    it('should handle error gracefully', async () => {
      const categories = [
        { id: '1', title: 'Category 1', alias: 'cat1', parent_id: 0 },
      ] as any;
      const mockDB = {
        execute: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await expect(saveCategories('live', 'portal-1', categories)).resolves.not.toThrow();
    });
  });

  describe('clearAllCategoriesCache', () => {
    it('should clear all categories', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await clearAllCategoriesCache();

      expect(mockDB.execute).toHaveBeenCalledWith('DELETE FROM categories');
    });

    it('should throw error on failure', async () => {
      const mockDB = {
        execute: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await expect(clearAllCategoriesCache()).rejects.toThrow('DB error');
    });
  });
});
