/**
 * Notifications.test.tsx — Settings › Notification Preferences unit and integration tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { NotificationProvider } from '../../../context/NotificationContext';
import NotificationSettings from '../Notifications';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <NotificationProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </NotificationProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('NotificationSettings', () => {
  // ── Rendering ────────────────────────────────────────────────────────────

  it('renders the Notification Preferences page heading and subtitle', () => {
    renderWithProviders(<NotificationSettings />);

    expect(
      screen.getByRole('heading', { level: 1, name: /notification preferences/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/manage which in-app notification categories you receive/i)
    ).toBeInTheDocument();
  });

  it('renders Category Toggles section heading', () => {
    renderWithProviders(<NotificationSettings />);

    expect(
      screen.getByRole('heading', { level: 2, name: /category toggles/i })
    ).toBeInTheDocument();
  });

  it('renders 6 switch toggles (1 master + 5 category toggles)', () => {
    renderWithProviders(<NotificationSettings />);

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(6);
  });

  it('all category toggles default to on (aria-checked="true")', () => {
    renderWithProviders(<NotificationSettings />);

    const switches = screen.getAllByRole('switch');
    for (const toggle of switches) {
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    }
  });

  it('renders all 5 category names', () => {
    renderWithProviders(<NotificationSettings />);

    expect(screen.getAllByText('Transactions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Credit Lines').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Risk Score').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rate Changes').length).toBeGreaterThan(0);
    expect(screen.getAllByText('System Notifications').length).toBeGreaterThan(0);
  });

  // ── Master Toggle ────────────────────────────────────────────────────────

  it('master toggle disables all categories when all are enabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationSettings />);

    const masterToggle = screen.getByRole('switch', {
      name: /enable all notification categories/i,
    });

    // Currently all enabled
    expect(masterToggle).toHaveAttribute('aria-checked', 'true');

    // Click master toggle to disable all
    await user.click(masterToggle);

    const switches = screen.getAllByRole('switch');
    for (const toggle of switches) {
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('master toggle enables all categories after being disabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationSettings />);

    const masterToggle = screen.getByRole('switch', {
      name: /enable all notification categories/i,
    });

    await user.click(masterToggle); // Turn off all
    await user.click(masterToggle); // Turn on all

    const switches = screen.getAllByRole('switch');
    for (const toggle of switches) {
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    }
  });

  // ── Individual Toggles ───────────────────────────────────────────────────

  it('toggling an individual category switch updates its state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationSettings />);

    const txToggle = screen.getByRole('switch', {
      name: /transactions notifications/i,
    });

    expect(txToggle).toHaveAttribute('aria-checked', 'true');
    await user.click(txToggle);
    expect(txToggle).toHaveAttribute('aria-checked', 'false');
  });

  // ── Save & Dirty State ───────────────────────────────────────────────────

  it('save button is disabled when preferences are unchanged', () => {
    renderWithProviders(<NotificationSettings />);

    const saveBtn = screen.getByRole('button', { name: /save preferences/i });
    expect(saveBtn).toBeDisabled();
  });

  it('save button becomes enabled after a toggle change', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationSettings />);

    const txToggle = screen.getByRole('switch', {
      name: /transactions notifications/i,
    });
    await user.click(txToggle);

    const saveBtn = screen.getByRole('button', { name: /save preferences/i });
    expect(saveBtn).not.toBeDisabled();
  });

  it('saving updates context, localStorage, and shows success banner', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationSettings />);

    const txToggle = screen.getByRole('switch', {
      name: /transactions notifications/i,
    });
    await user.click(txToggle);

    const saveBtn = screen.getByRole('button', { name: /save preferences/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
    expect(screen.getByText(/notification preferences saved successfully/i)).toBeInTheDocument();

    const stored = window.localStorage.getItem('creditra_notification_prefs');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.transaction).toBe(false);
    expect(parsed.credit_line).toBe(true);
  });

  it('can dismiss the success banner', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationSettings />);

    const txToggle = screen.getByRole('switch', {
      name: /transactions notifications/i,
    });
    await user.click(txToggle);
    await user.click(screen.getByRole('button', { name: /save preferences/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /dismiss success message/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // ── Reset ────────────────────────────────────────────────────────────────

  it('reset button is disabled when preferences match defaults', () => {
    renderWithProviders(<NotificationSettings />);

    const resetBtn = screen.getByRole('button', {
      name: /reset all notification preferences to defaults/i,
    });
    expect(resetBtn).toBeDisabled();
  });

  it('reset button restores all toggles to enabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationSettings />);

    const masterToggle = screen.getByRole('switch', {
      name: /enable all notification categories/i,
    });
    await user.click(masterToggle);

    const resetBtn = screen.getByRole('button', {
      name: /reset all notification preferences to defaults/i,
    });
    expect(resetBtn).not.toBeDisabled();

    await user.click(resetBtn);

    const switches = screen.getAllByRole('switch');
    for (const toggle of switches) {
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    }
  });

  // ── Validation & Warning Banner ──────────────────────────────────────────

  it('shows warning banner when all categories are disabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationSettings />);

    const masterToggle = screen.getByRole('switch', {
      name: /enable all notification categories/i,
    });
    await user.click(masterToggle);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText(/all notification categories are disabled/i)
    ).toBeInTheDocument();
  });

  // ── Accessibility ────────────────────────────────────────────────────────

  it('main element has aria-labelledby pointing to heading', () => {
    const { container } = renderWithProviders(<NotificationSettings />);
    const main = container.querySelector('main');
    expect(main).toHaveAttribute('aria-labelledby', 'notifications-page-title');
  });

  it('uses fieldset and legend elements for category accessibility', () => {
    const { container } = renderWithProviders(<NotificationSettings />);
    const fieldsets = container.querySelectorAll('fieldset');
    expect(fieldsets).toHaveLength(5);
    const legends = container.querySelectorAll('legend');
    expect(legends).toHaveLength(5);
  });

  it('renders link to delivery channel preferences note', () => {
    renderWithProviders(<NotificationSettings />);

    const channelLink = screen.getByRole('link', {
      name: /notification channel preferences/i,
    });
    expect(channelLink).toBeInTheDocument();
    expect(channelLink).toHaveAttribute('href', '/notification-preferences');
  });
});
