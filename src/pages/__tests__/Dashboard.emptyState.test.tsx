import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../Dashboard';

// Mock WalletContext to be connected
vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({
    wallet: {
      publicKey: '0x1234567890abcdef1234567890abcdef12345678',
      network: 'TESTNET',
    },
    status: 'connected',
  }),
}));

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
    vi.useFakeTimers();

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    // Fast-forward dashboard loading delay (500ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Check that empty state content is visible
    expect(screen.getByRole('heading', { name: 'No credit lines yet' })).toBeInTheDocument();
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
