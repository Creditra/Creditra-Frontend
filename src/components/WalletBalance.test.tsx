import { render, screen, act } from '@testing-library/react';
import { WalletBalance } from './WalletBalance';
import { useWallet } from '../context/WalletContext';
import { SETTLEMENT_ASSET } from '../lib/repayable-balance';
import { vi } from 'vitest';
import '@testing-library/jest-dom';

vi.mock('../context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

interface TestBalance {
  asset: string;
  balance: string;
  issuer?: string;
}

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: state !== 'visible',
  });
}

function mockConnected(
  balances: TestBalance[] | null,
  overrides: Record<string, unknown> = {},
) {
  const refreshBalance = vi.fn();
  vi.mocked(useWallet).mockReturnValue({
    status: 'connected',
    wallet: { publicKey: 'G123' },
    balances,
    streamStatus: 'live',
    refreshBalance,
    ...overrides,
  } as any);
  return { refreshBalance };
}

describe('WalletBalance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setVisibilityState('visible');
  });

  afterEach(() => {
    setVisibilityState('visible');
    vi.useRealTimers();
  });

  it('renders null when not connected', () => {
    vi.mocked(useWallet).mockReturnValue({
      status: 'disconnected',
      wallet: null,
      balances: null,
      streamStatus: 'live',
      refreshBalance: vi.fn(),
    } as any);

    const { container } = render(<WalletBalance />);
    expect(container.firstChild).toBeNull();
  });

  it('renders both balances with an accessible group and per-value labels', () => {
    mockConnected([
      { asset: 'USDC', balance: '24.9999999', issuer: SETTLEMENT_ASSET.issuer },
      { asset: 'XLM', balance: '100.5050505' },
    ]);

    render(<WalletBalance />);

    expect(screen.getByRole('group', { name: /wallet balance/i })).toBeInTheDocument();
    expect(screen.getByText('XLM balance:')).toBeInTheDocument();
    expect(screen.getByText('USDC balance:')).toBeInTheDocument();
    expect(screen.getByText('100.5050 XLM')).toBeInTheDocument();
    expect(screen.getByText('24.99 USDC')).toBeInTheDocument();
    expect(screen.queryByText('No USDC trustline')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Balance stream: Live');
  });

  it('shows explicit zero balances and no-trustline state when there are no balances', () => {
    mockConnected([]);

    render(<WalletBalance />);

    expect(screen.getByRole('group', { name: /wallet balance/i })).toBeInTheDocument();
    expect(screen.getByText('0.0000 XLM')).toBeInTheDocument();
    expect(screen.getByText('0.00 USDC')).toBeInTheDocument();
    expect(screen.getByText('No USDC trustline')).toBeInTheDocument();
  });

  it('reports a missing USDC trustline when only XLM is present', () => {
    mockConnected([{ asset: 'XLM', balance: '12.3' }]);

    render(<WalletBalance />);

    expect(screen.getByText('12.3000 XLM')).toBeInTheDocument();
    expect(screen.getByText('0.00 USDC')).toBeInTheDocument();
    expect(screen.getByText('No USDC trustline')).toBeInTheDocument();
  });

  it('keeps zero XLM explicit when only USDC is present', () => {
    mockConnected([
      { asset: 'USDC', balance: '9.9999999', issuer: SETTLEMENT_ASSET.issuer },
    ]);

    render(<WalletBalance />);

    expect(screen.getByText('0.0000 XLM')).toBeInTheDocument();
    expect(screen.getByText('9.99 USDC')).toBeInTheDocument();
    expect(screen.queryByText('No USDC trustline')).not.toBeInTheDocument();
  });

  it('prefers the configured issuer when two USDC assets are present', () => {
    mockConnected([
      { asset: 'USDC', balance: '1.00', issuer: 'GOTHERISSUER1' },
      { asset: 'XLM', balance: '3' },
      { asset: 'USDC', balance: '2.00', issuer: SETTLEMENT_ASSET.issuer },
    ]);

    render(<WalletBalance />);

    expect(screen.getByText('2.00 USDC')).toBeInTheDocument();
    expect(screen.queryByText('1.00 USDC')).not.toBeInTheDocument();
  });

  it('falls back to the first USDC entry when no issuer matches the configuration', () => {
    mockConnected([
      { asset: 'USDC', balance: '7.00', issuer: 'GISSUERA' },
      { asset: 'USDC', balance: '8.00', issuer: 'GISSUERB' },
    ]);

    render(<WalletBalance />);

    expect(screen.getByText('7.00 USDC')).toBeInTheDocument();
    expect(screen.queryByText('8.00 USDC')).not.toBeInTheDocument();
  });

  it('formats very large balance strings without floating point drift', () => {
    const huge = '123456789012345678901234567890.1234567';
    mockConnected([
      { asset: 'XLM', balance: huge },
      { asset: 'USDC', balance: huge },
    ]);

    render(<WalletBalance />);

    expect(screen.getByText('123456789012345678901234567890.1234 XLM')).toBeInTheDocument();
    expect(screen.getByText('123456789012345678901234567890.12 USDC')).toBeInTheDocument();
  });

  it('does not poll on a 15s interval (relies on WalletContext stream)', () => {
    const { refreshBalance } = mockConnected([{ asset: 'XLM', balance: '100.50' }]);

    render(<WalletBalance />);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(refreshBalance).not.toHaveBeenCalled();
  });

  it('triggers a one-time initial fetch when connected without balances', () => {
    const { refreshBalance } = mockConnected(null);

    render(<WalletBalance />);
    expect(refreshBalance).toHaveBeenCalledTimes(1);
  });

  it('reflects reconnecting and polling stream statuses', () => {
    mockConnected([{ asset: 'XLM', balance: '100.50' }], {
      streamStatus: 'reconnecting',
    });

    const { rerender } = render(<WalletBalance />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Balance stream: Reconnecting…',
    );

    mockConnected([{ asset: 'XLM', balance: '100.50' }], { streamStatus: 'polling' });

    rerender(<WalletBalance />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Balance stream: Polling');
  });

  it('does not refresh while hidden and runs one catch-up refresh on return to visible', () => {
    const { refreshBalance } = mockConnected([{ asset: 'XLM', balance: '100.50' }]);

    render(<WalletBalance />);
    expect(refreshBalance).not.toHaveBeenCalled();

    act(() => {
      setVisibilityState('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(60_000);
    });
    expect(refreshBalance).not.toHaveBeenCalled();

    act(() => {
      setVisibilityState('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(refreshBalance).toHaveBeenCalledTimes(1);
  });
});
