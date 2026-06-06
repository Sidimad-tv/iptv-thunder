// ADAPTER - DOM → Engine
// Converts DOM elements to NavigationState

import { NavigationState, GridData, NavNode } from '../core/types';

export function buildNavigationState(
  elements: HTMLElement[],
  currentId: string | null = null,
  lastXByRow?: Map<number, number>,
  lastPositionByAxis?: { x: number; y: number }
): NavigationState {
  
  // Filter out elements with data-tv-skip attribute (check for presence, not undefined)
  // Also filter out elements with tv-div-* IDs (wrapper elements from virtualization)
  const filteredElements = elements.filter(el => {
    const hasSkip = 'tvSkip' in el.dataset;
    const hasTvDivId = el.dataset.tvId?.startsWith('tv-div-') || el.id?.startsWith('tv-div-');
    return !hasSkip && !hasTvDivId;
  });
  
  // Generate IDs for all elements first to ensure consistency
  const nodes = filteredElements.map(el => {
    const groupId = (el.closest('[data-tv-group]') as HTMLElement | null)?.dataset.tvGroup;
    const containerId = (el.closest('[data-tv-container]') as HTMLElement | null)?.dataset.tvContainer;
    return {
      id: el.dataset.tvId || el.id || generateId(el),
      el,
      rect: el.getBoundingClientRect(),
      disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.dataset.tvDisabled !== undefined,
      containerId: containerId,
      groupId: groupId,
      index: el.dataset.tvIndex ? Number.parseInt(el.dataset.tvIndex) : undefined,
      isSearch: el.dataset.tvSearch !== undefined,
      isInitial: el.dataset.tvInitial !== undefined,
      isActive: el.dataset.tvActive === 'true',
    };
  });

  // Determine currentId: use provided, fallback to active element's generated ID
  let resolvedCurrentId = currentId;
  if (!resolvedCurrentId && document.activeElement) {
    const activeNode = nodes.find(n => n.el === document.activeElement);
    resolvedCurrentId = activeNode?.id ?? document.activeElement.id ?? null;
  }

  const nodesWithoutEl = nodes.map(({ el, ...node }) => node);

  return {
    currentId: resolvedCurrentId ?? null,
    nodes: nodesWithoutEl,
    lastXByRow: lastXByRow ?? new Map(),
    lastPositionByAxis: lastPositionByAxis ?? { x: 0, y: 0 },
    grid: computeGridData(nodesWithoutEl),
  };
}

function clusterNodesIntoRows(sortedNodes: NavNode[], threshold: number): NavNode[][] {
  const rowGroups: NavNode[][] = [];
  let currentRow: NavNode[] = [];

  for (const node of sortedNodes) {
    if (currentRow.length === 0) {
      currentRow.push(node);
    } else {
      const lastTop = currentRow.at(-1)!.rect.top;
      const topDiff = Math.abs(node.rect.top - lastTop);
      if (topDiff < threshold) {
        currentRow.push(node);
      } else {
        rowGroups.push(currentRow);
        currentRow = [node];
      }
    }
  }
  if (currentRow.length > 0) {
    rowGroups.push(currentRow);
  }

  return rowGroups;
}

function assignGridPositions(rowGroups: NavNode[][]): void {
  for (let rowIdx = 0; rowIdx < rowGroups.length; rowIdx++) {
    rowGroups[rowIdx].sort((a, b) => a.rect.left - b.rect.left);
    for (let colIdx = 0; colIdx < rowGroups[rowIdx].length; colIdx++) {
      rowGroups[rowIdx][colIdx].gridPosition = { row: rowIdx, col: colIdx };
    }
  }
}

function calculateColumnCount(rowGroups: NavNode[][]): number {
  let maxElementsInRow = 1;
  for (const elements of rowGroups) {
    maxElementsInRow = Math.max(maxElementsInRow, elements.length);
  }
  return Math.max(1, maxElementsInRow);
}

function buildIndexMap(groupNodes: NavNode[]): Map<number, NavNode> {
  const indexMap = new Map<number, NavNode>();
  for (const node of groupNodes) {
    if (node.index !== undefined) {
      indexMap.set(node.index, node);
    }
  }
  return indexMap;
}

// Carousel groups - horizontal single row navigation
const CAROUSEL_GROUPS = new Set(['for-you-live', 'for-you-movies', 'for-you-series']);

// Virtualized grid groups - use index-based grid calculation instead of position-based
const VIRTUALIZED_GRID_GROUPS = new Set(['favorite-series', 'favorite-movies', 'series', 'movies', 'favorite-channels', 'tv-channels']);

// Category grid groups - use index-based calculation with detected column count
const CATEGORY_GRID_GROUPS = new Set(['favorite-series-categories', 'favorite-movie-categories', 'series-categories', 'movie-categories', 'favorite-categories', 'categories']);

function buildCarouselRows(groupNodes: NavNode[]): NavNode[][] {
  const sortedByIndex = [...groupNodes].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return [sortedByIndex];
}

function buildVirtualizedGridRows(groupNodes: NavNode[]): NavNode[][] {
  const sortedByIndex = [...groupNodes].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  // Detect actual column count from DOM positions (similar to category grids)
  const uniqueLefts = new Set(sortedByIndex.map(n => Math.round(n.rect.left)));
  const columnCount = Math.max(1, uniqueLefts.size);
  const rowGroups: NavNode[][] = [];
  for (let i = 0; i < sortedByIndex.length; i += columnCount) {
    rowGroups.push(sortedByIndex.slice(i, i + columnCount));
  }
  return rowGroups;
}

function buildCategoryGridRows(groupNodes: NavNode[]): NavNode[][] {
  const sortedByIndex = [...groupNodes].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  // Category grids use position-based clustering to detect rows
  // This handles variable category sizes better than fixed column counting
  const ROW_THRESHOLD = 20;
  return clusterNodesIntoRows(sortedByIndex, ROW_THRESHOLD);
}

function buildPositionBasedRows(groupNodes: NavNode[], threshold: number): NavNode[][] {
  const sortedNodes = [...groupNodes].sort((a, b) => a.rect.top - b.rect.top);
  const uniqueTops = new Set(sortedNodes.map(n => Math.round(n.rect.top)));
  const isVerticalList = uniqueTops.size === 1 && sortedNodes.length > 1;

  if (isVerticalList) {
    return sortedNodes.map(node => [node]);
  }
  return clusterNodesIntoRows(sortedNodes, threshold);
}

function getRowGroupsForGroup(groupId: string, groupNodes: NavNode[], threshold: number): NavNode[][] {
  if (CAROUSEL_GROUPS.has(groupId)) {
    return buildCarouselRows(groupNodes);
  }
  if (VIRTUALIZED_GRID_GROUPS.has(groupId)) {
    return buildVirtualizedGridRows(groupNodes);
  }
  if (CATEGORY_GRID_GROUPS.has(groupId)) {
    return buildCategoryGridRows(groupNodes);
  }
  return buildPositionBasedRows(groupNodes, threshold);
}

function copyGridPositionsToOriginalNodes(rowGroups: NavNode[][], groupNodes: NavNode[]): void {
  for (const row of rowGroups) {
    for (const node of row) {
      const originalNode = groupNodes.find(n => n.id === node.id);
      if (originalNode && node.gridPosition) {
        originalNode.gridPosition = node.gridPosition;
      }
    }
  }
}

function computeGridData(nodes: NavNode[]): Map<string, GridData> {
  const gridMap = new Map<string, GridData>();
  const ROW_THRESHOLD = 20;

  const groupKeys = new Set<string>();
  for (const node of nodes) {
    if (node.groupId && node.containerId && node.index !== undefined) {
      groupKeys.add(`${node.groupId}|${node.containerId}`);
    }
  }

  for (const groupKey of groupKeys) {
    const [groupId, containerId] = groupKey.split('|');
    
    const groupNodes = nodes.filter(n =>
      n.index !== undefined &&
      n.groupId === groupId &&
      n.containerId === containerId
    );

    if (groupNodes.length === 0) continue;

    const rowGroups = getRowGroupsForGroup(groupId, groupNodes, ROW_THRESHOLD);
    assignGridPositions(rowGroups);
    copyGridPositionsToOriginalNodes(rowGroups, groupNodes);
    const columnCount = calculateColumnCount(rowGroups);
    const indexMap = buildIndexMap(groupNodes);

    gridMap.set(groupKey, {
      rows: rowGroups,
      columnCount,
      indexMap,
    });
  }

  return gridMap;
}

const idCache = new WeakMap<HTMLElement, string>();

function generateId(el: HTMLElement): string {
  if (!idCache.has(el)) {
    idCache.set(el, `tv-${Math.random().toString(36).substring(2, 11)}`);
  }
  return idCache.get(el)!;
}

export function findElementById(elements: HTMLElement[], id: string): HTMLElement | undefined {
  return elements.find(el => {
    const elId = el.dataset.tvId || el.id || idCache.get(el);
    return elId === id;
  });
}

export { isVisible } from '../utils/visibility';
export { filterVisibleElements } from '../utils/visibility';
