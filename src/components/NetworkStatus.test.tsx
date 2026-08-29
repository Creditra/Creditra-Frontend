import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkStatus } from './NetworkStatus';
import * as useOnlineHook from '../hooks/useOnline';

vi.mock('../hooks/useOnline');

describe('NetworkStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders online indicator with accessible label', () => {
    vi.spyOn(useOnlineHook, 'useOnline').mockReturnValue({
      isOnline: true,
      queueAction: vi.fn(),
      checkOnlineStatus: vi.fn(),
      queuedActionCount: 0,
    });

    render(<NetworkStatus />);

    expect(
      screen.getByLabelText('Network status: online'),
    ).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('renders offline indicator with accessible label', () => {
    vi.spyOn(useOnlineHook, 'useOnline').mockReturnValue({
      isOnline: false,
      queueAction: vi.fn(),
      checkOnlineStatus: vi.fn(),
      queuedActionCount: 0,
    });

    render(<NetworkStatus />);

    expect(
      screen.getByLabelText('Network status: offline'),
    ).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('does not announce on initial mount', () => {
    vi.spyOn(useOnlineHook, 'useOnline').mockReturnValue({
      isOnline: true,
      queueAction: vi.fn(),
      checkOnlineStatus: vi.fn(),
      queuedActionCount: 0,
    });

    render(<NetworkStatus />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces assertively when going offline', () => {
    let isOnline = true;

    vi.spyOn(useOnlineHook, 'useOnline').mockImplementation(() => ({
      isOnline,
      queueAction: vi.fn(),
      checkOnlineStatus: vi.fn(),
      queuedActionCount: 0,
    }));

    const { rerender } = render(<NetworkStatus />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    isOnline = false;
    rerender(<NetworkStatus />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent('Network connection lost. You are offline.');
  });

  it('announces politely when connection is restored', () => {
    let isOnline = false;

    vi.spyOn(useOnlineHook, 'useOnline').mockImplementation(() => ({
      isOnline,
      queueAction: vi.fn(),
      checkOnlineStatus: vi.fn(),
      queuedActionCount: 0,
    }));

    const { rerender } = render(<NetworkStatus />);

    isOnline = true;
    act(() => {
      rerender(<NetworkStatus />);
    });

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Network connection restored.');
  });

  it('applies theme-aware online/offline modifier classes', () => {
    vi.spyOn(useOnlineHook, 'useOnline').mockReturnValue({
      isOnline: true,
      queueAction: vi.fn(),
      checkOnlineStatus: vi.fn(),
      queuedActionCount: 0,
    });

    const { rerender } = render(<NetworkStatus />);
    expect(screen.getByLabelText('Network status: online')).toHaveClass(
      'network-status--online',
    );

    vi.spyOn(useOnlineHook, 'useOnline').mockReturnValue({
      isOnline: false,
      queueAction: vi.fn(),
      checkOnlineStatus: vi.fn(),
      queuedActionCount: 0,
    });
    rerender(<NetworkStatus />);

    expect(screen.getByLabelText('Network status: offline')).toHaveClass(
      'network-status--offline',
    );
  });
});
