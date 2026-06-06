import { trapFocusPlugin } from '../trapFocusPlugin';
import { NavigationState, Direction } from '../../core/types';

describe('trapFocusPlugin', () => {
  it('should have correct name', () => {
    expect(trapFocusPlugin.name).toBe('trapFocus');
  });

  describe('handlePortalActionsNavigation', () => {
    it('should return null for non-portal-actions group', () => {
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

      const result = trapFocusPlugin.findNext(state, 'up');
      expect(result).toBeNull();
    });

    it('should return null for non-up/down directions', () => {
      const state: NavigationState = {
        currentId: 'node-1',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'portal-actions',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
        ],
      };

      const directions: Direction[] = ['left', 'right', 'back'];
      directions.forEach(direction => {
        const result = trapFocusPlugin.findNext(state, direction);
        expect(result).toBeNull();
      });
    });

    it('should navigate up within portal-actions', () => {
      const state: NavigationState = {
        currentId: 'node-2',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'portal-actions',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
          {
            id: 'node-2',
            containerId: 'main',
            groupId: 'portal-actions',
            rect: { left: 0, top: 100, right: 100, bottom: 200, x: 0, y: 100, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 1,
          },
        ],
      };

      const result = trapFocusPlugin.findNext(state, 'up');
      expect(result).toBe('node-1');
    });

    it('should navigate down within portal-actions', () => {
      const state: NavigationState = {
        currentId: 'node-1',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'portal-actions',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
          {
            id: 'node-2',
            containerId: 'main',
            groupId: 'portal-actions',
            rect: { left: 0, top: 100, right: 100, bottom: 200, x: 0, y: 100, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 1,
          },
        ],
      };

      const result = trapFocusPlugin.findNext(state, 'down');
      expect(result).toBe('node-2');
    });

    it('should stay on current when at top and navigating up', () => {
      const state: NavigationState = {
        currentId: 'node-1',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'portal-actions',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
        ],
      };

      const result = trapFocusPlugin.findNext(state, 'up');
      expect(result).toBe('node-1');
    });

    it('should stay on current when at bottom and navigating down', () => {
      const state: NavigationState = {
        currentId: 'node-1',
        nodes: [
          {
            id: 'node-1',
            containerId: 'main',
            groupId: 'portal-actions',
            rect: { left: 0, top: 0, right: 100, bottom: 100, x: 0, y: 0, width: 100, height: 100, toJSON: () => ({}) },
            disabled: false,
            index: 0,
          },
        ],
      };

      const result = trapFocusPlugin.findNext(state, 'down');
      expect(result).toBe('node-1');
    });
  });

  describe('handleResumeDialogNavigation', () => {
    it('should return null for non-resume-dialog container', () => {
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

      const result = trapFocusPlugin.findNext(state, 'left');
      expect(result).toBeNull();
    });

    it('should navigate left within resume-dialog', () => {
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

      const result = trapFocusPlugin.findNext(state, 'left');
      expect(result).toBe('node-1');
    });

    it('should navigate right within resume-dialog', () => {
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

      const result = trapFocusPlugin.findNext(state, 'right');
      expect(result).toBe('node-2');
    });

    it('should stay on current for up/down in resume-dialog', () => {
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

      const resultUp = trapFocusPlugin.findNext(state, 'up');
      const resultDown = trapFocusPlugin.findNext(state, 'down');
      expect(resultUp).toBe('node-1');
      expect(resultDown).toBe('node-1');
    });

    it('should return null for back direction in resume-dialog', () => {
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

      const result = trapFocusPlugin.findNext(state, 'back');
      expect(result).toBeNull();
    });
  });

  it('should return null when current node not found', () => {
    const state: NavigationState = {
      currentId: 'nonexistent',
      nodes: [],
    };

    const result = trapFocusPlugin.findNext(state, 'right');
    expect(result).toBeNull();
  });
});
