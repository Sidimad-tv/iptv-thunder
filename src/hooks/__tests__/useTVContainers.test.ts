import { renderHook, act } from '@testing-library/react';
import { useTVContainers } from '../useTVContainers';

describe('useTVContainers', () => {
  beforeEach(() => {
    // Reset global state
    (globalThis as any).globalActiveContainer = null;
    (globalThis as any).activeContainerRefCount = 0;
  });

  it('should return container management functions', () => {
    const { result } = renderHook(() => useTVContainers());

    expect(result.current).toHaveProperty('activeContainerRef');
    expect(result.current).toHaveProperty('setActiveContainer');
    expect(result.current).toHaveProperty('getActiveContainer');
    expect(result.current).toHaveProperty('getGlobalActiveContainer');
    expect(result.current).toHaveProperty('saveLastFocused');
    expect(result.current).toHaveProperty('restoreLastFocused');
  });

  it('should set active container', () => {
    const { result } = renderHook(() => useTVContainers());
    const container = document.createElement('div');

    act(() => {
      result.current.setActiveContainer(container);
    });

    expect(result.current.activeContainerRef.current).toBe(container);
    expect(result.current.getGlobalActiveContainer()).toBe(container);
  });

  it('should clear active container when setting null', () => {
    const { result } = renderHook(() => useTVContainers());
    const container = document.createElement('div');

    act(() => {
      result.current.setActiveContainer(container);
      result.current.setActiveContainer(null);
    });

    expect(result.current.activeContainerRef.current).toBeNull();
  });

  it('should return active container', () => {
    const { result } = renderHook(() => useTVContainers());
    const container = document.createElement('div');

    act(() => {
      result.current.setActiveContainer(container);
    });

    expect(result.current.getActiveContainer()).toBe(container);
  });

  it('should save last focused element for container', () => {
    const onContainerFocus = jest.fn();
    const { result } = renderHook(() => useTVContainers({ onContainerFocus }));
    const container = document.createElement('div');
    container.id = 'test-container';
    const element = document.createElement('button');

    act(() => {
      result.current.saveLastFocused(element);
    });

    expect(result.current.restoreLastFocused('test-container')).toBeNull();
    expect(onContainerFocus).toHaveBeenCalledWith(element);
  });

  it('should restore last focused element', () => {
    const { result } = renderHook(() => useTVContainers());
    const container = document.createElement('div');
    container.id = 'test-container';
    container.setAttribute('data-tv-container', 'true');
    const element = document.createElement('button');

    act(() => {
      container.appendChild(element);
      result.current.saveLastFocused(element);
    });

    const restored = result.current.restoreLastFocused('test-container');
    expect(restored).toBe(element);
  });

  it('should update onContainerFocus callback when it changes', () => {
    const onContainerFocus1 = jest.fn();
    const onContainerFocus2 = jest.fn();
    const { result, rerender } = renderHook(
      ({ onContainerFocus }) => useTVContainers({ onContainerFocus }),
      { initialProps: { onContainerFocus: onContainerFocus1 } }
    );

    const element = document.createElement('button');

    rerender({ onContainerFocus: onContainerFocus2 });

    act(() => {
      result.current.saveLastFocused(element);
    });

    expect(onContainerFocus2).toHaveBeenCalledWith(element);
    expect(onContainerFocus1).not.toHaveBeenCalled();
  });

  it('should cleanup global state on unmount', () => {
    const { result, unmount } = renderHook(() => useTVContainers());
    const container = document.createElement('div');

    act(() => {
      result.current.setActiveContainer(container);
    });

    unmount();

    expect(result.current.getGlobalActiveContainer()).toBeNull();
  });
});
