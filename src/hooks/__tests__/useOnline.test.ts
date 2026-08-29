import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { useOnline } from '../useOnline';

describe('useOnline hook', () => {
  let originalOnLine: boolean;

  beforeAll(() => {
    originalOnLine = navigator.onLine;
  });

  afterAll(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
    });
  });

  const setNavigatorOnLine = (value: boolean) => {
    Object.defineProperty(navigator, 'onLine', {
      value,
      configurable: true,
    });
  };

  it('should initialize with navigator.onLine status', () => {
    setNavigatorOnLine(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current.isOnline).toBe(false);
  });

  it('should update status on online/offline events', () => {
    setNavigatorOnLine(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      setNavigatorOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);

    act(() => {
      setNavigatorOnLine(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('should execute action immediately if online', () => {
    setNavigatorOnLine(true);
    const { result } = renderHook(() => useOnline());
    const action = vi.fn();
    
    act(() => {
      result.current.queueAction(action);
    });
    
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('should queue action and execute when coming online', () => {
    setNavigatorOnLine(false);
    const { result } = renderHook(() => useOnline());
    const action = vi.fn();
    
    act(() => {
      result.current.queueAction(action);
    });
    
    expect(action).not.toHaveBeenCalled();

    act(() => {
      setNavigatorOnLine(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('should check status manually', () => {
    setNavigatorOnLine(false);
    const { result } = renderHook(() => useOnline());
    
    act(() => {
      setNavigatorOnLine(true);
      result.current.checkOnlineStatus();
    });
    
    expect(result.current.isOnline).toBe(true);
  });

  describe('queuedActionCount', () => {
    it('should start at 0', () => {
      setNavigatorOnLine(false);
      const { result } = renderHook(() => useOnline());
      expect(result.current.queuedActionCount).toBe(0);
    });

    it('should increment as actions are queued offline', () => {
      setNavigatorOnLine(false);
      const { result } = renderHook(() => useOnline());

      act(() => {
        result.current.queueAction(() => {});
        result.current.queueAction(() => {});
      });

      expect(result.current.queuedActionCount).toBe(2);
    });

    it('should not increment when action executes immediately online', () => {
      setNavigatorOnLine(true);
      const { result } = renderHook(() => useOnline());

      act(() => {
        result.current.queueAction(() => {});
      });

      expect(result.current.queuedActionCount).toBe(0);
    });

    it('should reset to 0 when coming online flushes the queue', () => {
      setNavigatorOnLine(false);
      const { result } = renderHook(() => useOnline());

      act(() => {
        result.current.queueAction(() => {});
        result.current.queueAction(() => {});
      });
      expect(result.current.queuedActionCount).toBe(2);

      act(() => {
        setNavigatorOnLine(true);
        window.dispatchEvent(new Event('online'));
      });

      expect(result.current.queuedActionCount).toBe(0);
    });
  });

  describe('queueAction dedup', () => {
    it('should only queue one action when the same key is enqueued multiple times offline', () => {
      setNavigatorOnLine(false);
      const { result } = renderHook(() => useOnline());
      const action = vi.fn();

      act(() => {
        result.current.queueAction(action, 'same-key');
        result.current.queueAction(action, 'same-key');
        result.current.queueAction(action, 'same-key');
      });

      expect(result.current.queuedActionCount).toBe(1);

      act(() => {
        setNavigatorOnLine(true);
        window.dispatchEvent(new Event('online'));
      });

      expect(action).toHaveBeenCalledTimes(1);
    });

    it('should queue distinct actions for distinct keys', () => {
      setNavigatorOnLine(false);
      const { result } = renderHook(() => useOnline());
      const first = vi.fn();
      const second = vi.fn();

      act(() => {
        result.current.queueAction(first, 'key-a');
        result.current.queueAction(second, 'key-b');
      });

      expect(result.current.queuedActionCount).toBe(2);

      act(() => {
        setNavigatorOnLine(true);
        window.dispatchEvent(new Event('online'));
      });

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('should allow re-enqueueing the same key after the queue flushes', () => {
      setNavigatorOnLine(false);
      const { result } = renderHook(() => useOnline());
      const action = vi.fn();

      act(() => {
        result.current.queueAction(action, 'reuse-key');
      });
      expect(result.current.queuedActionCount).toBe(1);

      act(() => {
        setNavigatorOnLine(true);
        window.dispatchEvent(new Event('online'));
      });
      expect(action).toHaveBeenCalledTimes(1);

      // Go offline again: the key is available again because the queue flushed.
      act(() => {
        setNavigatorOnLine(false);
        window.dispatchEvent(new Event('offline'));
      });
      act(() => {
        result.current.queueAction(action, 'reuse-key');
      });
      expect(result.current.queuedActionCount).toBe(1);

      act(() => {
        setNavigatorOnLine(true);
        window.dispatchEvent(new Event('online'));
      });
      expect(action).toHaveBeenCalledTimes(2);
    });
  });
});
