import { matchCondition, findTargetByConfig } from '../config';

describe('config', () => {
  describe('matchCondition', () => {
    it('should match container and group', () => {
      const condition = { container: 'main', group: 'movies' };
      const current = { containerId: 'main', groupId: 'movies' };
      expect(matchCondition(condition, current, 'right')).toBe(true);
    });

    it('should not match when container differs', () => {
      const condition = { container: 'main', group: 'movies' };
      const current = { containerId: 'sidebar', groupId: 'movies' };
      expect(matchCondition(condition, current, 'right')).toBe(false);
    });

    it('should not match when group differs', () => {
      const condition = { container: 'main', group: 'movies' };
      const current = { containerId: 'main', groupId: 'series' };
      expect(matchCondition(condition, current, 'right')).toBe(false);
    });

    it('should match container only', () => {
      const condition = { container: 'main' };
      const current = { containerId: 'main', groupId: 'movies' };
      expect(matchCondition(condition, current, 'right')).toBe(true);
    });

    it('should match group only', () => {
      const condition = { group: 'movies' };
      const current = { containerId: 'main', groupId: 'movies' };
      expect(matchCondition(condition, current, 'right')).toBe(true);
    });

    it('should match with direction', () => {
      const condition = { container: 'main', direction: 'right' as const };
      const current = { containerId: 'main' };
      expect(matchCondition(condition, current, 'right')).toBe(true);
    });

    it('should not match when direction differs', () => {
      const condition = { container: 'main', direction: 'right' as const };
      const current = { containerId: 'main' };
      expect(matchCondition(condition, current, 'left')).toBe(false);
    });

    it('should match with index', () => {
      const condition = { container: 'main', index: 0 };
      const current = { containerId: 'main', index: 0 };
      expect(matchCondition(condition, current, 'right')).toBe(true);
    });

    it('should not match when index differs', () => {
      const condition = { container: 'main', index: 0 };
      const current = { containerId: 'main', index: 1 };
      expect(matchCondition(condition, current, 'right')).toBe(false);
    });

    it('should match with last true', () => {
      const condition = { container: 'main', last: true };
      const current = { containerId: 'main' };
      expect(matchCondition(condition, current, 'right', true)).toBe(true);
    });

    it('should not match with last false when isLast is true', () => {
      const condition = { container: 'main', last: false };
      const current = { containerId: 'main' };
      expect(matchCondition(condition, current, 'right', true)).toBe(false);
    });

    it('should match isSearch', () => {
      const condition = { isSearch: true as const };
      const current = { isSearch: true };
      expect(matchCondition(condition, current, 'right')).toBe(true);
    });

    it('should not match isSearch when false', () => {
      const condition = { isSearch: true as const };
      const current = { isSearch: false };
      expect(matchCondition(condition, current, 'right')).toBe(false);
    });

    it('should match direction only', () => {
      const condition = { direction: 'right' as const };
      const current = {};
      expect(matchCondition(condition, current, 'right')).toBe(true);
    });

    it('should not match when no condition matches', () => {
      const condition = { container: 'main' };
      const current = { containerId: 'sidebar' };
      expect(matchCondition(condition, current, 'right')).toBe(false);
    });
  });

  describe('findTargetByConfig', () => {
    const state = {
      nodes: [
        { id: 'node-1', containerId: 'main', groupId: 'movies', isInitial: true, isActive: false, disabled: false },
        { id: 'node-2', containerId: 'main', groupId: 'movies', isInitial: false, isActive: true, disabled: false },
        { id: 'node-3', containerId: 'sidebar', groupId: 'nav', isInitial: false, isActive: false, disabled: false },
        { id: 'node-4', containerId: 'main', groupId: 'series', isInitial: false, isActive: false, disabled: false },
      ],
    };

    it('should find by container', () => {
      const target = { container: 'main' };
      expect(findTargetByConfig(state, target)).toBe('node-1');
    });

    it('should find by group', () => {
      const target = { group: 'movies' };
      expect(findTargetByConfig(state, target)).toBe('node-1');
    });

    it('should find by container and group', () => {
      const target = { container: 'main', group: 'movies' };
      expect(findTargetByConfig(state, target)).toBe('node-1');
    });

    it('should find initial element', () => {
      const target = { container: 'main', initial: true };
      expect(findTargetByConfig(state, target)).toBe('node-1');
    });

    it('should find active element', () => {
      const target = { container: 'main', active: true };
      expect(findTargetByConfig(state, target)).toBe('node-2');
    });

    it('should find last element', () => {
      const target = { container: 'main', last: true };
      expect(findTargetByConfig(state, target)).toBe('node-4');
    });

    it('should find first element', () => {
      const target = { container: 'main', first: true };
      expect(findTargetByConfig(state, target)).toBe('node-1');
    });

    it('should return null when no elements match', () => {
      const target = { container: 'nonexistent' };
      expect(findTargetByConfig(state, target)).toBeNull();
    });

    it('should return null when state has no nodes', () => {
      const emptyState = { nodes: [] };
      const target = { container: 'main' };
      expect(findTargetByConfig(emptyState, target)).toBeNull();
    });

    it('should skip disabled elements', () => {
      const stateWithDisabled = {
        nodes: [
          { id: 'node-1', containerId: 'main', groupId: 'movies', isInitial: true, isActive: false, disabled: true },
          { id: 'node-2', containerId: 'main', groupId: 'movies', isInitial: false, isActive: true, disabled: false },
        ],
      };
      const target = { container: 'main', active: true };
      expect(findTargetByConfig(stateWithDisabled, target)).toBe('node-2');
    });

    it('should return null when no active and no initial element', () => {
      const target = { container: 'sidebar', active: true };
      expect(findTargetByConfig(state, target)).toBeNull();
    });

    it('should return active element when it exists', () => {
      const target = { container: 'main', active: true };
      expect(findTargetByConfig(state, target)).toBe('node-2');
    });
  });
});
