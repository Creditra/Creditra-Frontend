/**
 * WalletContext — multi-account tests (#1374)
 *
 * Covers account discovery on connect, switching without disconnecting,
 * persistence of the explicit choice, fallback when listing fails, and
 * clearing accounts on disconnect.
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletProvider, useWallet } from './WalletContext';
import * as walletUtils from '../utils/wallet';
import * as creditNetwork from '../config/creditNetwork';
import type { WalletInfo } from '../types/wallet';

const ACCOUNT_A = 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB';
const ACCOUNT_B = 'GB7KKHHVYLDIZEKYJPAJUOTBE5E3NJAXPSDZK7O6O44WR3EBRO5HRPVT';

const WALLET_A: WalletInfo = {
  type: 'freighter',
  publicKey: ACCOUNT_A,
  network: 'PUBLIC',
};

const STORED_PREFERENCE = { v: 2 as const, type: 'freighter' as const };

function Consumer() {
  const { status, wallet, accounts, switchAccount, connect, disconnect } = useWallet();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="wallet">{wallet?.publicKey ?? 'null'}</span>
      <span data-testid="accounts">{accounts.join(',')}</span>
      <button data-testid="connect" onClick={() => { void connect('freighter'); }}>
        Connect
      </button>
      <button data-testid="switch-b" onClick={() => switchAccount(ACCOUNT_B)}>
        Switch B
      </button>
      <button data-testid="switch-unknown" onClick={() => switchAccount('GUNKNOWN')}>
        Switch unknown
      </button>
      <button data-testid="disconnect" onClick={disconnect}>
        Disconnect
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <WalletProvider timeoutMs={500}>
      <Consumer />
    </WalletProvider>,
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.localStorage.clear();

  vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
  vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(WALLET_A);
  vi.spyOn(walletUtils, 'getAccounts').mockResolvedValue([ACCOUNT_A, ACCOUNT_B]);
  vi.spyOn(walletUtils, 'saveWalletPreference').mockImplementation(() => {});
  vi.spyOn(walletUtils, 'recordRecentWallet').mockImplementation(() => {});
  vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(false);
  vi.spyOn(walletUtils, 'setWalletRemembered').mockImplementation(() => {});
  vi.spyOn(walletUtils, 'disconnectWallet').mockImplementation(() => {});
  vi.spyOn(creditNetwork, 'getCreditNetworkConfig').mockReturnValue({
    horizonUrl: 'https://horizon-testnet.stellar.org',
  } as ReturnType<typeof creditNetwork.getCreditNetworkConfig>);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('WalletContext — multi-account selection', () => {
  it('exposes every discovered account after connecting', async () => {
    renderProvider();
    await act(async () => {
      screen.getByTestId('connect').click();
    });
    await flush();

    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('wallet').textContent).toBe(ACCOUNT_A);
    expect(screen.getByTestId('accounts').textContent).toBe(`${ACCOUNT_A},${ACCOUNT_B}`);
  });

  it('switches the active account without disconnecting and remembers it', async () => {
    renderProvider();
    await act(async () => {
      screen.getByTestId('connect').click();
    });
    await flush();

    await act(async () => {
      screen.getByTestId('switch-b').click();
    });

    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('wallet').textContent).toBe(ACCOUNT_B);
    expect(walletUtils.getLastAccount('freighter')).toBe(ACCOUNT_B);
  });

  it('ignores keys the wallet does not expose', async () => {
    renderProvider();
    await act(async () => {
      screen.getByTestId('connect').click();
    });
    await flush();

    await act(async () => {
      screen.getByTestId('switch-unknown').click();
    });

    expect(screen.getByTestId('wallet').textContent).toBe(ACCOUNT_A);
  });

  it('falls back to the connected key when account discovery fails', async () => {
    vi.mocked(walletUtils.getAccounts).mockRejectedValue(new Error('denied'));

    renderProvider();
    await act(async () => {
      screen.getByTestId('connect').click();
    });
    await flush();

    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('accounts').textContent).toBe(ACCOUNT_A);
  });

  it('restores the remembered account on reconnect', async () => {
    walletUtils.saveLastAccount('freighter', ACCOUNT_B);
    vi.mocked(walletUtils.getStoredWallet).mockReturnValue(STORED_PREFERENCE);
    vi.mocked(walletUtils.isWalletRemembered).mockReturnValue(true);

    renderProvider();
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    await flush();

    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('wallet').textContent).toBe(ACCOUNT_B);
    expect(screen.getByTestId('accounts').textContent).toBe(`${ACCOUNT_A},${ACCOUNT_B}`);
  });

  it('clears accounts on disconnect', async () => {
    renderProvider();
    await act(async () => {
      screen.getByTestId('connect').click();
    });
    await flush();

    await act(async () => {
      screen.getByTestId('disconnect').click();
    });

    expect(screen.getByTestId('wallet').textContent).toBe('null');
    expect(screen.getByTestId('accounts').textContent).toBe('');
  });
});
