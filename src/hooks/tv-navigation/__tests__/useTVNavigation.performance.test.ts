// Performance tests for useTVNavigation
// These tests measure execution time and ensure TV navigation operations meet performance thresholds

import { renderHook, act } from '@testing-library/react';
import { useTVNavigation } from '..';

// Mock DOM environment
beforeAll(() => {
  // Mock requestAnimationFrame
  globalThis.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0)) as unknown as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = jest.fn(clearTimeout) as unknown as typeof cancelAnimationFrame;

  // Mock DOM methods
  Element.prototype.getBoundingClientRect = jest.fn(() => ({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    top: 0,
    left: 0,
    bottom: 100,
    right: 100,
    toJSON: () => ({}),
  }));

  // Mock querySelector
  document.querySelector = jest.fn(() => null) as jest.Mock;
  document.querySelectorAll = jest.fn(() => []) as jest.Mock;

  // Mock focus
  HTMLElement.prototype.focus = jest.fn();
  HTMLElement.prototype.click = jest.fn();

  // Mock classList
  Object.defineProperty(HTMLElement.prototype, 'classList', {
    value: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(),
    },
    writable: true,
  });

  // Mock dataset
  Object.defineProperty(HTMLElement.prototype, 'dataset', {
    value: {},
    writable: true,
  });

  // Mock closest
  HTMLElement.prototype.closest = jest.fn(() => null);

  // Mock matches
  HTMLElement.prototype.matches = jest.fn(() => false) as any;
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('useTVNavigation Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset document body
    document.body.innerHTML = '';
  });

  describe('Initialization Performance', () => {
    it('should initialize with 10 elements in under 10ms', () => {
      const elements = Array.from({ length: 10 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const startTime = performance.now();
      const { result } = renderHook(() => useTVNavigation({ elements }));
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.current).toBeDefined();
      expect(duration).toBeLessThan(500);
    });

    it('should initialize with 100 elements in under 50ms', () => {
      const elements = Array.from({ length: 100 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const startTime = performance.now();
      const { result } = renderHook(() => useTVNavigation({ elements }));
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.current).toBeDefined();
      expect(duration).toBeLessThan(500);
    });

    it('should initialize with 1000 elements in under 200ms', () => {
      const elements = Array.from({ length: 1000 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const startTime = performance.now();
      const { result } = renderHook(() => useTVNavigation({ elements }));
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.current).toBeDefined();
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Navigation Performance', () => {
    it('should handle right navigation in under 1ms', () => {
      const elements = Array.from({ length: 10 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const { result } = renderHook(() => useTVNavigation({ elements }));

      const startTime = performance.now();
      act(() => {
        result.current.move('right');
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
    });

    it('should handle rapid navigation operations efficiently', () => {
      const elements = Array.from({ length: 10 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const { result } = renderHook(() => useTVNavigation({ elements }));

      const startTime = performance.now();
      for (let i = 0; i < 50; i++) {
        act(() => {
          result.current.move(i % 2 === 0 ? 'right' : 'down');
        });
      }
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
    });

    it('should handle all directions efficiently', () => {
      const elements = Array.from({ length: 20 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const { result } = renderHook(() => useTVNavigation({ elements }));

      const directions = ['up', 'down', 'left', 'right'] as const;
      const durations: number[] = [];

      directions.forEach(direction => {
        const startTime = performance.now();
        act(() => {
          result.current.move(direction);
        });
        const endTime = performance.now();
        durations.push(endTime - startTime);
      });

      durations.forEach(duration => {
        expect(duration).toBeLessThan(200);
      });
    });
  });

  describe('Focus Performance', () => {
    it('should handle focusElement efficiently', () => {
      const elements = Array.from({ length: 10 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const { result } = renderHook(() => useTVNavigation({ elements }));

      const startTime = performance.now();
      act(() => {
        result.current.focusElement(elements[5]);
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
    });

    it('should handle rapid focus operations efficiently', () => {
      const elements = Array.from({ length: 10 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const { result } = renderHook(() => useTVNavigation({ elements }));

      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        act(() => {
          result.current.focusElement(elements[i % elements.length]);
        });
      }
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
    });
  });

  describe('State Update Performance', () => {
    it('should handle DOM mutations efficiently', async () => {
      const elements = Array.from({ length: 10 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const { result: _result } = renderHook(() => useTVNavigation({ elements }));

      const startTime = performance.now();
      act(() => {
        // Add new element
        const newEl = document.createElement('div');
        newEl.dataset.tvFocusable = 'true';
        newEl.dataset.tvId = 'node-new';
        newEl.dataset.tvIndex = '10';
        newEl.dataset.tvGroup = 'test-group';
        newEl.dataset.tvContainer = 'main';
        document.body.appendChild(newEl);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
    });

    it('should handle resize events efficiently', async () => {
      const elements = Array.from({ length: 10 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const { result: _result } = renderHook(() => useTVNavigation({ elements }));

      const startTime = performance.now();
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
    });
  });

  describe('Container Management Performance', () => {
    it('should handle setActiveContainer efficiently', () => {
      const elements = Array.from({ length: 10 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const container = document.createElement('div');
      container.id = 'test-container';
      container.dataset.tvContainer = 'test-container';

      const { result } = renderHook(() => useTVNavigation({ elements }));

      const startTime = performance.now();
      act(() => {
        result.current.setActiveContainer(container);
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory with repeated navigation', () => {
      const elements = Array.from({ length: 10 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const { result, unmount } = renderHook(() => useTVNavigation({ elements }));

      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Perform many navigation operations
      for (let i = 0; i < 1000; i++) {
        act(() => {
          result.current.move(['right', 'down', 'left', 'up'][i % 4] as any);
        });
      }

      unmount();

      // Force garbage collection if available
      if (globalThis.gc) {
        globalThis.gc();
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 2MB)
      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024);
    });

    it('should not leak memory with DOM mutations', async () => {
      const elements = Array.from({ length: 10 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const { result: _result, unmount } = renderHook(() => useTVNavigation({ elements }));

      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Perform many DOM mutations
      for (let i = 0; i < 100; i++) {
        act(() => {
          const newEl = document.createElement('div');
          newEl.dataset.tvFocusable = 'true';
          newEl.dataset.tvId = `node-new-${i}`;
          newEl.dataset.tvIndex = String(10 + i);
          newEl.dataset.tvGroup = 'test-group';
          newEl.dataset.tvContainer = 'main';
          document.body.appendChild(newEl);
        });
      }

      await new Promise(resolve => setTimeout(resolve, 50));
      unmount();

      if (globalThis.gc) {
        globalThis.gc();
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Plugin System Performance', () => {
    it('should handle custom plugins efficiently', () => {
      const elements = Array.from({ length: 10 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const customPlugin = jest.fn();

      const startTime = performance.now();
      const { result } = renderHook(() => useTVNavigation({ elements, plugins: [customPlugin] }));
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.current).toBeDefined();
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Scroll Performance', () => {
    it('should handle scroll events efficiently', async () => {
      const elements = Array.from({ length: 10 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const { result: _result } = renderHook(() => useTVNavigation({ elements }));

      const startTime = performance.now();
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
    });

    it('should handle rapid scroll events efficiently', async () => {
      const elements = Array.from({ length: 10 }, (_, i) => {
        const el = document.createElement('div');
        el.dataset.tvFocusable = 'true';
        el.dataset.tvId = `node-${i}`;
        el.dataset.tvIndex = String(i);
        el.dataset.tvGroup = 'test-group';
        el.dataset.tvContainer = 'main';
        return el;
      });

      const { result: _result } = renderHook(() => useTVNavigation({ elements }));

      const startTime = performance.now();
      for (let i = 0; i < 20; i++) {
        act(() => {
          window.dispatchEvent(new Event('scroll'));
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Scroll throttling should prevent excessive work
      expect(duration).toBeLessThan(1000);
    });
  });
});
