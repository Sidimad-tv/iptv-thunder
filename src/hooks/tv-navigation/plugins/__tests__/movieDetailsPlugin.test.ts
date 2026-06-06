import { movieDetailsPlugin } from '../movieDetailsPlugin';
import { NavigationState } from '../../core/types';

describe('movieDetailsPlugin', () => {
  it('should have correct name', () => {
    expect(movieDetailsPlugin.name).toBe('movieDetails');
  });

  it('should return null when current node not found', () => {
    const state: NavigationState = {
      currentId: 'nonexistent',
      nodes: [],
    };

    const result = movieDetailsPlugin.findNext(state, 'back');
    expect(result).toBeNull();
  });

  it('should handle back from movie-actions', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'main',
          groupId: 'movie-actions',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const result = movieDetailsPlugin.findNext(state, 'back');
    expect(result).toBeNull(); // Returns null because it emits BACK action
  });

  it('should handle left from movie-actions when leftmost', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'main',
          groupId: 'movie-actions',
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

    const result = movieDetailsPlugin.findNext(state, 'left');
    expect(result).toBe('nav-1');
  });

  it('should defer to spatial when not leftmost in movie-actions', () => {
    const state: NavigationState = {
      currentId: 'node-2',
      nodes: [
        {
          id: 'node-1',
          containerId: 'main',
          groupId: 'movie-actions',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
        {
          id: 'node-2',
          containerId: 'main',
          groupId: 'movie-actions',
          rect: { left: 100, top: 0, right: 200, bottom: 100, x: 100, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 1,
        },
      ],
    };

    const result = movieDetailsPlugin.findNext(state, 'left');
    expect(result).toBeNull(); // Defer to spatial plugin
  });

  it('should handle resume dialog close button left', () => {
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
          flags: { isResumeDialog: true, isCloseButton: true },
        },
      ],
    };

    const result = movieDetailsPlugin.findNext(state, 'left');
    expect(result).toBeNull(); // Blocks left navigation
  });

  it('should handle resume dialog action button right', () => {
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
          flags: { isResumeDialog: true, isActionButton: true },
        },
      ],
    };

    const result = movieDetailsPlugin.findNext(state, 'right');
    expect(result).toBeNull(); // Blocks right navigation
  });

  it('should defer back from resume dialog button', () => {
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
          flags: { isResumeDialog: true },
        },
      ],
    };

    const result = movieDetailsPlugin.findNext(state, 'back');
    expect(result).toBeNull(); // Defer to resume dialog close
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

    const result = movieDetailsPlugin.findNext(state, 'right');
    expect(result).toBeNull();
  });

  it('should return null for up/down directions', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'main',
          groupId: 'movie-actions',
          rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
          disabled: false,
          index: 0,
        },
      ],
    };

    const upResult = movieDetailsPlugin.findNext(state, 'up');
    const downResult = movieDetailsPlugin.findNext(state, 'down');
    expect(upResult).toBeNull();
    expect(downResult).toBeNull();
  });

  it('should find navigation active element', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'main',
          groupId: 'movie-actions',
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

    const result = movieDetailsPlugin.findNext(state, 'left');
    expect(result).toBe('nav-1');
  });

  it('should return first navigation element if no active', () => {
    const state: NavigationState = {
      currentId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          containerId: 'main',
          groupId: 'movie-actions',
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
        },
      ],
    };

    const result = movieDetailsPlugin.findNext(state, 'left');
    expect(result).toBe('nav-1');
  });

  it('should identify resume dialog by containerType', () => {
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
          containerType: 'modal',
        },
      ],
    };

    const result = movieDetailsPlugin.findNext(state, 'back');
    expect(result).toBeNull(); // Defer to resume dialog close
  });
});
