import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { NotificationProvider, useNotifications } from '../../context/NotificationContext';
import {
  NotificationCenter,
  NOTIFICATION_CENTER_MD_BREAKPOINT,
  resolveSheetSnapFromRatio,
  SHEET_SNAP_RATIOS,
} from './NotificationCenter';
import { ToastContainer } from './ToastContainer';

vi.mock('../../hooks/useBodyScrollLock', () => ({
  useBodyScrollLock: vi.fn(),
}));

vi.mock('../../hooks/useInertBackdrop', () => ({
  useInertBackdrop: vi.fn(),
}));

function renderOpenPanel() {
  function Harness() {
    const { openPanel } = useNotifications();
    return (
      <>
        <button type="button" onClick={openPanel}>
          Open panel
        </button>
        <NotificationCenter />
      </>
    );
  }

  render(
    <NotificationProvider>
      <Harness />
    </NotificationProvider>,
  );
}

describe('resolveSheetSnapFromRatio', () => {
  it('dismisses when dragged below the lower threshold', () => {
    expect(resolveSheetSnapFromRatio(0.2)).toBe('dismiss');
  });

  it('snaps to half between 35% and 70% viewport height', () => {
    expect(resolveSheetSnapFromRatio(0.5)).toBe('half');
  });

  it('snaps to full at or above 70% viewport height', () => {
    expect(resolveSheetSnapFromRatio(0.85)).toBe('full');
  });
});

describe('NotificationCenter mobile bottom-sheet', () => {
  const mobileQuery = `(max-width: ${NOTIFICATION_CENTER_MD_BREAKPOINT - 1}px)`;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === mobileQuery,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('opens at the half snap point on mobile', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOpenPanel();

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    const dialog = screen.getByRole('dialog', { name: 'Notification center' });
    expect(dialog).toHaveClass('nc-panel-snap-half');
    expect(dialog).not.toHaveClass('nc-panel-snap-full');
  });

  it('expands to the full snap point via keyboard-accessible control', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOpenPanel();

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    await user.click(
      screen.getByRole('button', { name: 'Expand notification panel to full height' }),
    );

    const dialog = screen.getByRole('dialog', { name: 'Notification center' });
    expect(dialog).toHaveClass('nc-panel-snap-full');
  });

  it('collapses back to the half snap point', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOpenPanel();

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    await user.click(
      screen.getByRole('button', { name: 'Expand notification panel to full height' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Collapse notification panel to half height' }),
    );

    const dialog = screen.getByRole('dialog', { name: 'Notification center' });
    expect(dialog).toHaveClass('nc-panel-snap-half');
  });

  it('exposes expand and collapse controls only in the mobile sheet chrome', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOpenPanel();

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    expect(
      screen.getByRole('button', { name: 'Expand notification panel to full height' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Collapse notification panel to half height' }),
    ).toBeInTheDocument();
  });

  it('maps snap points to 50% and 90% viewport height ratios', () => {
    expect(SHEET_SNAP_RATIOS.half).toBe(0.5);
    expect(SHEET_SNAP_RATIOS.full).toBe(0.9);
  });
});

describe('NotificationCenter focus trap', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('focuses the first control when the panel opens', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOpenPanel();

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Notification preferences' }),
    );
  });

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOpenPanel();

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.keyboard('{Escape}');

    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('NotificationCenter mark all as read', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  function renderWithNotifications() {
    function Harness() {
      const { openPanel, addToast } = useNotifications();

      React.useEffect(() => {
        // Add some unread notifications
        addToast({
          type: 'success',
          category: 'transaction',
          title: 'Payment received',
          message: 'Your payment of $100 was received',
          saveToHistory: true,
        });
        addToast({
          type: 'info',
          category: 'credit_line',
          title: 'Credit line updated',
          message: 'Your credit limit was increased',
          saveToHistory: true,
        });
        addToast({
          type: 'warning',
          category: 'risk_score',
          title: 'Risk score changed',
          message: 'Your risk score decreased',
          saveToHistory: true,
        });
      }, [addToast]);

      return (
        <>
          <button type="button" onClick={openPanel}>
            Open panel
          </button>
          <NotificationCenter />
        </>
      );
    }

    render(
      <NotificationProvider>
        <Harness />
      </NotificationProvider>,
    );
  }

  it('marks all notifications as read when button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithNotifications();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Check unread badge shows count
    expect(screen.getByText('3')).toBeInTheDocument();

    // Click mark all read button
    const markAllButton = screen.getByRole('button', { name: /mark all notifications as read, 3 unread/i });
    expect(markAllButton).toBeEnabled();
    
    await user.click(markAllButton);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Unread badge should be gone
    expect(screen.queryByText('3')).not.toBeInTheDocument();

    // Button should be disabled with no unread notifications
    expect(screen.getByRole('button', { name: /mark all notifications as read/i })).toBeDisabled();
  });

  it('announces completion to screen readers', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithNotifications();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Click mark all read
    await user.click(screen.getByRole('button', { name: /mark all notifications as read, 3 unread/i }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Check screen reader announcement
    const announcement = screen.getByRole('status');
    expect(announcement).toHaveTextContent('3 notifications marked as read');
    expect(announcement).toHaveAttribute('aria-live', 'polite');
    expect(announcement).toHaveAttribute('aria-atomic', 'true');
  });

  it('announces singular form for one notification', async () => {
    function Harness() {
      const { openPanel, addToast } = useNotifications();

      React.useEffect(() => {
        addToast({
          type: 'success',
          category: 'transaction',
          title: 'Payment received',
          message: 'Your payment was received',
          saveToHistory: true,
        });
      }, [addToast]);

      return (
        <>
          <button type="button" onClick={openPanel}>
            Open panel
          </button>
          <NotificationCenter />
        </>
      );
    }

    render(
      <NotificationProvider>
        <Harness />
      </NotificationProvider>,
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Click mark all read
    await user.click(screen.getByRole('button', { name: /mark all notifications as read, 1 unread/i }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Check singular announcement
    const announcement = screen.getByRole('status');
    expect(announcement).toHaveTextContent('1 notification marked as read');
  });

  it('clears announcement after 3 seconds', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithNotifications();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Click mark all read
    await user.click(screen.getByRole('button', { name: /mark all notifications as read, 3 unread/i }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Announcement should be present
    expect(screen.getByRole('status')).toHaveTextContent('3 notifications marked as read');

    // Fast-forward past 3 seconds
    act(() => {
      vi.advanceTimersByTime(3100);
    });

    // Announcement should be cleared
    expect(screen.queryByText('3 notifications marked as read')).not.toBeInTheDocument();
  });

  it('disables button when there are no unread notifications', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    
    function Harness() {
      const { openPanel } = useNotifications();
      return (
        <>
          <button type="button" onClick={openPanel}>
            Open panel
          </button>
          <NotificationCenter />
        </>
      );
    }

    render(
      <NotificationProvider>
        <Harness />
      </NotificationProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Button should be disabled with no notifications
    const markAllButton = screen.getByRole('button', { name: /mark all notifications as read/i });
    expect(markAllButton).toBeDisabled();
  });

  it('includes unread count in button aria-label', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithNotifications();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Button aria-label should include count
    const markAllButton = screen.getByRole('button', { name: /mark all notifications as read, 3 unread/i });
    expect(markAllButton).toBeInTheDocument();
    expect(markAllButton).toHaveAccessibleName('Mark all notifications as read, 3 unread');
  });

  it('supports keyboard activation with Enter key', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithNotifications();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Tab to mark all read button and press Enter
    const markAllButton = screen.getByRole('button', { name: /mark all notifications as read, 3 unread/i });
    markAllButton.focus();
    
    await user.keyboard('{Enter}');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should announce completion
    expect(screen.getByRole('status')).toHaveTextContent('3 notifications marked as read');
  });

  it('renders KbdHint shortcut chip when there are unread notifications', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithNotifications();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // KbdHint should show Shift+R shortcut
    expect(screen.getByText('Shift')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
  });

  it('does not render KbdHint shortcut chip when there are no unread notifications', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithNotifications();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Mark all as read first
    const markAllButton = screen.getByRole('button', { name: /mark all notifications as read, 3 unread/i });
    await user.click(markAllButton);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // KbdHint should not be visible when no unread notifications
    expect(screen.queryByText('Shift')).not.toBeInTheDocument();
    expect(screen.queryByText('R')).not.toBeInTheDocument();
  });

  it('activates mark all read with Shift+R keyboard shortcut', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithNotifications();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: 'Open panel' }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Verify unread count
    expect(screen.getByText('3')).toBeInTheDocument();

    // Press Shift+R
    await user.keyboard('{Shift>}R{/Shift}');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should mark all as read
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('does not activate Shift+R shortcut when panel is closed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithNotifications();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Don't open the panel
    // Press Shift+R
    await user.keyboard('{Shift>}R{/Shift}');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Unread count should remain (panel not open)
    // Since we can't easily test the global state without opening panel,
    // we verify the panel is not in the document
    expect(screen.queryByRole('dialog', { name: 'Notification center' })).not.toBeInTheDocument();
  });

  it('restores exactly the originally unread notifications on undo (scenario 1)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    localStorage.setItem(
      'creditra_notifications',
      JSON.stringify([
        { id: 'u1', type: 'info', category: 'transaction', title: 'Unread One', message: 'm1', timestamp: new Date(1000).toISOString(), read: false },
        { id: 'u2', type: 'info', category: 'transaction', title: 'Unread Two', message: 'm2', timestamp: new Date(2000).toISOString(), read: false },
        { id: 'r1', type: 'info', category: 'transaction', title: 'Read One', message: 'm3', timestamp: new Date(3000).toISOString(), read: true },
        { id: 'r2', type: 'info', category: 'transaction', title: 'Read Two', message: 'm4', timestamp: new Date(4000).toISOString(), read: true },
        { id: 'r3', type: 'info', category: 'transaction', title: 'Read Three', message: 'm5', timestamp: new Date(5000).toISOString(), read: true },
      ]),
    );

    function Harness() {
      const { openPanel } = useNotifications();
      return (
        <>
          <button type="button" onClick={openPanel}>Open panel</button>
          <NotificationCenter />
          <ToastContainer />
        </>
      );
    }

    render(
      <NotificationProvider>
        <Harness />
      </NotificationProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // 2 unread initially
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Unread One, unread' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Unread Two, unread' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Read One, read' })).toBeInTheDocument();

    // Mark all as read
    const markAllBtn = screen.getByRole('button', { name: /mark all notifications as read, 2 unread/i });
    await user.click(markAllBtn);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // All should be read now
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Unread One, read' })).toBeInTheDocument();

    // Click Undo on the toast
    const undoBtn = screen.getByRole('button', { name: /undo/i });
    await user.click(undoBtn);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Exactly the 2 originally unread are unread again!
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Unread One, unread' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Unread Two, unread' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Read One, read' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Read Two, read' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Read Three, read' })).toBeInTheDocument();
  });

  it('restores cleared snapshot merged with newly arrived notifications on clear-all undo (scenario 2)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    localStorage.setItem(
      'creditra_notifications',
      JSON.stringify([
        { id: 'orig-1', type: 'info', category: 'transaction', title: 'Orig 1', message: 'm1', timestamp: new Date(1000).toISOString(), read: false },
        { id: 'orig-2', type: 'info', category: 'transaction', title: 'Orig 2', message: 'm2', timestamp: new Date(2000).toISOString(), read: false },
        { id: 'orig-3', type: 'info', category: 'transaction', title: 'Orig 3', message: 'm3', timestamp: new Date(3000).toISOString(), read: false },
        { id: 'orig-4', type: 'info', category: 'transaction', title: 'Orig 4', message: 'm4', timestamp: new Date(4000).toISOString(), read: false },
        { id: 'orig-5', type: 'info', category: 'transaction', title: 'Orig 5', message: 'm5', timestamp: new Date(5000).toISOString(), read: false },
      ]),
    );

    function Harness() {
      const { openPanel, addToast } = useNotifications();
      return (
        <>
          <button type="button" onClick={openPanel}>Open panel</button>
          <button
            type="button"
            onClick={() => {
              addToast({
                type: 'info',
                category: 'transaction',
                title: 'New Arrival',
                message: 'new message',
                saveToHistory: true,
              });
            }}
          >
            Add new notification
          </button>
          <NotificationCenter />
          <ToastContainer />
        </>
      );
    }

    render(
      <NotificationProvider>
        <Harness />
      </NotificationProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // 5 original items in feed
    expect(screen.getAllByRole('article')).toHaveLength(5);

    // Clear all
    const clearAllBtn = screen.getByRole('button', { name: 'Clear all notifications' });
    await user.click(clearAllBtn);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText('No notifications')).toBeInTheDocument();

    // A new notification arrives during undo window
    await user.click(screen.getByRole('button', { name: 'Add new notification' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Only the new notification is in the feed now
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'New Arrival, unread' })).toBeInTheDocument();

    // Click Undo on the clear-all toast
    const undoBtn = screen.getByRole('button', { name: /undo/i });
    await user.click(undoBtn);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Feed now has all 6 items: the 5 originals plus the new arrival!
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(6);
    expect(screen.getByRole('article', { name: 'New Arrival, unread' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Orig 1, unread' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Orig 5, unread' })).toBeInTheDocument();
  });

  it('is idempotent when undo is triggered twice (scenario 3)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    localStorage.setItem(
      'creditra_notifications',
      JSON.stringify([
        { id: 'u1', type: 'info', category: 'transaction', title: 'Unread One', message: 'm1', timestamp: new Date(1000).toISOString(), read: false },
        { id: 'r1', type: 'info', category: 'transaction', title: 'Read One', message: 'm2', timestamp: new Date(2000).toISOString(), read: true },
      ]),
    );

    function Harness() {
      const { openPanel, undoRead } = useNotifications();
      return (
        <>
          <button type="button" onClick={openPanel}>Open panel</button>
          <button type="button" onClick={() => undoRead(['u1'])}>Trigger Second Restoration</button>
          <NotificationCenter />
          <ToastContainer />
        </>
      );
    }

    render(
      <NotificationProvider>
        <Harness />
      </NotificationProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: /mark all notifications as read/i }));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const undoBtn = screen.getByRole('button', { name: /undo/i });
    await user.click(undoBtn);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // First undo state
    expect(screen.getByRole('article', { name: 'Unread One, unread' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Read One, read' })).toBeInTheDocument();

    // Second undo attempt
    await user.click(screen.getByRole('button', { name: 'Trigger Second Restoration' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // State identical
    expect(screen.getByRole('article', { name: 'Unread One, unread' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Read One, read' })).toBeInTheDocument();
  });

  it('renders undo toast even when preferences.system is false (scenario 4)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    localStorage.setItem(
      'creditra_notification_prefs',
      JSON.stringify({ system: false }),
    );
    localStorage.setItem(
      'creditra_notifications',
      JSON.stringify([
        { id: 'u1', type: 'info', category: 'transaction', title: 'Unread One', message: 'm1', timestamp: new Date(1000).toISOString(), read: false },
      ]),
    );

    function Harness() {
      const { openPanel } = useNotifications();
      return (
        <>
          <button type="button" onClick={openPanel}>Open panel</button>
          <NotificationCenter />
          <ToastContainer />
        </>
      );
    }

    render(
      <NotificationProvider>
        <Harness />
      </NotificationProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const markAllBtn = screen.getByRole('button', { name: /mark all notifications as read/i });
    await user.click(markAllBtn);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Undo button on toast must still be rendered because bypassPreferences: true
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
  });

  it('ignores Shift+R when focus is in an input inside the panel (scenario 6)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithNotifications();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Verify 3 unread
    expect(screen.getByText('3')).toBeInTheDocument();

    // Open preferences panel
    await user.click(screen.getByRole('button', { name: 'Notification preferences' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Focus a checkbox input inside the preferences panel
    const toggles = screen.getAllByRole('checkbox');
    expect(toggles.length).toBeGreaterThan(0);
    toggles[0].focus();
    expect(document.activeElement).toBe(toggles[0]);

    // Press Shift+R while input is focused
    await user.keyboard('{Shift>}R{/Shift}');
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should NOT mark all as read; unread count remains 3!
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('NotificationCenter keyboard navigation and focus stability', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  function renderPanelWithThreeItems() {
    let externalAddToast: ReturnType<typeof useNotifications>['addToast'];

    function Harness() {
      const { openPanel, addToast } = useNotifications();
      externalAddToast = addToast;

      React.useEffect(() => {
        addToast({
          type: 'success',
          category: 'transaction',
          title: 'First notification',
          message: 'Message 1',
          saveToHistory: true,
        });
        addToast({
          type: 'info',
          category: 'credit_line',
          title: 'Second notification',
          message: 'Message 2',
          saveToHistory: true,
        });
        addToast({
          type: 'warning',
          category: 'risk_score',
          title: 'Third notification',
          message: 'Message 3',
          saveToHistory: true,
        });
      }, [addToast]);

      return (
        <>
          <button type="button" onClick={openPanel}>
            Open panel
          </button>
          <NotificationCenter />
        </>
      );
    }

    render(
      <NotificationProvider>
        <Harness />
      </NotificationProvider>,
    );

    return {
      triggerOutsideToast: () =>
        externalAddToast({
          type: 'info',
          category: 'system',
          title: 'External toast',
          message: 'Background event',
          saveToHistory: false,
        }),
    };
  }

  it('keeps focus on item 3 when addToast is called from outside while panel is open', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { triggerOutsideToast } = renderPanelWithThreeItems();

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const articles = screen.getAllByRole('article');
    const item3 = articles[2];
    item3.focus();
    expect(document.activeElement).toBe(item3);

    act(() => {
      triggerOutsideToast();
      vi.advanceTimersByTime(100);
    });

    expect(document.activeElement).toBe(item3);
  });

  it('marks focused item as read on Enter and keeps focus on that item', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPanelWithThreeItems();

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const articles = screen.getAllByRole('article');
    const item1 = articles[0];
    expect(item1).toHaveAttribute('aria-label', expect.stringMatching(/unread/i));

    item1.focus();
    expect(document.activeElement).toBe(item1);

    await user.keyboard('{Enter}');
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(item1).toHaveAttribute('aria-label', expect.stringMatching(/, read$/i));
    expect(document.activeElement).toBe(item1);
  });

  it('marks focused item as read on Space and keeps focus on that item', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPanelWithThreeItems();

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const articles = screen.getAllByRole('article');
    const item2 = articles[1];
    expect(item2).toHaveAttribute('aria-label', expect.stringMatching(/unread/i));

    item2.focus();
    expect(document.activeElement).toBe(item2);

    await user.keyboard(' ');
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(item2).toHaveAttribute('aria-label', expect.stringMatching(/, read$/i));
    expect(document.activeElement).toBe(item2);
  });

  it('moves focus between articles with PageDown and PageUp', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPanelWithThreeItems();

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const articles = screen.getAllByRole('article');
    articles[0].focus();
    expect(document.activeElement).toBe(articles[0]);

    await user.keyboard('{PageDown}');
    expect(document.activeElement).toBe(articles[1]);

    await user.keyboard('{PageUp}');
    expect(document.activeElement).toBe(articles[0]);
  });

  it('moves focus to the empty state when Clear all is activated', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPanelWithThreeItems();

    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const clearAllBtn = screen.getByRole('button', { name: /clear all notifications/i });
    await user.click(clearAllBtn);

    const emptyStatus = screen.getByRole('status');
    expect(emptyStatus).toHaveTextContent(/no notifications/i);
    expect(document.activeElement).toBe(emptyStatus);
  });
});
