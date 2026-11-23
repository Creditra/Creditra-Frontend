import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useBodyScrollLock,
  _resetBodyScrollLockForTesting,
} from '../useBodyScrollLock';

describe('useBodyScrollLock', () => {
  let mockScrollY = 0;
  let scrollToSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    _resetBodyScrollLockForTesting();
    mockScrollY = 0;

    // Reset document body styles
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';

    // Mock window.scrollY getter
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => mockScrollY);

    // Mock window.scrollTo
    scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetBodyScrollLockForTesting();
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
  });

  it('does not modify body styles when isLocked is false', () => {
    renderHook(() => useBodyScrollLock({ isLocked: false }));

    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.position).toBe('');
    expect(document.body.style.width).toBe('');
    expect(document.body.style.top).toBe('');
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('applies expected body styles when isLocked is true', () => {
    mockScrollY = 240;

    renderHook(() => useBodyScrollLock({ isLocked: true }));

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.width).toBe('100%');
    expect(document.body.style.top).toBe('-240px');
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('supports boolean argument directly (isLocked = true)', () => {
    mockScrollY = 150;

    renderHook(() => useBodyScrollLock(true));

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-150px');
  });

  it('restores original scroll position and body styles on unlock', () => {
    mockScrollY = 350;
    document.body.style.overflow = 'scroll';
    document.body.style.position = 'relative';

    const { rerender } = renderHook(
      ({ isLocked }) => useBodyScrollLock({ isLocked }),
      { initialProps: { isLocked: true } },
    );

    // Locked state
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-350px');

    // Unlock
    rerender({ isLocked: false });

    // Restored state
    expect(document.body.style.overflow).toBe('scroll');
    expect(document.body.style.position).toBe('relative');
    expect(document.body.style.width).toBe('');
    expect(document.body.style.top).toBe('');
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).toHaveBeenCalledWith(0, 350);
  });

  it('cleans up styles and restores scroll on unmount while locked', () => {
    mockScrollY = 480;

    const { unmount } = renderHook(() => useBodyScrollLock({ isLocked: true }));

    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-480px');

    unmount();

    expect(document.body.style.position).toBe('');
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.top).toBe('');
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).toHaveBeenCalledWith(0, 480);
  });

  it('handles nested locks and releases only when the last lock unlocks', () => {
    mockScrollY = 500;

    // Modal 1 mounts and locks body
    const modal1 = renderHook(
      ({ isLocked }) => useBodyScrollLock({ isLocked }),
      { initialProps: { isLocked: true } },
    );

    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-500px');
    expect(scrollToSpy).not.toHaveBeenCalled();

    // Modal 2 opens while Modal 1 is still open (e.g. confirmation modal)
    // Note: while fixed, window.scrollY might be 0, but hook should retain original 500
    mockScrollY = 0;
    const modal2 = renderHook(
      ({ isLocked }) => useBodyScrollLock({ isLocked }),
      { initialProps: { isLocked: true } },
    );

    // Body should remain locked at original offset
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-500px');
    expect(scrollToSpy).not.toHaveBeenCalled();

    // Modal 2 unlocks/closes
    modal2.rerender({ isLocked: false });

    // Modal 1 is STILL open — body must remain locked and not restore scroll yet!
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-500px');
    expect(scrollToSpy).not.toHaveBeenCalled();

    // Modal 1 unlocks/closes
    modal1.rerender({ isLocked: false });

    // Both are closed now — body should be unlocked and scroll position restored
    expect(document.body.style.position).toBe('');
    expect(document.body.style.overflow).toBe('');
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).toHaveBeenCalledWith(0, 500);
  });

  it('handles nested unmounts in reverse order correctly', () => {
    mockScrollY = 320;

    const modal1 = renderHook(() => useBodyScrollLock({ isLocked: true }));
    const modal2 = renderHook(() => useBodyScrollLock({ isLocked: true }));

    expect(document.body.style.top).toBe('-320px');

    // Unmount modal 1 first (parent unmounts)
    modal1.unmount();

    // Modal 2 is still mounted and locked
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-320px');
    expect(scrollToSpy).not.toHaveBeenCalled();

    // Unmount modal 2
    modal2.unmount();

    // Final unlock
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).toHaveBeenCalledWith(0, 320);
  });

  it('supports sequential modal open and close cycles', () => {
    // First cycle at scrollY = 100
    mockScrollY = 100;
    const cycle1 = renderHook(
      ({ isLocked }) => useBodyScrollLock({ isLocked }),
      { initialProps: { isLocked: true } },
    );
    expect(document.body.style.top).toBe('-100px');
    cycle1.rerender({ isLocked: false });
    expect(scrollToSpy).toHaveBeenLastCalledWith(0, 100);

    // User scrolls to 600 and opens another modal
    mockScrollY = 600;
    const cycle2 = renderHook(
      ({ isLocked }) => useBodyScrollLock({ isLocked }),
      { initialProps: { isLocked: true } },
    );
    expect(document.body.style.top).toBe('-600px');
    cycle2.rerender({ isLocked: false });
    expect(scrollToSpy).toHaveBeenLastCalledWith(0, 600);
    expect(scrollToSpy).toHaveBeenCalledTimes(2);
  });
});
