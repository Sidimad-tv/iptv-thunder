import { renderHook, act } from '@testing-library/react';
import { useLongPress } from '../useLongPress';

// Mock window.addEventListener and removeEventListener
const addEventListenerSpy = jest.spyOn(window, 'addEventListener').mockImplementation();
const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener').mockImplementation();

describe('useLongPress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset window globals
    (window as any).__tvLongPressHandled = false;
    (window as any).__tvLongPressPreventClick = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return long press handlers', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    expect(result.current).toHaveProperty('onMouseDown');
    expect(result.current).toHaveProperty('onMouseUp');
    expect(result.current).toHaveProperty('onMouseLeave');
    expect(result.current).toHaveProperty('onTouchStart');
    expect(result.current).toHaveProperty('onTouchEnd');
    expect(result.current).toHaveProperty('onTouchMove');
    expect(result.current).toHaveProperty('onKeyDown');
    expect(result.current).toHaveProperty('onKeyUp');
    expect(result.current).toHaveProperty('isLongPress');
    expect(result.current).toHaveProperty('isLongPressRef');
    expect(result.current).toHaveProperty('ref');
  });

  it('should set isLongPress to true after delay on mouse down', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, delay: 500 }));

    const event = new MouseEvent('mousedown') as any;
    result.current.onMouseDown(event);

    expect(result.current.isLongPress).toBe(false);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isLongPress).toBe(true);
    expect(onLongPress).toHaveBeenCalled();
  });

  it('should reset isLongPress on mouse up', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, delay: 500 }));

    const event = new MouseEvent('mousedown') as any;
    result.current.onMouseDown(event);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isLongPress).toBe(true);

    const upEvent = new MouseEvent('mouseup') as any;
    result.current.onMouseUp(upEvent);

    expect(result.current.isLongPress).toBe(true); // Still true due to 100ms delay

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.isLongPress).toBe(false);
  });

  it('should reset isLongPress on mouse leave', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, delay: 500 }));

    const event = new MouseEvent('mousedown') as any;
    result.current.onMouseDown(event);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isLongPress).toBe(true);

    const leaveEvent = new MouseEvent('mouseleave') as any;
    act(() => {
      result.current.onMouseLeave(leaveEvent);
    });

    expect(result.current.isLongPress).toBe(false);
  });

  it('should prevent default on touch start if shouldPreventDefault is true', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, shouldPreventDefault: true }));

    const event = new TouchEvent('touchstart', { cancelable: true }) as any;
    result.current.onTouchStart(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('should not prevent default on touch start if shouldPreventDefault is false', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, shouldPreventDefault: false }));

    const event = new TouchEvent('touchstart', { cancelable: true }) as any;
    result.current.onTouchStart(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('should set isLongPress to true after delay on touch start', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, delay: 500 }));

    const event = new TouchEvent('touchstart') as any;
    result.current.onTouchStart(event);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isLongPress).toBe(true);
    expect(onLongPress).toHaveBeenCalled();
  });

  it('should reset isLongPress on touch end', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, delay: 500 }));

    const event = new TouchEvent('touchstart') as any;
    result.current.onTouchStart(event);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isLongPress).toBe(true);

    const endEvent = new TouchEvent('touchend') as any;
    result.current.onTouchEnd(endEvent);

    expect(result.current.isLongPress).toBe(true); // Still true due to 100ms delay

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.isLongPress).toBe(false);
  });

  it('should reset isLongPress on touch move', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, delay: 500 }));

    const event = new TouchEvent('touchstart') as any;
    result.current.onTouchStart(event);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isLongPress).toBe(true);

    const moveEvent = new TouchEvent('touchmove') as any;
    act(() => {
      result.current.onTouchMove(moveEvent);
    });

    expect(result.current.isLongPress).toBe(false);
  });

  it('should use default delay of 500ms', () => {
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    const event = new MouseEvent('mousedown') as any;
    result.current.onMouseDown(event);

    act(() => {
      jest.advanceTimersByTime(499);
    });

    expect(result.current.isLongPress).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(result.current.isLongPress).toBe(true);
  });

  it('should clear timeout on mouse up', () => {
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
    const onLongPress = jest.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, delay: 500 }));

    const event = new MouseEvent('mousedown') as any;
    result.current.onMouseDown(event);

    const upEvent = new MouseEvent('mouseup') as any;
    result.current.onMouseUp(upEvent);

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should add tvlongpress event listener', () => {
    renderHook(() => useLongPress({ onLongPress: jest.fn() }));

    expect(addEventListenerSpy).toHaveBeenCalledWith('tvlongpress', expect.any(Function));
  });

  it('should remove tvlongpress event listener on unmount', () => {
    const { unmount } = renderHook(() => useLongPress({ onLongPress: jest.fn() }));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('tvlongpress', expect.any(Function));
  });

  it('should handle tvlongpress event', () => {
    const onLongPress = jest.fn();
    renderHook(() => useLongPress({ onLongPress }));

    // Verify the event listener was added
    expect(addEventListenerSpy).toHaveBeenCalledWith('tvlongpress', expect.any(Function));
  });
});
