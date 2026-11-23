import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUnsavedChangesGuard } from '../useUnsavedChangesGuard';

describe('useUnsavedChangesGuard', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(window, 'addEventListener');
    removeSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds the beforeunload listener when isDirty is true', () => {
    renderHook(() => useUnsavedChangesGuard(true));

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('does not add the listener when isDirty is false', () => {
    renderHook(() => useUnsavedChangesGuard(false));

    const beforeunloadCalls = addSpy.mock.calls.filter(([event]) => event === 'beforeunload');
    expect(beforeunloadCalls).toHaveLength(0);
  });

  it('removes the listener on unmount', () => {
    const { unmount } = renderHook(() => useUnsavedChangesGuard(true));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('removes the listener when isDirty transitions from true to false', () => {
    const { rerender } = renderHook(
      ({ isDirty }: { isDirty: boolean }) => useUnsavedChangesGuard(isDirty),
      { initialProps: { isDirty: true } },
    );

    act(() => {
      rerender({ isDirty: false });
    });

    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('calls preventDefault and sets returnValue on the beforeunload event', () => {
    renderHook(() => useUnsavedChangesGuard(true));

    const handler = addSpy.mock.calls.find(([event]) => event === 'beforeunload')?.[1] as
      | EventListener
      | undefined;
    expect(handler).toBeDefined();

    const event = new Event('beforeunload') as BeforeUnloadEvent;
    Object.defineProperty(event, 'returnValue', { writable: true, value: undefined });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    handler!(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect((event as unknown as { returnValue: string }).returnValue).toBe('');
  });
});
