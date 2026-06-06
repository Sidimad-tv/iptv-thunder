import { useRef, useCallback, useEffect } from 'react';

let globalActiveContainer: HTMLElement | null = null;
let activeContainerRefCount = 0;

interface TVContainersOptions {
  onContainerFocus?: (element: HTMLElement) => void;
}

export function useTVContainers(options: TVContainersOptions = {}) {
  const { onContainerFocus } = options;
  
  const activeContainerRef = useRef<HTMLElement | null>(null);
  const lastFocusedByContainer = useRef<Map<string, HTMLElement>>(new Map());
  const onContainerFocusRef = useRef(onContainerFocus);
  
  useEffect(() => { onContainerFocusRef.current = onContainerFocus; }, [onContainerFocus]);

  const setActiveContainer = useCallback((container: HTMLElement | null) => {
    if (container) {
      activeContainerRef.current = container;
      globalActiveContainer = container;
      activeContainerRefCount++;
    } else if (activeContainerRef.current === globalActiveContainer) {
      activeContainerRef.current = null;
      activeContainerRefCount--;
      if (activeContainerRefCount <= 0) {
        globalActiveContainer = null;
        activeContainerRefCount = 0;
      }
    }
  }, []);

  const getActiveContainer = useCallback(() => activeContainerRef.current, []);
  const getGlobalActiveContainer = useCallback(() => globalActiveContainer, []);

  const saveLastFocused = useCallback((element: HTMLElement) => {
    const container = element.closest('[data-tv-container]');
    if (container?.id) {
      lastFocusedByContainer.current.set(container.id, element);
    }
    onContainerFocusRef.current?.(element);
  }, []);

  const restoreLastFocused = useCallback((containerId: string) => {
    return lastFocusedByContainer.current.get(containerId) ?? null;
  }, []);

  useEffect(() => {
    return () => {
      if (activeContainerRef.current === globalActiveContainer) {
        activeContainerRefCount--;
        if (activeContainerRefCount <= 0) {
          globalActiveContainer = null;
          activeContainerRefCount = 0;
        }
      }
    };
  }, []);

  return {
    activeContainerRef,
    setActiveContainer,
    getActiveContainer,
    getGlobalActiveContainer,
    saveLastFocused,
    restoreLastFocused,
  };
}
