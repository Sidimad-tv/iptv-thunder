// CONFIG TYPES - Configuration-based navigation rules
// Makes the engine reusable, app-agnostic, and publishable

import { Direction } from './types';

export type NavigationTarget =
  | { container: string; initial?: boolean }
  | { container: string; active?: boolean }
  | { group: string; initial?: boolean }
  | { group: string; active?: boolean }
  | { group: string; last?: boolean }
  | { group: string; first?: boolean };

export type NavigationCondition =
  | { container: string; group?: never; direction?: Direction; index?: number; last?: boolean }
  | { container: string; group: string; direction?: Direction; index?: number; last?: boolean }
  | { group: string; container?: never; direction?: Direction; index?: number; last?: boolean }
  | { isSearch: true; direction?: Direction }
  | { direction: Direction; container?: never; group?: never };

export interface NavigationRule {
  when: NavigationCondition;
  goTo: NavigationTarget;
}

export interface NavigationConfig {
  rules: NavigationRule[];
}

function matchesOptionalFields(
  condition: { direction?: Direction; index?: number; last?: boolean },
  currentIndex: number | undefined,
  direction: Direction,
  isLast: boolean | undefined
): boolean {
  if (condition.direction !== undefined && condition.direction !== direction) return false;
  if (condition.index !== undefined && currentIndex !== condition.index) return false;
  if (condition.last !== undefined && condition.last !== isLast) return false;
  return true;
}

export function matchCondition(
  condition: NavigationCondition,
  current: { containerId?: string; groupId?: string; isSearch?: boolean; index?: number },
  direction: Direction,
  isLast?: boolean
): boolean {
  if ('container' in condition && 'group' in condition) {
    const cond = condition as { container: string; group: string; direction?: Direction; index?: number; last?: boolean };
    return (
      cond.container === current.containerId &&
      cond.group === current.groupId &&
      matchesOptionalFields(cond, current.index, direction, isLast)
    );
  }

  if ('container' in condition && typeof condition.container === 'string') {
    return (
      condition.container === current.containerId &&
      matchesOptionalFields(condition, current.index, direction, isLast)
    );
  }

  if ('group' in condition && typeof condition.group === 'string') {
    return (
      condition.group === current.groupId &&
      matchesOptionalFields(condition, current.index, direction, isLast)
    );
  }

  if ('isSearch' in condition) {
    return current.isSearch === true && (!condition.direction || condition.direction === direction);
  }

  if ('direction' in condition) {
    return condition.direction === direction;
  }

  return false;
}

export function findTargetByConfig(
  state: { nodes: Array<{ id: string; containerId?: string; groupId?: string; isInitial?: boolean; isActive?: boolean; disabled?: boolean }> },
  target: NavigationTarget
): string | null {
  let elements = state.nodes;

  if ('container' in target) {
    elements = elements.filter(n => n.containerId === target.container);
  }

  if ('group' in target) {
    elements = elements.filter(n => n.groupId === target.group);
  }

  if ('initial' in target && target.initial) {
    const initial = elements.find(n => n.isInitial);
    return initial?.id ?? elements[0]?.id ?? null;
  }

  if ('active' in target && target.active) {
    const active = elements.find(n => n.isActive);
    return active?.id ?? elements.find(n => n.isInitial)?.id ?? null;
  }

  if ('last' in target && target.last) {
    return elements.at(-1)?.id ?? null;
  }

  if ('first' in target && target.first) {
    return elements[0]?.id ?? null;
  }

  return elements[0]?.id ?? null;
}
