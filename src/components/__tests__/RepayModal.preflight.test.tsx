import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RepayModal } from '../RepayModal';
import * as walletUtils from '../../utils/wallet';
import type { WalletInfo } from '../../types/wallet';

vi.mock('@/hooks/useBodyScrollLock', () => ({ useBodyScrollLock: vi.fn() }));
vi.mock('@/hooks/useInertBackdrop', () => ({ useInertBackdrop: vi.fn() }));
vi.mock('../InlineHelpOverlay', () => ({
  InlineHelpOverlay: () => null,
}));

vi.mock('../../utils/wallet', async () => {
  const actual = await vi.importActual<typeof import('../../utils/wallet')>('../../utils/wallet');
  return {
    ...actual,
    switchNetwork: vi.fn(),
  };
});

describe('RepayModal with transaction preflight verification', () => {
  const mockCreditLine = {
    id: 'CL-001',
    name: 'Primary Line',
    limit: 10_000,
    utilized: 2_000,
    apr: 10,
    borrowerAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  };

  const validWallet: WalletInfo = {
    type: 'freighter',
    publicKey: mockCreditLine.borrowerAddress,
    network: 'TESTNET',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function navigateToReview(customProps = {}) {
    const props = {
      creditLine: mockCreditLine,
      walletBalance: 5_000,
      onClose: vi.fn(),
      onSuccess: vi.fn(),
      walletOverride: validWallet,
      statusOverride: 'connected' as const,
      ...customProps,
    };

    const utils = render(<RepayModal {...props} />);

    const input = screen.getByTestId('repay-amount-input');
    fireEvent.change(input, { target: { value: '500' } });

    const reviewButton = screen.getByRole('button', { name: /review repayment/i });
    fireEvent.click(reviewButton);

    return { ...utils, props };
  }

  it('renders preflight confirmation summary and allows confirmation when network and account match', () => {
    navigateToReview();

    expect(screen.getByTestId('transaction-preflight-summary')).toBeInTheDocument();
    expect(screen.getByTestId('preflight-status-badge')).toHaveTextContent('Ready to Sign');
    expect(screen.getByTestId('network-match-badge')).toHaveTextContent('Match');
    expect(screen.getByTestId('account-match-badge')).toHaveTextContent('Match');

    const confirmButton = screen.getByRole('button', { name: /confirm repayment/i });
    expect(confirmButton).not.toBeDisabled();
  });

  it('blocks repayment confirmation when connected to wrong network', () => {
    const wrongNetworkWallet: WalletInfo = {
      ...validWallet,
      network: 'PUBLIC',
    };

    navigateToReview({ walletOverride: wrongNetworkWallet });

    expect(screen.getByTestId('preflight-status-badge')).toHaveTextContent('Signing Blocked');
    expect(screen.getByTestId('network-match-badge')).toHaveTextContent('Mismatch');

    const confirmButton = screen.getByRole('button', { name: /confirm repayment/i });
    expect(confirmButton).toBeDisabled();

    expect(screen.getByTestId('switch-network-action-button')).toBeInTheDocument();
  });

  it('guarantees network switch failure does not submit repayment', async () => {
    vi.mocked(walletUtils.switchNetwork).mockRejectedValueOnce(
      new Error('User rejected network switch in extension'),
    );

    const wrongNetworkWallet: WalletInfo = {
      ...validWallet,
      network: 'PUBLIC',
    };

    const { props } = navigateToReview({ walletOverride: wrongNetworkWallet });

    const switchBtn = screen.getByTestId('switch-network-action-button');
    fireEvent.click(switchBtn);

    await waitFor(() => {
      expect(screen.getByTestId('switch-network-error-alert')).toBeInTheDocument();
    });

    expect(props.onSuccess).not.toHaveBeenCalled();
    const confirmButton = screen.getByRole('button', { name: /confirm repayment/i });
    expect(confirmButton).toBeDisabled();
  });

  it('blocks repayment confirmation when expected borrower account differs from connected account', () => {
    const mismatchedWallet: WalletInfo = {
      ...validWallet,
      publicKey: 'GCAL45EPMU6J2GY4HQHCHYF5H7GYZRFV2Z7X7V4XQGJJJFX65G5M6PQC',
    };

    navigateToReview({ walletOverride: mismatchedWallet });

    expect(screen.getByTestId('preflight-status-badge')).toHaveTextContent('Signing Blocked');
    expect(screen.getByTestId('account-match-badge')).toHaveTextContent('Mismatch');

    const confirmButton = screen.getByRole('button', { name: /confirm repayment/i });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByTestId('preflight-block-alert')).toHaveTextContent(/account mismatch/i);
  });

  it('blocks repayment confirmation when wallet is disconnected', () => {
    navigateToReview({ walletOverride: null, statusOverride: 'disconnected' });

    expect(screen.getByTestId('preflight-status-badge')).toHaveTextContent('Signing Blocked');
    const confirmButton = screen.getByRole('button', { name: /confirm repayment/i });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByTestId('preflight-block-alert')).toHaveTextContent(/disconnected/i);
  });
});
