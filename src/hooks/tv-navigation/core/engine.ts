// CORE ENGINE - Pure logic, no React, no DOM
// Only plugin orchestration

import { Direction, NavigationState, NavigationPlugin, PluginContext } from './types';

export function findNextNode(
  state: NavigationState,
  direction: Direction,
  plugins: NavigationPlugin[] = [],
  context?: PluginContext
): { targetId: string | null; action?: string } {

  const current = state.nodes.find(n => n.id === state.currentId);
  if (!current) {
    return { targetId: null };
  }

  // Try each plugin in order
  for (const plugin of plugins) {
    const result = plugin.findNext(state, direction, context);

    // Handle both old API (string | null) and new API (RuleResult)
    if (result === null) {
      continue;
    }

    if (typeof result === 'string') {
      // Old API - backward compatibility
      return { targetId: result };
    }

    if (typeof result === 'object' && 'handled' in result) {
      // New API - RuleResult
      if (result.handled) {
        return { targetId: result.targetId ?? null, action: result.action };
      }
      // Not handled, try next plugin
      continue;
    }

    // Treat truthy non-object values as targetId (backward compatibility)
    return { targetId: result as string | null };
  }
  return { targetId: null };
}
