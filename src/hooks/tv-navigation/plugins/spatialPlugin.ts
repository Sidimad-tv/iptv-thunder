// PLUGIN - Spatial Navigation
// Fallback geometric navigation based on distance and heuristics

import { NavigationState, Direction, NavigationPlugin, NavNode } from '../core/types';
import { getCenter, getDistance, isSameRow, isSameColumn, overlapsVertically, isInDirection, getRowKey } from '../utils/geometry';

export const spatialPlugin: NavigationPlugin = {
  name: 'spatial',
  findNext: (state: NavigationState, direction: Direction) => {
    if (direction === 'back') return null;
    const current = state.nodes.find(n => n.id === state.currentId);
    if (!current) {
      return null;
    }

    // Prevent navigation loops by tracking recent positions
    const recentPositions = state.lastPositionByAxis;
    if (recentPositions && direction === 'down') {
      // If we're going down and the current position is very close to where we just were,
      // we might be in a loop. Try to find a different target.
      // Only trigger if we've actually moved from the starting position (y > 0)
      const currentY = current.rect.top;
      const lastY = recentPositions.y;
      if (currentY > 0 && Math.abs(currentY - lastY) < 5) {
        return null;
      }
    }

    // Block DOWN on last episode of series-episodes
    if (direction === 'down' && current.groupId === 'series-episodes') {
      const episodes = state.nodes.filter(n => n.groupId === 'series-episodes' && !n.disabled);
      const sortedEpisodes = episodes.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const lastEpisode = sortedEpisodes.at(-1);
      if (current.id === lastEpisode?.id) {
        return null;
      }
    }

    // Phase 1: Search in same container only
    let best = findBestInContainer(current, state.nodes, direction, state, current.containerId);

    // Phase 2: If no result and current has container, search globally but penalize other containers
    // IMPORTANT: Don't leave modal containers (e.g., settings-modal, portal-actions)
    // IMPORTANT: Don't leave navigation container when in submenu (prevent exiting)
    const isModalContainer = (id: string) => id && id !== 'main' && id !== 'navigation';
    const isNavigationContainer = (id: string) => id === 'navigation';
    if (!best && current.containerId && !isModalContainer(current.containerId) && !isNavigationContainer(current.containerId)) {
      best = findBestGlobally(current, state.nodes, direction, state);
    } else if (!best && current.containerId && isModalContainer(current.containerId)) {
      return null;
    }

    return best?.id ?? null;
  },
};

function findBestInContainer(
  current: NavNode,
  nodes: NavNode[],
  direction: Direction,
  state: NavigationState,
  containerId?: string
): NavNode | null {
  let best: NavNode | null = null;
  let bestScore = Infinity;

  for (const node of nodes) {
    if (node.id === current.id || node.disabled) continue;
    if (containerId && node.containerId !== containerId) continue;
    if (!isInDirection(current.rect, node.rect, direction)) continue;

    const score = calculateScore(current, node, direction, state);
    if (score < bestScore) {
      bestScore = score;
      best = node;
    }
  }

  return best;
}

function findBestGlobally(
  current: NavNode,
  nodes: NavNode[],
  direction: Direction,
  state: NavigationState
): NavNode | null {
  let best: NavNode | null = null;
  let bestScore = Infinity;

  for (const node of nodes) {
    if (node.id === current.id || node.disabled) continue;
    if (!isInDirection(current.rect, node.rect, direction)) continue;

    let score = calculateScore(current, node, direction, state);
    // Penalty for different container
    if (node.containerId !== current.containerId) {
      score += 50000;
    }

    if (score < bestScore) {
      bestScore = score;
      best = node;
    }
  }

  return best;
}

function calculateScore(
  current: NavNode,
  target: NavNode,
  direction: Direction,
  state: NavigationState
): number {
  const { dx, dy } = getDistance(current.rect, target.rect);
  const targetCenter = getCenter(target.rect);

  const sameRow = isSameRow(current.rect, target.rect);
  const sameColumn = isSameColumn(current.rect, target.rect);
  const overlaps = overlapsVertically(current.rect, target.rect);
  const sameContainer = !!(current.containerId && target.containerId && current.containerId === target.containerId);
  const sameGroup = !!(current.groupId && target.groupId && current.groupId === target.groupId);

  let priority = calculateContainerPriority(sameContainer, sameGroup);
  priority = calculateAntiLoopPriority(direction, dy, priority);

  const { distance, additionalPriority } = calculateDirectionalScore(direction, {
    dx, dy, sameRow, sameColumn, overlaps, current, target,
    targetRect: target.rect, targetCenter, state,
  });

  return distance - (priority + additionalPriority);
}

function calculateContainerPriority(sameContainer: boolean, sameGroup: boolean): number {
  let priority = 0;
  if (sameContainer) {
    priority += 10000;
  }
  if (sameGroup) {
    priority += 20000;
  }
  return priority;
}

function calculateAntiLoopPriority(direction: Direction, dy: number, priority: number): number {
  if (direction === 'down' && dy < 0) {
    priority -= 50000;
  }
  if (direction === 'up' && dy > 0) {
    priority -= 50000;
  }
  return priority;
}

interface DirectionalContext {
  dx: number;
  dy: number;
  sameRow: boolean;
  sameColumn: boolean;
  overlaps: boolean;
  current: NavNode;
  target: NavNode;
  targetRect: DOMRect;
  targetCenter: { x: number; y: number };
  state: NavigationState;
}

function calculateDirectionalScore(
  direction: Direction,
  ctx: DirectionalContext
): { distance: number; additionalPriority: number } {
  switch (direction) {
    case 'right':
      return calculateRightScore(ctx);
    case 'left':
      return calculateLeftScore(ctx);
    case 'down':
      return calculateDownScore(ctx);
    case 'up':
      return calculateUpScore(ctx);
    default:
      return { distance: 0, additionalPriority: 0 };
  }
}

function calculateRightScore(ctx: DirectionalContext): { distance: number; additionalPriority: number } {
  let priority = 0;
  const distance = ctx.dx + Math.abs(ctx.dy) * 2;
  if (ctx.sameRow) priority += 1000;
  if (ctx.overlaps) priority += 500;
  return { distance, additionalPriority: priority };
}

function calculateLeftScore(ctx: DirectionalContext): { distance: number; additionalPriority: number } {
  let priority = 0;
  const distance = Math.abs(ctx.dx) + Math.abs(ctx.dy) * 2;
  if (ctx.sameRow) priority += 1000;
  if (ctx.overlaps) priority += 500;
  const yDistanceFromMemory = Math.abs(ctx.targetCenter.y - (ctx.state.lastPositionByAxis?.y ?? 0));
  priority -= yDistanceFromMemory * 50;
  return { distance, additionalPriority: priority };
}

function calculateDownScore(ctx: DirectionalContext): { distance: number; additionalPriority: number } {
  let priority = 0;
  const distance = ctx.dy + Math.abs(ctx.dx) * 5;
  if (ctx.sameColumn) priority += 5000;
  const xDistanceFromMemory = calculateXDistanceFromMemory(ctx.targetRect, ctx.targetCenter, ctx.state);
  priority -= xDistanceFromMemory * 20;
  if (ctx.current.groupId === 'series' && ctx.dy < 10) {
    priority -= 10000;
  }
  return { distance, additionalPriority: priority };
}

function calculateUpScore(ctx: DirectionalContext): { distance: number; additionalPriority: number } {
  let priority = 0;
  const distance = Math.abs(ctx.dy) + Math.abs(ctx.dx) * 5;
  if (ctx.sameColumn) priority += 3000;
  // Only use X memory if not in same group (prevents interference in sidebar navigation)
  const sameGroup = !!(ctx.current.groupId && ctx.target.groupId && ctx.current.groupId === ctx.target.groupId);
  if (!sameGroup) {
    const xDistanceFromMemory = calculateXDistanceFromMemory(ctx.targetRect, ctx.targetCenter, ctx.state);
    priority -= xDistanceFromMemory * 20;
  }
  if (ctx.current.groupId === 'series' && Math.abs(ctx.dy) < 10) {
    priority -= 10000;
  }
  return { distance, additionalPriority: priority };
}

function calculateXDistanceFromMemory(
  targetRect: DOMRect,
  targetCenter: { x: number; y: number },
  state: NavigationState
): number {
  const targetRow = getRowKey(targetRect);
  const rememberedX = state.lastXByRow?.get(targetRow) ?? state.lastPositionByAxis?.x ?? 0;
  return Math.abs(targetCenter.x - rememberedX);
}
