// PLUGIN - Focus Trapping
// Traps focus within specific groups (e.g., portal-actions) to prevent escape

import { NavigationState, Direction, NavigationPlugin } from '../core/types';

function handlePortalActionsNavigation(state: NavigationState, current: NavigationState['nodes'][0], direction: Direction): string | null {
  if (current.groupId !== 'portal-actions') return null;

  if (direction !== 'up' && direction !== 'down') return null;

  const menuElements = state.nodes.filter(n => n.groupId === 'portal-actions' && !n.disabled);
  if (menuElements.length === 0) return null;

  menuElements.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  const currentIndex = menuElements.findIndex(n => n.id === current.id);
  if (currentIndex === -1) return null;

  if (direction === 'up' && currentIndex > 0) {
    return menuElements[currentIndex - 1].id;
  }
  if (direction === 'down' && currentIndex < menuElements.length - 1) {
    return menuElements[currentIndex + 1].id;
  }

  return current.id;
}

function handleResumeDialogNavigation(state: NavigationState, current: NavigationState['nodes'][0], direction: Direction): string | null {
  if (current.containerId !== 'resume-dialog') return null;

  const dialogElements = state.nodes.filter(n => n.containerId === 'resume-dialog' && !n.disabled);
  if (dialogElements.length === 0) return null;

  const currentIndex = dialogElements.findIndex(n => n.id === current.id);
  if (currentIndex === -1) return null;

  // Allow LEFT/RIGHT navigation within dialog
  if (direction === 'left' && currentIndex > 0) {
    return dialogElements[currentIndex - 1].id;
  }
  if (direction === 'right' && currentIndex < dialogElements.length - 1) {
    return dialogElements[currentIndex + 1].id;
  }

  // Block UP/DOWN - stay on current element
  if (direction === 'up' || direction === 'down') {
    return current.id;
  }

  return null;
}

export const trapFocusPlugin: NavigationPlugin = {
  name: 'trapFocus',
  findNext: (state: NavigationState, direction: Direction) => {
    const current = state.nodes.find(n => n.id === state.currentId);
    if (!current) return null;

    // Try resume-dialog trapping first
    const resumeResult = handleResumeDialogNavigation(state, current, direction);
    if (resumeResult) return resumeResult;

    // Try portal-actions trapping
    return handlePortalActionsNavigation(state, current, direction);
  },
};
