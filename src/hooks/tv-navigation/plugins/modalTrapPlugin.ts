// PLUGIN - Modal Focus Trapping
// Traps focus within modal containers to prevent navigation to background elements

import { NavigationState, Direction, NavigationPlugin } from '../core/types';

export const modalTrapPlugin: NavigationPlugin = {
  name: 'modalTrap',
  findNext: (state: NavigationState, direction: Direction) => {
    const current = state.nodes.find(n => n.id === state.currentId);
    if (!current) {
      return null;
    }

    // Check if current is in a modal container
    if (current.containerId !== 'resume-dialog') {
      return null;
    }

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

    // Block UP/DOWN/BACK - stay on current element
    if (direction === 'up' || direction === 'down' || direction === 'back') {
      return current.id;
    }

    return null;
  },
};
