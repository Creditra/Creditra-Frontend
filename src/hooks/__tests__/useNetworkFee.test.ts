import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  estimateInvocationFee: vi.fn(),
}));

vi.mock('../../services/fees', () => ({
  estimateInvocationFee: mocks.estimateInvocationFee,
  feeArgsKey: (args: unknown[]) => JSON.stringify(args),
}));

import { useNetworkFee } from '../useNetworkFee';

const estimate = {
  method: 'draw',
  inclusionFeeStroops: 100,
  resourceFeeStroops: 5000,
  totalStroops: 5100,
  totalXlm: 0.00051,
  fetchedAt: 0,
};

beforeEach(() => {
  mocks.estimateInvocationFee.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useNetworkFee', () => {
  it('stays idle when disabled', async () => {
    const { result } = renderHook(() =>
      useNetworkFee('draw', [] as never, { enabled: false }),
    );

    expect(result.current).toEqual({ status: 'idle' });
    expect(mocks.estimateInvocationFee).not.toHaveBeenCalled();
  });

  it('stays idle when args are null', async () => {
    const { result } = renderHook(() => useNetworkFee('draw', null));

    expect(result.current).toEqual({ status: 'idle' });
  });

  it('resolves to a ready estimate', async () => {
    mocks.estimateInvocationFee.mockResolvedValue(estimate);
    const args = [{ line: 'line-1' }] as never;

    const { result } = renderHook(() =>
      useNetworkFee('draw', args, { debounceMs: 0 }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toEqual({ status: 'ready', estimate });
  });

  it('resolves to unavailable when estimation fails', async () => {
    mocks.estimateInvocationFee.mockRejectedValue(new Error('rpc down'));
    const args = [{ line: 'line-1' }] as never;

    const { result } = renderHook(() =>
      useNetworkFee('repay', args, { debounceMs: 0 }),
    );

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current).toMatchObject({ error: 'rpc down' });
  });

  it('debounces arg changes and only estimates the latest amount', async () => {
    vi.useFakeTimers();
    mocks.estimateInvocationFee.mockResolvedValue(estimate);

    const { result, rerender } = renderHook(
      ({ args }) => useNetworkFee('draw', args, { debounceMs: 50 }),
      { initialProps: { args: [{ amount: 1 }] as never } },
    );

    await act(async () => {
      vi.advanceTimersByTime(10);
    });
    rerender({ args: [{ amount: 2 }] as never });

    await act(async () => {
      vi.advanceTimersByTime(60);
      await Promise.resolve();
    });

    expect(mocks.estimateInvocationFee).toHaveBeenCalledTimes(1);
    expect(mocks.estimateInvocationFee.mock.calls[0][1]).toEqual([{ amount: 2 }]);
    expect(result.current.status).toBe('ready');
  });
});
