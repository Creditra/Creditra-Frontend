import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionPreflightGuard } from '../TransactionPreflightGuard';
import * as walletUtils from '../../utils/wallet';
import type { WalletInfo } from '../../types/wallet';

vi.mock('../../utils/wallet', async () => {
  const actual = await vi.importActual<typeof import('../../utils/wallet')>('../../utils/wallet');
  return {
    ...actual,
    switchNetwork: vi.fn(),
  };
});

describe('TransactionPreflightGuard and ConfirmationSummary', () => {
  const mockWallet: WalletInfo = {
    type: 'freighter',
    publicKey: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    network: 'TESTNET',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders confirmation summary and allows signing when network and account match', () => {
    const handleConfirm = vi.fn();

    render(
      <TransactionPreflightGuard
        walletOverride={mockWallet}
        statusOverride="connected"
        expectedNetwork="TESTNET"
        expectedAccount={mockWallet.publicKey}
      >
        {({ canSign, executeSafeSubmit }) => (
          <button
            type="button"
            disabled={!canSign}
            onClick={() => executeSafeSubmit()}
            data-testid="confirm-btn"
          >
            Confirm Transaction
          </button>
        )}
      </TransactionPreflightGuard>,
    );

    expect(screen.getByTestId('preflight-status-badge')).toHaveTextContent('Ready to Sign');
    expect(screen.getByTestId('network-match-badge')).toHaveTextContent('Match');
    expect(screen.getByTestId('account-match-badge')).toHaveTextContent('Match');

    const confirmBtn = screen.getByTestId('confirm-btn');
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);
    expect(screen.queryByTestId('preflight-block-alert')).toBeNull();
  });

  it('blocks signing when wallet is disconnected', () => {
    render(
      <TransactionPreflightGuard
        walletOverride={null}
        statusOverride="disconnected"
        expectedNetwork="TESTNET"
      >
        {({ canSign }) => (
          <button type="button" disabled={!canSign} data-testid="confirm-btn">
            Confirm Transaction
          </button>
        )}
      </TransactionPreflightGuard>,
    );

    expect(screen.getByTestId('preflight-status-badge')).toHaveTextContent('Signing Blocked');
    expect(screen.getByTestId('confirm-btn')).toBeDisabled();
    expect(screen.getByTestId('preflight-block-alert')).toHaveTextContent('Wallet disconnected');
  });

  it('blocks signing when connected to the wrong network and renders explicit switch action', () => {
    const wrongNetworkWallet: WalletInfo = {
      ...mockWallet,
      network: 'PUBLIC',
    };

    render(
      <TransactionPreflightGuard
        walletOverride={wrongNetworkWallet}
        statusOverride="connected"
        expectedNetwork="TESTNET"
      >
        {({ canSign }) => (
          <button type="button" disabled={!canSign} data-testid="confirm-btn">
            Confirm Transaction
          </button>
        )}
      </TransactionPreflightGuard>,
    );

    expect(screen.getByTestId('preflight-status-badge')).toHaveTextContent('Signing Blocked');
    expect(screen.getByTestId('network-match-badge')).toHaveTextContent('Mismatch');
    expect(screen.getByTestId('confirm-btn')).toBeDisabled();
    expect(screen.getByTestId('switch-network-action-button')).toBeInTheDocument();
  });

  it('guarantees switch failures do not auto-submit transaction', async () => {
    const onConfirmSpy = vi.fn();
    vi.mocked(walletUtils.switchNetwork).mockRejectedValueOnce(
      new Error('Extension rejected network change'),
    );

    const wrongNetworkWallet: WalletInfo = {
      ...mockWallet,
      network: 'PUBLIC',
    };

    render(
      <TransactionPreflightGuard
        walletOverride={wrongNetworkWallet}
        statusOverride="connected"
        expectedNetwork="TESTNET"
        onExecuteTransaction={onConfirmSpy}
      >
        {({ canSign, executeSafeSubmit }) => (
          <button
            type="button"
            disabled={!canSign}
            onClick={() => executeSafeSubmit()}
            data-testid="confirm-btn"
          >
            Confirm Transaction
          </button>
        )}
      </TransactionPreflightGuard>,
    );

    const switchBtn = screen.getByTestId('switch-network-action-button');
    fireEvent.click(switchBtn);

    await waitFor(() => {
      expect(screen.getByTestId('switch-network-error-alert')).toBeInTheDocument();
    });

    expect(screen.getByTestId('switch-network-error-alert')).toHaveTextContent(
      'Extension rejected network change',
    );
    expect(onConfirmSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-btn')).toBeDisabled();
  });

  it('blocks signing when expected account does not match connected account', () => {
    const foreignAccount = 'GCAL45EPMU6J2GY4HQHCHYF5H7GYZRFV2Z7X7V4XQGJJJFX65G5M6PQC';

    render(
      <TransactionPreflightGuard
        walletOverride={mockWallet}
        statusOverride="connected"
        expectedNetwork="TESTNET"
        expectedAccount={foreignAccount}
      >
        {({ canSign }) => (
          <button type="button" disabled={!canSign} data-testid="confirm-btn">
            Confirm Transaction
          </button>
        )}
      </TransactionPreflightGuard>,
    );

    expect(screen.getByTestId('preflight-status-badge')).toHaveTextContent('Signing Blocked');
    expect(screen.getByTestId('account-match-badge')).toHaveTextContent('Mismatch');
    expect(screen.getByTestId('confirm-btn')).toBeDisabled();
    expect(screen.getByTestId('preflight-block-alert')).toHaveTextContent('Account mismatch');
  });

  it('blocks signing on stale account state and unblocks when acknowledged', () => {
    const initialKey = 'freighter:G_STALE_KEY:TESTNET';

    render(
      <TransactionPreflightGuard
        walletOverride={mockWallet}
        statusOverride="connected"
        expectedNetwork="TESTNET"
        initialIdentityKey={initialKey}
      >
        {({ canSign }) => (
          <button type="button" disabled={!canSign} data-testid="confirm-btn">
            Confirm Transaction
          </button>
        )}
      </TransactionPreflightGuard>,
    );

    expect(screen.getByTestId('preflight-status-badge')).toHaveTextContent('Signing Blocked');
    expect(screen.getByTestId('confirm-btn')).toBeDisabled();
    expect(screen.getByTestId('preflight-block-alert')).toHaveTextContent(/stale/i);

    const acknowledgeBtn = screen.getByTestId('acknowledge-identity-button');
    fireEvent.click(acknowledgeBtn);

    expect(screen.getByTestId('preflight-status-badge')).toHaveTextContent('Ready to Sign');
    expect(screen.getByTestId('confirm-btn')).not.toBeDisabled();
  });
});
