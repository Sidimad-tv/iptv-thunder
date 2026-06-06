import { renderHook, waitFor } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  it('should return initial value immediately', async () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('should not update value before delay', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 500 });
    await waitFor(() => expect(result.current).toBe('initial'), { timeout: 300 });
  });

  it('should update value after delay', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 500 });
    
    await waitFor(() => {
      expect(result.current).toBe('updated');
    }, { timeout: 1000 });
  });

  it('should reset timer when value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    rerender({ value: 'first', delay: 500 });
    
    await waitFor(() => {
      expect(result.current).toBe('first');
    }, { timeout: 1000 });
  });

  it('should handle different delay values', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    rerender({ value: 'updated', delay: 1000 });
    
    await waitFor(() => {
      expect(result.current).toBe('updated');
    }, { timeout: 1500 });
  });

  it('should handle number values', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 500 } }
    );

    expect(result.current).toBe(0);

    rerender({ value: 100, delay: 500 });
    
    await waitFor(() => {
      expect(result.current).toBe(100);
    }, { timeout: 1000 });
  });

  it('should handle object values', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: { key: 'initial' }, delay: 500 } }
    );

    expect(result.current).toEqual({ key: 'initial' });

    rerender({ value: { key: 'updated' }, delay: 500 });
    
    await waitFor(() => {
      expect(result.current).toEqual({ key: 'updated' });
    }, { timeout: 1000 });
  });

  it('should handle array values', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: [1, 2, 3], delay: 500 } }
    );

    expect(result.current).toEqual([1, 2, 3]);

    rerender({ value: [4, 5, 6], delay: 500 });
    
    await waitFor(() => {
      expect(result.current).toEqual([4, 5, 6]);
    }, { timeout: 1000 });
  });
});
