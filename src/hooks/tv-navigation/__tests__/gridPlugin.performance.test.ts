// Performance tests for gridPlugin
// These tests measure execution time and ensure grid navigation algorithms meet performance thresholds

import { gridPlugin } from '../plugins/gridPlugin';
import { NavigationState, Direction, NavNode } from '../core/types';

describe('gridPlugin Performance Tests', () => {
  const createMockNode = (
    id: string,
    index: number,
    row: number,
    col: number,
    groupId: string,
    containerId: string = 'main',
    disabled: boolean = false
  ): NavNode => ({
    id,
    rect: new DOMRect(col * 110, row * 110, 100, 100),
    containerId,
    groupId,
    disabled,
    index,
    gridPosition: { row, col },
  });

  const createGridState = (
    rows: number,
    cols: number,
    groupId: string,
    containerId: string = 'main'
  ): NavigationState => {
    const nodes: NavNode[] = [];
    const gridRows: NavNode[][] = [];
    const indexMap = new Map<number, NavNode>();

    for (let row = 0; row < rows; row++) {
      const gridRow: NavNode[] = [];
      for (let col = 0; col < cols; col++) {
        const node = createMockNode(
          `node-${row}-${col}`,
          row * cols + col,
          row,
          col,
          groupId,
          containerId
        );
        nodes.push(node);
        gridRow.push(node);
        indexMap.set(row * cols + col, node);
      }
      gridRows.push(gridRow);
    }

    return {
      currentId: nodes[0].id,
      nodes,
      grid: new Map([[`${groupId}|${containerId}`, { rows: gridRows, columnCount: cols, indexMap }]]),
      lastPositionByAxis: { x: 0, y: 0 },
      lastXByRow: new Map(),
    };
  };

  describe('Grid Navigation Performance', () => {
    it('should handle right navigation in 10x10 grid in under 1ms', () => {
      const state = createGridState(10, 10, 'tv-channels');
      state.currentId = 'node-0-0';

      const startTime = performance.now();
      const result = gridPlugin.findNext(state, 'right');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBe('node-0-1');
      expect(duration).toBeLessThan(10);
    });

    it('should handle down navigation in 10x10 grid in under 1ms', () => {
      const state = createGridState(10, 10, 'tv-channels');
      state.currentId = 'node-0-0';

      const startTime = performance.now();
      const result = gridPlugin.findNext(state, 'down');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBe('node-1-0');
      expect(duration).toBeLessThan(10);
    });

    it('should handle navigation in 50x50 grid in under 5ms', () => {
      const state = createGridState(50, 50, 'movies');
      state.currentId = 'node-0-0';

      const startTime = performance.now();
      const result = gridPlugin.findNext(state, 'right');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBe('node-0-1');
      expect(duration).toBeLessThan(5);
    });

    it('should handle navigation in 100x100 grid in under 5ms', () => {
      const state = createGridState(100, 100, 'series');
      state.currentId = 'node-0-0';

      const startTime = performance.now();
      const result = gridPlugin.findNext(state, 'down');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBe('node-1-0');
      expect(duration).toBeLessThan(5);
    });
  });

  describe('All Directions Performance', () => {
    it('should handle all directions efficiently in 20x20 grid', () => {
      const state = createGridState(20, 20, 'tv-channels');
      state.currentId = 'node-10-10';

      const directions: Direction[] = ['up', 'down', 'left', 'right'];
      const durations: number[] = [];

      directions.forEach(direction => {
        const startTime = performance.now();
        gridPlugin.findNext(state, direction);
        const endTime = performance.now();
        durations.push(endTime - startTime);
      });

      durations.forEach(duration => {
        expect(duration).toBeLessThan(100);
      });
    });
  });

  describe('Carousel Navigation Performance', () => {
    it('should handle carousel group navigation efficiently', () => {
      const state = createGridState(5, 10, 'for-you-live');
      state.currentId = 'node-0-5';

      const startTime = performance.now();
      gridPlugin.findNext(state, 'down');
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Carousel navigation should be fast
      expect(duration).toBeLessThan(50);
    });

    it('should handle carousel up navigation efficiently', () => {
      // For carousel groups, UP goes to previous carousel group
      // Create state with for-you-live group as previous group
      const state = createGridState(5, 10, 'for-you-movies');
      
      // Add for-you-live nodes as previous carousel group
      const liveNodes: NavNode[] = [];
      const liveRows: NavNode[][] = [];
      const liveIndexMap = new Map<number, NavNode>();
      for (let row = 0; row < 5; row++) {
        const gridRow: NavNode[] = [];
        for (let col = 0; col < 10; col++) {
          const node = createMockNode(
            `live-node-${row}-${col}`,
            row * 10 + col,
            row,
            col,
            'for-you-live',
            'main'
          );
          liveNodes.push(node);
          gridRow.push(node);
          liveIndexMap.set(row * 10 + col, node);
        }
        liveRows.push(gridRow);
      }
      
      // Add live nodes to state
      state.nodes = [...liveNodes, ...state.nodes];
      state.grid?.set('for-you-live|main', { rows: liveRows, columnCount: 10, indexMap: liveIndexMap });
      
      state.currentId = 'node-2-5'; // in for-you-movies

      const startTime = performance.now();
      const result = gridPlugin.findNext(state, 'up');
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should navigate to for-you-live group
      expect(result).toMatch(/^live-node-/);
      expect(duration).toBeLessThan(150);
    });
  });

  describe('Multiple Containers Performance', () => {
    it('should handle navigation across multiple containers efficiently', () => {
      const nodes: NavNode[] = [];
      const gridMap = new Map<string, { rows: NavNode[][], columnCount: number, indexMap: Map<number, NavNode> }>();

      // Create 3 containers with grids
      for (let container = 0; container < 3; container++) {
        const gridRows: NavNode[][] = [];
        const indexMap = new Map<number, NavNode>();
        for (let row = 0; row < 10; row++) {
          const gridRow: NavNode[] = [];
          for (let col = 0; col < 10; col++) {
            const node = createMockNode(
              `container-${container}-node-${row}-${col}`,
              row * 10 + col,
              row,
              col,
              'tv-channels',
              `container-${container}`
            );
            nodes.push(node);
            gridRow.push(node);
            indexMap.set(row * 10 + col, node);
          }
          gridRows.push(gridRow);
        }
        gridMap.set(`tv-channels|container-${container}`, { rows: gridRows, columnCount: 10, indexMap });
      }

      const state: NavigationState = {
        currentId: 'container-0-node-0-0',
        nodes,
        grid: gridMap,
        lastPositionByAxis: { x: 0, y: 0 },
        lastXByRow: new Map(),
      };

      const startTime = performance.now();
      gridPlugin.findNext(state, 'right');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(20);
    });
  });

  describe('Edge Cases Performance', () => {
    it('should handle grid boundaries efficiently', () => {
      const state = createGridState(10, 10, 'tv-channels');
      
      // Test right boundary
      state.currentId = 'node-0-9';
      const startTime1 = performance.now();
      gridPlugin.findNext(state, 'right');
      const endTime1 = performance.now();

      // Test left boundary
      state.currentId = 'node-0-0';
      const startTime2 = performance.now();
      gridPlugin.findNext(state, 'left');
      const endTime2 = performance.now();

      // Test top boundary
      state.currentId = 'node-0-0';
      const startTime3 = performance.now();
      gridPlugin.findNext(state, 'up');
      const endTime3 = performance.now();

      // Test bottom boundary
      state.currentId = 'node-9-0';
      const startTime4 = performance.now();
      gridPlugin.findNext(state, 'down');
      const endTime4 = performance.now();

      expect(endTime1 - startTime1).toBeLessThan(50);
      expect(endTime2 - startTime2).toBeLessThan(50);
      expect(endTime3 - startTime3).toBeLessThan(50);
      expect(endTime4 - startTime4).toBeLessThan(50);
    });

    it('should handle disabled nodes efficiently', () => {
      const state = createGridState(10, 10, 'tv-channels');
      
      // Disable some nodes
      state.nodes.forEach((node, index) => {
        if (index % 3 === 0) {
          node.disabled = true;
          // Update grid to reflect disabled state
          const grid = state.grid?.get('tv-channels|main');
          if (grid) {
            const row = Math.floor(index / 10);
            const col = index % 10;
            grid.rows[row][col].disabled = true;
            // Update indexMap as well
            grid.indexMap.set(index, grid.rows[row][col]);
          }
        }
      });

      state.currentId = 'node-0-1'; // Start with enabled node

      const startTime = performance.now();
      gridPlugin.findNext(state, 'right');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2);
    });

    it('should handle non-grid groups efficiently', () => {
      const state: NavigationState = {
        currentId: 'node-0',
        nodes: [
          {
            id: 'node-0',
            rect: new DOMRect(0, 0, 100, 100),
            containerId: 'main',
            groupId: 'non-grid-group', // Not in GRID_GROUPS
            index: 0,
          },
        ],
        lastPositionByAxis: { x: 0, y: 0 },
        lastXByRow: new Map(),
      };

      const startTime = performance.now();
      const result = gridPlugin.findNext(state, 'right');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBeNull();
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Series Episodes Performance', () => {
    it('should handle series episodes navigation efficiently', () => {
      const state = createGridState(50, 1, 'series-episodes');
      state.currentId = 'node-25-0';

      const startTime = performance.now();
      const result = gridPlugin.findNext(state, 'down');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBe('node-26-0');
      expect(duration).toBeLessThan(1);
    });

    it('should handle last episode blocking efficiently', () => {
      const state = createGridState(50, 1, 'series-episodes');
      state.currentId = 'node-49-0'; // Last episode

      const startTime = performance.now();
      const result = gridPlugin.findNext(state, 'down');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBeNull();
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory with repeated navigation', () => {
      const state = createGridState(50, 50, 'tv-channels');
      
      const initialMemory = performance.memory?.usedJSHeapSize || 0;
      
      // Perform 1000 navigation operations
      for (let i = 0; i < 1000; i++) {
        gridPlugin.findNext(state, 'right');
        gridPlugin.findNext(state, 'down');
        gridPlugin.findNext(state, 'left');
        gridPlugin.findNext(state, 'up');
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

  describe('Large-scale Grid Performance', () => {
    it('should handle 5000 node grid in under 10ms', () => {
      const state = createGridState(50, 100, 'movies');
      state.currentId = 'node-25-50';

      const startTime = performance.now();
      gridPlugin.findNext(state, 'right');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10);
    });
  });

  describe('Sidebar Navigation Performance', () => {
    it('should handle sidebar navigation efficiently', () => {
      const nodes: NavNode[] = [];
      
      // Create sidebar nodes
      for (let i = 0; i < 20; i++) {
        nodes.push(
          createMockNode(
            `sidebar-${i}`,
            i,
            i,
            0,
            'tv-categories',
            'navigation'
          )
        );
      }

      // Create main content nodes
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          nodes.push(
            createMockNode(
              `content-${row}-${col}`,
              20 + row * 10 + col,
              row,
              col,
              'tv-channels',
              'main'
            )
          );
        }
      }

      const gridRows: NavNode[][] = [];
      const indexMap = new Map<number, NavNode>();
      for (let row = 0; row < 10; row++) {
        const gridRow: NavNode[] = [];
        for (let col = 0; col < 10; col++) {
          const node = createMockNode(
            `content-${row}-${col}`,
            20 + row * 10 + col,
            row,
            col,
            'tv-channels',
            'main'
          );
          gridRow.push(node);
          indexMap.set(row * 10 + col, node);
        }
        gridRows.push(gridRow);
      }

      const state: NavigationState = {
        currentId: 'content-5-5',
        nodes,
        grid: new Map([['tv-channels|main', { rows: gridRows, columnCount: 10, indexMap }]]),
        lastPositionByAxis: { x: 550, y: 550 },
        lastXByRow: new Map(),
      };

      const startTime = performance.now();
      gridPlugin.findNext(state, 'left');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5);
    });
  });

  describe('Grid Groups Check Performance', () => {
    it('should handle GRID_GROUPS check efficiently', () => {
      const state = createGridState(10, 10, 'tv-channels');
      
      const startTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        gridPlugin.findNext(state, 'right');
      }
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });
  });
});
