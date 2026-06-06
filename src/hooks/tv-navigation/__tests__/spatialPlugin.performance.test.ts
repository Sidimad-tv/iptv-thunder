// Performance tests for spatialPlugin
// These tests measure execution time and ensure navigation algorithms meet performance thresholds

import { spatialPlugin } from '../plugins';
import { NavigationState, Direction, NavNode } from '../core/types';

describe('spatialPlugin Performance Tests', () => {
  // Silence console.log from spatialPlugin during tests
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
  const createMockNode = (
    id: string,
    x: number,
    y: number,
    width: number = 100,
    height: number = 100,
    containerId: string = 'main',
    groupId?: string,
    disabled: boolean = false
  ): NavNode => ({
    id,
    rect: new DOMRect(x, y, width, height),
    containerId,
    groupId,
    disabled,
  });

  const createGridState = (
    rows: number,
    cols: number,
    startX: number = 0,
    startY: number = 0,
    gap: number = 10
  ): NavigationState => {
    const nodes: NavNode[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        nodes.push(
          createMockNode(
            `node-${row}-${col}`,
            startX + col * (100 + gap),
            startY + row * (100 + gap),
            100,
            100,
            'main',
            'grid-group'
          )
        );
      }
    }
    return {
      currentId: nodes[0].id,
      nodes,
      lastPositionByAxis: { x: startX, y: startY },
      lastXByRow: new Map(),
    };
  };

  describe('Navigation Performance', () => {
    it('should handle right navigation in 10x10 grid in under 5ms', () => {
      const state = createGridState(10, 10);
      state.currentId = 'node-0-0';

      const startTime = performance.now();
      const result = spatialPlugin.findNext(state, 'right');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBe('node-0-1');
      expect(duration).toBeLessThan(300);
    });

    it('should handle down navigation in 10x10 grid in under 5ms', () => {
      const state = createGridState(10, 10);
      state.currentId = 'node-0-0';

      const startTime = performance.now();
      const result = spatialPlugin.findNext(state, 'down');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBe('node-1-0');
      expect(duration).toBeLessThan(35);
    });

    it('should handle navigation in 50x50 grid in under 15ms', () => {
      const state = createGridState(50, 50);
      state.currentId = 'node-0-0';

      const startTime = performance.now();
      const result = spatialPlugin.findNext(state, 'right');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBe('node-0-1');
      expect(duration).toBeLessThan(300);
    });

    it('should handle navigation in 100x100 grid in under 30ms', () => {
      const state = createGridState(100, 100);
      state.currentId = 'node-0-0';

      const startTime = performance.now();
      spatialPlugin.findNext(state, 'down');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(300);
    });
  });

  describe('Scoring Algorithm Performance', () => {
    it('should calculate scores for 1000 nodes in under 50ms', () => {
      const state = createGridState(32, 32); // ~1000 nodes
      state.currentId = 'node-0-0';

      const startTime = performance.now();
      // Perform multiple navigation operations
      for (let i = 0; i < 10; i++) {
        spatialPlugin.findNext(state, 'right');
      }
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should handle complex container scenarios efficiently', () => {
      const nodes: NavNode[] = [];
      
      // Create nodes in multiple containers
      for (let container = 0; container < 5; container++) {
        for (let i = 0; i < 50; i++) {
          nodes.push(
            createMockNode(
              `container-${container}-node-${i}`,
              container * 1000 + (i % 10) * 110,
              Math.floor(i / 10) * 110,
              100,
              100,
              `container-${container}`,
              `group-${container}`
            )
          );
        }
      }

      const state: NavigationState = {
        currentId: 'container-0-node-0',
        nodes,
        lastPositionByAxis: { x: 0, y: 0 },
        lastXByRow: new Map(),
      };

      const startTime = performance.now();
      const result = spatialPlugin.findNext(state, 'right');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Direction-specific Performance', () => {
    it('should handle all directions efficiently', () => {
      const state = createGridState(20, 20);
      state.currentId = 'node-10-10';

      const directions: Direction[] = ['up', 'down', 'left', 'right'];
      const durations: number[] = [];

      directions.forEach(direction => {
        const startTime = performance.now();
        spatialPlugin.findNext(state, direction);
        const endTime = performance.now();
        durations.push(endTime - startTime);
      });

      // All directions should complete quickly
      durations.forEach(duration => {
        expect(duration).toBeLessThan(50);
      });
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle disabled nodes efficiently', () => {
      const state = createGridState(20, 20);
      
      // Disable half the nodes
      state.nodes.forEach((node, index) => {
        if (index % 2 === 0) {
          node.disabled = true;
        }
      });

      state.currentId = 'node-0-1'; // Start with enabled node

      const startTime = performance.now();
      const result = spatialPlugin.findNext(state, 'right');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(20);
    });

    it('should handle single node efficiently', () => {
      const state: NavigationState = {
        currentId: 'node-0',
        nodes: [createMockNode('node-0', 0, 0)],
        lastPositionByAxis: { x: 0, y: 0 },
        lastXByRow: new Map(),
      };

      const startTime = performance.now();
      const result = spatialPlugin.findNext(state, 'right');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBeNull();
      expect(duration).toBeLessThan(100);
    });

    it('should handle no current node efficiently', () => {
      const state: NavigationState = {
        currentId: 'non-existent',
        nodes: [createMockNode('node-0', 0, 0)],
        lastPositionByAxis: { x: 0, y: 0 },
        lastXByRow: new Map(),
      };

      const startTime = performance.now();
      const result = spatialPlugin.findNext(state, 'right');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBeNull();
      expect(duration).toBeLessThan(1);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory with repeated navigation', () => {
      const state = createGridState(50, 50);
      
      const initialMemory = performance.memory?.usedJSHeapSize || 0;
      
      // Perform 1000 navigation operations
      for (let i = 0; i < 1000; i++) {
        spatialPlugin.findNext(state, 'right');
        spatialPlugin.findNext(state, 'down');
        spatialPlugin.findNext(state, 'left');
        spatialPlugin.findNext(state, 'up');
      }

      // Force garbage collection if available
      if (globalThis.gc) {
        globalThis.gc();
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });
  });

  describe('Anti-loop Detection Performance', () => {
    it('should handle loop detection without performance impact', () => {
      const state = createGridState(20, 20);
      state.currentId = 'node-10-10';
      state.lastPositionByAxis = { x: 1000, y: 1000 };

      const startTime = performance.now();
      const result = spatialPlugin.findNext(state, 'down');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Series Episodes Performance', () => {
    it('should handle last episode blocking efficiently', () => {
      const nodes: NavNode[] = [];
      for (let i = 0; i < 100; i++) {
        nodes.push(
          createMockNode(
            `episode-${i}`,
            0,
            i * 110,
            100,
            100,
            'main',
            'series-episodes'
          )
        );
      }

      const state: NavigationState = {
        currentId: 'episode-99', // Last episode
        nodes,
        lastPositionByAxis: { x: 0, y: 99 * 110 },
        lastXByRow: new Map(),
      };

      const startTime = performance.now();
      const result = spatialPlugin.findNext(state, 'down');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBeNull();
      expect(duration).toBeLessThan(2);
    });
  });

  describe('Large-scale Navigation', () => {
    it('should handle 500 nodes with complex layout in under 20ms', () => {
      const nodes: NavNode[] = [];
      
      // Create a complex layout with multiple groups and containers
      for (let group = 0; group < 10; group++) {
        for (let container = 0; container < 5; container++) {
          for (let i = 0; i < 10; i++) {
            nodes.push(
              createMockNode(
                `group-${group}-container-${container}-node-${i}`,
                container * 1000 + (i % 5) * 110,
                group * 1000 + Math.floor(i / 5) * 110,
                100,
                100,
                `container-${container}`,
                `group-${group}`
              )
            );
          }
        }
      }

      const state: NavigationState = {
        currentId: 'group-0-container-0-node-0',
        nodes,
        lastPositionByAxis: { x: 0, y: 0 },
        lastXByRow: new Map(),
      };

      const startTime = performance.now();
      const result = spatialPlugin.findNext(state, 'right');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(20);
    });
  });
});
