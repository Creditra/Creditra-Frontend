import { screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../Dashboard';
import { renderWithCredit } from '../../test/renderWithCredit';

// Mock WalletContext to be connected
vi.mock('../../context/WalletContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/WalletContext')>(
    '../../context/WalletContext',
  );
  return {
    ...actual,
    useWallet: () => ({
      wallet: {
        publicKey: '0x1234567890abcdef1234567890abcdef12345678',
        network: 'TESTNET',
      },
      status: 'connected',
    }),
  };
});

// Mock storage utilities
vi.mock('../../utils/storage', () => ({
  readJson: vi.fn((_key: string, fallback: unknown) => fallback),
  writeJson: vi.fn(),
}));

// Mock mockData to return empty list of credit lines for empty state test
vi.mock('../../data/mockData', () => ({
  MOCK_CREDIT_LINES: [],
}));

describe('Dashboard — empty state (issue #501)', () => {
  it('renders the shared EmptyState component when no credit lines are present', async () => {
    renderWithCredit(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
      { withRouter: false },
    );

    // Check that empty state content is visible
    expect(await screen.findByRole('heading', { name: 'No credit lines yet' })).toBeInTheDocument();
    expect(
      screen.getByText(/Start your credit journey by requesting a credit evaluation/i)
    ).toBeInTheDocument();

    // Check that the CTA link is rendered
    const ctaLink = screen.getByRole('link', { name: 'Request Credit Evaluation' });
    expect(ctaLink).toBeInTheDocument();
    expect(ctaLink.getAttribute('href')).toBe('/open-credit');

    vi.useRealTimers();
  });
});
