import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePageVisible } from '../usePageVisible';

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: state !== 'visible',
  });
}

describe('usePageVisible', () => {
  afterEach(() => {
    setVisibilityState('visible');
    vi.restoreAllMocks();
  });

  it('returns true when document.visibilityState is visible', () => {
    setVisibilityState('visible');
    const { result } = renderHook(() => usePageVisible());
    expect(result.current).toBe(true);
  });

  it('returns false when document.visibilityState starts hidden', () => {
    setVisibilityState('hidden');
    const { result } = renderHook(() => usePageVisible());
    expect(result.current).toBe(false);
  });

  it('updates when visibilitychange is dispatched', () => {
    setVisibilityState('visible');
    const { result } = renderHook(() => usePageVisible());
    expect(result.current).toBe(true);

    act(() => {
      setVisibilityState('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(false);

    act(() => {
      setVisibilityState('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(true);
  });

  it('removes the visibilitychange listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => usePageVisible());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
