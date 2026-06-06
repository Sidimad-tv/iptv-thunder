import React, { useRef, useCallback, useState, useEffect } from 'react';

type LongPressCallback = (e: React.TouchEvent | React.MouseEvent | React.KeyboardEvent | Event) => void;

interface UseLongPressOptions {
  onLongPress: LongPressCallback;
  delay?: number;
  shouldPreventDefault?: boolean;
}

export const useLongPress = ({
  onLongPress,
  delay = 500,
  shouldPreventDefault = true,
}: UseLongPressOptions) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetRef = useRef<EventTarget | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);
  const isLongPressRef = useRef(false);

  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;

  // Listen for native Android TV long press events
  useEffect(() => {
    const handleTvLongPress = (e: Event) => {
      // Check if already handled by another component
      if ((window as any).__tvLongPressHandled) {
        return;
      }

      // Check if this element is the active element
      const activeElement = document.activeElement as HTMLElement;
      const isSameElement = elementRef.current === activeElement;

      // Only handle long press if this element is actually focused
      if (!isSameElement) {
        return;
      }

      // Mark as handled
      (window as any).__tvLongPressHandled = true;

      // Set flag to prevent select even if onKeyUp fires
      (window as any).__tvLongPressPreventClick = true;

      // Trigger onLongPress for this instance
      setIsLongPress(true);
      isLongPressRef.current = true;
      onLongPressRef.current(e);

      // Reset flags after a delay
      setTimeout(() => {
        setIsLongPress(false);
        isLongPressRef.current = false;
        (window as any).__tvLongPressPreventClick = false;
        (window as any).__tvLongPressHandled = false;
      }, 1000);
    };

    window.addEventListener('tvlongpress', handleTvLongPress);
    return () => {
      window.removeEventListener('tvlongpress', handleTvLongPress);
    };
  }, []); // Empty array - only run once

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Only prevent default on touch events to avoid interfering with mouse clicks
      if (shouldPreventDefault && e instanceof TouchEvent) {
        e.preventDefault();
      }
      
      setIsLongPress(false);
      targetRef.current = e.target;
      
      timeoutRef.current = setTimeout(() => {
        setIsLongPress(true);
        onLongPress(e);
      }, delay);
    },
    [onLongPress, delay, shouldPreventDefault]
  );

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    targetRef.current = null;
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      start(e);
    },
    [start]
  );

  const onMouseUp = useCallback(
    (_e: React.MouseEvent) => {
      clear();
      // Reset long press state after a short delay
      setTimeout(() => setIsLongPress(false), 100);
    },
    [clear]
  );

  const onMouseLeave = useCallback(
    (_e: React.MouseEvent) => {
      clear();
      setIsLongPress(false);
    },
    [clear]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (shouldPreventDefault) {
        e.preventDefault();
      }
      start(e);
    },
    [start, shouldPreventDefault]
  );

  const onTouchEnd = useCallback(
    (_e: React.TouchEvent) => {
      clear();
      setTimeout(() => setIsLongPress(false), 100);
    },
    [clear]
  );

  const onTouchMove = useCallback(
    (_e: React.TouchEvent) => {
      clear();
      setIsLongPress(false);
    },
    [clear]
  );

  // Keyboard handlers for Android TV remote long press
  const onKeyDown = useCallback(
    (_: React.KeyboardEvent) => {
      // Don't handle keyboard long press here - let native Android handle it
      // Native Android sends tvlongpress event which is handled in the useEffect above
    },
    []
  );

  const onKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'OK' || e.key === 'Select') {
        clear();
        setTimeout(() => setIsLongPress(false), 100);
      }
    },
    [clear]
  );

  // Ref callback to track the element
  const refCallback = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
  }, []);

  return {
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onTouchStart,
    onTouchEnd,
    onTouchMove,
    onKeyDown,
    onKeyUp,
    isLongPress,
    isLongPressRef,
    ref: refCallback,
  };
};
