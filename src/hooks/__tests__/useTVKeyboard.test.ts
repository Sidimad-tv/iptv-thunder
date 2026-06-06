import { renderHook, act } from '@testing-library/react';
import { useTVKeyboard } from '../useTVKeyboard';

// Mock console.log to avoid noise
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

describe('useTVKeyboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset window globals
    (window as any).__tvLongPressPreventClick = false;
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleLogSpy.mockClear();
  });

  it('should return empty object', () => {
    const { result } = renderHook(() => useTVKeyboard());
    expect(result.current).toEqual({});
  });

  it('should add keydown event listener', () => {
    const addEventListenerSpy = jest.spyOn(globalThis, 'addEventListener');
    const { unmount } = renderHook(() => useTVKeyboard());

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    unmount();
  });

  it('should add tvlongpress event listener', () => {
    const addEventListenerSpy = jest.spyOn(globalThis, 'addEventListener');
    const { unmount } = renderHook(() => useTVKeyboard());

    expect(addEventListenerSpy).toHaveBeenCalledWith('tvlongpress', expect.any(Function));
    unmount();
  });

  it('should remove event listeners on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(globalThis, 'removeEventListener');
    const { unmount } = renderHook(() => useTVKeyboard());

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('tvlongpress', expect.any(Function));
  });

  it('should call onBack when Backspace is pressed', () => {
    const onBack = jest.fn();
    renderHook(() => useTVKeyboard({ onBack }));

    const event = new KeyboardEvent('keydown', { key: 'Backspace' });
    globalThis.dispatchEvent(event);

    expect(onBack).toHaveBeenCalled();
  });

  it('should call onBack when Escape is pressed', () => {
    const onBack = jest.fn();
    renderHook(() => useTVKeyboard({ onBack }));

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    globalThis.dispatchEvent(event);

    expect(onBack).toHaveBeenCalled();
  });

  it('should call onBack when Back is pressed', () => {
    const onBack = jest.fn();
    renderHook(() => useTVKeyboard({ onBack }));

    const event = new KeyboardEvent('keydown', { key: 'Back' });
    globalThis.dispatchEvent(event);

    expect(onBack).toHaveBeenCalled();
  });

  it('should call onMenu when Menu is pressed', () => {
    const onMenu = jest.fn();
    renderHook(() => useTVKeyboard({ onMenu }));

    const event = new KeyboardEvent('keydown', { key: 'Menu' });
    globalThis.dispatchEvent(event);

    expect(onMenu).toHaveBeenCalled();
  });

  it('should call onFocusNext with right direction when Right key is pressed', () => {
    const onFocusNext = jest.fn();
    const { unmount } = renderHook(() => useTVKeyboard({ onFocusNext }));

    const event = new KeyboardEvent('keydown', { key: 'Right' });
    globalThis.dispatchEvent(event);

    expect(onFocusNext).toHaveBeenCalledWith('right');
    unmount();
  });

  it('should call onFocusNext with left direction when Left key is pressed', () => {
    const onFocusNext = jest.fn();
    const element = document.createElement('button');
    const getCurrentElement = jest.fn().mockReturnValue(element);
    const { unmount } = renderHook(() => useTVKeyboard({ onFocusNext, getCurrentElement }));

    const event = new KeyboardEvent('keydown', { key: 'Left' });
    globalThis.dispatchEvent(event);

    expect(onFocusNext).toHaveBeenCalledWith('left');
    unmount();
  });

  it('should call onFocusNext with down direction when Down key is pressed', () => {
    const onFocusNext = jest.fn();
    const { unmount } = renderHook(() => useTVKeyboard({ onFocusNext }));

    const event = new KeyboardEvent('keydown', { key: 'Down' });
    globalThis.dispatchEvent(event);

    expect(onFocusNext).toHaveBeenCalledWith('down');
    unmount();
  });

  it('should call onFocusNext with up direction when Up key is pressed', () => {
    const onFocusNext = jest.fn();
    const { unmount } = renderHook(() => useTVKeyboard({ onFocusNext }));

    const event = new KeyboardEvent('keydown', { key: 'Up' });
    globalThis.dispatchEvent(event);

    expect(onFocusNext).toHaveBeenCalledWith('up');
    unmount();
  });

  it('should not call onFocusNext for up when on search input', () => {
    const onFocusNext = jest.fn();
    const element = document.createElement('input');
    element.dataset.tvSearch = 'true';
    const getCurrentElement = jest.fn().mockReturnValue(element);

    renderHook(() => useTVKeyboard({ onFocusNext, getCurrentElement }));

    const event = new KeyboardEvent('keydown', { key: 'Up' });
    globalThis.dispatchEvent(event);

    expect(onFocusNext).not.toHaveBeenCalled();
  });

  it('should not call onFocusNext for left when in sidebar', () => {
    const onFocusNext = jest.fn();
    const element = document.createElement('button');
    const sidebar = document.createElement('div');
    sidebar.setAttribute('data-tv-container', 'navigation');
    sidebar.appendChild(element);
    document.body.appendChild(sidebar);
    const getCurrentElement = jest.fn().mockReturnValue(element);

    renderHook(() => useTVKeyboard({ onFocusNext, getCurrentElement }));

    const event = new KeyboardEvent('keydown', { key: 'Left' });
    globalThis.dispatchEvent(event);

    expect(onFocusNext).not.toHaveBeenCalled();
    document.body.removeChild(sidebar);
  });

  it('should prevent default for navigation keys', () => {
    const preventDefaultSpy = jest.spyOn(KeyboardEvent.prototype, 'preventDefault');
    renderHook(() => useTVKeyboard());

    const event = new KeyboardEvent('keydown', { key: 'Right' });
    globalThis.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should not prevent default for Backspace when typing in input', () => {
    const preventDefaultSpy = jest.spyOn(KeyboardEvent.prototype, 'preventDefault');
    const input = document.createElement('input');
    input.focus();
    renderHook(() => useTVKeyboard());

    const event = new KeyboardEvent('keydown', { key: 'Backspace' });
    Object.defineProperty(event, 'target', { value: input, writable: false });
    globalThis.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('should handle tvlongpress event to cancel pending click', () => {
    const onEnter = jest.fn();
    const element = document.createElement('button');
    element.click = jest.fn();
    const getCurrentElement = jest.fn().mockReturnValue(element);

    renderHook(() => useTVKeyboard({ onEnter, getCurrentElement }));

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    globalThis.dispatchEvent(enterEvent);

    // Simulate tvlongpress event before timeout
    (window as any).__tvLongPressPreventClick = true;
    globalThis.dispatchEvent(new Event('tvlongpress'));

    act(() => {
      jest.advanceTimersByTime(550);
    });

    expect(element.click).not.toHaveBeenCalled();
  });

  it('should respect global vs local active container', () => {
    const onFocusNext = jest.fn();
    const globalContainer = document.createElement('div');
    const localContainer = document.createElement('div');
    const getGlobalActiveContainer = jest.fn().mockReturnValue(globalContainer);
    const getLocalActiveContainer = jest.fn().mockReturnValue(localContainer);

    renderHook(() => useTVKeyboard({ onFocusNext, getGlobalActiveContainer, getLocalActiveContainer }));

    const event = new KeyboardEvent('keydown', { key: 'Right' });
    globalThis.dispatchEvent(event);

    // Should not call onFocusNext when global and local containers differ
    expect(onFocusNext).not.toHaveBeenCalled();
  });

  it('should call onFocusNext when global and local containers match', () => {
    const onFocusNext = jest.fn();
    const container = document.createElement('div');
    const getGlobalActiveContainer = jest.fn().mockReturnValue(container);
    const getLocalActiveContainer = jest.fn().mockReturnValue(container);

    renderHook(() => useTVKeyboard({ onFocusNext, getGlobalActiveContainer, getLocalActiveContainer }));

    const event = new KeyboardEvent('keydown', { key: 'Right' });
    globalThis.dispatchEvent(event);

    expect(onFocusNext).toHaveBeenCalledWith('right');
  });
});
