import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickRepayModal } from '../QuickRepayModal';
import * as walletUtils from '../../utils/wallet';
import type { WalletInfo } from '../../types/wallet';

vi.mock('@/hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock('../../utils/wallet', async () => {
  const actual = await vi.importActual<typeof import('../../utils/wallet')>('../../utils/wallet');
  return {
    ...actual,
    switchNetwork: vi.fn(),
  };
});

describe('QuickRepayModal transaction preflight', () => {
  const mockCreditLine = {
    id: 'CL-002',
    name: 'Secondary Line',
    limit: 5_000,
    utilized: 1_000,
    apr: 8,
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

  it('renders preflight summary and enables confirm button when network and account match', () => {
    render(
      <QuickRepayModal
        creditLine={mockCreditLine}
        walletBalance={2_000}
        initialAmount="100"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        walletOverride={validWallet}
        statusOverride="connected"
      />,
    );

    expect(screen.getByTestId('transaction-preflight-summary')).toBeInTheDocument();
    expect(screen.getByTestId('preflight-status-badge')).toHaveTextContent('Ready to Sign');

    const confirmBtn = screen.getByRole('button', { name: /confirm repayment/i });
    expect(confirmBtn).not.toBeDisabled();
  });

  it('blocks confirm button when network is mismatched', () => {
    const wrongNetworkWallet: WalletInfo = {
      ...validWallet,
      network: 'PUBLIC',
    };

    render(
      <QuickRepayModal
        creditLine={mockCreditLine}
        walletBalance={2_000}
        initialAmount="100"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        walletOverride={wrongNetworkWallet}
        statusOverride="connected"
      />,
    );

    expect(screen.getByTestId('preflight-status-badge')).toHaveTextContent('Signing Blocked');
    expect(screen.getByTestId('network-match-badge')).toHaveTextContent('Mismatch');

    const confirmBtn = screen.getByRole('button', { name: /confirm repayment/i });
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByTestId('switch-network-action-button')).toBeInTheDocument();
  });

  it('blocks confirm button when account is mismatched', () => {
    const wrongAccountWallet: WalletInfo = {
      ...validWallet,
      publicKey: 'GCAL45EPMU6J2GY4HQHCHYF5H7GYZRFV2Z7X7V4XQGJJJFX65G5M6PQC',
    };

    render(
      <QuickRepayModal
        creditLine={mockCreditLine}
        walletBalance={2_000}
        initialAmount="100"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        walletOverride={wrongAccountWallet}
        statusOverride="connected"
      />,
    );

    expect(screen.getByTestId('preflight-status-badge')).toHaveTextContent('Signing Blocked');
    expect(screen.getByTestId('account-match-badge')).toHaveTextContent('Mismatch');

    const confirmBtn = screen.getByRole('button', { name: /confirm repayment/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('prevents auto-submission on switch failure', async () => {
    vi.mocked(walletUtils.switchNetwork).mockRejectedValueOnce(new Error('Rejected switch'));

    const onSuccess = vi.fn();
    const wrongNetworkWallet: WalletInfo = {
      ...validWallet,
      network: 'PUBLIC',
    };

    render(
      <QuickRepayModal
        creditLine={mockCreditLine}
        walletBalance={2_000}
        initialAmount="100"
        onClose={vi.fn()}
        onSuccess={onSuccess}
        walletOverride={wrongNetworkWallet}
        statusOverride="connected"
      />,
    );

    const switchBtn = screen.getByTestId('switch-network-action-button');
    fireEvent.click(switchBtn);

    await waitFor(() => {
      expect(screen.getByTestId('switch-network-error-alert')).toBeInTheDocument();
    });

    expect(onSuccess).not.toHaveBeenCalled();
    const confirmBtn = screen.getByRole('button', { name: /confirm repayment/i });
    expect(confirmBtn).toBeDisabled();
  });
});
