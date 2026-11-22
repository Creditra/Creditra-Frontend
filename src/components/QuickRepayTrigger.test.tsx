import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuickRepayTrigger } from './QuickRepayTrigger';

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    wallet: { publicKey: 'GTEST', network: 'TESTNET' },
    status: 'connected',
    balances: [
      { asset: 'XLM', balance: '10000' },
      {
        asset: 'USDC',
        issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        balance: '5.0000000',
      },
    ],
  }),
}));

vi.mock('../data/mockData', () => ({
  MOCK_CREDIT_LINES: [
    {
      id: 'CL-TEST',
      name: 'Test credit line',
      status: 'Active',
      limit: 10000,
      utilized: 1000,
      apr: 8,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
}));

describe('QuickRepayTrigger', () => {
  it('shows only the settlement-asset balance, not the sum of wallet assets', () => {
    render(<QuickRepayTrigger />);
    fireEvent.click(screen.getByRole('button', { name: 'Quick Repay' }));

    expect(screen.getByText('$5.00')).toBeInTheDocument();
    expect(screen.queryByText('$10,005.00')).not.toBeInTheDocument();
  });
});
