// PLUGIN - Container Navigation
// Handles container switching and last focus restore
// NOTE: All state lives in PluginContext.container (instance-scoped, NOT global)

import { NavigationState, Direction, NavigationPlugin, PluginContext } from '../core/types';
import { GRID_GROUPS } from './gridPlugin';

type Handler = (state: NavigationState, current: NavigationState['nodes'][0]) => string | null;

interface Rule {
  match: (direction: Direction, current: NavigationState['nodes'][0], state: NavigationState) => boolean;
  handler: Handler;
  log: string;
}

const rules: Rule[] = [
  { match: (d, c, _) => d === 'down' && !!c.isSearch, handler: findMainInitial, log: 'down from search' },
  { match: (d, c, _) => d === 'left' && !!c.isSearch, handler: findNavigationActive, log: 'left from search' },
  { match: (d, c, _) => d === 'right' && c.containerId === 'navigation', handler: findMainInitial, log: 'right from navigation' },
  // SeriesDetails navigation - LEFT/RIGHT within series-actions (PRIORITY before left from main)
  { match: (d, c, _) => d === 'right' && c.groupId === 'series-actions', handler: findNextInSeriesActions, log: 'right within series-actions' },
  { match: (d, c, _) => d === 'left' && c.groupId === 'series-actions', handler: findPrevInSeriesActions, log: 'left within series-actions' },
  // PortalForm navigation - sequential by index (ONLY when in modal container)
  { match: (d, c, _) => d === 'down' && c.groupId === 'portal-form' && c.containerId === 'modal', handler: findNextByIndex, log: 'down from portal-form by index' },
  { match: (d, c, _) => d === 'up' && c.groupId === 'portal-form' && c.containerId === 'modal', handler: findPrevByIndex, log: 'up from portal-form by index' },
  { match: (d, c, _) => d === 'right' && c.groupId === 'portal-form' && c.containerId === 'modal', handler: findNextByIndex, log: 'right from portal-form by index' },
  { match: (d, c, _) => d === 'left' && c.groupId === 'portal-form' && c.containerId === 'modal', handler: findPrevByIndex, log: 'left from portal-form by index' },
  // Settings modal navigation - sequential by index
  { match: (d, c, _) => d === 'down' && c.containerId === 'settings-modal', handler: findNextByIndex, log: 'down from settings-modal by index' },
  { match: (d, c, _) => d === 'up' && c.containerId === 'settings-modal', handler: findPrevByIndex, log: 'up from settings-modal by index' },
  { match: (d, c, _) => d === 'right' && c.containerId === 'settings-modal', handler: findNextByIndex, log: 'right from settings-modal by index' },
  { match: (d, c, _) => d === 'left' && c.containerId === 'settings-modal', handler: findPrevByIndex, log: 'left from settings-modal by index' },
  // Settings modal specific groups
  { match: (d, c, _) => d === 'down' && c.groupId === 'settings-header', handler: findNextByIndex, log: 'down from settings-header' },
  { match: (d, c, _) => d === 'down' && c.groupId === 'settings-tabs', handler: findNextByIndex, log: 'down from settings-tabs' },
  { match: (d, c, _) => d === 'down' && c.groupId === 'settings-content', handler: findNextByIndex, log: 'down from settings-content' },
  { match: (d, c, _) => d === 'up' && c.groupId === 'settings-content', handler: findPrevByIndex, log: 'up from settings-content' },
  { match: (d, c, _) => d === 'up' && c.groupId === 'settings-tabs', handler: findPrevByIndex, log: 'up from settings-tabs' },
  // General navigation rules
  { match: (d, c, _) => d === 'left' && c.containerId === 'main' && !GRID_GROUPS.has(c.groupId || '') && c.groupId !== 'movie-actions', handler: findNavigationActive, log: 'left from main (non-grid, non-movie-actions)' },
  { match: (d, c, _) => d === 'right' && c.groupId === 'movie-categories', handler: findGridInitial, log: 'right from movie-categories to first movie' },
  { match: (d, c, _) => d === 'right' && c.groupId === 'series-categories', handler: findGridInitial, log: 'right from series-categories to first series' },
  { match: (d, c, _) => d === 'up' && c.groupId === 'movie-actions' && !c.isInitial, handler: findMovieActionsInitial, log: 'up from movie-actions to X' },
  { match: (d, c, _) => d === 'back' && c.groupId === 'portal-actions', handler: findPortalsContentActive, log: 'back from portal-actions' },
  // From back button, go to poster (below), otherwise go to season selector
  { match: (d, c, _) => d === 'down' && c.id === 'series-back-btn', handler: findSeriesPosterFromBackBtn, log: 'down from back-btn to poster' },
  { match: (d, c, _) => d === 'down' && c.groupId === 'series-actions', handler: findSeriesControlsFromAnyAction, log: 'down from other series-actions' },
  { match: (d, c, _) => d === 'up' && c.groupId === 'series-controls', handler: findSeriesActionsLast, log: 'up from series-controls to last action' },
  { match: (d, c, _) => d === 'down' && c.groupId === 'series-controls', handler: findSeriesEpisodesInitial, log: 'down from series-controls' },
  { match: (d, c, _) => d === 'up' && c.groupId === 'series-episodes' && c.index === 0, handler: findSeriesControlsOrActions, log: 'up from first episode' },
];

function getTargetContainer(
  state: NavigationState,
  current: NavigationState['nodes'][0],
  direction: Direction,
  context?: PluginContext
): { targetId: string | null; newContainerId: string | null } {
  for (const rule of rules) {
    const matched = rule.match(direction, current, state);
    if (matched) {
      const targetId = rule.handler(state, current);
      if (targetId) {
        const targetNode = state.nodes.find(n => n.id === targetId);
        return { targetId, newContainerId: targetNode?.containerId ?? null };
      }
    }
  }

  if (context && (direction === 'left' || direction === 'right' || direction === 'up' || direction === 'down')) {
    // Auto-container switching will be handled by spatial plugin result
  }

  return { targetId: null, newContainerId: null };
}

// Restore last focus when entering a container (via context)
function restoreLastFocus(context: PluginContext | undefined, containerId: string, state: NavigationState): string | null {
  const lastElementId = context?.container.lastFocusedByContainer.get(containerId);
  if (!lastElementId) return null;

  const element = state.nodes.find(n => n.id === lastElementId);
  if (element && !element.disabled) {
    return element.id;
  }
  return null;
}

// Save focus for a container (via context)
function saveContainerFocus(context: PluginContext | undefined, containerId: string | undefined, elementId: string): void {
  if (containerId && context) {
    context.container.lastFocusedByContainer.set(containerId, elementId);
  }
}

// Get last focused element ID for a container (via context)
function getLastFocus(context: PluginContext | undefined, containerId: string): string | null {
  return context?.container.lastFocusedByContainer.get(containerId) ?? null;
}

// Get active container ID (via context)
function getActiveContainerId(context: PluginContext | undefined): string | null {
  return context?.container.activeContainerId ?? null;
}

// Set active container ID (via context)
function setActiveContainerId(context: PluginContext | undefined, containerId: string | null): void {
  if (context) {
    context.container.activeContainerId = containerId;
  }
}

export const containerPlugin: NavigationPlugin = {
  name: 'container',
  findNext: (state: NavigationState, direction: Direction, context?: PluginContext) => {
    const current = state.nodes.find(n => n.id === state.currentId);
    if (!current) {
      return null;
    }

    // Single source of truth for all container navigation
    const { targetId, newContainerId } = getTargetContainer(state, current, direction, context);
    if (targetId) {
      // Only save current focus when actually navigating away
      if (targetId !== current.id) {
        saveContainerFocus(context, current.containerId, current.id);
      }

      // Update active container if changed
      const activeId = getActiveContainerId(context);
      if (newContainerId && newContainerId !== activeId) {
        setActiveContainerId(context, newContainerId);
        // Try to restore last focus in new container, but only if group HAS changed
        // AND target is not a carousel group (for-you-*)
        const targetNode = state.nodes.find(n => n.id === targetId);
        const isCarouselGroup = targetNode?.groupId?.startsWith('for-you-');
        if (targetNode?.groupId !== current.groupId && !isCarouselGroup) {
          const restoredId = restoreLastFocus(context, newContainerId, state);
          if (restoredId && restoredId !== targetId) {
            return restoredId;
          }
        }
      }
      return targetId;
    }

    return null;
  },
  onContainerChange: (container: HTMLElement | null, context: PluginContext) => {
    const newContainerId = container?.id ?? null;
    const activeId = getActiveContainerId(context);
    if (newContainerId !== activeId) {
      setActiveContainerId(context, newContainerId);
    }
  },
};

// Export container management API for use by hook (context-aware versions)
export { getActiveContainerId, setActiveContainerId, saveContainerFocus, getLastFocus, restoreLastFocus };

function findMainInitial(state: NavigationState): string | null {
  // Check which nav item is active and route to appropriate content
  const navElements = state.nodes.filter(n => n.containerId === 'navigation');
  const activeNavItem = navElements.find(n => n.isActive);
  const activeNavId = activeNavItem?.id;

  // Check if current element is in navigation container but not in navbar - navigate to main content
  const current = state.nodes.find(n => n.id === state.currentId);
  const isInNavigationNotNavbar = current?.containerId === 'navigation' && current?.groupId !== 'navbar';
  
  if (isInNavigationNotNavbar) {
    const mainElements = state.nodes.filter(n => n.containerId === 'main' && !n.isSearch);
    if (mainElements.length > 0) {
      return mainElements[0].id;
    }
  }

  // If current element is in navbar and is one of the main nav items, navigate to main content
  const isNavbarMainItem = current?.groupId === 'navbar' && (current?.id === 'tv' || current?.id === 'movies' || current?.id === 'series');
  if (isNavbarMainItem) {
    const mainElements = state.nodes.filter(n => n.containerId === 'main' && !n.isSearch);
    if (mainElements.length > 0) {
      return mainElements[0].id;
    }
  }

  // Route to appropriate content based on active nav item
  if (activeNavId === 'portals') {
    const portalsContent = state.nodes.filter(n => n.groupId === 'portals-content');
    if (portalsContent.length > 0) {
      return portalsContent.find(n => n.isInitial)?.id ?? portalsContent[0]?.id ?? null;
    }
    // If portals content not loaded yet, don't fall back to other content
    return null;
  }

  if (activeNavId === 'for-you') {
    // For-you carousel groups
    const forYouLiveElements = state.nodes.filter(n => n.containerId === 'for-you-live');
    if (forYouLiveElements.length > 0) {
      return forYouLiveElements[0].id;
    }
  }

  if (activeNavId === 'tv') {
    const tvCategories = state.nodes.filter(n => n.containerId === 'main' && (n.groupId === 'categories' || n.groupId === 'favorite-categories'));
    if (tvCategories.length > 0) {
      return tvCategories[0].id;
    }
  }

  if (activeNavId === 'movies') {
    const movieCategories = state.nodes.filter(n => n.containerId === 'main' && (n.groupId === 'movie-categories' || n.groupId === 'favorite-movie-categories'));
    if (movieCategories.length > 0) {
      return movieCategories[0].id;
    }
  }

  if (activeNavId === 'series') {
    const seriesCategories = state.nodes.filter(n => n.containerId === 'main' && (n.groupId === 'series-categories' || n.groupId === 'favorite-series-categories'));
    if (seriesCategories.length > 0) {
      return seriesCategories[0].id;
    }
  }

  const mainElements = state.nodes.filter(n => n.containerId === 'main');
  // Check for carousel groups (for-you-*) in main container
  const carouselElements = mainElements.filter(n => n.groupId?.startsWith('for-you-'));
  if (carouselElements.length > 0) {
    // Return first carousel element ID instead of groupId
    return carouselElements[0].id;
  }
  // Carousel groups have containerId = groupId, search them separately
  const forYouLiveElements = state.nodes.filter(n => n.containerId === 'for-you-live');
  if (forYouLiveElements.length > 0) {
    return forYouLiveElements[0].id;
  }
  const forYouMoviesElements = state.nodes.filter(n => n.containerId === 'for-you-movies');
  if (forYouMoviesElements.length > 0) {
    return forYouMoviesElements[0].id;
  }
  const forYouSeriesElements = state.nodes.filter(n => n.containerId === 'for-you-series');
  if (forYouSeriesElements.length > 0) {
    return forYouSeriesElements[0].id;
  }
  // Look for initial element first
  const initialElement = mainElements.find(n => n.isInitial);
  if (initialElement) return initialElement.id;
  // Look for movie elements first (skip search input)
  const movieElement = mainElements.find(n => n.groupId === 'movies' || n.groupId === 'favorite-movies');
  if (movieElement) return movieElement.id;
  // Look for series elements
  const seriesElement = mainElements.find(n => n.groupId === 'series' || n.groupId === 'favorite-series');
  if (seriesElement) return seriesElement.id;
  // Fallback: skip search elements
  const nonSearchElement = mainElements.find(n => !n.isSearch);
  // IMPORTANT: If current is search and no main elements found, return current.id to stay on search
  // This prevents spatial plugin from searching globally and finding sidebar
  if (current?.isSearch && !nonSearchElement) {
    return current.id;
  }
  return nonSearchElement?.id ?? null;
}

function findNavigationActive(state: NavigationState): string | null {
  const navElements = state.nodes.filter(n => n.containerId === 'navigation');
  const activeElement = navElements.find(n => n.isActive);
  const result = activeElement?.id ?? navElements[0]?.id ?? null;
  return result;
}

function findPortalsContentActive(state: NavigationState): string | null {
  const contentElements = state.nodes.filter(n => n.groupId === 'portals-content');
  const activeElement = contentElements.find(n => n.isActive);
  return activeElement?.id ?? contentElements.find(n => n.isInitial)?.id ?? null;
}

function findMovieActionsInitial(state: NavigationState): string | null {
  const movieActionsElements = state.nodes.filter(n => n.groupId === 'movie-actions');
  const initialElement = movieActionsElements.find(n => n.isInitial);
  return initialElement?.id ?? null;
}

function findGridInitial(state: NavigationState): string | null {
  // Find the first grid element in main container
  const gridElements = state.nodes.filter(n => 
    n.containerId === 'main' && 
    GRID_GROUPS.has(n.groupId || '') &&
    n.groupId !== 'movie-categories' && 
    n.groupId !== 'series-categories' &&
    n.groupId !== 'favorite-movie-categories' && 
    n.groupId !== 'favorite-series-categories'
  );
  const initialElement = gridElements.find(n => n.isInitial);
  return initialElement?.id ?? gridElements[0]?.id ?? null;
}

function findNextByIndex(state: NavigationState, current: NavigationState['nodes'][0]): string | null {
  const groupNodes = state.nodes
    .filter(n => n.groupId === 'portal-form' && !n.disabled)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const currentIndex = groupNodes.findIndex(n => n.id === current.id);
  if (currentIndex === -1 || currentIndex === groupNodes.length - 1) {
    return null; // At the end, let spatial plugin handle it
  }
  return groupNodes[currentIndex + 1].id;
}

function findPrevByIndex(state: NavigationState, current: NavigationState['nodes'][0]): string | null {
  const groupNodes = state.nodes
    .filter(n => n.groupId === 'portal-form' && !n.disabled)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const currentIndex = groupNodes.findIndex(n => n.id === current.id);
  if (currentIndex <= 0) {
    return null; // At the beginning, let spatial plugin handle it
  }
  return groupNodes[currentIndex - 1].id;
}

// SeriesDetails navigation helpers
function findSeriesEpisodesInitial(state: NavigationState): string | null {
  const episodes = state.nodes.filter(n => n.groupId === 'series-episodes' && !n.disabled);
  return episodes.find(n => n.index === 0)?.id ?? episodes[0]?.id ?? null;
}

function findSeriesControlsOrActions(state: NavigationState): string | null {
  // First try to find season selector
  const controlsElements = state.nodes.filter(n => n.groupId === 'series-controls' && !n.disabled);
  if (controlsElements.length > 0) {
    return controlsElements[0]?.id ?? null;
  }
  // Fallback to actions
  const actionsElements = state.nodes.filter(n => n.groupId === 'series-actions' && !n.disabled);
  return actionsElements.find(n => n.isInitial)?.id ?? actionsElements[0]?.id ?? null;
}


function getSeriesActionsElements(state: NavigationState) {
  return state.nodes
    .filter(n => n.groupId === 'series-actions' && !n.disabled)
    .sort((a, b) => {
      // Sort by Y first (row), then by X (column within row)
      const yDiff = a.rect.top - b.rect.top;
      if (Math.abs(yDiff) > 20) return yDiff; // Different rows
      return a.rect.left - b.rect.left; // Same row, sort by X
    });
}

function findNextInSeriesActions(state: NavigationState, current: NavigationState['nodes'][0]): string | null {
  const elements = getSeriesActionsElements(state);
  const currentIndex = elements.findIndex(n => n.id === current.id);
  if (currentIndex === -1 || currentIndex >= elements.length - 1) {
    return null; // At the end, let spatial plugin handle it or stay
  }
  const result = elements[currentIndex + 1]?.id ?? null;
  return result;
}

function findPrevInSeriesActions(state: NavigationState, current: NavigationState['nodes'][0]): string | null {
  const elements = getSeriesActionsElements(state);
  const currentIndex = elements.findIndex(n => n.id === current.id);
  if (currentIndex <= 0) {
    return null; // At the start, let spatial plugin handle it or stay
  }
  return elements[currentIndex - 1]?.id ?? null;
}

function findSeriesActionsLast(state: NavigationState): string | null {
  const elements = getSeriesActionsElements(state);
  return elements.at(-1)?.id ?? null;
}

function findSeriesPosterFromBackBtn(state: NavigationState): string | null {
  // From back button, go to poster (below in the layout)
  const poster = state.nodes.find(n => n.id === 'series-poster' && !n.disabled);
  if (poster) {
    return poster.id;
  }
  // Fallback to other actions
  const playFirst = state.nodes.find(n => n.id === 'series-play-first' && !n.disabled);
  if (playFirst) {
    return playFirst.id;
  }
  // Fallback to season selector
  const controlsElement = state.nodes.find(n => n.groupId === 'series-controls' && !n.disabled);
  return controlsElement?.id ?? null;
}

function findSeriesControlsFromAnyAction(state: NavigationState): string | null {
  // From any series-actions element, DOWN goes to season selector (series-controls)
  const controlsElement = state.nodes.find(n => n.groupId === 'series-controls' && !n.disabled);
  return controlsElement?.id ?? null;
}

