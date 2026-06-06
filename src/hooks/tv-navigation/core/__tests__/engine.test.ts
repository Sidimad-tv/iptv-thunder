import { findNextNode } from '../engine';
import { NavigationState, NavigationPlugin, PluginContext } from '../types';

describe('engine', () => {
  describe('findNextNode', () => {
    it('should return null when current node not found', () => {
      const state: NavigationState = {
        currentId: 'nonexistent',
        nodes: [],
      };

      const result = findNextNode(state, 'right', []);
      expect(result).toEqual({ targetId: null });
    });

    it('should return null when no plugins handle the navigation', () => {
      const state: NavigationState = {
        currentId: 'node-1',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'movies',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
        ],
      };

      const mockPlugin: NavigationPlugin = {
        name: 'mock',
        findNext: jest.fn(() => null),
      };

      const result = findNextNode(state, 'right', [mockPlugin]);
      expect(result).toEqual({ targetId: null });
    });

    it('should handle old API (string return)', () => {
      const state: NavigationState = {
        currentId: 'node-1',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'movies',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
        ],
      };

      const mockPlugin: NavigationPlugin = {
        name: 'mock',
        findNext: jest.fn(() => 'node-2'),
      };

      const result = findNextNode(state, 'right', [mockPlugin]);
      expect(result).toEqual({ targetId: 'node-2' });
    });

    it('should handle new API (RuleResult return)', () => {
      const state: NavigationState = {
        currentId: 'node-1',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'movies',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
        ],
      };

      const mockPlugin: NavigationPlugin = {
        name: 'mock',
        findNext: jest.fn(() => ({ handled: true, targetId: 'node-2' })),
      };

      const result = findNextNode(state, 'right', [mockPlugin]);
      expect(result).toEqual({ targetId: 'node-2' });
    });

    it('should handle new API with action', () => {
      const state: NavigationState = {
        currentId: 'node-1',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'movies',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
        ],
      };

      const mockPlugin: NavigationPlugin = {
        name: 'mock',
        findNext: jest.fn(() => ({ handled: true, action: 'BACK' })),
      };

      const result = findNextNode(state, 'back', [mockPlugin]);
      expect(result).toEqual({ targetId: null, action: 'BACK' });
    });

    it('should try next plugin when current one returns handled: false', () => {
      const state: NavigationState = {
        currentId: 'node-1',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'movies',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
        ],
      };

      const plugin1: NavigationPlugin = {
        name: 'plugin1',
        findNext: jest.fn(() => ({ handled: false, reason: 'defer' })),
      };

      const plugin2: NavigationPlugin = {
        name: 'plugin2',
        findNext: jest.fn(() => 'node-2'),
      };

      const result = findNextNode(state, 'right', [plugin1, plugin2]);
      expect(result).toEqual({ targetId: 'node-2' });
      expect(plugin1.findNext).toHaveBeenCalled();
      expect(plugin2.findNext).toHaveBeenCalled();
    });

    it('should pass context to plugins', () => {
      const state: NavigationState = {
        currentId: 'node-1',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'movies',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
        ],
      };

      const context: PluginContext = {
        container: {
          lastFocusedByContainer: new Map([['main', 'node-1']]),
          activeContainerId: 'main',
        },
        setActiveContainer: jest.fn(),
        getActiveContainer: jest.fn().mockReturnValue('main'),
        saveLastFocus: jest.fn(),
        getLastFocus: jest.fn().mockReturnValue('node-1'),
      };

      const mockPlugin: NavigationPlugin = {
        name: 'mock',
        findNext: jest.fn(() => 'node-2'),
      };

      findNextNode(state, 'right', [mockPlugin], context);
      expect(mockPlugin.findNext).toHaveBeenCalledWith(state, 'right', context);
    });

    it('should return null when all plugins return null', () => {
      const state: NavigationState = {
        currentId: 'node-1',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'movies',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
        ],
      };

      const plugin1: NavigationPlugin = {
        name: 'plugin1',
        findNext: jest.fn(() => null),
      };

      const plugin2: NavigationPlugin = {
        name: 'plugin2',
        findNext: jest.fn(() => null),
      };

      const result = findNextNode(state, 'right', [plugin1, plugin2]);
      expect(result).toEqual({ targetId: null });
    });

    it('should handle empty plugins array', () => {
      const state: NavigationState = {
        currentId: 'node-1',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'movies',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
        ],
      };

      const result = findNextNode(state, 'right', []);
      expect(result).toEqual({ targetId: null });
    });
  });
});
