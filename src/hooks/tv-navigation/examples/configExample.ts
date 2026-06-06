// EXAMPLE - Using createNavigation with config-based rules
// This demonstrates how the new config-based API makes the engine reusable and app-agnostic

import { createNavigation, NavigationConfig } from '../core/types';
import { spatialPlugin, gridPlugin, wrapPlugin, containerPlugin, navbarPlugin, trapFocusPlugin } from '../plugins';

// Example 1: Simple app with basic navigation rules
const simpleAppConfig: NavigationConfig = {
  rules: [
    {
      when: { container: 'navigation', direction: 'right' },
      goTo: { container: 'main', initial: true }
    },
    {
      when: { container: 'main', direction: 'left' },
      goTo: { container: 'navigation', active: true }
    }
  ]
};

// @ts-ignore - Example variable, not used in this demo
const simpleNavigation = createNavigation({
  config: simpleAppConfig,
  plugins: [spatialPlugin] // Add spatial navigation as fallback
});

// Example 2: Settings modal navigation (replaces settingsPlugin)
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
    }
  ]
};

// @ts-ignore - Example variable, not used in this demo
const settingsNavigation = createNavigation({
  config: settingsConfig,
  plugins: [spatialPlugin]
});

// Example 3: Full app with multiple plugins
const fullAppConfig: NavigationConfig = {
  rules: [
    // Container transitions
    {
      when: { container: 'navigation', direction: 'right' },
      goTo: { container: 'main', initial: true }
    },
    {
      when: { isSearch: true, direction: 'down' },
      goTo: { container: 'main', initial: true }
    },
    // Settings navigation
    {
      when: { group: 'settings-tabs', direction: 'right' },
      goTo: { group: 'settings-content', initial: true }
    }
  ]
};

// @ts-ignore - Example variable, not used in this demo
const fullNavigation = createNavigation({
  config: fullAppConfig,
  plugins: [
    containerPlugin,  // Container switching + restore
    navbarPlugin,    // Navbar/submenu navigation
    trapFocusPlugin, // Focus trapping
    gridPlugin,      // Grid navigation
    wrapPlugin,      // Wrap around edges
    spatialPlugin    // General spatial fallback
  ]
});

// Usage in React hook:
// const { plugins } = fullNavigation;
// const nextId = findNextNode(state, direction, plugins, context);
