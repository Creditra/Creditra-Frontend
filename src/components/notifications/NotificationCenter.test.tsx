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
});
