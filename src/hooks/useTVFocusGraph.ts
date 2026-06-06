import { useRef, useCallback } from 'react';
import {
  findNextNode,
  Direction,
  NavigationState,
  buildNavigationState,
  findElementById,
  filterVisibleElements,
  isVisible,
  gridPlugin,
  containerPlugin,
  wrapPlugin,
  spatialPlugin,
} from './tv-navigation';

interface TVFocusGraphOptions {
  selector?: string;
  elements?: HTMLElement[];
  onTVFocus?: (element: HTMLElement) => void;
  getActiveContainer?: () => HTMLElement | null;
  plugins?: any[];
}

export function useTVFocusGraph(options: TVFocusGraphOptions = {}) {
  const { 
    selector = '[data-tv-focusable]', 
    elements: externalElements, 
    onTVFocus, 
    getActiveContainer,
    plugins: customPlugins = []
  } = options;

  const elementsRef = useRef<HTMLElement[]>([]);
  const stateRef = useRef<NavigationState | undefined>(undefined);
  const currentElementRef = useRef<HTMLElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Combine default plugins with custom plugins
  const allPlugins = [containerPlugin, gridPlugin, wrapPlugin, spatialPlugin, ...customPlugins];

  const getFocusableElements = useCallback(() => {
    if (externalElements) {
      const elements = externalElements;
      const activeContainer = getActiveContainer?.();
      if (activeContainer) {
        return elements.filter(el => activeContainer?.contains(el));
      }
      return elements;
    }

    const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
    const activeContainer = getActiveContainer?.();
    if (activeContainer) {
      return elements.filter(el => activeContainer?.contains(el));
    }

    return elements;
  }, [selector, externalElements, getActiveContainer]);

  const scrollToElement = (el: HTMLElement) => {
    if (scrollTimeoutRef.current !== null) {
      cancelAnimationFrame(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
      scrollTimeoutRef.current = null;
    });
  };

  const focusElement = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    if (currentElementRef.current === el) return;

    el.focus({ preventScroll: true });
    scrollToElement(el);
    currentElementRef.current = el;

    onTVFocus?.(el);
  }, [onTVFocus]);

  const updateState = useCallback(() => {
    const elements = getFocusableElements();
    const visibleElements = filterVisibleElements(elements);
    elementsRef.current = visibleElements;

    const currentId = currentElementRef.current
      ? (currentElementRef.current.dataset.tvId ?? currentElementRef.current.id)
      : null;

    stateRef.current = buildNavigationState(visibleElements, currentId);
  }, [getFocusableElements]);

  const findNextElement = useCallback((direction: Direction) => {
    if (!stateRef.current) return null;

    const result = findNextNode(stateRef.current, direction, allPlugins);
    if (!result.targetId) return null;

    const el = findElementById(elementsRef.current, result.targetId);
    return el ?? null;
  }, [allPlugins]);

  const invalidateRectCache = useCallback(() => {
    // In the new architecture, we just update the state
    updateState();
  }, [updateState]);

  const updateRectCache = useCallback(() => {
    updateState();
  }, [updateState]);

  return {
    focusableElementsRef: elementsRef,
    currentElementRef,
    getFocusableElements,
    focusElement,
    findNextElement,
    invalidateRectCache,
    updateRectCache,
    isVisible,
    updateState,
  };
}
