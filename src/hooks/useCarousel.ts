// =========================
// 🎠 USE CAROUSEL HOOKS - Horizontal carousel with virtualization and TV support
// =========================
import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';

// Virtualization constants - tune for TV performance
const BUFFER_CARDS = 50; // Extra cards to render outside viewport
const CARD_WIDTH_MD = 140; // 140px default width (matches Movies/Series)

// Scroll constants
const GAP = 16; // Gap between cards (mr-4 = 16px)
const VISIBLE_CARDS = 3; // Number of cards to scroll at once

// =========================
// USE TV MODE HOOK - Detect TV environment
// =========================
const useTVMode = (): boolean => {
  const [isTV, setIsTV] = useState(() => {
    if (globalThis.window === undefined) return false;
    const userAgent = navigator.userAgent.toLowerCase();
    return /smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast.tv|webos|tizen|android.*tv|rim.tv|playstation|xbox/.test(userAgent);
  });

  useEffect(() => {
    // Check for TV user agent
    const userAgent = navigator.userAgent.toLowerCase();
    const isTVUserAgent = /smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast.tv|webos|tizen|android.*tv|rim.tv|playstation|xbox/.test(userAgent);
    
    // Check for coarse pointer (TV remotes, gamepads)
    const hasCoarsePointer = globalThis.matchMedia('(pointer: coarse)').matches;
    
    // Check for keyboard navigation active (Tab key pressed recently)
    let keyboardNavActive = false;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key.startsWith('Arrow')) {
        keyboardNavActive = true;
      }
    };
    const handlePointerDown = () => {
      keyboardNavActive = false;
    };
    
    globalThis.addEventListener('keydown', handleKeyDown);
    globalThis.addEventListener('pointerdown', handlePointerDown);
    
    setIsTV(isTVUserAgent || hasCoarsePointer || keyboardNavActive);
    
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
      globalThis.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return isTV;
};

// =========================
// CORE CAROUSEL HOOK - Handles scrolling, resize, width, locking, UI flags
// =========================
interface UseCarouselCoreOptions {
  /** Items array (used for length calculation) */
  items: unknown[];
  /** Enable virtualization */
  virtualization: boolean;
  /** TV mode flag */
  isTV: boolean;
}

interface UseCarouselCoreReturn {
  /** Scroll container ref */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Can scroll left */
  canScrollLeft: boolean;
  /** Can scroll right */
  canScrollRight: boolean;
  /** Visible range for virtualization */
  visibleRange: { start: number; end: number };
  /** Scroll function */
  scroll: (direction: 'left' | 'right') => void;
  /** Get card width helper */
  getCardWidth: () => number;
  /** Scroll to specific index and center it */
  scrollToIndex: (index: number) => void;
}

export const useCarouselCore = ({
  items,
  virtualization,
  isTV,
}: UseCarouselCoreOptions): UseCarouselCoreReturn => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardWidthRef = useRef<number>(CARD_WIDTH_MD);
  const scrollLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkScrollRafRef = useRef<number | null>(null);
  const updateRangeRafRef = useRef<number | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });
  const isScrollingRef = useRef(false);


  // Update cached card width (call on mount/resize)
  const updateCardWidth = useCallback(() => {
    const first = scrollRef.current?.children[0] as HTMLElement;
    const width = first?.getBoundingClientRect().width ?? CARD_WIDTH_MD;
    cardWidthRef.current = width || CARD_WIDTH_MD;
  }, []);

  // Stable checkScroll with useCallback
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(
      el.scrollLeft < el.scrollWidth - el.clientWidth - 10
    );
  }, []);

  // RAF-based throttling for checkScroll (syncs with rendering)
  const throttledCheckScroll = useMemo(() => {
    return () => {
      if (checkScrollRafRef.current !== null) return;
      checkScrollRafRef.current = requestAnimationFrame(() => {
        checkScroll();
        checkScrollRafRef.current = null;
      });
    };
  }, [checkScroll]);

  // Virtualization - update visible range on scroll
  // On TV: disable virtualization - render all items to prevent focus loss
  const updateVisibleRange = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    // TV mode: render all items, no virtualization
    if (isTV || !virtualization) {
      setVisibleRange(prev => 
        prev.start === 0 && prev.end === items.length 
          ? prev 
          : { start: 0, end: items.length }
      );
      return;
    }

    const cardWidth = cardWidthRef.current;
    const containerWidth = el.clientWidth;
    const scrollLeft = el.scrollLeft;
    
    // Calculate visible indices
    const startIndex = Math.max(0, Math.floor(scrollLeft / cardWidth) - BUFFER_CARDS);
    const visibleCount = Math.ceil(containerWidth / cardWidth) + BUFFER_CARDS * 2;
    const endIndex = Math.min(items.length, startIndex + visibleCount);

    setVisibleRange(prev => 
      prev.start === startIndex && prev.end === endIndex 
        ? prev 
        : { start: startIndex, end: endIndex }
    );
  }, [items.length, isTV, virtualization]);

  // RAF-based throttling for updateRange (syncs with rendering)
  const throttledUpdateRange = useMemo(() => {
    return () => {
      if (updateRangeRafRef.current !== null) return;
      updateRangeRafRef.current = requestAnimationFrame(() => {
        updateVisibleRange();
        updateRangeRafRef.current = null;
      });
    };
  }, [updateVisibleRange]);

  // Setup scroll and resize observers
  const setupObservers = useCallback(() => {
    const ref = scrollRef.current;
    if (!ref) return;

    // Initial check
    checkScroll();
    updateCardWidth();
    updateVisibleRange();

    // Combined scroll listener
    const handleScroll = () => {
      throttledCheckScroll();
      throttledUpdateRange();
    };
    
    ref.addEventListener('scroll', handleScroll);
    
    // Update on container resize (better than window resize for TV) - throttled with RAF
    const resizeObserver = new ResizeObserver(() => {
      if (resizeRafRef.current !== null) return;
      resizeRafRef.current = requestAnimationFrame(() => {
        checkScroll();
        updateCardWidth();
        updateVisibleRange();
        resizeRafRef.current = null;
      });
    });
    resizeObserver.observe(ref);
    
    return () => {
      ref.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
    };
  }, [checkScroll, throttledCheckScroll, throttledUpdateRange, updateCardWidth, updateVisibleRange]);

  // Effect to setup observers (only run once when setupObservers changes)
  useEffect(() => {
    const cleanup = setupObservers();
    return () => cleanup?.();
  }, [setupObservers]);

  // Separate effect to update visible range when items change
  useEffect(() => {
    updateVisibleRange();
  }, [items]);

  // Reset scroll position on items change (important for TV focus UX)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const reset = () => {
      el.scrollTo({ left: 0, behavior: 'auto' });
    };

    requestAnimationFrame(reset);

    const ro = new ResizeObserver(() => {
      reset();
    });

    ro.observe(el);

    return () => ro.disconnect();
  }, [items]);

  // Cleanup scroll lock timer and RAF requests on unmount
  useEffect(() => {
    return () => {
      if (scrollLockTimerRef.current) {
        clearTimeout(scrollLockTimerRef.current);
      }
      if (checkScrollRafRef.current !== null) {
        cancelAnimationFrame(checkScrollRafRef.current);
      }
      if (updateRangeRafRef.current !== null) {
        cancelAnimationFrame(updateRangeRafRef.current);
      }
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
      }
    };
  }, []);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (scrollRef.current) {
      // Prevent scroll spam on non-TV mode
      if (!isTV && isScrollingRef.current) return;

      // Use cached card width for scroll amount
      const cardWidth = cardWidthRef.current;
      const scrollAmount = cardWidth * VISIBLE_CARDS + GAP * VISIBLE_CARDS;

      // Use 'auto' for TV mode to prevent animation queuing, 'smooth' for desktop
      const behavior = isTV ? 'auto' : 'smooth';

      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior,
      });

      // Lock scroll for non-TV mode with debounce
      if (!isTV) {
        isScrollingRef.current = true;
        if (scrollLockTimerRef.current) {
          clearTimeout(scrollLockTimerRef.current);
        }
        scrollLockTimerRef.current = setTimeout(() => { isScrollingRef.current = false; }, 120);
      }
    }
  }, [isTV]);

  const getCardWidthFn = useCallback(() => {
    return cardWidthRef.current;
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el) return;

    const effectiveWidth = cardWidthRef.current + GAP;
    const target = index * effectiveWidth;

    const centered =
      target - el.clientWidth / 2 + effectiveWidth / 2;

    el.scrollTo({
      left: centered,
      behavior: isTV ? 'auto' : 'smooth',
    });
  }, [isTV]);

  return useMemo(() => ({
    scrollRef,
    canScrollLeft,
    canScrollRight,
    visibleRange,
    scroll,
    getCardWidth: getCardWidthFn,
    scrollToIndex,
  }), [canScrollLeft, canScrollRight, visibleRange, scroll, getCardWidthFn, scrollToIndex]);
};

// =========================
// CONVENIENCE CAROUSEL HOOK - Auto-detects TV mode
// =========================
interface UseCarouselOptions {
  /** Items array (used for length calculation) */
  items: unknown[];
  /** Enable virtualization (default: true, auto-disabled on TV) */
  virtualization?: boolean;
  /** Force TV mode (default: auto-detect) */
  tvMode?: boolean;
}

interface UseCarouselReturn {
  /** Scroll container ref */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Can scroll left */
  canScrollLeft: boolean;
  /** Can scroll right */
  canScrollRight: boolean;
  /** Visible range for virtualization */
  visibleRange: { start: number; end: number };
  /** Is TV mode active */
  isTV: boolean;
  /** Scroll function */
  scroll: (direction: 'left' | 'right') => void;
  /** Get card width helper */
  getCardWidth: () => number;
  /** Scroll to specific index and center it (for TV focus) */
  scrollToIndex: (index: number) => void;
}

export const useCarousel = ({
  items,
  virtualization = true,
  tvMode,
}: UseCarouselOptions): UseCarouselReturn => {
  const detectedTV = useTVMode();
  const isTV = tvMode ?? detectedTV;

  const core = useCarouselCore({
    items,
    virtualization: isTV ? false : virtualization, // Disable virtualization on TV
    isTV,
  });

  return useMemo(() => ({
    ...core,
    isTV,
  }), [core, isTV]);
};
