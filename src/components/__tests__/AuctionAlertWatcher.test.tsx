import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { AuctionAlertWatcher } from '../AuctionAlertWatcher';
import { NotificationProvider, useNotifications } from '../../context/NotificationContext';
import { setAlert } from '../../state/auctionAlerts';

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

function ToastProbe() {
  const { toasts } = useNotifications();
  return <output data-testid="toast-categories">{toasts.map(toast => toast.category).join(',')}</output>;
}

describe('AuctionAlertWatcher', () => {
  afterEach(() => {
    setVisibilityState('visible');
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
    const view = render(<NotificationProvider><AuctionAlertWatcher /><ToastProbe /></NotificationProvider>);
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByTestId('toast-categories').textContent).toBe('auction');
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByTestId('toast-categories').textContent).not.toContain('auction,auction');
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

  it('pauses polling while hidden and runs one catch-up check on return', () => {
    vi.useFakeTimers();
    setVisibilityState('visible');
    // Set an alert with a very low target so it does not trigger immediately
    setAlert('DA-001', 1);
    const view = render(<NotificationProvider><AuctionAlertWatcher /><ToastProbe /></NotificationProvider>);
    expect(vi.getTimerCount()).toBe(1);

    // Hide the tab: interval must be cleared
    act(() => {
      setVisibilityState('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(vi.getTimerCount()).toBe(0);

    // Update alert to a target that is already reached while hidden
    setAlert('DA-001', 9_900_000_000);
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(screen.getByTestId('toast-categories').textContent).toBe('');

    // Return to visible: catch-up check fires immediately
    act(() => {
      setVisibilityState('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByTestId('toast-categories').textContent).toBe('auction');
    expect(JSON.parse(localStorage.getItem('creditra_auction_alerts_v1') || '[]')).toEqual([]);
    view.unmount();
  });
});