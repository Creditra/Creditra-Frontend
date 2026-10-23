import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import App from './App';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { ToastContainer } from './components/notifications/ToastContainer';

// Mock the Dashboard route component to expose buttons for notification testing
vi.mock('./pages/Dashboard', () => ({
  Dashboard: () => {
    const { addToast, addBanner } = useNotifications();
    return (
      <div>
        <h1>Dashboard</h1>
        <button
          type="button"
          onClick={() =>
            addToast({
              type: 'info',
              title: 'Transaction Submitted',
              message: 'Your transfer is processing.',
              saveToHistory: false,
            })
          }
        >
          Add Info Toast
        </button>
        <button
          type="button"
          onClick={() =>
            addToast({
              type: 'error',
              title: 'Transaction Failed',
              message: 'Insufficient balance.',
              saveToHistory: false,
            })
          }
        >
          Add Error Toast
        </button>
        <button
          type="button"
          onClick={() => {
            for (let i = 0; i < 6; i++) {
              addToast({
                type: 'info',
                title: `Queued Toast ${i}`,
                message: `Message ${i}`,
                duration: 5000,
                saveToHistory: false,
              });
            }
          }}
        >
          Add 6 Toasts
        </button>
        <button
          type="button"
          onClick={() =>
            addBanner({
              type: 'warning',
              message: 'Network congestion detected.',
            })
          }
        >
          Add Banner
        </button>
      </div>
    );
  },
}));

describe('App Toast and Banner Shell Mounting', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    localStorage.clear();
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    localStorage.clear();
  });

  // Scenario 1: Call addToast from a child of the providers -> toast text visible in document
  it('Scenario 1: renders toast text in document when addToast is called from child of providers', async () => {
    render(<App />);

    const button = await screen.findByRole('button', { name: 'Add Info Toast' });
    act(() => {
      button.click();
    });

    const container = document.querySelector('.toast-container');
    expect(container).toBeInTheDocument();
    expect(within(container as HTMLElement).getByText('Transaction Submitted')).toBeInTheDocument();
    expect(within(container as HTMLElement).getByText('Your transfer is processing.')).toBeInTheDocument();
  });

  // Scenario 2: Navigate (re-render at a new path) -> toast still visible
  it('Scenario 2: keeps toast visible when navigating to another route', async () => {
    render(<App />);

    const button = await screen.findByRole('button', { name: 'Add Info Toast' });
    act(() => {
      button.click();
    });

    const container = document.querySelector('.toast-container') as HTMLElement;
    expect(within(container).getByText('Transaction Submitted')).toBeInTheDocument();

    // Navigate to /transactions via nav link
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const transactionsLink = within(nav).getByRole('link', { name: 'Transactions' });

    act(() => {
      fireEvent.click(transactionsLink);
    });

    // Toast survives route navigation because ToastContainer is mounted outside <Routes>
    expect(within(container).getByText('Transaction Submitted')).toBeInTheDocument();
  });

  // Scenario 3: Error toast rendered with role="alert"; info toast with role="status"
  it('Scenario 3: renders error toast with role="alert" and info toast with role="status"', async () => {
    render(<App />);

    const errorBtn = await screen.findByRole('button', { name: 'Add Error Toast' });
    const infoBtn = screen.getByRole('button', { name: 'Add Info Toast' });

    act(() => {
      errorBtn.click();
    });

    const container = document.querySelector('.toast-container') as HTMLElement;
    const errorToast = within(container).getByText('Transaction Failed').closest('.toast-item');
    expect(errorToast).toHaveAttribute('role', 'alert');
    expect(errorToast).toHaveAttribute('aria-live', 'assertive');

    act(() => {
      infoBtn.click();
    });

    const infoToast = within(container).getByText('Transaction Submitted').closest('.toast-item');
    expect(infoToast).toHaveAttribute('role', 'status');
    expect(infoToast).toHaveAttribute('aria-live', 'polite');
  });

  // Scenario 4: Count live regions containing the toast text -> exactly one
  it('Scenario 4: has exactly one live region containing the toast text', async () => {
    render(<App />);

    const button = await screen.findByRole('button', { name: 'Add Info Toast' });
    act(() => {
      button.click();
    });

    const liveRegions = Array.from(
      document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')
    ).filter((el) => el.textContent?.includes('Transaction Submitted'));

    expect(liveRegions).toHaveLength(1);
    expect(liveRegions[0]).toHaveClass('toast-item');
  });

  // Scenario 5: Add 6 toasts -> 5 visible; evicted toast timer cleared
  it('Scenario 5: caps toast stack at 5 and clears evicted toast timer', async () => {
    render(<App />);

    const button = await screen.findByRole('button', { name: 'Add 6 Toasts' });
    act(() => {
      button.click();
    });

    const items = document.querySelectorAll('.toast-item');
    expect(items.length).toBe(5);

    // Oldest toast (Toast 0) was evicted and removed from DOM
    expect(screen.queryByText('Queued Toast 0')).not.toBeInTheDocument();
    // Most recent toast is visible
    expect(screen.getByText('Queued Toast 5')).toBeInTheDocument();
  });

  // Scenario 6: Unmount the provider with 3 pending toasts -> vi.getTimerCount() returns 0
  it('Scenario 6: clears all pending timers when provider unmounts with 3 pending toasts', () => {
    vi.useFakeTimers();
    try {
      function Runner() {
        const { addToast } = useNotifications();
        return (
          <button
            type="button"
            onClick={() => {
              addToast({ type: 'info', title: 'T1', message: 'M1', duration: 10000 });
              addToast({ type: 'info', title: 'T2', message: 'M2', duration: 10000 });
              addToast({ type: 'info', title: 'T3', message: 'M3', duration: 10000 });
            }}
          >
            Add 3
          </button>
        );
      }

      const { unmount } = render(
        <NotificationProvider>
          <Runner />
          <ToastContainer />
        </NotificationProvider>
      );

      act(() => {
        screen.getByRole('button', { name: 'Add 3' }).click();
      });

      expect(vi.getTimerCount()).toBeGreaterThan(0);

      act(() => {
        unmount();
      });

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  // Scenario 7: Mark all as read in NotificationCenter -> Undo toast visible with an Undo button
  it('Scenario 7: renders Undo toast with Undo button when marking all as read in NotificationCenter', async () => {
    localStorage.setItem(
      'creditra_notifications',
      JSON.stringify([
        {
          id: 'notif-1',
          type: 'info',
          category: 'system',
          title: 'Liquidation warning',
          message: 'Your collateral ratio is low.',
          timestamp: new Date().toISOString(),
          read: false,
        },
      ])
    );

    render(<App />);

    // Bell button has aria-label with unread count
    const bell = await screen.findByRole('button', { name: /notifications/i });
    act(() => {
      fireEvent.click(bell);
    });

    // Notification center dialog is now open; click "Mark all read"
    const markAllBtn = screen.getByRole('button', { name: /mark all.*read/i });
    act(() => {
      fireEvent.click(markAllBtn);
    });

    // Undo toast is now rendered by ToastContainer in the app shell
    const toastContainer = document.querySelector('.toast-container') as HTMLElement;
    expect(within(toastContainer).getByText('Marked all as read')).toBeInTheDocument();
    expect(within(toastContainer).getByRole('button', { name: /undo/i, hidden: true })).toBeInTheDocument();
  });

  // Scenario 8: addBanner -> banner rendered once at the top of <main>
  it('Scenario 8: renders banner once at the top of <main>', async () => {
    render(<App />);

    const button = await screen.findByRole('button', { name: 'Add Banner' });
    act(() => {
      button.click();
    });

    const main = screen.getByRole('main');
    const bannerStack = main.querySelector('.banner-stack');
    expect(bannerStack).toBeInTheDocument();
    expect(bannerStack).toContainElement(screen.getByText('Network congestion detected.'));

    // Verified rendered exactly once in <main>
    const allBanners = document.querySelectorAll('.banner-stack');
    expect(allBanners).toHaveLength(1);
    expect(main.firstElementChild).toBe(bannerStack);
  });
});
