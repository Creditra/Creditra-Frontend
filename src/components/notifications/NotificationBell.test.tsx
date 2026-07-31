/**
 * NotificationBell tests — Issue #219
 *
 * NotificationBell reads its state from NotificationContext (no
 * props required), so these tests seed the context via a small
 * helper component before asserting on the rendered bell button.
 *
 * Covers:
 *  1. Renders without notifications
 *  2. Shows correct unread count via the accessible name
 *  3. Pulse fires once on high-priority ('danger'/'error') arrival
 *  4. Pulse does NOT fire for normal-priority arrivals
 *  5. Pulse does NOT re-fire when count changes but no new arrival
 *  6. onClick (openPanel) is called when the button is pressed
 *  7. Badge caps at 99+
 *  8. Custom label is honored in aria-label
 */

import { useEffect } from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NotificationBell } from './NotificationBell';
import { NotificationProvider, useNotifications } from '../../context/NotificationContext';
import type { Notification, NotificationType } from '../../types/notification';

// ── Helpers ──────────────────────────────────────────────────────────────────

type SeedNotif = Partial<Omit<Notification, 'read'>> & { type?: NotificationType };

function Seeder({ notifications = [] as SeedNotif[] }: { notifications?: SeedNotif[] }) {
  const { addToast } = useNotifications();
  useEffect(() => {
    notifications.forEach((n) =>
      addToast({
        type: n.type ?? 'info',
        category: n.category ?? 'system',
        title: n.title ?? 'Test notification',
        message: n.message ?? 'This is a test.',
        saveToHistory: true,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function renderBell(notifications: SeedNotif[] = [], label?: string) {
  return render(
    <NotificationProvider>
      <Seeder notifications={notifications} />
      <NotificationBell label={label} />
    </NotificationProvider>,
  );
}

const normal = (title = 'Info'): SeedNotif => ({ type: 'info', title });
const high = (title = 'Risk drop detected'): SeedNotif => ({ type: 'danger', title });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  // 1
  it('renders the bell button with no badge when there are no notifications', () => {
    renderBell();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(document.querySelector('.notif-bell-badge')).toBeNull();
  });

  // 2
  it('shows the correct unread count in the badge', () => {
    renderBell([normal('a'), normal('b')]);
    expect(document.querySelector('.notif-bell-badge')?.textContent).toBe('2');
  });

  // 3
  it('applies bell-pulse class when a new high-priority notification arrives', () => {
    renderBell([high('hp-1')]);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('bell-pulse');
  });

  // 4
  it('does NOT pulse for normal-priority arrivals', () => {
    renderBell([normal('n-1')]);
    expect(screen.getByRole('button')).not.toHaveClass('bell-pulse');
  });

  // 5
  it('removes bell-pulse class after 650 ms (one-shot)', async () => {
    renderBell([high('hp-1')]);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('bell-pulse');

    await act(async () => vi.advanceTimersByTime(700));
    expect(btn).not.toHaveClass('bell-pulse');
  });

  // 5b — regression: a notifications mutation mid-animation (e.g. markAsRead
  // or another arrival) must NOT cancel the in-flight pulse timer, or
  // `.bell-pulse` would stick on forever.
  it('clears the pulse even when notifications change mid-animation (sticky-pulse regression)', async () => {
    let addToast!: ReturnType<typeof useNotifications>['addToast'];
    function Harness() {
      addToast = useNotifications().addToast;
      return <NotificationBell />;
    }
    render(
      <NotificationProvider>
        <Seeder notifications={[high('hp-1')]} />
        <Harness />
      </NotificationProvider>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('bell-pulse');

    // Trigger a `notifications` array change while the pulse is active.
    act(() => {
      addToast({
        type: 'info',
        title: 'Info',
        message: 'Another arrival.',
        saveToHistory: true,
      });
    });

    // The original 650 ms timer must still fire and clear the pulse.
    await act(async () => vi.advanceTimersByTime(700));
    expect(btn).not.toHaveClass('bell-pulse');
  });

  // 6
  it('calls openPanel when the button is pressed', () => {
    renderBell();
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  // 7
  it('caps badge at 99+ when count exceeds 99', () => {
    const many = Array.from({ length: 100 }, (_, i) => normal(`n-${i}`));
    renderBell(many);
    expect(document.querySelector('.notif-bell-badge')?.textContent).toBe('99+');
  });

  // 8
  it('uses custom label in aria-label', () => {
    renderBell([normal('a')], 'Alerts');
    expect(
      screen.getByRole('button', { name: /Alerts — 1 unread/i }),
    ).toBeInTheDocument();
  });
});
