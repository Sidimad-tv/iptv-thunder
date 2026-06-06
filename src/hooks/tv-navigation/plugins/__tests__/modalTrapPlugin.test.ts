import { modalTrapPlugin } from '../modalTrapPlugin';
import { NavigationState } from '../../core/types';

describe('modalTrapPlugin', () => {
  it('should have correct name', () => {
    expect(modalTrapPlugin.name).toBe('modalTrap');
  });

  it('should return null when current node not found', () => {
    const state: NavigationState = {
      currentId: 'nonexistent',
      nodes: [],
    };

    const result = modalTrapPlugin.findNext(state, 'right');
    expect(result).toBeNull();
  });

  it('should return null for non-modal container', () => {
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

    const result = modalTrapPlugin.findNext(state, 'left');
    expect(result).toBeNull();
  });

  it('should return null when no dialog elements', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [],
    };

    const result = modalTrapPlugin.findNext(state, 'left');
    expect(result).toBeNull();
  });

  it('should return null when current not in dialog elements', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-2',
          containerId: 'resume-dialog',
          groupId: 'resume-options',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const result = modalTrapPlugin.findNext(state, 'left');
    expect(result).toBeNull();
  });

  it('should navigate left within modal', () => {
    const state: NavigationState = {
      currentId: 'node-2',
      nodes: [
        {
          id: 'node-1',
          containerId: 'resume-dialog',
          groupId: 'resume-options',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'node-2',
          containerId: 'resume-dialog',
          groupId: 'resume-options',
          rect: { left: 100, top: 0, right: 200, bottom: 100, x: 100, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = modalTrapPlugin.findNext(state, 'left');
    expect(result).toBe('node-1');
  });

  it('should navigate right within modal', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'resume-dialog',
          groupId: 'resume-options',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'node-2',
          containerId: 'resume-dialog',
          groupId: 'resume-options',
          rect: { left: 100, top: 0, right: 200, bottom: 100, x: 100, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = modalTrapPlugin.findNext(state, 'right');
    expect(result).toBe('node-2');
  });

  it('should stay on current for up direction', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'resume-dialog',
          groupId: 'resume-options',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const result = modalTrapPlugin.findNext(state, 'up');
    expect(result).toBe('node-1');
  });

  it('should stay on current for down direction', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'resume-dialog',
          groupId: 'resume-options',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const result = modalTrapPlugin.findNext(state, 'down');
    expect(result).toBe('node-1');
  });

  it('should stay on current for back direction', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'resume-dialog',
          groupId: 'resume-options',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const result = modalTrapPlugin.findNext(state, 'back');
    expect(result).toBe('node-1');
  });

  it('should return null when at left boundary and navigating left', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'resume-dialog',
          groupId: 'resume-options',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const result = modalTrapPlugin.findNext(state, 'left');
    expect(result).toBeNull();
  });

  it('should return null when at right boundary and navigating right', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'resume-dialog',
          groupId: 'resume-options',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const result = modalTrapPlugin.findNext(state, 'right');
    expect(result).toBeNull();
  });

  it('should skip disabled elements', () => {
    const state: NavigationState = {
      currentId: 'node-2',
      nodes: [
        {
          id: 'node-1',
          containerId: 'resume-dialog',
          groupId: 'resume-options',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: true,
          index: 0,
        },
        {
          id: 'node-2',
          containerId: 'resume-dialog',
          groupId: 'resume-options',
          rect: { left: 100, top: 0, right: 200, bottom: 100, x: 100, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = modalTrapPlugin.findNext(state, 'left');
    expect(result).toBeNull();
  });
});
