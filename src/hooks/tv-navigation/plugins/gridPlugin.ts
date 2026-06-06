// PLUGIN - Grid Navigation
// Handles index-based grid navigation

import { NavigationState, Direction, NavigationPlugin, GridData } from '../core/types';

const lastCategoryFocus = new Map<string, string>();

// Cache for filtered nodes to avoid repeated O(n) operations
const nodesCache = new Map<string, any[]>();

type NavigationTarget = { id: string; disabled?: boolean } | string | null;

export const GRID_GROUPS = new Set([
  'categories', 'favorite-categories', 'favorite-channels',
  'tv-categories', 'tv-channels',
  'movie-categories', 'favorite-movie-categories', 'favorite-movies', 'movies',
  'series-categories', 'favorite-series-categories', 'favorite-series', 'series',
  'portals-content', 'portal-actions',
  // ForYou carousel groups - horizontal grid navigation
  'for-you-live', 'for-you-movies', 'for-you-series',
  // Episodes grid - vertical list navigation
  'series-episodes',
  // Category cards grid
  'category-cards',
]);

export const gridPlugin: NavigationPlugin = {
  name: 'grid',
  findNext: (state: NavigationState, direction: Direction) => {
    const current = state.nodes.find(n => n.id === state.currentId);
    if (!current) {
      return null;
    }

    // Check if we should use grid navigation
    if (!shouldUseGridNavigation(current)) {
      return null;
    }

    const node = { ...current, index: current.index! };
    return findGridNext(node, state, direction);
  },
};

function shouldUseGridNavigation(
  current: { index?: number; groupId?: string; containerId?: string }
): boolean {
  if (current.index === undefined) {
    return false;
  }
  if (!current.groupId) {
    return false;
  }
  return GRID_GROUPS.has(current.groupId);
}

const CAROUSEL_ORDER = ['for-you-live', 'for-you-movies', 'for-you-series'] as const;

function getCarouselGroupNodes(
  state: NavigationState,
  groupId: string,
) {
  const cacheKey = `carousel-${groupId}`;
  const cached = nodesCache.get(cacheKey);
  if (cached) return cached;

  const filtered = state.nodes.filter(
    n => n.groupId === groupId && !n.disabled
  );
  nodesCache.set(cacheKey, filtered);
  return filtered;
}

function getCarouselGroupIndex(groupId: string | undefined): number {
  return CAROUSEL_ORDER.indexOf(groupId as any);
}

function hasCarouselNext(currentGroupIndex: number): boolean {
  return currentGroupIndex >= 0 && currentGroupIndex < CAROUSEL_ORDER.length - 1;
}

function navigateToNextCarouselGroup(
  state: NavigationState,
  currentGroupIndex: number,
  col: number
): string | null {
  const nextGroupId = CAROUSEL_ORDER[currentGroupIndex + 1];
  const nextGroupNodes = getCarouselGroupNodes(state, nextGroupId);
  const targetCol = Math.min(col, nextGroupNodes.length - 1);
  const nextGroupTarget = nextGroupNodes[targetCol] ?? nextGroupNodes[0];
  return nextGroupTarget?.id ?? null;
}

function navigateCarouselDown(
  state: NavigationState,
  currentGroupId: string | undefined,
  col: number,
  currentId: string | undefined
): string | null {
  const currentGroupIndex = getCarouselGroupIndex(currentGroupId);
  if (currentGroupIndex < 0) return null;

  if (hasCarouselNext(currentGroupIndex)) {
    return navigateToNextCarouselGroup(state, currentGroupIndex, col);
  }

  return currentId ?? null;
}

function hasCarouselPrev(currentGroupIndex: number): boolean {
  return currentGroupIndex > 0;
}

function navigateToPrevCarouselGroup(
  state: NavigationState,
  currentGroupIndex: number,
  col: number
): string | null {
  const prevGroupId = CAROUSEL_ORDER[currentGroupIndex - 1];
  const prevGroupNodes = getCarouselGroupNodes(state, prevGroupId);
  const targetCol = Math.min(col, prevGroupNodes.length - 1);
  const prevGroupTarget = prevGroupNodes[targetCol] ?? prevGroupNodes[0];
  return prevGroupTarget?.id ?? null;
}

function navigateCarouselUp(
  state: NavigationState,
  currentGroupId: string | undefined,
  col: number
): string | null {
  const currentGroupIndex = getCarouselGroupIndex(currentGroupId);
  if (currentGroupIndex < 0) return null;

  if (hasCarouselPrev(currentGroupIndex)) {
    return navigateToPrevCarouselGroup(state, currentGroupIndex, col);
  }

  return getSearchNode(state);
}

function getSearchNode(state: NavigationState): string | null {
  const searchNode = state.nodes.find(n => n.isSearch);
  return searchNode && !searchNode.disabled ? searchNode.id : null;
}

function getActiveSidebarElement(state: NavigationState): string | null {
  const activeSidebarElement = state.nodes.find(
    n => n.containerId === 'navigation' && n.isActive && !n.disabled && !n.isSearch
  );
  if (activeSidebarElement) return activeSidebarElement.id;

  const sidebarElement = state.nodes.find(
    n => n.containerId === 'navigation' && !n.disabled && !n.isSearch
  );
  return sidebarElement?.id ?? null;
}

function tryNavigateToNextRow(grid: any, row: number, col: number): NavigationTarget {
  const nextRow = grid.rows[row + 1];
  if (!nextRow) return null;

  const targetCol = Math.min(col, nextRow.length - 1);
  return nextRow[targetCol];
}

function shouldTryCategoriesAtTop(row: number): boolean {
  return row === 0;
}

function isSeriesEpisodesBottom(currentGroupId: string | undefined, row: number, grid: any): boolean {
  return currentGroupId === 'series-episodes' && row === grid.rows.length - 1;
}

function navigateDown(
  grid: any,
  row: number,
  col: number,
  state: NavigationState,
  currentGroupId: string | undefined,
  currentId: string | undefined
): NavigationTarget {
  const carouselResult = navigateCarouselDown(state, currentGroupId, col, currentId);
  if (carouselResult !== null) return carouselResult;

  const nextRowTarget = tryNavigateToNextRow(grid, row, col);
  if (nextRowTarget) return nextRowTarget;

  if (shouldTryCategoriesAtTop(row)) {
    const categoriesNode = getCategoryListElement(state, currentGroupId);
    if (categoriesNode) return categoriesNode;
  }

  if (isSeriesEpisodesBottom(currentGroupId, row, grid)) {
    return null;
  }

  return null;
}

function getGroupMapping(): Record<string, string> {
  return {
    'movie-categories': 'movie-categories',
    'favorite-movie-categories': 'favorite-movie-categories',
    'series-categories': 'series-categories',
    'favorite-series-categories': 'favorite-series-categories',
    categories: 'categories',
    'favorite-categories': 'favorite-categories',
    'favorite-channels': 'favorite-channels',
    movies: 'movie-categories',
    'favorite-movies': 'favorite-movies',
    series: 'series-categories',
    'favorite-series': 'favorite-series',
    'tv-categories': 'categories',
    'tv-channels': 'favorite-channels',
    'category-cards': 'categories',
  };
}

function getParentGroupMapping(): Record<string, string> {
  return {
    'movie-categories': 'movies',
    'favorite-movie-categories': 'movies',
    'series-categories': 'series',
    'favorite-series-categories': 'series',
    categories: 'tv',
    'favorite-categories': 'tv',
    'favorite-channels': 'tv',
  };
}

function getStoredFocusNode(state: NavigationState, currentGroupId: string): string | null {
  const stored = lastCategoryFocus.get(currentGroupId);
  if (!stored) return null;

  const storedNode = state.nodes.find((n) => n.id === stored && !n.disabled);
  return storedNode?.id ?? null;
}

function findTargetNodeByGroup(
  state: NavigationState,
  targetGroup: string,
  currentGroupId: string
): string | null {
  const navNodes = state.nodes.filter((n) => n.containerId === 'navigation' && !n.disabled);
  const targetNode = navNodes.find((n) => n.groupId === targetGroup);

  if (targetNode) {
    lastCategoryFocus.set(currentGroupId, targetNode.id);
    return targetNode.id;
  }

  return null;
}

function findParentNode(state: NavigationState, targetGroup: string): string | null {
  const parentGroup = getParentGroupMapping()[targetGroup];
  if (!parentGroup) return null;

  const navNodes = state.nodes.filter((n) => n.containerId === 'navigation' && !n.disabled);
  const parentNode = navNodes.find((n) => n.groupId === parentGroup);

  return parentNode?.id ?? null;
}

function getCategoryListElement(state: NavigationState, currentGroupId?: string | undefined): string | null {
  const map = getGroupMapping();
  const targetGroup = currentGroupId ? map[currentGroupId] : undefined;
  if (!targetGroup) {
    return getActiveSidebarElement(state);
  }

  const storedNode = getStoredFocusNode(state, currentGroupId || '');
  if (storedNode) {
    return storedNode;
  }

  const targetNode = findTargetNodeByGroup(state, targetGroup, currentGroupId || '');
  if (targetNode) {
    return targetNode;
  }

  const parentNode = findParentNode(state, targetGroup);
  if (parentNode) {
    return parentNode;
  }

  return getActiveSidebarElement(state);
}

function isLogicalFirstRow(currentIndex: number | undefined, columnCount: number): boolean {
  return currentIndex !== undefined && currentIndex < columnCount;
}

function shouldNavigateToSearch(
  searchNode: string | null,
  isLogicalFirstRow: boolean,
  isVisualTopRow: boolean
): boolean {
  return !!searchNode && (isLogicalFirstRow || isVisualTopRow);
}

function tryNavigateToPreviousRow(grid: GridData, row: number, col: number): NavigationTarget {
  const prevRow = grid.rows[row - 1];
  if (!prevRow) return null;

  const targetCol = Math.min(col, prevRow.length - 1);
  return prevRow[targetCol];
}

function navigateUp(
  grid: GridData,
  row: number,
  col: number,
  state: NavigationState,
  currentNode: { groupId?: string; containerId?: string; rect: DOMRect },
  currentIndex?: number
): NavigationTarget {
  const currentGroupId = currentNode.groupId;
  const carouselResult = navigateCarouselUp(state, currentGroupId, col);
  if (carouselResult !== null) return carouselResult;

  const searchNode = getSearchNode(state);
  const logicalFirstRow = isLogicalFirstRow(currentIndex, grid.columnCount);
  const visualTopRow = isInVisualTopRow(state, currentNode);

  if (shouldNavigateToSearch(searchNode, logicalFirstRow, visualTopRow)) {
    return searchNode;
  }

  if (row === 0) return searchNode;

  return tryNavigateToPreviousRow(grid, row, col);
}

function tryNavigateToLeftInRow(grid: any, row: number, col: number): NavigationTarget {
  const currentRow = grid.rows[row];
  if (currentRow && col - 1 >= 0) {
    return currentRow[col - 1];
  }
  return null;
}

function isInCarouselGroup(groupId: string | undefined): boolean {
  return CAROUSEL_ORDER.indexOf(groupId as any) >= 0;
}

function tryNavigateToPreviousInCarousel(
  state: NavigationState,
  currentGroupId: string | undefined,
  currentId: string | undefined
): NavigationTarget {
  const cacheKey = `carousel-prev-${currentGroupId}`;
  const cached = nodesCache.get(cacheKey);
  const groupElements = cached || state.nodes.filter(n => n.groupId === currentGroupId && !n.disabled);
  if (!cached) nodesCache.set(cacheKey, groupElements);

  const currentIndex = groupElements.findIndex(n => n.id === currentId);
  if (currentIndex > 0) {
    return groupElements[currentIndex - 1].id;
  }
  return null;
}

function navigateLeft(
  grid: any,
  row: number,
  col: number,
  state: NavigationState,
  currentGroupId: string | undefined,
  currentId: string | undefined
): NavigationTarget {
  const leftInRow = tryNavigateToLeftInRow(grid, row, col);
  if (leftInRow) return leftInRow;

  if (col !== 0) return null;

  if (isInCarouselGroup(currentGroupId)) {
    const carouselPrev = tryNavigateToPreviousInCarousel(state, currentGroupId, currentId);
    if (carouselPrev) return carouselPrev;
  }

  return getActiveSidebarElement(state);
}

function getDirectionOffset(direction: 'prev' | 'next'): number {
  return direction === 'prev' ? -1 : 1;
}

function tryGetAdjacentByIndex(
  grid: GridData,
  currentIndex: number,
  offset: number
) {
  const candidate = grid.indexMap?.get(currentIndex + offset);
  if (candidate && !candidate.disabled) {
    return candidate;
  }
  return null;
}

function shouldIncludeNode(
  node: { index?: number; groupId?: string; containerId?: string; disabled?: boolean },
  targetIndex: number,
  direction: 'prev' | 'next',
  currentGroupId?: string,
  currentContainerId?: string
): boolean {
  const hasValidIndex = node.index !== undefined;
  const isEnabled = !node.disabled;
  const matchesGroup = node.groupId === currentGroupId;
  const matchesContainer = node.containerId === currentContainerId;
  const isCorrectDirection = hasValidIndex && (direction === 'prev' ? node.index! < targetIndex : node.index! > targetIndex);

  return hasValidIndex && isEnabled && matchesGroup && matchesContainer && isCorrectDirection;
}

function sortNodesByDirection(nodes: any[], direction: 'prev' | 'next'): any[] {
  if (direction === 'prev') {
    return nodes.sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
  }
  return nodes.sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER));
}

function findAdjacentNodeInGroup(
  state: NavigationState,
  current: { index?: number; groupId?: string; containerId?: string },
  grid: GridData,
  direction: 'prev' | 'next'
) {
  if (current.index === undefined) return null;

  const offset = getDirectionOffset(direction);
  const adjacentByIndex = tryGetAdjacentByIndex(grid, current.index, offset);
  if (adjacentByIndex) {
    return adjacentByIndex;
  }

  const targetIndex = current.index;
  const cacheKey = `adjacent-${current.groupId}-${current.containerId}-${direction}-${targetIndex}`;
  const cached = nodesCache.get(cacheKey);
  const filteredNodes = cached || state.nodes.filter((n) =>
    shouldIncludeNode(n, targetIndex, direction, current.groupId, current.containerId)
  );
  if (!cached) nodesCache.set(cacheKey, filteredNodes);
  const sortedNodes = sortNodesByDirection(filteredNodes, direction);

  return sortedNodes.at(0) ?? null;
}

function findNextNodeInGroup(
  state: NavigationState,
  current: { index?: number; groupId?: string; containerId?: string },
  grid: GridData
) {
  return findAdjacentNodeInGroup(state, current, grid, 'next');
}

function isInVisualTopRow(
  state: NavigationState,
  current: { groupId?: string; containerId?: string; rect: DOMRect }
): boolean {
  const THRESHOLD = 4; // px tolerance for same-row detection (reduced from 16 to prevent row skipping)
  const cacheKey = `visual-top-${current.groupId}-${current.containerId}`;
  const cached = nodesCache.get(cacheKey);
  const groupNodes = cached || state.nodes.filter((n) =>
    n.groupId === current.groupId &&
    n.containerId === current.containerId &&
    n.rect !== undefined
  );
  if (!cached) nodesCache.set(cacheKey, groupNodes);

  if (groupNodes.length === 0) return false;

  const minTop = Math.min(...groupNodes.map((n) => n.rect.top));
  return current.rect.top - minTop <= THRESHOLD;
}

function extractTargetId(target: NavigationTarget): string | null {
  if (typeof target === 'string') return target;
  return target?.id ?? null;
}

function tryNavigateRightInRow(grid: GridData, row: number, col: number): string | null {
  const currentRow = grid.rows[row];
  if (!currentRow || col + 1 >= currentRow.length) return null;

  const rightTarget = currentRow[col + 1];
  return extractTargetId(rightTarget);
}

function getFallbackRightNode(
  state: NavigationState,
  current: { index?: number; id?: string },
  grid: GridData
): string | null {
  if (current.index === undefined) return null;

  const fallbackNode = findNextNodeInGroup(state, current, grid);
  return fallbackNode?.id ?? null;
}

function handleRightNavigation(
  grid: GridData,
  row: number,
  col: number,
  current: { index?: number; id?: string },
  state: NavigationState
): string | null {
  const rightInRow = tryNavigateRightInRow(grid, row, col);
  if (rightInRow) return rightInRow;

  // Block right navigation when at the last element in a row
  const currentRow = grid.rows[row];
  if (currentRow && col === currentRow.length - 1) {
    return current.id ?? null;
  }

  const fallbackNode = getFallbackRightNode(state, current, grid);
  if (fallbackNode) return fallbackNode;

  return current.id ?? null;
}

function shouldTryPreviousRowNode(
  grid: GridData,
  row: number,
  current: { index?: number }
): boolean {
  const currentRowLength = grid.rows[row]?.length;
  return currentRowLength === 1 && current.index !== undefined && current.index > 0;
}

function getPreviousRowNode(
  grid: GridData,
  current: { index?: number }
): string | null {
  const prevNode = grid.indexMap?.get(current.index! - 1);
  if (prevNode && !prevNode.disabled) {
    return prevNode.id;
  }
  return null;
}

function getFallbackNavigationTarget(
  state: NavigationState,
  current: { groupId?: string; id?: string }
): string | null {
  const categoriesNode = getCategoryListElement(state, current.groupId);
  if (categoriesNode) {
    return categoriesNode;
  }
  const sidebar = getActiveSidebarElement(state);
  return sidebar ?? current.id ?? null;
}

function handleLeftNavigationAtColumnZero(
  grid: GridData,
  row: number,
  current: { index?: number; groupId?: string; id?: string },
  state: NavigationState
): string | null {
  if (shouldTryPreviousRowNode(grid, row, current)) {
    const prevNode = getPreviousRowNode(grid, current);
    if (prevNode) {
      return prevNode;
    }
  }

  return getFallbackNavigationTarget(state, current);
}

function handleLeftNavigation(
  grid: GridData,
  row: number,
  col: number,
  current: { index?: number; groupId?: string; id?: string },
  state: NavigationState
): string | null {
  if (col === 0) {
    return handleLeftNavigationAtColumnZero(grid, row, current, state);
  }

  const targetNode = navigateLeft(grid, row, col, state, current.groupId, current.id);
  return extractTargetId(targetNode);
}

function shouldSkipGridNavigation(current: { containerId?: string }): boolean {
  return current.containerId === 'navigation';
}

function getGridData(
  state: NavigationState,
  current: { groupId?: string; containerId?: string; gridPosition?: { row: number; col: number } }
): { grid: GridData; row: number; col: number } | null {
  const gridKey = `${current.groupId}|${current.containerId}`;
  const grid = state.grid?.get(gridKey);
  if (!grid || !current.gridPosition) {
    return null;
  }
  const { row, col } = current.gridPosition;
  return { grid, row, col };
}

function navigateByDirection(
  grid: GridData,
  row: number,
  col: number,
  state: NavigationState,
  current: { index: number; rect: DOMRect; id?: string; containerId?: string; groupId?: string },
  direction: Direction
): NavigationTarget {
  switch (direction) {
    case 'down':
      return navigateDown(grid, row, col, state, current.groupId, current.id);
    case 'up':
      return navigateUp(grid, row, col, state, current, current.index);
    case 'right':
      return handleRightNavigation(grid, row, col, current, state);
    case 'left':
      return handleLeftNavigation(grid, row, col, current, state);
    default:
      return null;
  }
}

function findGridNext(
  current: { index: number; rect: DOMRect; id?: string; containerId?: string; groupId?: string; gridPosition?: { row: number; col: number } },
  state: NavigationState,
  direction: Direction
): string | null {
  if (shouldSkipGridNavigation(current)) {
    return null;
  }

  const gridData = getGridData(state, current);
  if (!gridData) {
    return null;
  }

  const { grid, row, col } = gridData;
  const targetNode = navigateByDirection(grid, row, col, state, current, direction);

  return extractTargetId(targetNode);
}
