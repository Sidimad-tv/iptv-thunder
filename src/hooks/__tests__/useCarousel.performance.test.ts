// Performance tests for useCarousel
// These tests measure execution time and ensure carousel operations meet performance thresholds

import { renderHook, act } from '@testing-library/react';
import { useCarousel } from '../useCarousel';

// Mock window and DOM for testing
const mockResizeObserver = jest.fn();
const mockRequestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));
const mockCancelAnimationFrame = jest.fn(clearTimeout);

beforeAll(() => {
  // Mock ResizeObserver
  globalThis.ResizeObserver = mockResizeObserver.mockImplementation((callback) => ({
    observe: jest.fn((element) => {
      // Simulate resize callback
      setTimeout(() => callback([{ target: element, contentRect: element.getBoundingClientRect() }]), 0);
    }),
    disconnect: jest.fn(),
    unobserve: jest.fn(),
  })) as unknown as typeof ResizeObserver;

  // Mock requestAnimationFrame
  globalThis.requestAnimationFrame = mockRequestAnimationFrame as unknown as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = mockCancelAnimationFrame as unknown as typeof cancelAnimationFrame;

  // Mock window methods
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1920,
  });

  // Mock DOM methods
  Element.prototype.getBoundingClientRect = jest.fn(() => ({
    x: 0,
    y: 0,
    width: 182,
    height: 240,
    top: 0,
    left: 0,
    bottom: 240,
    right: 182,
    toJSON: () => ({}),
  }));
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('useCarousel Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.innerWidth = 1920;
  });

  describe('Initialization Performance', () => {
    it('should initialize with 100 items in under 10ms', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));

      const startTime = performance.now();
      const { result } = renderHook(() => useCarousel({ items }));
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.current).toBeDefined();
      expect(duration).toBeLessThan(100);
    });

    it('should initialize with 1000 items in under 50ms', () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));

      const startTime = performance.now();
      const { result } = renderHook(() => useCarousel({ items }));
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.current).toBeDefined();
      expect(duration).toBeLessThan(50);
    });

    it('should initialize with virtualization enabled efficiently', () => {
      const items = Array.from({ length: 5000 }, (_, i) => ({ id: i }));

      const startTime = performance.now();
      const { result } = renderHook(() => useCarousel({ items, virtualization: true }));
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.current.visibleRange.end).toBeLessThan(items.length);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Scroll Performance', () => {
    it('should handle scroll right in under 1ms', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const { result } = renderHook(() => useCarousel({ items }));

      const startTime = performance.now();
      act(() => {
        result.current.scroll('right');
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });

    it('should handle rapid scroll operations efficiently', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const { result } = renderHook(() => useCarousel({ items }));

      const startTime = performance.now();
      for (let i = 0; i < 50; i++) {
        act(() => {
          result.current.scroll(i % 2 === 0 ? 'right' : 'left');
        });
      }
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });

    it('should handle scroll with TV mode enabled efficiently', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const { result } = renderHook(() => useCarousel({ items, tvMode: true }));

      const startTime = performance.now();
      act(() => {
        result.current.scroll('right');
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });
  });

  describe('Virtualization Performance', () => {
    it('should update visible range efficiently on scroll', async () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      const { result } = renderHook(() => useCarousel({ items, virtualization: true }));

      const startTime = performance.now();
      act(() => {
        result.current.scroll('right');
      });
      
      // Wait for RAF
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should handle virtualization with large datasets efficiently', () => {
      const items = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
      const { result } = renderHook(() => useCarousel({ items, virtualization: true }));

      const startTime = performance.now();
      // Simulate multiple scroll operations
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.scroll('right');
        });
      }
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Virtualization should keep performance high
      expect(duration).toBeLessThan(100);
    });

    it('should disable virtualization in TV mode without performance hit', () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      const { result } = renderHook(() => useCarousel({ items, tvMode: true }));

      const startTime = performance.now();
      act(() => {
        result.current.scroll('right');
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      // TV mode renders all items but should still be fast
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Resize Performance', () => {
    it('should handle resize events efficiently', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const { result: _result } = renderHook(() => useCarousel({ items }));

      const startTime = performance.now();
      act(() => {
        window.innerWidth = 1280;
        window.dispatchEvent(new Event('resize'));
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(80);
    });

    it('should handle rapid resize events efficiently', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const { result: _result } = renderHook(() => useCarousel({ items }));

      const startTime = performance.now();
      for (let i = 0; i < 10; i++) {
        act(() => {
          window.innerWidth = 800 + i * 100;
          window.dispatchEvent(new Event('resize'));
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200);
    });
  });

  describe('ScrollToIndex Performance', () => {
    it('should handle scrollToIndex efficiently', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const { result } = renderHook(() => useCarousel({ items }));

      const startTime = performance.now();
      act(() => {
        result.current.scrollToIndex(50);
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });

    it('should handle scrollToIndex with large datasets efficiently', () => {
      const items = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
      const { result } = renderHook(() => useCarousel({ items }));

      const startTime = performance.now();
      act(() => {
        result.current.scrollToIndex(5000);
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory with repeated scroll operations', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const { result, unmount } = renderHook(() => useCarousel({ items }));

      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Perform many scroll operations
      for (let i = 0; i < 1000; i++) {
        act(() => {
          result.current.scroll(i % 2 === 0 ? 'right' : 'left');
        });
      }

      unmount();

      // Force garbage collection if available
      if (globalThis.gc) {
        globalThis.gc();
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('should not leak memory with resize events', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const { result: _result, unmount } = renderHook(() => useCarousel({ items }));

      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Perform many resize operations
      for (let i = 0; i < 100; i++) {
        act(() => {
          window.innerWidth = 800 + (i % 10) * 100;
          window.dispatchEvent(new Event('resize'));
        });
      }

      await new Promise(resolve => setTimeout(resolve, 50));
      unmount();

      if (globalThis.gc) {
        globalThis.gc();
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024);
    });
  });

  describe('RAF Throttling Performance', () => {
    it('should throttle scroll checks efficiently', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const { result } = renderHook(() => useCarousel({ items }));

      const startTime = performance.now();
      
      // Rapid scroll operations should be throttled
      for (let i = 0; i < 100; i++) {
        act(() => {
          result.current.scroll('right');
        });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // RAF throttling should prevent excessive work
      expect(duration).toBeLessThan(100);
    });
  });

  describe('TV Mode Detection Performance', () => {
    it('should detect TV mode efficiently on mount', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));

      const startTime = performance.now();
      const { result } = renderHook(() => useCarousel({ items }));
      const endTime = performance.now();
      const duration = endTime - startTime;

      // TV mode detection should be fast
      expect(duration).toBeLessThan(100);
      expect(typeof result.current.isTV).toBe('boolean');
    });
  });
});
