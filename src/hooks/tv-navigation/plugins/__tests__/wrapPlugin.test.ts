import { wrapPlugin } from '../wrapPlugin';
import { NavigationState, Direction } from '../../core/types';

describe('wrapPlugin', () => {
  it('should have correct name', () => {
    expect(wrapPlugin.name).toBe('wrap');
  });

  it('should return null for all directions (disabled)', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'main',
          groupId: 'test',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const directions: Direction[] = ['up', 'down', 'left', 'right', 'back'];

    directions.forEach(direction => {
      const result = wrapPlugin.findNext(state, direction);
      expect(result).toBeNull();
    });
  });

  it('should return null even with context', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'main',
          groupId: 'test',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const context = {
      container: {
        activeContainerId: 'main',
        lastFocusedByContainer: new Map(),
      },
      setActiveContainer: jest.fn(),
      getActiveContainer: jest.fn(),
      saveLastFocus: jest.fn(),
      getLastFocus: jest.fn(),
    };

    const result = wrapPlugin.findNext(state, 'right', context);
    expect(result).toBeNull();
  });
});
