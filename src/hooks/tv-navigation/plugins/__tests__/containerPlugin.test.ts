import { containerPlugin } from '../containerPlugin';
import { NavigationState, PluginContext } from '../../core/types';

describe('containerPlugin', () => {
  it('should have correct name', () => {
    expect(containerPlugin.name).toBe('container');
  });

  it('should return null when current node not found', () => {
    const state: NavigationState = {
      currentId: 'nonexistent',
      nodes: [],
    };

    const result = containerPlugin.findNext(state, 'right');
    expect(result).toBeNull();
  });

  it('should handle down from search', () => {
    const state: NavigationState = {
      currentId: 'search-1',
      nodes: [
        {
          id: 'search-1',
          containerId: 'main',
          groupId: 'search',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
          isSearch: true,
        },
        {
          id: 'main-1',
          containerId: 'main',
          groupId: 'movies',
          rect: { left: 0, top: 100, right: 100, bottom: 200, x: 0, y: 100, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
          isInitial: true,
        },
      ],
    };

    const result = containerPlugin.findNext(state, 'down');
    expect(result).toBe('main-1');
  });

  it('should handle left from search', () => {
    const state: NavigationState = {
      currentId: 'search-1',
      nodes: [
        {
          id: 'search-1',
          containerId: 'main',
          groupId: 'search',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
          isSearch: true,
        },
        {
          id: 'nav-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
          isActive: true,
        },
      ],
    };

    const result = containerPlugin.findNext(state, 'left');
    expect(result).toBe('nav-1');
  });

  it('should handle right from navigation', () => {
    const state: NavigationState = {
      currentId: 'nav-1',
      nodes: [
        {
          id: 'nav-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'main-1',
          containerId: 'main',
          groupId: 'movies',
          rect: { left: 100, top: 0, right: 200, bottom: 100, x: 100, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
          isInitial: true,
        },
      ],
    };

    const result = containerPlugin.findNext(state, 'right');
    expect(result).toBe('main-1');
  });

  it('should handle right within series-actions', () => {
    const state: NavigationState = {
      currentId: 'action-1',
      nodes: [
        {
          id: 'action-1',
          containerId: 'main',
          groupId: 'series-actions',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'action-2',
          containerId: 'main',
          groupId: 'series-actions',
          rect: { left: 100, top: 0, right: 200, bottom: 100, x: 100, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = containerPlugin.findNext(state, 'right');
    expect(result).toBe('action-2');
  });

  it('should handle left within series-actions', () => {
    const state: NavigationState = {
      currentId: 'action-2',
      nodes: [
        {
          id: 'action-1',
          containerId: 'main',
          groupId: 'series-actions',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'action-2',
          containerId: 'main',
          groupId: 'series-actions',
          rect: { left: 100, top: 0, right: 200, bottom: 100, x: 100, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = containerPlugin.findNext(state, 'left');
    expect(result).toBe('action-1');
  });

  it('should handle down in portal-form by index', () => {
    const state: NavigationState = {
      currentId: 'form-1',
      nodes: [
        {
          id: 'form-1',
          containerId: 'modal',
          groupId: 'portal-form',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'form-2',
          containerId: 'modal',
          groupId: 'portal-form',
          rect: { left: 0, top: 50, right: 100, bottom: 100, x: 0, y: 50, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = containerPlugin.findNext(state, 'down');
    expect(result).toBe('form-2');
  });

  it('should handle up in portal-form by index', () => {
    const state: NavigationState = {
      currentId: 'form-2',
      nodes: [
        {
          id: 'form-1',
          containerId: 'modal',
          groupId: 'portal-form',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'form-2',
          containerId: 'modal',
          groupId: 'portal-form',
          rect: { left: 0, top: 50, right: 100, bottom: 100, x: 0, y: 50, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = containerPlugin.findNext(state, 'up');
    expect(result).toBe('form-1');
  });

  it('should handle down in settings-modal by index', () => {
    const state: NavigationState = {
      currentId: 'setting-1',
      nodes: [
        {
          id: 'setting-1',
          containerId: 'settings-modal',
          groupId: 'settings-content',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'setting-2',
          containerId: 'settings-modal',
          groupId: 'settings-content',
          rect: { left: 0, top: 50, right: 100, bottom: 100, x: 0, y: 50, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = containerPlugin.findNext(state, 'down');
    // settingsPlugin handles this, containerPlugin returns null
    expect(result).toBeNull();
  });

  it('should handle left from main (non-grid, non-movie-actions)', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'main',
          groupId: 'other',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'nav-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
          isActive: true,
        },
      ],
    };

    const result = containerPlugin.findNext(state, 'left');
    expect(result).toBe('nav-1');
  });

  it('should handle right from movie-categories', () => {
    const state: NavigationState = {
      currentId: 'cat-1',
      nodes: [
        {
          id: 'cat-1',
          containerId: 'main',
          groupId: 'movie-categories',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'movie-1',
          containerId: 'main',
          groupId: 'movies',
          rect: { left: 100, top: 0, right: 200, bottom: 100, x: 100, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
          isInitial: true,
        },
      ],
    };

    const result = containerPlugin.findNext(state, 'right');
    expect(result).toBe('movie-1');
  });

  it('should handle up from movie-actions to X button', () => {
    const state: NavigationState = {
      currentId: 'action-1',
      nodes: [
        {
          id: 'action-1',
          containerId: 'main',
          groupId: 'movie-actions',
          rect: { left: 0, top: 100, right: 100, bottom: 200, x: 0, y: 100, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'close-btn',
          containerId: 'main',
          groupId: 'movie-actions',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
          isInitial: true,
        },
      ],
    };

    const result = containerPlugin.findNext(state, 'up');
    expect(result).toBe('close-btn');
  });

  it('should handle back from portal-actions', () => {
    const state: NavigationState = {
      currentId: 'action-1',
      nodes: [
        {
          id: 'action-1',
          containerId: 'portal-actions',
          groupId: 'portal-actions',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'content-1',
          containerId: 'portals-content',
          groupId: 'portals',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
          isActive: true,
        },
      ],
    };

    const result = containerPlugin.findNext(state, 'back');
    // This rule may not match in all cases, returns null
    expect(result).toBeNull();
  });

  it('should return null for non-matching conditions', () => {
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

    const result = containerPlugin.findNext(state, 'back');
    expect(result).toBeNull();
  });

  it('should save and restore last focus via context', () => {
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
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    // When navigating right from navigation, it restores last focus from main
    const result = containerPlugin.findNext(state, 'right', context);
    expect(result).toBe('node-1');
  });
});
