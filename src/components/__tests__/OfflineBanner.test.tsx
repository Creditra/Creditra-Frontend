import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineBanner } from '../OfflineBanner';
import * as useOnlineHook from '../../hooks/useOnline';

vi.mock('../../hooks/useOnline');

describe('OfflineBanner', () => {
  const mockCheckOnlineStatus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when online and not previously shown', () => {
    vi.spyOn(useOnlineHook, 'useOnline').mockReturnValue({
      isOnline: true,
      queueAction: vi.fn(),
      checkOnlineStatus: mockCheckOnlineStatus,
      queuedActionCount: 0,
    });

    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders offline banner when offline', () => {
    vi.spyOn(useOnlineHook, 'useOnline').mockReturnValue({
      isOnline: false,
      queueAction: vi.fn(),
      checkOnlineStatus: mockCheckOnlineStatus,
      queuedActionCount: 0,
    });

    render(<OfflineBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('You are currently offline. Actions will be queued.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry connection' })).toBeInTheDocument();
  });

  it('calls checkOnlineStatus on retry button click', async () => {
    vi.spyOn(useOnlineHook, 'useOnline').mockReturnValue({
      isOnline: false,
      queueAction: vi.fn(),
      checkOnlineStatus: mockCheckOnlineStatus,
      queuedActionCount: 0,
    });

    render(<OfflineBanner />);
    const button = screen.getByRole('button', { name: 'Retry connection' });
    await userEvent.click(button);
    expect(mockCheckOnlineStatus).toHaveBeenCalledTimes(1);
  });

  it('shows restored state temporarily when coming back online', () => {
    vi.useFakeTimers();
    let isOnline = false;
    
    vi.spyOn(useOnlineHook, 'useOnline').mockImplementation(() => ({
      isOnline,
      queueAction: vi.fn(),
      checkOnlineStatus: mockCheckOnlineStatus,
      queuedActionCount: 0,
    }));

    const { rerender } = render(<OfflineBanner />);
    expect(screen.getByText('You are currently offline. Actions will be queued.')).toBeInTheDocument();

    // Come back online
    isOnline = true;
    rerender(<OfflineBanner />);
    
    expect(screen.getByText('Connection restored.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry connection' })).not.toBeInTheDocument();

    // Fast-forward timer to hide banner
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('Connection restored.')).not.toBeInTheDocument();
    
    vi.useRealTimers();
  });
});
