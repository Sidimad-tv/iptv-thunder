import {
  preloadImage,
  clearImageCache,
  getCacheSize,
  getCacheStats,
} from '../useImageCache';
import { remove, readDir, stat } from '@tauri-apps/plugin-fs';

// Mock Tauri APIs
jest.mock('@tauri-apps/plugin-fs', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  remove: jest.fn(),
  readDir: jest.fn(),
  rename: jest.fn(),
  stat: jest.fn(),
}));

jest.mock('@tauri-apps/api/path', () => ({
  appDataDir: jest.fn(),
  join: jest.fn(),
}));

jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
  convertFileSrc: jest.fn(),
}));

describe('useImageCache utility functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('preloadImage', () => {
    it('should return false on error', async () => {
      (stat as jest.Mock).mockRejectedValue(new Error('Not found'));

      const result = await preloadImage('http://example.com/image.jpg');

      expect(result).toBe(false);
    });
  });

  describe('clearImageCache', () => {
    it('should handle errors gracefully', async () => {
      (remove as jest.Mock).mockRejectedValue(new Error('Remove error'));

      await expect(clearImageCache()).resolves.not.toThrow();
    });
  });

  describe('getCacheSize', () => {
    it('should return cache size', async () => {
      const result = await getCacheSize();

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics structure', async () => {
      (readDir as jest.Mock).mockResolvedValue([]);

      const result = await getCacheStats();

      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('sizeFormatted');
      expect(result).toHaveProperty('fileCount');
      expect(result).toHaveProperty('maxSize');
      expect(result).toHaveProperty('maxSizeFormatted');
      expect(result).toHaveProperty('usage');
    });

    it('should handle empty cache', async () => {
      (readDir as jest.Mock).mockResolvedValue([]);

      const result = await getCacheStats();

      expect(result.fileCount).toBe(0);
      expect(result.size).toBe(0);
    });
  });
});
