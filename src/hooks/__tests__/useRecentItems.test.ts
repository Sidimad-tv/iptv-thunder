import {
  initRecentViewedTable,
  loadRecentViewed,
  addRecentViewed,
  clearRecentViewed,
} from '../useRecentItems';
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

describe('useRecentItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initRecentViewedTable', () => {
    it('should create recently_viewed table', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await initRecentViewedTable();

      expect(getDB).toHaveBeenCalled();
      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS recently_viewed')
      );
    });
  });

  describe('loadRecentViewed', () => {
    it('should load recent viewed items for account', async () => {
      const mockItems = [
        { id: 1, account_id: 'acc1', type: 'live', item_id: 'item1', name: 'Item 1', viewed_at: 123456 },
      ];
      const mockDB = {
        select: jest.fn().mockResolvedValue(mockItems),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await loadRecentViewed('acc1');

      expect(result).toEqual(mockItems);
      expect(mockDB.select).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM recently_viewed'),
        expect.arrayContaining(['acc1', expect.any(Number)])
      );
    });

    it('should load recent viewed items with type filter', async () => {
      const mockItems = [
        { id: 1, account_id: 'acc1', type: 'live', item_id: 'item1', name: 'Item 1', viewed_at: 123456 },
      ];
      const mockDB = {
        select: jest.fn().mockResolvedValue(mockItems),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await loadRecentViewed('acc1', 'live', 10);

      expect(result).toEqual(mockItems);
      expect(mockDB.select).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM recently_viewed'),
        expect.arrayContaining(['acc1', 'live', 10])
      );
    });

    it('should return empty array on error', async () => {
      const mockDB = {
        select: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      const result = await loadRecentViewed('acc1');

      expect(result).toEqual([]);
    });
  });

  describe('addRecentViewed', () => {
    it('should add recent viewed item', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await addRecentViewed('acc1', 'live', 'item1', { name: 'Item 1', poster: 'poster.jpg' });

      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO recently_viewed'),
        expect.arrayContaining(['acc1', 'live', 'item1', 'Item 1', 'poster.jpg'])
      );
    });

    it('should handle extra metadata as JSON', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await addRecentViewed('acc1', 'vod', 'item1', { extra: { key: 'value' } });

      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringContaining('{"key":"value"}')])
      );
    });

    it('should keep only last 100 items', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await addRecentViewed('acc1', 'live', 'item1', { name: 'Item 1' });

      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM recently_viewed'),
        expect.arrayContaining(['acc1', 'acc1'])
      );
    });

    it('should handle genre_id', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await addRecentViewed('acc1', 'live', 'item1', { name: 'Item 1', genre_id: 'genre1' });

      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO recently_viewed'),
        expect.arrayContaining(['acc1', 'live', 'item1', 'Item 1', null, null, null, null, null, null, 'genre1', expect.any(Number)])
      );
    });
  });

  describe('clearRecentViewed', () => {
    it('should clear recent viewed items for account', async () => {
      const mockDB = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await clearRecentViewed('acc1');

      expect(mockDB.execute).toHaveBeenCalledWith(
        'DELETE FROM recently_viewed WHERE account_id = ?',
        ['acc1']
      );
    });

    it('should throw error on failure', async () => {
      const mockDB = {
        execute: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      (getDB as jest.Mock).mockResolvedValue(mockDB);

      await expect(clearRecentViewed('acc1')).rejects.toThrow('DB error');
    });
  });
});
