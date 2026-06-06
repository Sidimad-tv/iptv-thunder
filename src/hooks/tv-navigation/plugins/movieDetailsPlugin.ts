// PLUGIN - Movie Details Navigation
// Handles navigation within movie details view and resume dialog

import { NavigationState, Direction, NavigationPlugin, PluginContext, RuleResult } from '../core/types';

type Handler = (state: NavigationState, current: NavigationState['nodes'][0]) => RuleResult;

interface Rule {
  match: (direction: Direction, current: NavigationState['nodes'][0]) => boolean;
  handler: Handler;
  log: string;
}

const rules: Rule[] = [
  // Close button (X) - handle back navigation
  { match: (d, c) => d === 'back' && c.groupId === 'movie-actions', handler: handleCloseBack, log: 'back from movie-actions' },

  // Left from leftmost movie-actions button to navigation
  { match: (d, c) => d === 'left' && c.groupId === 'movie-actions', handler: handleLeftFromMovieActions, log: 'left from movie-actions' },

  // Up from movie-actions to close button (X)
  { match: (d, c) => d === 'up' && c.groupId === 'movie-actions', handler: handleUpToCloseButton, log: 'up from movie-actions to close' },

  // Up from series-actions to back button (X)
  { match: (d, c) => d === 'up' && c.groupId === 'series-actions', handler: handleUpToSeriesBackButton, log: 'up from series-actions to back' },

  // Down from series-actions to episodes (or dropdown if open)
  { match: (d, c) => d === 'down' && c.groupId === 'series-actions', handler: handleDownToEpisodes, log: 'down from series-actions' },
  
  // Down from series-controls (season selector) to dropdown or episodes
  { match: (d, c) => d === 'down' && c.groupId === 'series-controls', handler: handleDownFromControls, log: 'down from series-controls' },

  // Season dropdown navigation
  { match: (d, c) => d === 'down' && c.groupId === 'seasons', handler: handleSeasonDown, log: 'down within seasons' },
  { match: (d, c) => d === 'up' && c.groupId === 'seasons', handler: handleSeasonUp, log: 'up within seasons' },

  // Resume dialog navigation
  { match: (d, c) => d === 'back' && isResumeDialogButton(c), handler: () => ({ handled: false, reason: 'resume-dialog-back-defer' }), log: 'back handled by resume dialog close' },
  { match: (d, c) => d === 'left' && isResumeDialogButton(c) && isResumeCloseButton(c), handler: () => ({ handled: true, reason: 'resume-dialog-close-block-left' }), log: 'left from resume close button' },
  { match: (d, c) => d === 'right' && isResumeDialogButton(c) && isResumeActionButton(c), handler: () => ({ handled: true, reason: 'resume-dialog-action-block-right' }), log: 'right from resume action button' },
];

function isResumeDialogButton(node: NavigationState['nodes'][0]): boolean {
  // Use semantic flags instead of hardcoded ID checks
  return node.flags?.isResumeDialog === true || node.containerType === 'modal';
}

function isResumeCloseButton(node: NavigationState['nodes'][0]): boolean {
  // Use semantic flags instead of hardcoded ID checks
  return node.flags?.isCloseButton === true;
}

function isResumeActionButton(node: NavigationState['nodes'][0]): boolean {
  // Use semantic flags instead of hardcoded ID checks
  return node.flags?.isActionButton === true;
}

function isLeftmostInGroup(state: NavigationState, current: NavigationState['nodes'][0]): boolean {
  // Find all elements in the same group
  const groupElements = state.nodes.filter(n => n.groupId === current.groupId);
  if (groupElements.length === 0) return false;

  // Find the leftmost element by rect.left
  const leftmost = groupElements.reduce((min, node) =>
    node.rect.left < min.rect.left ? node : min
  , groupElements[0]);

  return leftmost.id === current.id;
}

function findNavigationActive(state: NavigationState, _current: NavigationState['nodes'][0]): string | null {
  // Find active element in navigation container
  const navElements = state.nodes.filter(n => n.containerId === 'navigation');
  const activeElement = navElements.find(n => n.isActive);
  return activeElement?.id ?? navElements[0]?.id ?? null;
}

function handleLeftFromMovieActions(state: NavigationState, current: NavigationState['nodes'][0]): RuleResult {
  // If leftmost in group, go to navigation; otherwise let spatial handle it
  if (isLeftmostInGroup(state, current)) {
    const targetId = findNavigationActive(state, current);
    return { targetId, handled: true, reason: 'leftmost-in-group' };
  }
  return { handled: false, reason: 'not-leftmost-defer-to-spatial' };
}

function handleCloseBack(_state: NavigationState, _current: NavigationState['nodes'][0]): RuleResult {
  // Emit BACK intent instead of leaking UI concerns
  // The hook will handle calling onBack when it sees this action
  return { handled: true, action: 'BACK', reason: 'emit-back-intent' };
}

function handleUpToCloseButton(state: NavigationState, _current: NavigationState['nodes'][0]): RuleResult {
  // Find the close button element
  const closeButton = state.nodes.find(n => n.groupId === 'movie-details-close');
  if (closeButton) {
    return { targetId: closeButton.id, handled: true, reason: 'up-to-close-button' };
  }
  return { handled: false, reason: 'close-button-not-found-defer-to-spatial' };
}

function handleUpToSeriesBackButton(state: NavigationState, _current: NavigationState['nodes'][0]): RuleResult {
  // Find the series back button element
  const backButton = state.nodes.find(n => n.id === 'series-back-btn');
  if (backButton) {
    return { targetId: backButton.id, handled: true, reason: 'up-to-series-back-button' };
  }
  return { handled: false, reason: 'series-back-button-not-found-defer-to-spatial' };
}

function handleDownToEpisodes(state: NavigationState, current: NavigationState['nodes'][0]): RuleResult {
  // Check if dropdown is actually visible (using display class)
  const firstSeasonEl = document.querySelector('[data-tv-group="seasons"]') as HTMLElement | null;
  const isDropdownVisible = firstSeasonEl && !firstSeasonEl.classList.contains('hidden');

  // If dropdown is open and we're at the trigger, go to first season
  if (isDropdownVisible && current.id === 'series-season-select') {
    const firstSeasonNode = state.nodes.find(n => n.groupId === 'seasons');
    if (firstSeasonNode) {
      return { targetId: firstSeasonNode.id, handled: true, reason: 'down-to-dropdown' };
    }
  }

  // Check if we're at the bottom of series-actions group
  const groupElements = state.nodes.filter(n => n.groupId === 'series-actions');
  const currentIndex = groupElements.findIndex(n => n.id === current.id);
  const isLastElement = currentIndex === groupElements.length - 1;

  // Check if dropdown exists (has seasons)
  const firstSeason = state.nodes.find(n => n.groupId === 'seasons');
  const hasSeasons = !!firstSeason;

  // Special case: play-first and favorite-btn should go to season select trigger if seasons exist, else episodes
  if (current.id === 'series-play-first' || current.id === 'series-favorite-btn') {
    if (hasSeasons) {
      const seasonSelectTrigger = state.nodes.find(n => n.id === 'series-season-select');
      if (seasonSelectTrigger) {
        return { targetId: seasonSelectTrigger.id, handled: true, reason: 'down-to-season-select' };
      }
    }
    const firstEpisode = state.nodes.find(n => n.groupId === 'series-episodes');
    if (firstEpisode) {
      return { targetId: firstEpisode.id, handled: true, reason: 'down-to-episodes' };
    }
  }

  // If not at bottom, defer to spatial navigation
  if (!isLastElement) {
    return { handled: false, reason: 'not-at-bottom-of-group-defer-to-spatial' };
  }

  // At bottom of group - go directly to episodes
  const firstEpisode = state.nodes.find(n => n.groupId === 'series-episodes');
  if (firstEpisode) {
    return { targetId: firstEpisode.id, handled: true, reason: 'down-to-episodes' };
  }
  return { handled: false, reason: 'episodes-not-found-defer-to-spatial' };
}

function handleDownFromControls(state: NavigationState, _current: NavigationState['nodes'][0]): RuleResult {
  // Always go to episodes from season select trigger
  const firstEpisode = state.nodes.find(n => n.groupId === 'series-episodes');
  if (firstEpisode) {
    return { targetId: firstEpisode.id, handled: true, reason: 'down-to-episodes-from-controls' };
  }
  return { handled: false, reason: 'episodes-not-found-defer-to-spatial' };
}

function handleSeasonDown(state: NavigationState, current: NavigationState['nodes'][0]): RuleResult {
  const seasonElements = state.nodes
    .filter(n => n.groupId === 'seasons')
    .sort((a, b) => a.rect.top - b.rect.top);

  const currentIndex = seasonElements.findIndex(n => n.id === current.id);

  if (currentIndex < seasonElements.length - 1) {
    const nextId = seasonElements[currentIndex + 1].id;
    return { targetId: nextId, handled: true, reason: 'season-down' };
  }
  // At last season - stay in dropdown by returning handled: true with current ID
  return { targetId: current.id, handled: true, reason: 'last-season-stay-in-dropdown' };
}

function handleSeasonUp(state: NavigationState, current: NavigationState['nodes'][0]): RuleResult {
  const seasonElements = state.nodes
    .filter(n => n.groupId === 'seasons')
    .sort((a, b) => a.rect.top - b.rect.top);

  const currentIndex = seasonElements.findIndex(n => n.id === current.id);
  if (currentIndex > 0) {
    return { targetId: seasonElements[currentIndex - 1].id, handled: true, reason: 'season-up' };
  }
  return { handled: false, reason: 'first-season-defer-to-spatial' };
}

export const movieDetailsPlugin: NavigationPlugin = {
  name: 'movieDetails',
  findNext: (state: NavigationState, direction: Direction, _context?: PluginContext) => {
    const current = state.nodes.find(n => n.id === state.currentId);
    if (!current) {
      return null;
    }

    // Check rules
    for (const rule of rules) {
      if (rule.match(direction, current)) {
        const result = rule.handler(state, current);
        if (result.handled) {
          return result.targetId ?? null;
        }
        // If not handled, continue to next rule or let other plugins handle
        return null;
      }
    }

    return null;
  },
};
