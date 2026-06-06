import { renderHook } from '@testing-library/react';
import { useTVFocusGraph } from '../useTVFocusGraph';

// Mock the tv-navigation module
jest.mock('../tv-navigation', () => ({
  findNextNode: jest.fn(),
  Direction: {},
  buildNavigationState: jest.fn(() => ({ currentId: null, nodes: [], grid: new Map() })),
  findElementById: jest.fn(),
  filterVisibleElements: jest.fn((el) => el),
  isVisible: jest.fn(() => true),
  gridPlugin: {},
  containerPlugin: {},
  wrapPlugin: {},
  spatialPlugin: {},
}));

// Mock requestAnimationFrame
globalThis.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));
globalThis.cancelAnimationFrame = jest.fn();

describe('useTVFocusGraph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('should return focus graph methods', () => {
    const { result } = renderHook(() => useTVFocusGraph());

    expect(result.current).toHaveProperty('focusableElementsRef');
    expect(result.current).toHaveProperty('currentElementRef');
    expect(result.current).toHaveProperty('getFocusableElements');
    expect(result.current).toHaveProperty('focusElement');
    expect(result.current).toHaveProperty('findNextElement');
    expect(result.current).toHaveProperty('invalidateRectCache');
    expect(result.current).toHaveProperty('updateRectCache');
    expect(result.current).toHaveProperty('isVisible');
    expect(result.current).toHaveProperty('updateState');
  });

  it('should use custom selector', () => {
    const { result } = renderHook(() => useTVFocusGraph({ selector: '.custom-selector' }));

    expect(result.current).toBeDefined();
  });

  it('should use external elements', () => {
    const elements = [document.createElement('div'), document.createElement('button')];
    const { result } = renderHook(() => useTVFocusGraph({ elements }));

    const focusableElements = result.current.getFocusableElements();
    expect(focusableElements).toEqual(elements);
  });

  it('should call onTVFocus when focusing element', () => {
    const onTVFocus = jest.fn();
    const { result } = renderHook(() => useTVFocusGraph({ onTVFocus }));

    const element = document.createElement('button');
    result.current.focusElement(element);

    expect(onTVFocus).toHaveBeenCalledWith(element);
  });

  it('should not focus same element twice', () => {
    const onTVFocus = jest.fn();
    const { result } = renderHook(() => useTVFocusGraph({ onTVFocus }));

    const element = document.createElement('button');
    result.current.focusElement(element);
    result.current.focusElement(element);

    expect(onTVFocus).toHaveBeenCalledTimes(1);
  });

  it('should call updateState when invalidating rect cache', () => {
    const { result } = renderHook(() => useTVFocusGraph());

    result.current.invalidateRectCache();

    expect(result.current).toBeDefined();
  });

  it('should call updateState when updating rect cache', () => {
    const { result } = renderHook(() => useTVFocusGraph());

    result.current.updateRectCache();

    expect(result.current).toBeDefined();
  });
});
