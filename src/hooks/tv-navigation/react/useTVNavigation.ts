// REACT HOOK - UI Layer
// Thin wrapper that connects engine to React

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { findNextNode } from '../core/engine';
import { Direction, NavigationState, PluginContext, ContainerState } from '../core/types';
import { buildNavigationState, findElementById, filterVisibleElements } from '..';
import { gridPlugin, containerPlugin, wrapPlugin, spatialPlugin, initAutoFocus, navbarPlugin, trapFocusPlugin, settingsPlugin, movieDetailsPlugin, modalTrapPlugin } from '../plugins';
import { setActiveContainerId, saveContainerFocus, getLastFocus } from '../plugins/containerPlugin';

interface TVNavigationOptions {
  selector?: string;
  elements?: HTMLElement[];
  onBack?: () => void;
  onEnter?: (element: HTMLElement) => void;
  onTVFocus?: (element: HTMLElement) => void;
  plugins?: any[];
}

export function useTVNavigation(options: TVNavigationOptions = {}) {
  const {
    selector = '[data-tv-focusable]',
    elements: externalElements,
    onBack,
    onEnter,
    onTVFocus,
    plugins: customPlugins = []
  } = options;

  // Use refs for callbacks to avoid re-registering listeners
  const onBackRef = useRef(onBack);
  const onEnterRef = useRef(onEnter);
  const onTVFocusRef = useRef(onTVFocus);

  // Update refs when props change
  useEffect(() => { onBackRef.current = onBack; }, [onBack]);
  useEffect(() => { onEnterRef.current = onEnter; }, [onEnter]);
  useEffect(() => { onTVFocusRef.current = onTVFocus; }, [onTVFocus]);

  const elementsRef = useRef<HTMLElement[]>([]);
  const stateRef = useRef<NavigationState | undefined>(undefined);
  const currentElementRef = useRef<HTMLElement | null>(null);
  const activeContainerRef = useRef<HTMLElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Instance-scoped container state (prevents cross-instance bugs)
  const containerStateRef = useRef<ContainerState>({
    lastFocusedByContainer: new Map(),
    activeContainerId: null,
  });

  // Stable handler refs to avoid re-binding listeners
  const handleKeyDownRef = useRef<((e: KeyboardEvent) => void) | undefined>(undefined);
  const handleFocusRef = useRef<((e: FocusEvent) => void) | undefined>(undefined);

  // Combine default plugins with custom plugins
  // Order: specific plugins first, then general plugins as fallback
  const allPlugins = useMemo(
    () => [settingsPlugin, modalTrapPlugin, trapFocusPlugin, navbarPlugin, movieDetailsPlugin, containerPlugin, gridPlugin, wrapPlugin, spatialPlugin, ...customPlugins],
    [customPlugins]
  );

  // Plugin context for unified container management (instance-scoped)
  const pluginContext = useMemo<PluginContext>(() => {
    // Create context object that captures containerStateRef
    const ctx: PluginContext = {
      setActiveContainer: (container) => {
        activeContainerRef.current = container;
        // Update instance-scoped state
        const newId = container?.id ?? null;
        setActiveContainerId(ctx, newId);
      },
      getActiveContainer: () => activeContainerRef.current,
      saveLastFocus: (containerId, element) => {
        saveContainerFocus(ctx, containerId, element.id);
      },
      getLastFocus: (containerId) => {
        const lastId = getLastFocus(ctx, containerId);
        if (!lastId) return null;
        return document.getElementById(lastId) || document.querySelector(`[data-tv-id="${lastId}"]`) as HTMLElement | null;
      },
      container: containerStateRef.current,
    };
    return ctx;
  }, []);

  const getFocusableElements = useCallback(() => {
    if (activeContainerRef.current && !document.contains(activeContainerRef.current)) {
      activeContainerRef.current = null;
    }

    // Use container plugin's active container ID for filtering
    const activeContainer = activeContainerRef.current;

    if (externalElements) {
      const elements = externalElements;
      if (activeContainer) {
        return elements.filter(el => activeContainer.contains(el));
      }
      return elements;
    }

    // Query all focusable elements, then filter by container if needed
    const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[];

    // Filter out disabled elements and skip marked elements
    // Also filter out tv-div-* wrapper elements from virtualization
    const enabledElements = elements.filter(el => {
      const tvId = el.dataset.tvId;
      const hasTvDivId = tvId?.startsWith('tv-div-');
      if (el.dataset.tvSkip !== undefined || hasTvDivId) {
        return false;
      }
      return !el.hasAttribute('disabled') &&
        el.getAttribute('aria-disabled') !== 'true' &&
        el.dataset.tvDisabled === undefined;
    });

    // Always include season dropdown elements for navigation
    const dropdownElements = Array.from(document.querySelectorAll('[data-tv-group="seasons"]')) as HTMLElement[];
    const allElements = [...enabledElements, ...dropdownElements];
    
    // Remove duplicates (by element reference)
    const uniqueElements = Array.from(new Set(allElements));
    
    if (activeContainer) {
      // Include elements from active container OR dropdown elements
      return uniqueElements.filter(el => activeContainer.contains(el) || el.dataset.tvGroup === 'seasons');
    }
    return uniqueElements;
  }, [selector, externalElements]);

  const isHorizontalContainer = (container: Element): boolean =>
    container.classList.contains('overflow-x-auto') ||
    (container as HTMLElement).style.overflowX === 'auto' ||
    (container as HTMLElement).style.overflowX === 'scroll';

  const scrollHorizontal = (container: Element, el: HTMLElement) => {
    const containerRect = (container as HTMLElement).getBoundingClientRect();
    const elementRect = el.getBoundingClientRect();
    const relativeLeft = elementRect.left - containerRect.left;
    const scrollLeft = container.scrollLeft + relativeLeft - containerRect.width / 2 + elementRect.width / 2;
    container.scrollTo({ left: scrollLeft, behavior: 'auto' });
  };

  const scrollVertical = (container: Element, el: HTMLElement) => {
    const containerRect = (container as HTMLElement).getBoundingClientRect();
    const elementRect = el.getBoundingClientRect();
    const relativeTop = elementRect.top - containerRect.top;
    const scrollTop = container.scrollTop + relativeTop - containerRect.height / 2 + elementRect.height / 2;
    container.scrollTo({ top: scrollTop, behavior: 'auto' });
  };

  const scrollToElement = (el: HTMLElement) => {
    if (scrollTimeoutRef.current !== null) {
      cancelAnimationFrame(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = requestAnimationFrame(() => {
      const scrollableContainer = el.closest('[data-tv-container="navigation"] nav') ||
                                  el.closest('.overflow-y-auto') ||
                                  el.closest('.overflow-x-auto') ||
                                  el.closest('[data-tv-container]') ||
                                  document.documentElement;

      if (scrollableContainer && scrollableContainer !== document.documentElement) {
        if (isHorizontalContainer(scrollableContainer)) {
          scrollHorizontal(scrollableContainer, el);
        } else {
          scrollVertical(scrollableContainer, el);
        }
      } else {
        el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
      }
      scrollTimeoutRef.current = null;
    });
  };

  const syncCurrentElementFromDom = () => {
    if (currentElementRef.current) return;
    const active = document.activeElement as HTMLElement;
    if (active?.matches('[data-tv-focusable]') || active?.closest('[data-tv-focusable]')) {
      const el = active.matches('[data-tv-focusable]') ? active : active.closest('[data-tv-focusable]') as HTMLElement;
      currentElementRef.current = el;
      const container = el.closest('[data-tv-container]');
      if (container?.id && container.id !== activeContainerRef.current?.id) {
        activeContainerRef.current = null;
      }
    } else if (elementsRef.current.length > 0) {
      currentElementRef.current = elementsRef.current[0];
    }
  };

  const updateState = useCallback(() => {
    const elements = getFocusableElements();
    // Filter visible elements but always include dropdown season elements
    const visibleElements = elements.filter(el => {
      if (el.dataset.tvGroup === 'seasons') return true; // Always include seasons
      return filterVisibleElements([el]).length > 0;
    });

    // Dirty checking: only rebuild state if elements actually changed
    const prevElements = elementsRef.current;
    const elementsChanged = prevElements.length !== visibleElements.length ||
      prevElements.some((el, i) => el !== visibleElements[i]);

    // Always rebuild if currentId needs to be updated (focus changed) or state is null
    const newCurrentId = currentElementRef.current?.dataset.tvId || currentElementRef.current?.id || null;
    const currentIdChanged = stateRef.current?.currentId !== newCurrentId;

    syncCurrentElementFromDom();

    if (!elementsChanged && !currentIdChanged) {
      return; // Skip rebuild if nothing changed
    }

    elementsRef.current = visibleElements;

    // Clear current element if detached from DOM
    if (currentElementRef.current && !document.contains(currentElementRef.current)) {
      currentElementRef.current = null;
    }

    const currentId = currentElementRef.current
      ? (currentElementRef.current.dataset.tvId ?? currentElementRef.current.id)
      : null;

    stateRef.current = buildNavigationState(visibleElements, currentId);
  }, [getFocusableElements]);

  const focusElement = useCallback((el: HTMLElement | null) => {
    if (!el) return;

    // Check if already focused in DOM (not just in ref)
    if (document.activeElement === el) {
      return;
    }

    if (currentElementRef.current === el) {
      return;
    }

    // Remove .tv-focused from previous element BEFORE setting new ref
    if (currentElementRef.current) {
      currentElementRef.current.classList.remove('tv-focused');
    }

    // Set ref IMMEDIATELY to prevent any race conditions
    currentElementRef.current = el;

    el.focus({ preventScroll: true });
    el.classList.add('tv-focused');

    // Special case: reset scroll to top when focusing first element of for-you-live
    const isFirstForYouLive = el.dataset.tvGroup === 'for-you-live' && el.dataset.tvIndex === '0';
    if (isFirstForYouLive) {
      // Use requestAnimationFrame to ensure it happens after all layout/focus changes
      requestAnimationFrame(() => {
        // Find and reset ALL scrollable elements
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          const style = globalThis.window.getComputedStyle(el);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll' || (el as HTMLElement).scrollTop > 0) {
            (el as HTMLElement).scrollTo({ top: 0, behavior: 'auto' });
          }
        });
        window.scrollTo({ top: 0, behavior: 'auto' });
        // Update state after scroll reset completes
        updateState();
      });
    } else {
      scrollToElement(el);
    }

    currentElementRef.current = el;

    onTVFocusRef.current?.(el);

    // Save last focused element per container (via plugin context)
    const container = el.closest('[data-tv-container]');
    if (container?.id) {
      saveContainerFocus(pluginContext, container.id, el.id || el.dataset.tvId || '');
    }

    // Update state with new currentId - defer to RAF to ensure scroll completes first
    // (unless already handled in the for-you-live case above)
    if (!isFirstForYouLive) {
      requestAnimationFrame(() => {
        updateState();
      });
    }
  }, [updateState, pluginContext]);


  const setActiveContainer = useCallback((container: HTMLElement | null) => {
    pluginContext.setActiveContainer(container);
    // Notify container plugin
    if (containerPlugin.onContainerChange) {
      containerPlugin.onContainerChange(container, pluginContext);
    }
  }, [pluginContext]);

  const resolveTvDivFallback = useCallback((): boolean => {
    const validElements = elementsRef.current.filter(el => {
      const tvId = el.dataset.tvId;
      return tvId && !tvId.startsWith('tv-div-');
    });
    if (validElements.length === 0) return false;
    const firstValid = validElements[0];
    firstValid.focus();
    stateRef.current = undefined;
    currentElementRef.current = firstValid;
    updateState();
    return true;
  }, [updateState]);

  const syncDomFocusToState = useCallback(() => {
    const activeEl = document.activeElement as HTMLElement | null;
    if (!activeEl) return;
    const focusableEl = activeEl.matches('[data-tv-focusable]')
      ? activeEl
      : activeEl.closest('[data-tv-focusable]') as HTMLElement | null;
    if (!focusableEl) return;
    const activeId = focusableEl.dataset.tvId || focusableEl.id;
    if (activeId?.startsWith('tv-div-')) {
      resolveTvDivFallback();
      return;
    }
    // Don't reset currentElementRef if we're in a dropdown (check if currentElementRef is a season element)
    const currentRefId = currentElementRef.current?.dataset?.tvId || currentElementRef.current?.id;
    const isInDropdown = currentRefId?.startsWith('season-');
    if (isInDropdown) {
      return;
    }
    if (activeId && stateRef.current?.currentId !== activeId) {
      updateState();
      currentElementRef.current = focusableEl;
    }
  }, [resolveTvDivFallback, updateState]);

  const resolveGroupTarget = (groupId: string): HTMLElement | undefined => {
    const groupElements = Array.from(
      document.querySelectorAll(`[data-tv-group="${groupId}"]`)
    ) as HTMLElement[];
    return groupElements.find(el => {
      const tvId = el.dataset.tvId;
      return el.dataset.tvFocusable !== undefined && !tvId?.startsWith('tv-div-');
    });
  };

  const resolveElementTarget = (targetId: string): HTMLElement | undefined => {
    const fromRef = findElementById(elementsRef.current, targetId);
    if (fromRef) return fromRef;
    const candidates = Array.from(
      document.querySelectorAll(`[data-tv-id="${targetId}"]`)
    ) as HTMLElement[];
    return candidates.find(el => !el.dataset.tvId?.startsWith('tv-div-')) || candidates[0];
  };

  const isValidTarget = (targetEl: HTMLElement, isGroupId: boolean): boolean => {
    const finalTargetTvId = targetEl.dataset.tvId;
    const isPlaceholder = targetEl.id.startsWith('tv-div-') || finalTargetTvId?.startsWith('tv-div-');
    if (isPlaceholder) return false;
    const hasValidTvId = !!finalTargetTvId && finalTargetTvId.length > 0;
    return hasValidTvId || (isGroupId && !isPlaceholder) || (!hasValidTvId && !isPlaceholder);
  };

  const move = useCallback((direction: Direction) => {
    const currentId = currentElementRef.current?.dataset?.tvId || currentElementRef.current?.id || stateRef.current?.currentId;
    if (!currentId) {
      updateState();
      if (!stateRef.current) return;
    }

    const result = findNextNode(stateRef.current!, direction, allPlugins, pluginContext);
    if (!result || (!result.targetId && !result.action)) return;

    if (result.action === 'BACK') {
      onBackRef.current?.();
      return;
    }

    if (!result.targetId) return;
    if (result.targetId.startsWith('tv-div-')) return;

    const isGroupId = result.targetId.startsWith('for-you-');
    const targetEl = isGroupId
      ? resolveGroupTarget(result.targetId)
      : resolveElementTarget(result.targetId);

    if (targetEl && isValidTarget(targetEl, isGroupId)) {
      // Set currentElementRef immediately before focus
      currentElementRef.current = targetEl;
      targetEl.focus({ preventScroll: true });
      scrollToElement(targetEl);
      const newId = targetEl.dataset.tvId || targetEl.id || result.targetId;
      if (stateRef.current) {
        stateRef.current.currentId = newId;
      }
      updateState();
    }
  }, [allPlugins, focusElement, pluginContext, syncDomFocusToState, updateState]);

  useEffect(() => {
    let scheduled = false;

    const update = () => {
      if (scheduled) return;
      scheduled = true;

      requestAnimationFrame(() => {
        updateState();
        scheduled = false;
      });
    };

    update();

    const resizeListener = () => update();
    
    // Throttled scroll listener to prevent excessive updates during fast scrolling
    let scrollTimeout: number | null = null;
    const scrollListener = () => {
      if (scrollTimeout) return;
      scrollTimeout = globalThis.window.setTimeout(() => {
        update();
        scrollTimeout = null;
      }, 16); // ~60fps throttling
    };
    
    // Listen for custom rebuild event (e.g., when player closes and navigation reappears)
    const rebuildListener = () => {
      // Force immediate update without debouncing
      requestAnimationFrame(() => {
        updateState();
      });
    };
    
    window.addEventListener('resize', resizeListener);
    window.addEventListener('scroll', scrollListener, true);
    window.addEventListener('tv-navigation-rebuild', rebuildListener);

    // Optimized mutation observer - observe only TV containers
    let mutationScheduled = false;
    const observer = new MutationObserver((mutations) => {
      // Only process mutations that add or remove nodes
      if (!mutations.some(m => m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
        return;
      }
      if (mutationScheduled) return;
      mutationScheduled = true;

      requestAnimationFrame(() => {
        update();
        mutationScheduled = false;
      });
    });

    // Observe only TV containers instead of entire document
    const containers = document.querySelectorAll('[data-tv-container]');
    containers.forEach(container => {
      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false,
      });
    });

    // Also observe body for container additions/removals
    observer.observe(document.body, {
      childList: true,
      subtree: false,
      attributes: false,
      characterData: false,
    });

    return () => {
      window.removeEventListener('resize', resizeListener);
      window.removeEventListener('scroll', scrollListener, true);
      window.removeEventListener('tv-navigation-rebuild', rebuildListener);
      observer.disconnect();
      if (scrollTimeoutRef.current !== null) {
        cancelAnimationFrame(scrollTimeoutRef.current);
      }
      if (scrollTimeout !== null) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [updateState]);

  // Auto-focus initial element when new containers appear (e.g., modals)
  // Auto-focus initial element handled by initAutoFocus plugin
  useEffect(() => {
    return initAutoFocus();
  }, []);

  const isRadixSelectOpen = () =>
    document.querySelector('[data-radix-select-viewport]') !== null ||
    document.querySelector('[data-radix-popper-content-wrapper]') !== null ||
    document.querySelector('[data-state="open"][role="combobox"]') !== null ||
    document.querySelector('[data-state="open"][data-radix-menu-content]') !== null;

  const handleLeftKey = () => {
    const isInSidebar = currentElementRef.current?.closest('[data-tv-container="navigation"]') !== null;
    if (!isInSidebar) move('left');
  };

  const handleUpKey = () => {
    const isOnSearchInput = currentElementRef.current?.dataset.tvSearch !== undefined;
    if (!isOnSearchInput) move('up');
  };

  const handleBackOrEscapeKey = (isTyping: boolean, key: string) => {
    if (key === 'Backspace' && isTyping) return;
    const isInPortalActions = currentElementRef.current?.closest('[data-tv-container="portal-actions"]') !== null;
    if (isInPortalActions) {
      move('back');
    } else {
      onBackRef.current?.();
    }
  };

  const syncActiveElementToState = (activeEl: HTMLElement) => {
    if (activeEl !== currentElementRef.current &&
        (activeEl.matches('[data-tv-focusable]') || activeEl.closest('[data-tv-focusable]'))) {
      currentElementRef.current = activeEl;
      updateState();
    }
    const activeContainer = (activeEl.closest('[data-tv-container]') as HTMLElement | null)?.dataset.tvContainer;
    const currentContainer = (currentElementRef.current?.closest('[data-tv-container]') as HTMLElement | null)?.dataset.tvContainer;
    if (activeContainer && activeContainer !== currentContainer) {
      updateState();
    }
  };

  // Update handler refs when dependencies change
  useEffect(() => {
    handleKeyDownRef.current = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl) syncActiveElementToState(activeEl);

      if (isRadixSelectOpen()) return;

      const isTyping =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable;

      const keyMap: Record<string, () => void> = {
        ArrowRight: () => move('right'),
        Right: () => move('right'),
        ArrowLeft: handleLeftKey,
        Left: handleLeftKey,
        ArrowDown: () => move('down'),
        Down: () => move('down'),
        ArrowUp: handleUpKey,
        Up: handleUpKey,
        Enter: () => { /* handled via onKeyUp */ },
        OK: () => { /* handled via onKeyUp */ },
        Select: () => { /* handled via onKeyUp */ },
        Backspace: () => handleBackOrEscapeKey(isTyping, 'Backspace'),
        Escape: () => handleBackOrEscapeKey(isTyping, 'Escape'),
        Back: () => handleBackOrEscapeKey(isTyping, 'Back'),
      };

      const handler = keyMap[e.key];
      if (handler) {
        if (!(isTyping && e.key === 'Backspace')) e.preventDefault();
        handler();
      }
    };
  }, [move, updateState]);

  // Track last focused element before Radix dropdown opened
  const lastFocusBeforeDropdownRef = useRef<HTMLElement | null>(null);
  // Flag to prevent TV navigation interference during focus restoration
  const isRestoringFocusRef = useRef(false);

  useEffect(() => {
    handleFocusRef.current = (e: FocusEvent) => {
      const target = e.target as HTMLElement;

      // Skip focus handling during restoration
      if (isRestoringFocusRef.current) {
        return;
      }

      // Check if Radix dropdown is currently open
      const isRadixOpen = document.querySelector('[data-radix-select-viewport]') !== null ||
                          document.querySelector('[data-radix-popper-content-wrapper]') !== null ||
                          document.querySelector('[data-radix-menu-content]') !== null;

      // If focus is moving into a Radix dropdown, save the current element
      if (isRadixOpen && target instanceof Element && target?.closest('[data-radix-popper-content-wrapper], [data-radix-menu-content]')) {
        // Focus moved inside dropdown - don't update
        return;
      }

      // If dropdown was open and now closed, restore focus to last element
      if (!isRadixOpen && lastFocusBeforeDropdownRef.current) {
        const savedElement = lastFocusBeforeDropdownRef.current;
        lastFocusBeforeDropdownRef.current = null;

        isRestoringFocusRef.current = true;

        // Use multiple attempts to restore focus - Radix may move focus multiple times
        let attempts = 0;
        const maxAttempts = 5;
        const tryRestore = () => {
          const currentActive = document.activeElement as HTMLElement | null;
          const currentTvId = currentActive?.dataset?.tvId;
          const savedTvId = savedElement?.dataset?.tvId;

          // Always restore if not already on the saved element
          if (currentTvId !== savedTvId) {
            savedElement?.focus();

            // Try again if focus didn't stick
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(tryRestore, 50);
            } else {
              isRestoringFocusRef.current = false;
            }
          } else {
            isRestoringFocusRef.current = false;
          }
        };

        // Start restoration attempts
        setTimeout(tryRestore, 50);
      } else {
        // Clear the ref if dropdown is closed and we don't need to restore
        // This prevents restoring stale focus on future focus events
        lastFocusBeforeDropdownRef.current = null;
      }

      // Check if this is a TV focusable element
      if (!(target instanceof Element)) return;
      if (target.matches('[data-tv-focusable]') || target.closest('[data-tv-focusable]')) {
        let focusableEl = (target.matches('[data-tv-focusable]') ? target : target.closest('[data-tv-focusable]')) as HTMLElement;

        // Generate stable ID if element doesn't have one (based on element position in DOM)
        if (!focusableEl.dataset.tvId && !focusableEl.id) {
          const index = Array.from(focusableEl.parentElement?.children || []).indexOf(focusableEl);
          const tag = focusableEl.tagName.toLowerCase();
          const group = focusableEl.dataset.tvGroup || 'unknown';
          focusableEl.dataset.tvId = `tv-${tag}-${group}-${index}`;
        }


        // Always update currentElementRef to track actual focused element
        currentElementRef.current = focusableEl;

        // If Radix is opening, save this element
        if (isRadixOpen && !lastFocusBeforeDropdownRef.current) {
          lastFocusBeforeDropdownRef.current = focusableEl;
        }

        // Always update state when focus changes - this ensures navigation works after modal closes
        updateState();
      }
    };
  }, [updateState]);

  // Stable event listeners - never re-bind
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      const targetEl = e.target as HTMLElement;
      // Use currentElementRef if available, otherwise fall back to e.target
      const currentEl = currentElementRef.current || targetEl;

      // Check if Radix dropdown is open - let it handle navigation naturally
      // But NOT for our custom seasons dropdown - we handle that with TV navigation
      const isRadixOpen = document.querySelector('[data-radix-select-viewport]') !== null ||
                          document.querySelector('[data-radix-popper-content-wrapper]') !== null ||
                          document.querySelector('[data-radix-menu-content]') !== null;
      if (isRadixOpen) {
        // Don't block - let Radix handle the event
        return;
      }

      // Track element on keyDown to detect if focus changed before keyUp
      if (e.key === 'Enter' || e.key === 'OK' || e.key === 'Select') {
        const currentEl = currentElementRef.current;
        (globalThis as any).__tvEnterDownElement = currentEl?.dataset?.tvId || currentEl?.id;
        (globalThis as any).__tvEnterDownTimestamp = Date.now();
      }

      // If Enter is pressed on a Radix Select trigger, save focus before dropdown opens
      if (e.key === 'Enter' && currentEl?.dataset?.tvId === 'series-season-select') {
        lastFocusBeforeDropdownRef.current = currentEl;
      }

      // Block browser default navigation immediately for arrow keys
      // But allow for HTMLSelectElement to open dropdown naturally
      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Up', 'Down', 'Left', 'Right'];
      const isSelectElement = currentEl instanceof HTMLSelectElement || (currentEl instanceof Element && currentEl.closest('select') !== null);
      if (arrowKeys.includes(e.key) && !isSelectElement) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      handleKeyDownRef.current?.(e);
    };
    const focusHandler = (e: FocusEvent) => {
      handleFocusRef.current?.(e);
    };

    const handleEnterKeyUp = () => {
      if ((globalThis as any).__tvLongPressPreventClick) return;
      const current = currentElementRef.current;
      const currentId = current?.dataset?.tvId || current?.id;
      const downElementId = (globalThis as any).__tvEnterDownElement;
      (globalThis as any).__tvEnterDownElement = null;

      // Skip check for season elements (dropdown items) - allow selection even if focus shifted
      const isSeasonElement = downElementId?.startsWith('season-');

      if (downElementId && downElementId !== currentId && !isSeasonElement) return;
      if (!current) return;

      // Don't handle Enter for native select elements - let browser handle it
      if (current instanceof HTMLSelectElement) {
        return;
      }
      
      onEnterRef.current?.(current);

      // Special handling for season elements - trigger onClick on them
      if (currentId?.startsWith('season-')) {
        current.click();
        return;
      }

      current.click();
    };

    const keyUpHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'OK' || e.key === 'Select') {
        handleEnterKeyUp();
      }
    };

    // Use capturing phase to intercept before browser default navigation
    globalThis.addEventListener('keydown', keyHandler, true);
    globalThis.addEventListener('keyup', keyUpHandler, true);
    document.addEventListener('focusin', focusHandler);

    return () => {
      globalThis.removeEventListener('keydown', keyHandler, true);
      globalThis.removeEventListener('keyup', keyUpHandler, true);
      document.removeEventListener('focusin', focusHandler);
    };
  }, []);

  return { focusElement, setActiveContainer, move };
}
