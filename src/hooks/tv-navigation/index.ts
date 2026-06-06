// TV Navigation - 3-Layer Architecture
// Core: Pure logic (types.ts, engine.ts)
// Adapter: DOM → engine (domAdapter.ts)
// Plugins: Navigation strategies (grid, container, wrap, spatial)
// React: UI layer (useTVNavigation.ts)
// Utils: Shared utilities (geometry, visibility)

export { findNextNode } from './core/engine';
export type { NavNode, Direction, NavigationState, NavigationPlugin } from './core/types';
export { buildNavigationState, findElementById, isVisible, filterVisibleElements } from './adapters/domAdapter';
export { useTVNavigation } from './react/useTVNavigation';
export { gridPlugin, containerPlugin, wrapPlugin, spatialPlugin } from './plugins';
export * from './utils/geometry';
export * from './utils/visibility';
