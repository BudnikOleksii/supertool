import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedCallback } from './use-debounced-callback';

const DELAY_MS = 300;
const HALF_DELAY_MS = 150;

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('invokes the callback only after the delay elapses', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, DELAY_MS));

    act(() => {
      result.current('value');
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(DELAY_MS);
    });

    expect(callback).toHaveBeenCalledExactlyOnceWith('value');
  });

  it('collapses rapid calls into a single trailing invocation', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, DELAY_MS));

    act(() => {
      result.current('a');
      vi.advanceTimersByTime(HALF_DELAY_MS);
      result.current('b');
      vi.advanceTimersByTime(HALF_DELAY_MS);
      result.current('c');
      vi.advanceTimersByTime(DELAY_MS);
    });

    expect(callback).toHaveBeenCalledExactlyOnceWith('c');
  });

  it('cancels a pending invocation on unmount', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, DELAY_MS));

    act(() => {
      result.current('value');
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(DELAY_MS);
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
