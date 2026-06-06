import { settingsPlugin } from '../settingsPlugin';
import { NavigationState } from '../../core/types';

describe('settingsPlugin', () => {
  it('should have correct name', () => {
    expect(settingsPlugin.name).toBe('settings');
  });

  it('should return null when current node not found', () => {
    const state: NavigationState = {
      currentId: 'nonexistent',
      nodes: [],
    };

    const result = settingsPlugin.findNext(state, 'right');
    expect(result).toBeNull();
  });

  it('should return null for non-settings container', () => {
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

    const result = settingsPlugin.findNext(state, 'right');
    expect(result).toBeNull();
  });

  it('should navigate up within settings tabs', () => {
    const state: NavigationState = {
      currentId: 'tab-2',
      nodes: [
        {
          id: 'tab-1',
          containerId: 'settings-modal',
          groupId: 'settings-tabs',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'tab-2',
          containerId: 'settings-modal',
          groupId: 'settings-tabs',
          rect: { left: 0, top: 50, right: 100, bottom: 100, x: 0, y: 50, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = settingsPlugin.findNext(state, 'up');
    expect(result).toBe('tab-1');
  });

  it('should navigate down within settings tabs', () => {
    const state: NavigationState = {
      currentId: 'tab-1',
      nodes: [
        {
          id: 'tab-1',
          containerId: 'settings-modal',
          groupId: 'settings-tabs',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'tab-2',
          containerId: 'settings-modal',
          groupId: 'settings-tabs',
          rect: { left: 0, top: 50, right: 100, bottom: 100, x: 0, y: 50, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = settingsPlugin.findNext(state, 'down');
    expect(result).toBe('tab-2');
  });

  it('should return null at first tab when navigating up', () => {
    const state: NavigationState = {
      currentId: 'tab-1',
      nodes: [
        {
          id: 'tab-1',
          containerId: 'settings-modal',
          groupId: 'settings-tabs',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const result = settingsPlugin.findNext(state, 'up');
    expect(result).toBeNull();
  });

  it('should return null at last tab when navigating down', () => {
    const state: NavigationState = {
      currentId: 'tab-1',
      nodes: [
        {
          id: 'tab-1',
          containerId: 'settings-modal',
          groupId: 'settings-tabs',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const result = settingsPlugin.findNext(state, 'down');
    expect(result).toBeNull();
  });

  it('should navigate down within settings content', () => {
    const state: NavigationState = {
      currentId: 'content-1',
      nodes: [
        {
          id: 'content-1',
          containerId: 'settings-modal',
          groupId: 'settings-content',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'content-2',
          containerId: 'settings-modal',
          groupId: 'settings-content',
          rect: { left: 0, top: 50, right: 100, bottom: 100, x: 0, y: 50, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = settingsPlugin.findNext(state, 'down');
    expect(result).toBe('content-2');
  });

  it('should navigate up within settings content', () => {
    const state: NavigationState = {
      currentId: 'content-2',
      nodes: [
        {
          id: 'content-1',
          containerId: 'settings-modal',
          groupId: 'settings-content',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'content-2',
          containerId: 'settings-modal',
          groupId: 'settings-content',
          rect: { left: 0, top: 50, right: 100, bottom: 100, x: 0, y: 50, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = settingsPlugin.findNext(state, 'up');
    expect(result).toBe('content-1');
  });

  it('should return null for non-up/down directions in tabs', () => {
    const state: NavigationState = {
      currentId: 'tab-1',
      nodes: [
        {
          id: 'tab-1',
          containerId: 'settings-modal',
          groupId: 'settings-tabs',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const leftResult = settingsPlugin.findNext(state, 'left');
    const rightResult = settingsPlugin.findNext(state, 'right');
    expect(leftResult).toBeNull();
    expect(rightResult).toBeNull();
  });

  it('should return null for non-up/down directions in content', () => {
    const state: NavigationState = {
      currentId: 'content-1',
      nodes: [
        {
          id: 'content-1',
          containerId: 'settings-modal',
          groupId: 'settings-content',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const leftResult = settingsPlugin.findNext(state, 'left');
    const rightResult = settingsPlugin.findNext(state, 'right');
    expect(leftResult).toBeNull();
    expect(rightResult).toBeNull();
  });

  it('should skip disabled elements in tabs', () => {
    const state: NavigationState = {
      currentId: 'tab-2',
      nodes: [
        {
          id: 'tab-1',
          containerId: 'settings-modal',
          groupId: 'settings-tabs',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: true,
          index: 0,
        },
        {
          id: 'tab-2',
          containerId: 'settings-modal',
          groupId: 'settings-tabs',
          rect: { left: 0, top: 50, right: 100, bottom: 100, x: 0, y: 50, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = settingsPlugin.findNext(state, 'up');
    expect(result).toBeNull();
  });

  it('should skip disabled elements in content', () => {
    const state: NavigationState = {
      currentId: 'content-2',
      nodes: [
        {
          id: 'content-1',
          containerId: 'settings-modal',
          groupId: 'settings-content',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: true,
          index: 0,
        },
        {
          id: 'content-2',
          containerId: 'settings-modal',
          groupId: 'settings-content',
          rect: { left: 0, top: 50, right: 100, bottom: 100, x: 0, y: 50, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = settingsPlugin.findNext(state, 'up');
    expect(result).toBeNull();
  });

  it('should handle settings-modal container', () => {
    const state: NavigationState = {
      currentId: 'tab-1',
      nodes: [
        {
          id: 'tab-1',
          containerId: 'settings-modal',
          groupId: 'settings-tabs',
          rect: { left: 0, top: 0, right: 100, bottom: 50, x: 0, y: 0, width: 100, height: 50, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const result = settingsPlugin.findNext(state, 'down');
    expect(result).toBeNull();
  });
});
