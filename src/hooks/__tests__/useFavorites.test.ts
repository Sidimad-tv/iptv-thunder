import {
  initFavoritesTable,
  loadFavorites,
  addFavorite,
  removeFavorite,
  addToFavorites,
  removeFromFavorites,
  isFavorite,
  loadFavoriteCategories,
  loadAllFavoriteCategories,
  addFavoriteCategory,
  removeFavoriteCategory,
  toggleFavoriteCategory,
  isFavoriteCategory,
} from '../useFavorites';
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

describe('useFavorites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initFavoritesTable', () => {
    it('should create favorites table', async () => {
      const mockDB = {
        select: jest.fn().mockResolvedValue([]),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await initFavoritesTable();

      expect(getDB).toHaveBeenCalled();
      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS favorites')
      );
    });
  });

  describe('loadFavorites', () => {
    it('should load favorites for account', async () => {
      const mockFavorites = [
        { id: 1, account_id: 'acc1', kind: 'item', type: 'live', item_id: 'item1', name: 'Item 1', created_at: 123456 },
      ];
      const mockDB = {
        select: jest.fn().mockResolvedValue(mockFavorites),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await loadFavorites('acc1');

      expect(result).toEqual(mockFavorites);
      expect(mockDB.select).toHaveBeenCalledWith(
        "SELECT * FROM favorites WHERE account_id = ? AND kind = 'item' ORDER BY created_at DESC",
        ['acc1']
      );
    });

    it('should return empty array on error', async () => {
      const mockDB = {
        select: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await loadFavorites('acc1');

      expect(result).toEqual([]);
    });
  });

  describe('addFavorite', () => {
    it('should add favorite item', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await addFavorite('acc1', 'live', 'item1', { name: 'Item 1', poster: 'poster.jpg' });

      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO favorites'),
        expect.arrayContaining(['acc1', 'live', 'item1', null, 'Item 1', 'poster.jpg'])
      );
    });

    it('should handle extra metadata as JSON', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await addFavorite('acc1', 'vod', 'item1', { extra: { key: 'value' } });

      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringContaining('{"key":"value"}')])
      );
    });
  });

  describe('removeFavorite', () => {
    it('should remove favorite item', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await removeFavorite('acc1', 'live', 'item1');

      expect(mockDB.execute).toHaveBeenCalledWith(
        "DELETE FROM favorites WHERE account_id = ? AND kind = 'item' AND type = ? AND item_id IN (?, ?)",
        ['acc1', 'live', 'item1', 'item1.0']
      );
    });

    it('should normalize item_id by removing .0 suffix', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await removeFavorite('acc1', 'vod', 'item1.0');

      expect(mockDB.execute).toHaveBeenCalledWith(
        "DELETE FROM favorites WHERE account_id = ? AND kind = 'item' AND type = ? AND item_id IN (?, ?)",
        ['acc1', 'vod', 'item1', 'item1.0']
      );
    });
  });

  describe('addToFavorites / removeFromFavorites', () => {
    it('should call addFavorite', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await addToFavorites('acc1', 'live', 'item1', { name: 'Item 1' });

      expect(mockDB.execute).toHaveBeenCalled();
    });

    it('should call removeFavorite', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await removeFromFavorites('acc1', 'live', 'item1');

      expect(mockDB.execute).toHaveBeenCalled();
    });
  });

  describe('isFavorite', () => {
    it('should return true if item is favorite', async () => {
      const mockDB = {
        select: jest.fn().mockResolvedValue([{ count: 1 }]),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await isFavorite('acc1', 'live', 'item1');

      expect(result).toBe(true);
    });

    it('should return false if item is not favorite', async () => {
      const mockDB = {
        select: jest.fn().mockResolvedValue([{ count: 0 }]),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await isFavorite('acc1', 'live', 'item1');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const mockDB = {
        select: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await isFavorite('acc1', 'live', 'item1');

      expect(result).toBe(false);
    });
  });

  describe('loadFavoriteCategories', () => {
    it('should load favorite categories for type', async () => {
      const mockCategories = [
        { item_id: 'cat1' },
        { item_id: 'cat2' },
      ];
      const mockDB = {
        select: jest.fn().mockResolvedValue(mockCategories),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await loadFavoriteCategories('acc1', 'live');

      expect(result).toEqual(['cat1', 'cat2']);
      expect(mockDB.select).toHaveBeenCalledWith(
        "SELECT item_id FROM favorites WHERE account_id = ? AND kind = 'category' AND type = ?",
        ['acc1', 'live']
      );
    });

    it('should return empty array on error', async () => {
      const mockDB = {
        select: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await loadFavoriteCategories('acc1', 'live');

      expect(result).toEqual([]);
    });
  });

  describe('loadAllFavoriteCategories', () => {
    it('should load all favorite categories grouped by type', async () => {
      const mockCategories = [
        { type: 'live', item_id: 'cat1' },
        { type: 'vod', item_id: 'cat2' },
        { type: 'series', item_id: 'cat3' },
      ];
      const mockDB = {
        select: jest.fn().mockResolvedValue(mockCategories),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await loadAllFavoriteCategories('acc1');

      expect(result).toEqual({
        live: ['cat1'],
        vod: ['cat2'],
        series: ['cat3'],
      });
    });

    it('should return empty groups on error', async () => {
      const mockDB = {
        select: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await loadAllFavoriteCategories('acc1');

      expect(result).toEqual({ live: [], vod: [], series: [] });
    });
  });

  describe('addFavoriteCategory', () => {
    it('should add favorite category', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await addFavoriteCategory('acc1', 'live', 'cat1', 'Category 1');

      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO favorites'),
        expect.arrayContaining(['acc1', 'live', 'cat1', 'Category 1'])
      );
    });
  });

  describe('removeFavoriteCategory', () => {
    it('should remove favorite category', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await removeFavoriteCategory('acc1', 'live', 'cat1');

      expect(mockDB.execute).toHaveBeenCalledWith(
        "DELETE FROM favorites WHERE account_id = ? AND kind = 'category' AND type = ? AND item_id = ?",
        ['acc1', 'live', 'cat1']
      );
    });
  });

  describe('toggleFavoriteCategory', () => {
    it('should add category if not favorite', async () => {
      const mockDB = {
        select: jest.fn().mockResolvedValue([{ count: 0 }]),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await toggleFavoriteCategory('acc1', 'live', 'cat1', 'Category 1');

      expect(result).toBe(true);
      expect(mockDB.execute).toHaveBeenCalled();
    });

    it('should remove category if favorite', async () => {
      const mockDB = {
        select: jest.fn().mockResolvedValue([{ count: 1 }]),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await toggleFavoriteCategory('acc1', 'live', 'cat1');

      expect(result).toBe(false);
      expect(mockDB.execute).toHaveBeenCalledWith(
        "DELETE FROM favorites WHERE account_id = ? AND kind = 'category' AND type = ? AND item_id = ?",
        ['acc1', 'live', 'cat1']
      );
    });
  });

  describe('isFavoriteCategory', () => {
    it('should return true if category is favorite', async () => {
      const mockDB = {
        select: jest.fn().mockResolvedValue([{ count: 1 }]),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await isFavoriteCategory('acc1', 'live', 'cat1');

      expect(result).toBe(true);
    });

    it('should return false if category is not favorite', async () => {
      const mockDB = {
        select: jest.fn().mockResolvedValue([{ count: 0 }]),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await isFavoriteCategory('acc1', 'live', 'cat1');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const mockDB = {
        select: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await isFavoriteCategory('acc1', 'live', 'cat1');

      expect(result).toBe(false);
    });
  });
});
