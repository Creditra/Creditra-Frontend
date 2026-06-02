import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';

// Mock the useWallet hook
vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    wallet: {
      publicKey: '0x1234567890abcdef1234567890abcdef12345678',
      network: 'TESTNET',
    },
    status: 'connected',
  }),
}));

describe('Dashboard component skeletons', () => {
  it('renders initial skeleton loading phase with appropriate accessibility attributes', () => {
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    // Verify loading polite announcement
    const announcement = container.querySelector('.dashboard-root > .sr-only') as HTMLElement;
    expect(announcement).toBeInTheDocument();
    expect(announcement.textContent).toBe('Loading dashboard');

    // Verify main root has aria-busy="true"
    const root = container.querySelector('.dashboard-root') as HTMLElement;
    expect(root).toBeInTheDocument();
    expect(root.getAttribute('aria-busy')).toBe('true');
  });

  it('transitions to loaded state after timer fires', async () => {
    vi.useFakeTimers();

    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    // Fast-forward simulated loading time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Verify loaded polite announcement
    const announcement = container.querySelector('.dashboard-root > .sr-only') as HTMLElement;
    expect(announcement).toBeInTheDocument();
    expect(announcement.textContent).toBe('Dashboard loaded');

    // Verify root is not busy
    const root = container.querySelector('.dashboard-root') as HTMLElement;
    expect(root.getAttribute('aria-busy')).toBe('false');

    // Verify actual dashboard data is present
    expect(screen.getByText('Total Credit Limit')).toBeInTheDocument();
    expect(screen.getByText('Total Utilized')).toBeInTheDocument();
    expect(screen.getByText('Available Credit')).toBeInTheDocument();

    vi.useRealTimers();
  });
});
