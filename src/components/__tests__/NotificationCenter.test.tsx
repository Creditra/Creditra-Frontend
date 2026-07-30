/**
 * NotificationCenter — unit / integration tests
 *
 * Coverage:
 *  Panel open / close
 *    - Hidden (aria-hidden) when closed; visible when open
 *    - role="dialog", aria-modal, aria-label attributes
 *    - onClose via × button, backdrop click, and Escape keydown
 *  Header actions
 *    - "Mark all read" disabled when unreadCount === 0
 *    - "Mark all read" calls markAllAsRead
 *    - "Clear all" absent when no notifications; present otherwise
 *    - Preferences toggle shows/hides the prefs panel
 *  Filter tabs
 *    - All category tabs are rendered (role="tab")
 *    - Clicking a tab marks it aria-selected="true"
 *  Notification list
 *    - Empty state rendered when no notifications match filter
 *    - Notifications render as article elements with aria-label
 *    - Unread notification shows the unread dot
 *    - Clicking a notification calls markAsRead with its id
 *    - Inline action button calls the action callback
 *  Drag handle (mobile bottom-sheet marker)
 *    - .nc-drag-handle-area element present in DOM at all viewport sizes
 *  NotificationBell
 *    - Renders a button with aria-haspopup="dialog"
 *    - Badge shown when unreadCount > 0, hidden when 0
 *    - Clicking the bell calls openPanel
 *  NotificationWidget
 *    - Renders both bell and panel together
 *    - Panel opens when bell is clicked
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { NotificationBell } from '../notifications/NotificationBell';
import { NotificationWidget } from '../notifications/NotificationWidget';
import {
  NotificationProvider,
  useNotifications,
} from '../../context/NotificationContext';
import type { Notification } from '../../types/notification';
import { useEffect, useRef } from 'react';

// ─── Mock accessibility hooks ─────────────────────────────────────────────────
vi.mock('../../hooks/useBodyScrollLock', () => ({ useBodyScrollLock: () => undefined }));
vi.mock('../../hooks/useInertBackdrop',  () => ({ useInertBackdrop:  () => undefined }));
vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => { const r = { current: null }; return r; },
}));
Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Seed the notification context with specific state before the test component
 * renders, by using a child component that calls context APIs in useEffect.
 */
function Seeder({
  open = false,
  notifications = [] as Omit<Notification, 'read'>[],
}: {
  open?: boolean;
  notifications?: Omit<Notification, 'read'>[];
}) {
  const { openPanel, addToast } = useNotifications();
  useEffect(() => {
    notifications.forEach(n =>
      addToast({
        type: n.type,
        category: n.category,
        title: n.title,
        message: n.message,
        saveToHistory: true,
      })
    );
    if (open) openPanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Build a minimal valid notification payload. */
function makeNotif(overrides: Partial<Omit<Notification, 'read'>> = {}): Omit<Notification, 'read'> {
  return {
    id:        overrides.id        ?? `n-${Math.random()}`,
    type:      overrides.type      ?? 'info',
    category:  overrides.category  ?? 'system',
    title:     overrides.title     ?? 'Test notification',
    message:   overrides.message   ?? 'This is a test.',
    timestamp: overrides.timestamp ?? new Date().toISOString(),
  };
}

/**
 * Render `<NotificationCenter>` (or any child) inside a provider.
 * The Seeder component runs seed work before the panel mounts.
 */
function renderCenter(
  seedProps: Parameters<typeof Seeder>[0] = {},
  centerProps: Parameters<typeof NotificationCenter>[0] = {},
) {
  return render(
    <NotificationProvider>
      <Seeder {...seedProps} />
      <NotificationCenter {...centerProps} />
    </NotificationProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ─── Tests: NotificationCenter ────────────────────────────────────────────────

describe('NotificationCenter', () => {

  // ── Panel visibility ───────────────────────────────────────────────────

  it('has aria-hidden="true" when panel is closed', () => {
    renderCenter({ open: false });
    expect(screen.getByRole('dialog', { hidden: true }))
      .toHaveAttribute('aria-hidden', 'true');
  });

  it('has aria-hidden="false" when panel is open', () => {
    renderCenter({ open: true });
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-hidden', 'false');
  });

  it('has correct ARIA dialog attributes when open', () => {
    renderCenter({ open: true });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal',  'true');
    expect(dialog).toHaveAttribute('aria-label',  'Notification center');
  });

  it('shows the panel id for aria-controls from the bell', () => {
    renderCenter({ open: true });
    expect(document.getElementById('notification-center')).toBeInTheDocument();
  });

  // ── Dismiss ────────────────────────────────────────────────────────────

  it('calls closePanel when × button is clicked', () => {
    renderCenter({ open: true });
    fireEvent.click(screen.getByRole('button', { name: /close notification center/i }));
    // After close, panel should be aria-hidden
    expect(screen.getByRole('dialog', { hidden: true }))
      .toHaveAttribute('aria-hidden', 'true');
  });

  it('calls closePanel when backdrop is clicked', () => {
    renderCenter({ open: true });
    fireEvent.click(document.querySelector('.nc-backdrop') as HTMLElement);
    expect(screen.getByRole('dialog', { hidden: true }))
      .toHaveAttribute('aria-hidden', 'true');
  });

  it('calls closePanel when Escape is pressed on the dialog', () => {
    renderCenter({ open: true });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog', { hidden: true }))
      .toHaveAttribute('aria-hidden', 'true');
  });

  // ── Header actions ─────────────────────────────────────────────────────

  it('"Mark all read" is disabled when there are no unread notifications', () => {
    renderCenter({ open: true });
    expect(
      screen.getByRole('button', { name: /mark all.*read/i })
    ).toBeDisabled();
  });

  it('"Mark all read" is enabled when there are unread notifications', () => {
    renderCenter({ open: true, notifications: [makeNotif()] });
    expect(
      screen.getByRole('button', { name: /mark all.*read/i })
    ).not.toBeDisabled();
  });

  it('"Clear all" is absent when there are no notifications', () => {
    renderCenter({ open: true });
    expect(
      screen.queryByRole('button', { name: /clear all/i })
    ).toBeNull();
  });

  it('"Clear all" is present when notifications exist', () => {
    renderCenter({ open: true, notifications: [makeNotif()] });
    expect(
      screen.getByRole('button', { name: /clear all/i })
    ).toBeInTheDocument();
  });

  it('clicking "Mark all read" marks all notifications read', async () => {
    const user = userEvent.setup();
    renderCenter({ open: true, notifications: [makeNotif(), makeNotif()] });

    // Unread dots should be present before
    expect(document.querySelectorAll('.nc-unread-dot').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /mark all.*read/i }));

    // After marking read, no unread dots
    expect(document.querySelectorAll('.nc-unread-dot').length).toBe(0);
  });

  it('clicking "Clear all" removes all notifications', async () => {
    const user = userEvent.setup();
    renderCenter({ open: true, notifications: [makeNotif()] });

    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /clear all/i }));
    expect(screen.queryAllByRole('article').length).toBe(0);
  });

  // ── Preferences panel ──────────────────────────────────────────────────

  it('preferences panel is hidden initially', () => {
    renderCenter({ open: true });
    const prefs = document.getElementById('nc-prefs-panel') as HTMLElement;
    expect(prefs).toHaveAttribute('aria-hidden', 'true');
    expect(prefs.classList.contains('nc-prefs-open')).toBe(false);
  });

  it('clicking ⚙ button shows the preferences panel', async () => {
    const user = userEvent.setup();
    renderCenter({ open: true });

    await user.click(screen.getByRole('button', { name: /notification preferences/i }));

    const prefs = document.getElementById('nc-prefs-panel') as HTMLElement;
    expect(prefs).toHaveAttribute('aria-hidden', 'false');
    expect(prefs.classList.contains('nc-prefs-open')).toBe(true);
  });

  it('⚙ button has aria-expanded reflecting prefs state', async () => {
    const user = userEvent.setup();
    renderCenter({ open: true });

    const btn = screen.getByRole('button', { name: /notification preferences/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  // ── Filter tabs ─────────────────────────────────────────────────────────

  it('renders 6 filter tabs', () => {
    renderCenter({ open: true });
    // tablist contains 6 tabs: All + 5 categories
    const tablist = screen.getByRole('tablist');
    expect(within(tablist).getAllByRole('tab').length).toBe(6);
  });

  it('"All" tab is selected by default', () => {
    renderCenter({ open: true });
    const allTab = screen.getByRole('tab', { name: /^all$/i });
    expect(allTab).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking a tab marks it selected', async () => {
    const user = userEvent.setup();
    renderCenter({ open: true });

    const transTab = screen.getByRole('tab', { name: /transactions/i });
    await user.click(transTab);
    expect(transTab).toHaveAttribute('aria-selected', 'true');

    // Previous "All" tab should no longer be selected
    expect(
      screen.getByRole('tab', { name: /^all$/i })
    ).toHaveAttribute('aria-selected', 'false');
  });

  // ── Notification list ──────────────────────────────────────────────────

  it('shows empty state when there are no notifications', () => {
    renderCenter({ open: true });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
  });

  it('renders notifications as article elements', () => {
    renderCenter({ open: true, notifications: [makeNotif({ title: 'Hello' })] });
    expect(screen.getAllByRole('article').length).toBeGreaterThanOrEqual(1);
  });

  it('notification article has a descriptive aria-label', () => {
    renderCenter({
      open: true,
      notifications: [makeNotif({ title: 'Payment due' })],
    });
    expect(
      screen.getByRole('article', { name: /payment due/i })
    ).toBeInTheDocument();
  });

  it('unread notification shows the unread dot', () => {
    renderCenter({ open: true, notifications: [makeNotif()] });
    expect(document.querySelector('.nc-unread-dot')).not.toBeNull();
  });

  it('clicking a notification calls markAsRead', async () => {
    const user = userEvent.setup();
    renderCenter({ open: true, notifications: [makeNotif({ title: 'Click me' })] });

    const article = screen.getByRole('article', { name: /click me/i });
    // Unread dot visible before
    expect(within(article).queryByText('', { selector: '.nc-unread-dot' })).not.toBeNull();

    await user.click(article);

    // After click the notification is marked read → unread dot disappears
    expect(document.querySelector('.nc-unread-dot')).toBeNull();
  });

  it('notification action button fires the action callback', async () => {
    const user = userEvent.setup();
    const actionSpy = vi.fn();

    // Seed via context directly using a wrapper
    function Wrapper() {
      const { addToast, openPanel } = useNotifications();
      useEffect(() => {
        addToast({
          type: 'info',
          category: 'system',
          title: 'With action',
          message: 'Click action',
          saveToHistory: true,
          action: { label: 'View details', onClick: actionSpy },
        });
        openPanel();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <NotificationCenter />;
    }

    render(
      <NotificationProvider>
        <Wrapper />
      </NotificationProvider>
    );

    const actionBtn = screen.getByRole('button', {
      name: /view details.*with action/i,
    });
    await user.click(actionBtn);
    expect(actionSpy).toHaveBeenCalledOnce();
  });

  // ── Drag handle ────────────────────────────────────────────────────────

  it('the drag handle area is present in the DOM', () => {
    renderCenter({ open: true });
    expect(document.querySelector('.nc-drag-handle-area')).not.toBeNull();
  });

  it('the drag handle pill element is inside the handle area', () => {
    renderCenter({ open: true });
    const area = document.querySelector('.nc-drag-handle-area') as HTMLElement;
    expect(area.querySelector('.nc-drag-handle')).not.toBeNull();
  });

  // ── Tabular numerals ──────────────────────────────────────────────────

  it('badge applies tabular-nums class for aligned digits', () => {
    renderCenter({ open: true, notifications: [makeNotif()] });
    const badge = document.querySelector('.nc-badge');
    expect(badge).not.toBeNull();
    expect(badge).toHaveClass('tabular-nums');
  });

  it('notification timestamp applies tabular-nums class for aligned digits', () => {
    renderCenter({ open: true, notifications: [makeNotif({ title: 'With time' })] });
    const time = document.querySelector('.nc-item-time');
    expect(time).not.toBeNull();
    expect(time).toHaveClass('tabular-nums');
  });

});

// ─── Tests: NotificationBell ─────────────────────────────────────────────────

describe('NotificationBell', () => {
  function renderBell() {
    return render(
      <NotificationProvider>
        <Seeder />
        <NotificationBell />
      </NotificationProvider>
    );
  }

  it('renders a button with aria-haspopup="dialog"', () => {
    renderBell();
    expect(
      screen.getByRole('button', { name: /notifications/i })
    ).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('aria-expanded reflects the panel open state', () => {
    renderBell();
    const btn = screen.getByRole('button', { name: /notifications/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('badge is absent when unreadCount is 0', () => {
    renderBell();
    expect(document.querySelector('.notif-bell-badge')).toBeNull();
  });

  it('badge is shown when there are unread notifications', () => {
    render(
      <NotificationProvider>
        <Seeder notifications={[makeNotif()]} />
        <NotificationBell />
      </NotificationProvider>
    );
    expect(document.querySelector('.notif-bell-badge')).not.toBeNull();
  });

  it('badge text caps at "99+" for counts > 99', () => {
    // Seed 100 notifications
    const notifs = Array.from({ length: 100 }, (_, i) =>
      makeNotif({ title: `Notif ${i}` })
    );
    render(
      <NotificationProvider>
        <Seeder notifications={notifs} />
        <NotificationBell />
      </NotificationProvider>
    );
    expect(document.querySelector('.notif-bell-badge')?.textContent).toBe('99+');
  });

  it('clicking the bell opens the panel (aria-expanded becomes true)', async () => {
    const user = userEvent.setup();
    render(
      <NotificationProvider>
        <Seeder />
        <NotificationBell />
        <NotificationCenter />
      </NotificationProvider>
    );
    const btn = screen.getByRole('button', { name: /notifications/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-hidden', 'false');
  });

  it('aria-controls points to "notification-center"', () => {
    renderBell();
    expect(
      screen.getByRole('button', { name: /notifications/i })
    ).toHaveAttribute('aria-controls', 'notification-center');
  });
});

// ─── Tests: NotificationWidget ───────────────────────────────────────────────

describe('NotificationWidget', () => {
  function renderWidget() {
    return render(
      <NotificationProvider>
        <Seeder />
        <NotificationWidget />
      </NotificationProvider>
    );
  }

  it('renders both the bell button and the dialog', () => {
    renderWidget();
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    // Panel exists in DOM (hidden)
    expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument();
  });

  it('panel opens when bell is clicked', async () => {
    const user = userEvent.setup();
    renderWidget();
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-hidden', 'false');
  });

  it('panel closes when × button is clicked after opening', async () => {
    const user = userEvent.setup();
    renderWidget();
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    fireEvent.click(screen.getByRole('button', { name: /close notification center/i }));
    expect(screen.getByRole('dialog', { hidden: true }))
      .toHaveAttribute('aria-hidden', 'true');
  });
});
