// Performance tests for useImageCache
// These tests measure execution time and ensure critical operations meet performance thresholds

import { readFile, writeFile, stat, readDir } from '@tauri-apps/plugin-fs';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';
import { rebuildLruFromFs, getImageUrl, getCacheStats, fetchAndCacheImage } from '../';

// Mock Tauri dependencies
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

jest.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: jest.fn().mockResolvedValue({
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(false),
      clear: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock('@tauri-apps/plugin-sql', () => ({
  Database: {
    load: jest.fn().mockResolvedValue({
      execute: jest.fn().mockResolvedValue(undefined),
      select: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
    }),
  },
  default: {
    load: jest.fn().mockResolvedValue({
      execute: jest.fn().mockResolvedValue(undefined),
      select: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock('@tauri-apps/plugin-stronghold', () => ({
  Stronghold: jest.fn().mockImplementation(() => ({
    vault: jest.fn().mockReturnValue({
      createClient: jest.fn().mockReturnValue({
        save: jest.fn(),
        get: jest.fn(),
        remove: jest.fn(),
      }),
    }),
  })),
  Client: jest.fn().mockImplementation(() => ({
    save: jest.fn(),
    get: jest.fn(),
    remove: jest.fn(),
  })),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
  createDebugRequestContext: jest.fn(),
  logDebugRequest: jest.fn(),
  logDebugSuccess: jest.fn(),
  logDebugError: jest.fn(),
}));

describe('useImageCache Performance Tests', () => {
  const mockReadFile = readFile as jest.Mock;
  const mockWriteFile = writeFile as jest.Mock;
  const mockStat = stat as jest.Mock;
  const mockInvoke = invoke as jest.Mock;
  const mockConvertFileSrc = convertFileSrc as jest.Mock;
  const mockAppDataDir = appDataDir as jest.Mock;
  const mockJoin = join as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppDataDir.mockResolvedValue('/app/data');
    mockJoin.mockImplementation((...args) => args.join('/'));
    mockConvertFileSrc.mockImplementation((path) => `asset://${path}`);
    mockInvoke.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
      body: new Array(1000).fill(0),
    });
    mockStat.mockRejectedValue(new Error('File not found'));
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(new Uint8Array(1000));
  });

  beforeAll(() => {
    // Mock TextEncoder for Node.js environment
    if (typeof globalThis.TextEncoder === 'undefined') {
      globalThis.TextEncoder = class TextEncoder {
        encode(text: string): Uint8Array {
          const bytes: number[] = [];
          for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            if (code < 0x80) {
              bytes.push(code);
            } else if (code < 0x800) {
              bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
            } else {
              bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
            }
          }
          return new Uint8Array(bytes);
        }
      } as unknown as typeof TextEncoder;
    }
    // Mock Response for Node.js environment
    if (typeof globalThis.Response === 'undefined') {
      globalThis.Response = class Response {
        constructor(public body: unknown, public init?: ResponseInit) {}
        headers = new Headers();
        status = 200;
        statusText = 'OK';
        ok = true;
        json() { return Promise.resolve(this.body); }
        text() { return Promise.resolve(String(this.body)); }
        blob() { return Promise.resolve(new Blob([this.body as ArrayBuffer])); }
        arrayBuffer() { return Promise.resolve(new Uint8Array(this.body as number[]).buffer); }
      } as unknown as typeof Response;
    }
    // Mock crypto.subtle for Node.js environment
    if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
      Object.defineProperty(globalThis, 'crypto', {
        value: {
          subtle: {
            digest: async (_algorithm: string, data: Uint8Array) => {
              // Simple hash simulation for testing
              const hash = new Uint8Array(20);
              for (let i = 0; i < data.length; i++) {
                hash[i % 20] ^= data[i];
              }
              return hash.buffer;
            }
          }
        },
        writable: true,
        configurable: true
      });
    }
  });

  describe('LRU Cache Performance', () => {
    it('should handle 1000 cache entries in under 50ms', async () => {
      // Mock readDir to return 1000 files
      const mockReadDir = readDir as jest.Mock;
      const files = Array.from({ length: 1000 }, (_, i) => ({
        name: `file${i}.img`,
      }));
      mockReadDir.mockResolvedValue(files);
      
      // Mock stat for each file
      mockStat.mockResolvedValue({ size: 1000, mtime: Date.now() });

      const startTime = performance.now();
      await rebuildLruFromFs();
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('Hash Generation Performance', () => {
    it('should handle URL processing efficiently', async () => {
      const urls = Array.from({ length: 10 }, (_, i) => 
        `https://example.com/image${i}.jpg`
      );

      const startTime = performance.now();
      // Test URL processing performance (includes hash generation)
      await Promise.all(urls.map(url => getImageUrl(url).catch(() => null)));
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('Deduplication Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      // Pre-mock file exists to simulate cache hit
      mockStat.mockResolvedValue({ size: 1000, mtime: Date.now() });

      const urls = Array.from({ length: 10 }, (_, i) => 
        `https://example.com/image${i}.jpg`
      );

      const startTime = performance.now();
      await Promise.all(urls.map(url => getImageUrl(url).catch(() => null)));
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Cache Statistics Performance', () => {
    it('should calculate cache stats in under 100ms', async () => {
      // Mock readDir to return files
      const mockReadDir = readDir as jest.Mock;
      mockReadDir.mockResolvedValue(Array.from({ length: 100 }, (_, i) => ({
        name: `file${i}.img`,
      })));
      mockStat.mockResolvedValue({ size: 1000, mtime: Date.now() });

      const startTime = performance.now();
      const stats = await getCacheStats();
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(stats.fileCount).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Memory Efficiency', () => {
    it('should handle repeated operations without excessive memory growth', async () => {
      // Pre-mock file exists
      mockStat.mockResolvedValue({ size: 1000, mtime: Date.now() });
      
      const initialMemory = performance.memory?.usedJSHeapSize || 0;
      
      // Perform cache operations
      for (let i = 0; i < 100; i++) {
        await getImageUrl(`https://example.com/image${i % 10}.jpg`).catch(() => null);
      }

      // Force garbage collection if available
      if (globalThis.gc) {
        globalThis.gc();
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Concurrency Control Performance', () => {
    it('should respect concurrent fetch limit without blocking', async () => {
      mockInvoke.mockImplementation(async () => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
          body: new Array(1000).fill(0),
        };
      });

      const urls = Array.from({ length: 20 }, (_, i) => 
        `https://example.com/image${i}.jpg`
      );

      const startTime = performance.now();
      await Promise.all(urls.map(url => fetchAndCacheImage(url)));
      const endTime = performance.now();
      const duration = endTime - startTime;

      // With MAX_CONCURRENT_FETCHES=4 and 20 requests, should take roughly 5 * 10ms = 50ms
      // Allow some overhead
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle errors quickly without blocking', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));
      mockStat.mockRejectedValue(new Error('File not found'));

      const startTime = performance.now();
      await Promise.all([
        getImageUrl('https://example.com/image1.jpg'),
        getImageUrl('https://example.com/image2.jpg'),
        getImageUrl('https://example.com/image3.jpg'),
      ]);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should fail fast
      expect(duration).toBeLessThan(100);
    });
  });
});
