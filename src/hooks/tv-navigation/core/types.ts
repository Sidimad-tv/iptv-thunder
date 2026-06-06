// CORE TYPES - Shared type definitions

export type Direction = 'up' | 'down' | 'left' | 'right' | 'back';

// Rule result type to distinguish between "handled" and "not handled"
export interface RuleResult {
  targetId?: string | null;
  handled: boolean;
  reason?: string;
  action?: 'BACK' | 'CLOSE' | 'OPEN' | string;
}

// Re-export config types for public API
export type { NavigationConfig, NavigationRule, NavigationCondition, NavigationTarget } from './config';
export { matchCondition, findTargetByConfig } from './config';
export type { CreateNavigationOptions, NavigationEngine } from './factory';
export { createNavigation } from './factory';

export interface NavNode {
  id: string;
  rect: DOMRect;
  disabled?: boolean;
  containerId?: string;
  groupId?: string;
  index?: number;
  isSearch?: boolean;
  isInitial?: boolean;
  isActive?: boolean;
  gridPosition?: { row: number; col: number };
  // Semantic flags for UI-independent navigation logic
  flags?: {
    isResumeDialog?: boolean;
    isCloseButton?: boolean;
    isActionButton?: boolean;
  };
  // Container type for better modal detection
  containerType?: 'modal' | 'base' | 'overlay';
}

export interface GridData {
  rows: NavNode[][];
  columnCount: number;
  indexMap: Map<number, NavNode>;
}

export interface NavigationState {
  currentId: string | null;
  nodes: NavNode[];
  lastXByRow?: Map<number, number>;
  lastPositionByAxis?: { x: number; y: number };
  grid?: Map<string, GridData>; // groupId -> GridData
}

// Per-instance container state (NOT global)
export interface ContainerState {
  lastFocusedByContainer: Map<string, string>; // containerId -> elementId
  activeContainerId: string | null;
}

// Plugin context passed from hook to plugins
export interface PluginContext {
  setActiveContainer: (container: HTMLElement | null) => void;
  getActiveContainer: () => HTMLElement | null;
  saveLastFocus: (containerId: string, element: HTMLElement) => void;
  getLastFocus: (containerId: string) => HTMLElement | null;
  // Instance-scoped container state (prevents cross-instance bugs)
  container: ContainerState;
}

export interface NavigationPlugin {
  name: string;
  findNext: (state: NavigationState, direction: Direction, context?: PluginContext) => RuleResult | string | null;
  onContainerChange?: (container: HTMLElement | null, context: PluginContext) => void;
}
