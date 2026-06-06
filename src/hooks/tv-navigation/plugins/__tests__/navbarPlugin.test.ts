import { navbarPlugin } from '../navbarPlugin';
import { NavigationState } from '../../core/types';

describe('navbarPlugin', () => {
  it('should have correct name', () => {
    expect(navbarPlugin.name).toBe('navbar');
  });

  it('should return null when current node not found', () => {
    const state: NavigationState = {
      currentId: 'nonexistent',
      nodes: [],
    };

    const result = navbarPlugin.findNext(state, 'right');
    expect(result).toBeNull();
  });

  it('should return null for non-navigation container', () => {
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
      ],
    };

    const result = navbarPlugin.findNext(state, 'right');
    expect(result).toBeNull();
  });

  it('should navigate up within navbar', () => {
    const state: NavigationState = {
      currentId: 'node-2',
      nodes: [
        {
          id: 'node-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'node-2',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 50, right: 100, bottom: 100, x: 0, y: 50, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = navbarPlugin.findNext(state, 'up');
    expect(result).toBe('node-1');
  });

  it('should navigate down within navbar', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'node-2',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 50, right: 100, bottom: 100, x: 0, y: 50, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = navbarPlugin.findNext(state, 'down');
    expect(result).toBe('node-2');
  });

  it('should stay on current at top when navigating up', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const result = navbarPlugin.findNext(state, 'up');
    expect(result).toBe('node-1');
  });

  it('should stay on current at bottom when navigating down', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const result = navbarPlugin.findNext(state, 'down');
    expect(result).toBe('node-1');
  });

  it('should navigate to exit button from last navbar element', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'close-app',
          containerId: 'navigation',
          groupId: 'exit',
          rect: { left: 0, top: 100, right: 100, bottom: 150, x: 0, y: 100, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = navbarPlugin.findNext(state, 'down');
    expect(result).toBe('close-app');
  });

  it('should navigate from exit button to last navbar element', () => {
    const state: NavigationState = {
      currentId: 'close-app',
      nodes: [
        {
          id: 'node-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'close-app',
          containerId: 'navigation',
          groupId: 'exit',
          rect: { left: 0, top: 100, right: 100, bottom: 150, x: 0, y: 100, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = navbarPlugin.findNext(state, 'up');
    expect(result).toBe('node-1');
  });

  it('should return null for left/right directions', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const leftResult = navbarPlugin.findNext(state, 'left');
    const rightResult = navbarPlugin.findNext(state, 'right');
    expect(leftResult).toBeNull();
    expect(rightResult).toBeNull();
  });

  it('should skip disabled navbar elements', () => {
    const state: NavigationState = {
      currentId: 'node-2',
      nodes: [
        {
          id: 'node-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: true,
          index: 0,
        },
        {
          id: 'node-2',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 50, right: 100, bottom: 100, x: 0, y: 50, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = navbarPlugin.findNext(state, 'up');
    expect(result).toBe('node-2'); // Stay on current since prev is disabled
  });

  it('should navigate down to submenu', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'submenu-1',
          containerId: 'navigation',
          groupId: 'submenu',
          rect: { left: 0, top: 60, right: 100, bottom: 110, x: 0, y: 60, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = navbarPlugin.findNext(state, 'down');
    expect(result).toBe('submenu-1');
  });

  it('should navigate up from submenu to navbar', () => {
    const state: NavigationState = {
      currentId: 'submenu-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'submenu-1',
          containerId: 'navigation',
          groupId: 'submenu',
          rect: { left: 0, top: 60, right: 100, bottom: 110, x: 0, y: 60, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = navbarPlugin.findNext(state, 'up');
    expect(result).toBe('node-1');
  });

  it('should navigate within submenu down', () => {
    const state: NavigationState = {
      currentId: 'submenu-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'submenu-1',
          containerId: 'navigation',
          groupId: 'submenu',
          rect: { left: 0, top: 60, right: 100, bottom: 110, x: 0, y: 60, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
        {
          id: 'submenu-2',
          containerId: 'navigation',
          groupId: 'submenu',
          rect: { left: 0, top: 120, right: 100, bottom: 170, x: 0, y: 120, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 2,
        },
      ],
    };

    const result = navbarPlugin.findNext(state, 'down');
    expect(result).toBe('submenu-2');
  });

  it('should navigate within submenu up', () => {
    const state: NavigationState = {
      currentId: 'submenu-2',
      nodes: [
        {
          id: 'node-1',
          containerId: 'navigation',
          groupId: 'navbar',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'submenu-1',
          containerId: 'navigation',
          groupId: 'submenu',
          rect: { left: 0, top: 60, right: 100, bottom: 110, x: 0, y: 60, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
        {
          id: 'submenu-2',
          containerId: 'navigation',
          groupId: 'submenu',
          rect: { left: 0, top: 120, right: 100, bottom: 170, x: 0, y: 120, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 2,
        },
      ],
    };

    const result = navbarPlugin.findNext(state, 'up');
    expect(result).toBe('submenu-1');
  });
});
