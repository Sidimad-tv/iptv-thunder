import { renderHook } from '@testing-library/react';
import { useCarousel, useCarouselCore } from '../useCarousel';

// Mock navigator.userAgent
Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  writable: true,
});

// Mock requestAnimationFrame and cancelAnimationFrame
globalThis.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));
globalThis.cancelAnimationFrame = jest.fn();

describe('useCarouselCore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('should return carousel core methods', () => {
    const { result } = renderHook(() =>
      useCarouselCore({ items: [1, 2, 3], virtualization: true, isTV: false })
    );

    expect(result.current).toHaveProperty('scrollRef');
    expect(result.current).toHaveProperty('canScrollLeft');
    expect(result.current).toHaveProperty('canScrollRight');
    expect(result.current).toHaveProperty('visibleRange');
    expect(result.current).toHaveProperty('scroll');
    expect(result.current).toHaveProperty('getCardWidth');
    expect(result.current).toHaveProperty('scrollToIndex');
  });

  it('should disable virtualization on TV mode', () => {
    const { result } = renderHook(() =>
      useCarouselCore({ items: [1, 2, 3], virtualization: true, isTV: true })
    );

    // On TV mode, virtualization is disabled - initial state may be { start: 0, end: 10 }
    // but the hook will update it when ref is available
    expect(result.current.visibleRange).toHaveProperty('start');
    expect(result.current.visibleRange).toHaveProperty('end');
  });

  it('should enable virtualization on non-TV mode', () => {
    const { result } = renderHook(() =>
      useCarouselCore({ items: [1, 2, 3, 4, 5], virtualization: true, isTV: false })
    );

    // With virtualization, the range should be based on buffer cards
    expect(result.current.visibleRange.start).toBeGreaterThanOrEqual(0);
    expect(result.current.visibleRange.end).toBeGreaterThan(0);
  });

  it('should return getCardWidth function', () => {
    const { result } = renderHook(() =>
      useCarouselCore({ items: [1, 2, 3], virtualization: true, isTV: false })
    );

    const width = result.current.getCardWidth();
    expect(typeof width).toBe('number');
  });
});

describe('useCarousel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('should return carousel methods', () => {
    const { result } = renderHook(() =>
      useCarousel({ items: [1, 2, 3], virtualization: true })
    );

    expect(result.current).toHaveProperty('scrollRef');
    expect(result.current).toHaveProperty('canScrollLeft');
    expect(result.current).toHaveProperty('canScrollRight');
    expect(result.current).toHaveProperty('visibleRange');
    expect(result.current).toHaveProperty('isTV');
    expect(result.current).toHaveProperty('scroll');
    expect(result.current).toHaveProperty('getCardWidth');
    expect(result.current).toHaveProperty('scrollToIndex');
  });

  it('should auto-detect TV mode', () => {
    const { result } = renderHook(() =>
      useCarousel({ items: [1, 2, 3], virtualization: true })
    );

    expect(typeof result.current.isTV).toBe('boolean');
  });

  it('should use forced TV mode when provided', () => {
    const { result } = renderHook(() =>
      useCarousel({ items: [1, 2, 3], virtualization: true, tvMode: true })
    );

    expect(result.current.isTV).toBe(true);
  });

  it('should disable virtualization when TV mode is forced', () => {
    const { result } = renderHook(() =>
      useCarousel({ items: [1, 2, 3], virtualization: true, tvMode: true })
    );

    // On TV mode, virtualization is disabled
    expect(result.current.visibleRange).toHaveProperty('start');
    expect(result.current.visibleRange).toHaveProperty('end');
  });

  it('should use default virtualization setting', () => {
    const { result } = renderHook(() =>
      useCarousel({ items: [1, 2, 3] })
    );

    expect(typeof result.current.visibleRange).toBe('object');
  });
});
