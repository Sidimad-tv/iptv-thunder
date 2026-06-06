import { useRef, useEffect, useCallback } from 'react';

interface TVKeyboardOptions {
  onBack?: () => void;
  onEnter?: (element: HTMLElement) => void | boolean;
  onMenu?: () => void;
  onFocusNext?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  getCurrentElement?: () => HTMLElement | null;
  getGlobalActiveContainer?: () => HTMLElement | null;
  getLocalActiveContainer?: () => HTMLElement | null;
}

export function useTVKeyboard(options: TVKeyboardOptions = {}) {
  const { 
    onBack, 
    onEnter, 
    onMenu,
    onFocusNext,
    getCurrentElement,
    getGlobalActiveContainer,
    getLocalActiveContainer
  } = options;
  
  const onBackRef = useRef(onBack);
  const onEnterRef = useRef(onEnter);
  const onMenuRef = useRef(onMenu);
  const onFocusNextRef = useRef(onFocusNext);
  const enterClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for tvlongpress event to cancel pending click
  const handleTvLongPress = useCallback(() => {
    if (enterClickTimeoutRef.current) {
      clearTimeout(enterClickTimeoutRef.current);
      enterClickTimeoutRef.current = null;
    }
  }, []);
  
  useEffect(() => { onBackRef.current = onBack; }, [onBack]);
  useEffect(() => { onEnterRef.current = onEnter; }, [onEnter]);
  useEffect(() => { onMenuRef.current = onMenu; }, [onMenu]);
  useEffect(() => { onFocusNextRef.current = onFocusNext; }, [onFocusNext]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const globalActiveContainer = getGlobalActiveContainer?.();
      const localActiveContainer = getLocalActiveContainer?.();
      
      if (globalActiveContainer && globalActiveContainer !== localActiveContainer) {
        return;
      }

      const handleNavigation = (direction: 'up' | 'down' | 'left' | 'right') => {
        if (direction === 'up') {
          const current = getCurrentElement?.();
          const isOnSearchInput = current?.dataset.tvSearch !== undefined;
          if (!isOnSearchInput) {
            onFocusNextRef.current?.(direction);
          }
        } else if (direction === 'left') {
          const current = getCurrentElement?.();
          const isInSidebar = current?.closest('[data-tv-container="navigation"]') !== null;
          if (!isInSidebar) {
            onFocusNextRef.current?.(direction);
          }
        } else {
          onFocusNextRef.current?.(direction);
        }
      };

      const handleEnter = () => {
        const current = getCurrentElement?.();
        if (current) {
          // Clear any pending click
          if (enterClickTimeoutRef.current) {
            clearTimeout(enterClickTimeoutRef.current);
          }
          
          // Delay the click to allow long press detection
          enterClickTimeoutRef.current = setTimeout(() => {
            // Check if long press was triggered
            if (!(window as any).__tvLongPressPreventClick) {
              const handled = onEnterRef.current?.(current);
              if (handled !== true) {
                current.click();
              }
            }
          }, 550); // Delay longer than MainActivity's 500ms long press
        }
      };

      // Check if user is typing in an input field
      const isTyping =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable;

      const keyMap: Record<string, () => void> = {
        Right: () => handleNavigation('right'),
        Left: () => handleNavigation('left'),
        Down: () => handleNavigation('down'),
        Up: () => handleNavigation('up'),
        Enter: handleEnter,
        OK: handleEnter,
        Select: handleEnter,
        Menu: () => onMenuRef.current?.(),
        Backspace: () => {
          if (!isTyping) {
            onBackRef.current?.();
          }
        },
        Escape: () => onBackRef.current?.(),
        Back: () => onBackRef.current?.(),
      };

      const handler = keyMap[e.key];
      if (handler) {
        // Don't prevent default if user is typing and pressed Backspace
        if (!(isTyping && e.key === 'Backspace')) {
          e.preventDefault();
        }
        handler();
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    globalThis.addEventListener('tvlongpress', handleTvLongPress);

    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
      globalThis.removeEventListener('tvlongpress', handleTvLongPress);
      if (enterClickTimeoutRef.current) {
        clearTimeout(enterClickTimeoutRef.current);
      }
    };
  }, [getCurrentElement, getGlobalActiveContainer, getLocalActiveContainer]);

  return {};
}
