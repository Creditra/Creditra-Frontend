import { renderHook, waitFor } from '@testing-library/react';
import { useLedgerTime } from './useLedgerTime';
import { useWallet } from '../context/WalletContext';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

global.fetch = vi.fn();

describe('useLedgerTime', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useWallet as any).mockReturnValue({ wallet: { network: 'public' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('syncs with ledger time and calculates offset', async () => {
    const mockLedgerTime = new Date('2026-08-30T10:00:00Z').getTime();
    const localLaggingTime = mockLedgerTime - 300000; // 5 minutes behind
    
    vi.spyOn(Date, 'now').mockReturnValue(localLaggingTime);

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ history_latest_ledger_closed_at: '2026-08-30T10:00:00Z' }),
    });

    const { result } = renderHook(() => useLedgerTime());

    expect(result.current.isSynced).toBe(false);

    await waitFor(() => {
      expect(result.current.isSynced).toBe(true);
    });

    // The hook's `now` output should exactly equal the network ledger time, 
    // entirely ignoring the lagging local clock.
    expect(result.current.now).toBe(mockLedgerTime);
  });

  it('degrades gracefully to local time if fetch fails', async () => {
    const localTime = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(localTime);
    (global.fetch as any).mockRejectedValue(new Error('Horizon offline'));
    
    const { result } = renderHook(() => useLedgerTime());

    // We wait a microtask tick for the failed promise to resolve and catch
    await new Promise(process.nextTick);

    expect(result.current.isSynced).toBe(false);
    expect(result.current.now).toBe(localTime);
  });
});
