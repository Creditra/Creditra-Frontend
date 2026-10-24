import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { AuctionAlertWatcher } from '../AuctionAlertWatcher';
import { NotificationProvider, useNotifications } from '../../context/NotificationContext';
import { setAlert } from '../../state/auctionAlerts';

function ToastProbe() {
  const { toasts } = useNotifications();
  return <output data-testid="toast-categories">{toasts.map(toast => toast.category).join(',')}</output>;
}

describe('AuctionAlertWatcher', () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('does not keep an interval when there are no alerts', () => {
    vi.useFakeTimers();
    const view = render(<NotificationProvider><AuctionAlertWatcher /><ToastProbe /></NotificationProvider>);
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
  });

  it('notifies once when the target is reached, then clears the alert', () => {
    vi.useFakeTimers();
    setAlert('DA-001', 9_900_000_000);
    const view = render(<NotificationProvider><AuctionAlertWatcher /></NotificationProvider>);
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByTestId('toast-categories').textContent).toBe('auction');
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByTestId('toast-categories').textContent).toBe('auction');
    expect(JSON.parse(localStorage.getItem('creditra_auction_alerts_v1') || '[]')).toEqual([]);
    view.unmount();
  });

  it('suppresses notification when the auction preference is muted', () => {
    vi.useFakeTimers();
    localStorage.setItem('creditra_notification_prefs', JSON.stringify({ auction: false }));
    setAlert('DA-001', 9_900_000_000);
    const view = render(<NotificationProvider><AuctionAlertWatcher /><ToastProbe /></NotificationProvider>);
    expect(screen.getByTestId('toast-categories').textContent).toBe('');
    expect(JSON.parse(localStorage.getItem('creditra_auction_alerts_v1') || '[]')).toEqual([]);
    view.unmount();
  });
});