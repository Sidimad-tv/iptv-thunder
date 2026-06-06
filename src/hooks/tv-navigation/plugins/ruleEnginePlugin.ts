// PLUGIN - Rule Engine
// Interprets configuration-based navigation rules
// Makes the engine reusable, app-agnostic, and publishable

import { NavigationState, Direction, NavigationPlugin } from '../core/types';
import { NavigationConfig, matchCondition, findTargetByConfig } from '../core/config';

export function createRuleEnginePlugin(config: NavigationConfig): NavigationPlugin {
  return {
    name: 'ruleEngine',
    findNext: (state: NavigationState, direction: Direction) => {
      const current = state.nodes.find(n => n.id === state.currentId);
      if (!current) return null;

      // Calculate if current is the last element in its group
      let isLast = false;
      if (current.groupId) {
        const groupElements = state.nodes.filter(n => n.groupId === current.groupId && !n.disabled);
        const sortedElements = [...groupElements].sort((a, b) => (a.index || 0) - (b.index || 0));
        isLast = sortedElements.at(-1)?.id === current.id;
      }

      for (const rule of config.rules) {
        if (matchCondition(rule.when, current, direction, isLast)) {
          const targetId = findTargetByConfig(state, rule.goTo);
          if (targetId) {
            return targetId;
          }
        }
      }

      return null;
    },
  };
}
