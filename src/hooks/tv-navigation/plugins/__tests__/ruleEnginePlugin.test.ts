import { createRuleEnginePlugin } from '../ruleEnginePlugin';
import { NavigationState, NavigationConfig } from '../../core/types';

describe('ruleEnginePlugin', () => {
  describe('createRuleEnginePlugin', () => {
    it('should create a plugin with ruleEngine name', () => {
      const config: NavigationConfig = { rules: [] };
      const plugin = createRuleEnginePlugin(config);

      expect(plugin.name).toBe('ruleEngine');
    });

    it('should return null when current node not found', () => {
      const config: NavigationConfig = { rules: [] };
      const plugin = createRuleEnginePlugin(config);

      const state: NavigationState = {
        currentId: 'nonexistent',
        nodes: [],
      };

      const result = plugin.findNext(state, 'right');
      expect(result).toBeNull();
    });

    it('should return null when no rules match', () => {
      const config: NavigationConfig = {
        rules: [
          {
            when: { container: 'main' },
            goTo: { group: 'movies', initial: true },
          },
        ],
      };
      const plugin = createRuleEnginePlugin(config);

      const state: NavigationState = {
        currentId: 'node-1',
        nodes: [
          {
            id: 'node-1',
            containerId: 'other',
            groupId: 'movies',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
        ],
      };

      const result = plugin.findNext(state, 'right');
      expect(result).toBeNull();
    });

    it('should return targetId when rule matches', () => {
      const config: NavigationConfig = {
        rules: [
          {
            when: { container: 'main' },
            goTo: { group: 'movies', initial: true },
          },
        ],
      };
      const plugin = createRuleEnginePlugin(config);

      const state: NavigationState = {
        currentId: 'node-2',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'movies',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
          {
            id: 'node-2',
            containerId: 'main',
            groupId: 'movies',
            rect: { left: 100, top: 0, right: 200, bottom: 100, x: 100, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 1,
          },
        ],
      };

      const result = plugin.findNext(state, 'right');
      expect(result).toBe('node-1'); // initial returns first element
    });

    it('should handle isLast condition correctly', () => {
      const config: NavigationConfig = {
        rules: [
          {
            when: { container: 'main', last: true },
            goTo: { group: 'movies', initial: true },
          },
        ],
      };
      const plugin = createRuleEnginePlugin(config);

      const state: NavigationState = {
        currentId: 'node-2',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'movies',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
            isInitial: true,
          },
          {
            id: 'node-2',
            containerId: 'main',
            groupId: 'movies',
            rect: { left: 100, top: 0, right: 200, bottom: 100, x: 100, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 1,
          },
        ],
      };

      const result = plugin.findNext(state, 'right');
      expect(result).toBe('node-1'); // initial returns first element
    });

    it('should handle empty config', () => {
      const config: NavigationConfig = { rules: [] };
      const plugin = createRuleEnginePlugin(config);

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

      const result = plugin.findNext(state, 'right');
      expect(result).toBeNull();
    });

    it('should skip disabled elements when calculating isLast', () => {
      const config: NavigationConfig = {
        rules: [
          {
            when: { container: 'main', last: true },
            goTo: { group: 'movies', initial: true },
          },
        ],
      };
      const plugin = createRuleEnginePlugin(config);

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
            isInitial: true,
          },
          {
            id: 'node-2',
            containerId: 'main',
            groupId: 'movies',
            rect: { left: 100, top: 0, right: 200, bottom: 100, x: 100, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: true,
            index: 1,
          },
        ],
      };

      const result = plugin.findNext(state, 'right');
      expect(result).toBe('node-1');
    });
  });
});
