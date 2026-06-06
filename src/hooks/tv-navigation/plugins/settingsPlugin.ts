// PLUGIN - Settings Navigation
// Handles navigation within settings modal (tabs, content, footer)
// Now uses configuration-based rules for reusability

import { NavigationState, Direction, NavigationPlugin } from '../core/types';
import { createRuleEnginePlugin } from './ruleEnginePlugin';
import { NavigationConfig } from '../core/config';

// Configuration for settings navigation
const settingsConfig: NavigationConfig = {
  rules: [
    {
      when: { group: 'settings-tabs', direction: 'right' },
      goTo: { group: 'settings-content', initial: true }
    },
    {
      when: { group: 'settings-content', direction: 'left' },
      goTo: { group: 'settings-tabs', active: true }
    },
    {
      when: { group: 'settings-content', direction: 'down' },
      goTo: { group: 'settings-footer', first: true }
    },
    {
      when: { group: 'settings-footer', direction: 'up' },
      goTo: { group: 'settings-content', last: true }
    },
    {
      when: { group: 'settings-tabs', direction: 'up', index: 1 },
      goTo: { group: 'settings-header', first: true }
    },
    {
      when: { group: 'settings-tabs', direction: 'down', last: true },
      goTo: { group: 'settings-footer', first: true }
    },
    {
      when: { group: 'settings-header', direction: 'down' },
      goTo: { group: 'settings-tabs', first: true }
    }
  ]
};

// Custom logic for settings tabs (index-based vertical navigation)
function handleSettingsTabsNavigation(state: NavigationState, current: NavigationState['nodes'][0], direction: Direction): string | null {
  if (current.groupId !== 'settings-tabs') return null;
  if (direction !== 'up' && direction !== 'down') return null;

  const tabsElements = state.nodes.filter(n => n.groupId === 'settings-tabs' && !n.disabled).sort((a, b) => (a.index || 0) - (b.index || 0));
  const currentIndex = tabsElements.findIndex(n => n.id === current.id);

  if (currentIndex === -1) return null;

  // Edge cases (first tab up, last tab down) are handled by NavigationConfig rules
  // Only handle basic tab-to-tab navigation here
  if (direction === 'up') {
    if (currentIndex === 0) return null; // Let config handle it
    const prevIndex = currentIndex - 1;
    return tabsElements[prevIndex]?.id || null;
  } else if (direction === 'down') {
    if (currentIndex === tabsElements.length - 1) return null; // Let config handle it
    const nextIndex = currentIndex + 1;
    return tabsElements[nextIndex]?.id || null;
  }

  return null;
}

// Custom logic for settings content (index-based vertical navigation)
function handleSettingsContentNavigation(state: NavigationState, current: NavigationState['nodes'][0], direction: Direction): string | null {
  if (current.groupId !== 'settings-content') return null;
  if (direction !== 'down' && direction !== 'up') return null;

  const contentElements = state.nodes.filter(n => n.groupId === 'settings-content' && !n.disabled)
    .sort((a, b) => (a.index || 0) - (b.index || 0));
  const currentIndex = contentElements.findIndex(n => n.id === current.id);

  if (currentIndex === -1) return null;

  if (direction === 'down') {
    if (currentIndex < contentElements.length - 1) {
      return contentElements[currentIndex + 1]?.id || null;
    }
    // Last element - let rule engine handle jump to footer
    return null;
  } else if (direction === 'up') {
    if (currentIndex > 0) {
      return contentElements[currentIndex - 1]?.id || null;
    }
    // First element - let rule engine handle jump to tabs
    return null;
  }

  return null;
}

export const settingsPlugin: NavigationPlugin = {
  name: 'settings',
  findNext: (state: NavigationState, direction: Direction) => {
    const current = state.nodes.find(n => n.id === state.currentId);
    if (!current) return null;

    // Only handle if in settings-modal container or settings groups
    const isInSettings = current.containerId === 'settings-modal' ||
                        current.groupId?.startsWith('settings');
    if (!isInSettings) return null;

    // Handle special case for settings tabs navigation
    const tabsResult = handleSettingsTabsNavigation(state, current, direction);
    if (tabsResult) return tabsResult;

    // Handle tab to content navigation (right from tabs should go to content of current tab)
    if (current.groupId === 'settings-tabs' && direction === 'right') {
      const tabId = current.id.replace('settings-tab-', '');
      
      // Find the first focusable element inside the current tab's content container
      const tabContentEl = document.querySelector(`[data-tv-tab="${tabId}"] [data-tv-focusable]`);
      if (tabContentEl) {
        const targetId = (tabContentEl as HTMLElement).dataset.tvId || (tabContentEl as HTMLElement).id;
        return targetId || null;
      }
    }

    // Handle settings content navigation (index-based, not spatial)
    const contentResult = handleSettingsContentNavigation(state, current, direction);
    if (contentResult) return contentResult;

    // Default to rule engine (only for other cases)
    const ruleEngine = createRuleEnginePlugin(settingsConfig);
    return ruleEngine.findNext(state, direction);
  },
};
