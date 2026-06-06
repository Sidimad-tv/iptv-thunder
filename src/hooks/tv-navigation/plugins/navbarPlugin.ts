// PLUGIN - Navbar/Submenu Navigation
// Handles navigation between navbar items and their submenus

import { NavigationState, Direction, NavigationPlugin } from '../core/types';

function hasSubmenu(state: NavigationState, current: NavigationState['nodes'][0]): boolean {
  const submenuElements = state.nodes.filter(
    n => n.containerId === current.containerId && n.groupId && n.groupId !== current.groupId
  );
  return submenuElements.length > 0;
}

function findSubmenuForNavbar(
  state: NavigationState,
  current: { id: string; containerId?: string; groupId?: string },
  direction: 'up' | 'down'
): string | null {
  const submenuElements = state.nodes.filter(
    n => n.containerId === current.containerId && n.groupId && n.groupId !== current.groupId
  );

  if (submenuElements.length === 0) {
    return null;
  }

  submenuElements.sort((a, b) => a.rect.top - b.rect.top);

  const currentNode = state.nodes.find(n => n.id === current.id);
  if (!currentNode) {
    return null;
  }

  const result = direction === 'down'
    ? findSubmenuDown(state, current, currentNode, submenuElements)
    : findSubmenuUp(state, current, currentNode, submenuElements);

  return result;
}

function findSubmenuDown(
  state: NavigationState,
  current: { id: string; containerId?: string },
  currentNode: NavigationState['nodes'][0],
  submenuElements: NavigationState['nodes']
): string | null {
  // Find current index in submenuElements
  const currentIndex = submenuElements.findIndex(n => n.id === current.id);

  // If current is not in submenu (e.g., navbar element), return first submenu element
  if (currentIndex === -1) {
    const firstSubmenu = submenuElements[0];
    if (!firstSubmenu) return null;

    // Check if first submenu is below current
    if (firstSubmenu.rect.top <= currentNode.rect.top) {
      return null;
    }

    if (hasNavbarBetween(state, current.containerId, currentNode.rect.top, firstSubmenu.rect.top)) {
      return null;
    }

    return firstSubmenu.id;
  }

  // Get next element
  const nextSubmenu = submenuElements[currentIndex + 1];
  if (!nextSubmenu) return null;

  // Check if next element is below current
  if (nextSubmenu.rect.top <= currentNode.rect.top) {
    return null;
  }

  if (hasNavbarBetween(state, current.containerId, currentNode.rect.top, nextSubmenu.rect.top)) {
    return null;
  }

  return nextSubmenu.id;
}

function findSubmenuUp(
  state: NavigationState,
  current: { id: string; containerId?: string },
  currentNode: NavigationState['nodes'][0],
  submenuElements: NavigationState['nodes']
): string | null {
  // Find current index in submenuElements
  const currentIndex = submenuElements.findIndex(n => n.id === current.id);
  if (currentIndex === -1) return null;

  // Get previous element
  const prevSubmenu = submenuElements[currentIndex - 1];
  if (!prevSubmenu) return null;

  // Check if previous element is above current
  if (prevSubmenu.rect.top >= currentNode.rect.top) {
    return null;
  }

  if (hasNavbarBetween(state, current.containerId, prevSubmenu.rect.top, currentNode.rect.top)) {
    return null;
  }

  return prevSubmenu.id;
}

function hasNavbarBetween(
  state: NavigationState,
  containerId: string | undefined,
  top: number,
  bottom: number
): boolean {
  return state.nodes.some(
    n => n.containerId === containerId && n.groupId === 'navbar' &&
         n.rect.top > top && n.rect.top < bottom
  );
}

function findParentNavbarForSubmenu(state: NavigationState, current: { id: string; containerId?: string; groupId?: string }): string | null {
  const navbarElements = state.nodes.filter(
    n => n.containerId === current.containerId && n.groupId === 'navbar'
  );
  if (navbarElements.length > 0) {
    navbarElements.sort((a, b) => a.rect.top - b.rect.top);

    const currentNode = state.nodes.find(n => n.id === current.id);
    if (!currentNode) return null;

    const submenuElements = state.nodes.filter(
      n => n.containerId === current.containerId && n.groupId === current.groupId
    );
    submenuElements.sort((a, b) => a.rect.top - b.rect.top);
    const isFirstInSubmenu = submenuElements[0]?.id === current.id;

    if (!isFirstInSubmenu) {
      return null;
    }

    const parentNavbar = navbarElements
      .filter(n => n.rect.top < currentNode.rect.top)
      .sort((a, b) => b.rect.top - a.rect.top)[0];

    if (parentNavbar) {
      return parentNavbar.id;
    }
  }
  return null;
}

function handleNavbarNavigation(state: NavigationState, current: NavigationState['nodes'][0], direction: Direction): string | null {
  if (current.containerId !== 'navigation') return null;

  // Get all navbar elements sorted by position
  const navbarElements = state.nodes.filter(n => n.groupId === 'navbar' && !n.disabled);
  navbarElements.sort((a, b) => a.rect.top - b.rect.top);
  const currentIndex = navbarElements.findIndex(n => n.id === current.id);

  // Handle up/down navigation within sidebar
  if (direction === 'up') {
    // Special case: exit button (close-app) - navigate to last navbar element
    if (current.id === 'close-app') {
      const lastNavbar = navbarElements[navbarElements.length - 1];
      return lastNavbar?.id ?? null;
    }
    // If in submenu, navigate within submenu first (before checking currentIndex)
    if (current.groupId && current.groupId !== 'navbar') {
      const currentNode = state.nodes.find(n => n.id === current.id);
      if (!currentNode) return current.id;
      // Find all elements in the same submenu (same containerId as current)
      const submenuElements = state.nodes.filter(
        n => n.containerId === current.containerId && n.groupId !== 'navbar'
      );
      submenuElements.sort((a, b) => a.rect.top - b.rect.top);
      const result = findSubmenuUp(state, current, currentNode, submenuElements);
      if (result) {
        return result;
      }
      // If no submenu up, go to parent navbar
      const parent = findParentNavbarForSubmenu(state, current);
      return parent;
    }
    // If on navbar element, check if there are submenu elements below
    if (current.groupId === 'navbar') {
      const currentNode = state.nodes.find(n => n.id === current.id);
      if (currentNode) {
        // Find previous navbar element
        const prevNavbarIndex = currentIndex - 1;
        if (prevNavbarIndex >= 0) {
          const prevNavbar = navbarElements[prevNavbarIndex];
          // Find submenu elements that belong to previous navbar (are below it but above current)
          const submenuElements = state.nodes.filter(
            n => n.containerId === current.containerId &&
              n.groupId !== 'navbar' &&
              n.rect.top > prevNavbar.rect.top &&
              n.rect.top < currentNode.rect.top
          );
          submenuElements.sort((a, b) => a.rect.top - b.rect.top);
          if (submenuElements.length > 0) {
            return submenuElements[submenuElements.length - 1].id;
          }
        }
      }
    }
    // If at first element, stay there
    if (currentIndex <= 0) {
      return current.id;
    }
    // Move to previous navbar element
    const targetId = navbarElements[currentIndex - 1]?.id ?? null;
    return targetId;
  }

  if (direction === 'down') {
    // If in submenu, navigate within submenu first
    if (current.groupId && current.groupId !== 'navbar') {
      const currentNode = state.nodes.find(n => n.id === current.id);
      if (!currentNode) return current.id;
      // Find all elements in the same submenu (same containerId as current)
      const submenuElements = state.nodes.filter(
        n => n.containerId === current.containerId && n.groupId !== 'navbar'
      );
      submenuElements.sort((a, b) => a.rect.top - b.rect.top);
      const result = findSubmenuDown(state, current, currentNode, submenuElements);
      if (result) {
        return result;
      }
      // If no submenu down, find next navbar element
      // Find parent navbar by finding navbar element above current element
      const parentNavbar = navbarElements
        .filter(n => n.rect.top < currentNode.rect.top)
        .sort((a, b) => b.rect.top - a.rect.top)[0];

      if (parentNavbar) {
        const currentNavbarIndex = navbarElements.findIndex(n => n.id === parentNavbar.id);
        if (currentNavbarIndex >= 0 && currentNavbarIndex < navbarElements.length - 1) {
          const nextNavbar = navbarElements[currentNavbarIndex + 1]?.id ?? null;
          return nextNavbar;
        }
      }
      // If at last navbar element, stay there
      return current.id;
    }
    // If element has submenu, navigate to it first
    if (hasSubmenu(state, current)) {
      return findSubmenuForNavbar(state, current, 'down');
    }
    // Otherwise move to next navbar element
    if (currentIndex >= 0 && currentIndex < navbarElements.length - 1) {
      const targetId = navbarElements[currentIndex + 1]?.id ?? null;
      return targetId;
    }
    // At last navbar element, check if exit button exists below
    const exitButton = state.nodes.find(n => n.id === 'close-app' && !n.disabled);
    if (exitButton) {
      const currentNode = state.nodes.find(n => n.id === current.id);
      if (currentNode && exitButton.rect.top > currentNode.rect.top) {
        return exitButton.id;
      }
    }
    // At last element, stay there
    return current.id;
  }

  return null;
}

function handleSubmenuNavigation(state: NavigationState, current: NavigationState['nodes'][0], direction: Direction): string | null {
  if (direction !== 'up' || !current.groupId || current.groupId === 'navbar') return null;

  // Only return parent navbar if on first submenu item overall (by rect.top)
  // Otherwise return null to let containerPlugin handle navigation within submenu
  const allSubmenuElements = state.nodes.filter(
    n => n.containerId === current.containerId && n.groupId !== 'navbar'
  );
  allSubmenuElements.sort((a, b) => a.rect.top - b.rect.top);
  const isFirstInSubmenu = allSubmenuElements[0]?.id === current.id;

  if (!isFirstInSubmenu) {
    return null;
  }

  return findParentNavbarForSubmenu(state, current);
}

export const navbarPlugin: NavigationPlugin = {
  name: 'navbar',
  findNext: (state: NavigationState, direction: Direction) => {
    const current = state.nodes.find(n => n.id === state.currentId);
    if (!current) return null;

    const navbarResult = handleNavbarNavigation(state, current, direction);
    if (navbarResult) return navbarResult;

    const submenuResult = handleSubmenuNavigation(state, current, direction);
    if (submenuResult) return submenuResult;

    return null;
  },
};
