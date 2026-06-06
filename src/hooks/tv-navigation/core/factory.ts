// FACTORY - Create Navigation Engine
// Makes the engine reusable, app-agnostic, and publishable

import { NavigationConfig } from './config';
import { createRuleEnginePlugin } from '../plugins/ruleEnginePlugin';
import { NavigationPlugin } from './types';

export interface CreateNavigationOptions {
  config: NavigationConfig;
  plugins?: NavigationPlugin[];
}

export interface NavigationEngine {
  plugins: NavigationPlugin[];
  /** Add a plugin dynamically after engine creation */
  addPlugin: (plugin: NavigationPlugin) => void;
}

export function createNavigation(options: CreateNavigationOptions): NavigationEngine {
  const { config, plugins = [] } = options;

  // Create rule engine from config
  const ruleEnginePlugin = createRuleEnginePlugin(config);

  // Combine rule engine with custom plugins
  // Rule engine runs first (specific rules), then custom plugins
  const allPlugins: NavigationPlugin[] = [ruleEnginePlugin, ...plugins];

  return {
    plugins: allPlugins,
    // Expose for extensibility
    addPlugin: (plugin: NavigationPlugin) => {
      allPlugins.push(plugin);
    },
  };
}
