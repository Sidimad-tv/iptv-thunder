// PLUGIN - Wrap Navigation
// DISABLED - Spatial plugin handles all navigation now
// This plugin is kept for future use but currently returns null

import { NavigationState, Direction, NavigationPlugin } from '../core/types';

export const wrapPlugin: NavigationPlugin = {
  name: 'wrap',
  findNext: (_state: NavigationState, _direction: Direction) => {
    // Wrap is disabled - spatial plugin handles all navigation including wrap-around
    return null;
  },
};
