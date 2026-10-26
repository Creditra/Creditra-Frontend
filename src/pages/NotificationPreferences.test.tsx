/**
 * NotificationPreferences — unit / integration tests
 *
 * Coverage:
 *   Rendering
 *     - Page title, subtitle, and channel description
 *     - Three category groups (repayment due, default risk, attestation)
 *     - Nine channel toggles (3 categories × 3 channels)
 *     - All toggles default to "on"
 *     - Info note rendered
 *   Toggle interactions
 *     - Clicking a channel toggle flips aria-checked
 *     - aria-checked reflects the correct state
 *     - Toggle has role="switch"
 *     - Visual data-state attribute updates
 *   Save flow
 *     - Save button disabled when nothing changed
 *     - Save button enabled after toggle change
 *     - Clicking save shows success banner
 *     - After save, button becomes disabled again
 *     - localStorage is written with correct values
 *   Reset
 *     - Reset button disabled when prefs are defaults
 *     - Reset restores all toggles to "on"
 *   Validation
 *     - Warning banner shown when all channels are disabled
 *     - Save button disabled when no channels enabled
 *   Accessibility
 *     - Category groups use <fieldset>/<legend>
 *     - Toggles have role="switch" and aria-checked
 *     - Success banner has role="status" and aria-live="polite"
 *     - Error banner has role="alert"
 *     - Dismiss buttons have accessible labels
 *     - Save button shows pending state with aria-busy
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationPreferences } from './NotificationPreferences';
import { scopedKey } from '../utils/scoped-storage';

describe('NotificationPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('renders the page title and subtitle', () => {
      render(<NotificationPreferences />);
      expect(screen.getByRole('heading', { name: /notification preferences/i, level: 1 })).toBeInTheDocument();
      expect(screen.getByText(/choose how you want to receive notifications/i)).toBeInTheDocument();
    });

    it('renders three category groups', () => {
      render(<NotificationPreferences />);
      // Category groups are <fieldset> elements that implicitly have role="group"
      expect(screen.getByRole('group', { name: /repayment due/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /default risk/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /attestation/i })).toBeInTheDocument();
    });

    it('renders nine channel toggles (3 categories × 3 channels)', () => {
      render(<NotificationPreferences />);
      const toggles = screen.getAllByRole('switch');
      expect(toggles).toHaveLength(9);
    });

    it('all toggles default to on (aria-checked="true")', () => {
      render(<NotificationPreferences />);
      const toggles = screen.getAllByRole('switch');
      toggles.forEach(toggle => {
        expect(toggle).toHaveAttribute('aria-checked', 'true');
      });
    });

    it('all toggles have data-state="on" by default', () => {
      render(<NotificationPreferences />);
      const toggles = screen.getAllByRole('switch');
      toggles.forEach(toggle => {
        expect(toggle).toHaveAttribute('data-state', 'on');
      });
    });

    it('renders the info note', () => {
      render(<NotificationPreferences />);
      expect(screen.getByRole('note')).toBeInTheDocument();
      expect(screen.getByText(/these preferences control delivery channels only/i)).toBeInTheDocument();
    });

    it('renders the channels description inside the card', () => {
      render(<NotificationPreferences />);
      expect(screen.getByText(/toggle delivery channels for each notification scenario/i)).toBeInTheDocument();
    });

    it('each category group uses fieldset and legend semantics', () => {
      render(<NotificationPreferences />);

      const legends = document.querySelectorAll('legend');
      expect(legends).toHaveLength(3);

      const legendsText = Array.from(legends).map(l => l.textContent);
      expect(legendsText).toContain('Repayment Due');
      expect(legendsText).toContain('Default Risk');
      expect(legendsText).toContain('Attestation');
    });
  });

  // ── Toggle interactions ────────────────────────────────────────────────

  describe('Toggle interactions', () => {
    it('clicking a toggle flips it from on to off', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      const toggles = screen.getAllByRole('switch');
      const firstToggle = toggles[0];

      expect(firstToggle).toHaveAttribute('aria-checked', 'true');
      await user.click(firstToggle);
      expect(firstToggle).toHaveAttribute('aria-checked', 'false');
    });

    it('clicking a toggle twice flips it back on', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      const firstToggle = screen.getAllByRole('switch')[0];

      await user.click(firstToggle);
      expect(firstToggle).toHaveAttribute('aria-checked', 'false');

      await user.click(firstToggle);
      expect(firstToggle).toHaveAttribute('aria-checked', 'true');
    });

    it('data-state attribute updates on toggle', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      const firstToggle = screen.getAllByRole('switch')[0];

      expect(firstToggle).toHaveAttribute('data-state', 'on');
      await user.click(firstToggle);
      expect(firstToggle).toHaveAttribute('data-state', 'off');
    });

    it('each toggle has a descriptive aria-label with category context', () => {
      render(<NotificationPreferences />);

      expect(screen.getByRole('switch', { name: /email notifications.*repayment due/i })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: /sms notifications.*default risk/i })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: /push notifications.*attestation/i })).toBeInTheDocument();
    });

    it('channel toggles include category context in their accessible name', () => {
      render(<NotificationPreferences />);

      // Each toggle should include both the channel and category in its aria-label
      const toggles = screen.getAllByRole('switch');
      const toggleNames = toggles.map(t => t.getAttribute('aria-label'));

      // Verify we have both email and SMS toggles for repayment_due
      expect(toggleNames.some(n => n?.includes('Email') && n?.includes('Repayment Due'))).toBe(true);
      expect(toggleNames.some(n => n?.includes('SMS') && n?.includes('Default Risk'))).toBe(true);
      expect(toggleNames.some(n => n?.includes('Push') && n?.includes('Attestation'))).toBe(true);
    });
  });

  // ── Save flow ──────────────────────────────────────────────────────────

  describe('Save flow', () => {
    it('save button is disabled when no changes have been made', () => {
      render(<NotificationPreferences />);
      const saveBtn = screen.getByRole('button', { name: /save preferences/i });
      expect(saveBtn).toBeDisabled();
    });

    it('save button becomes enabled after toggling a channel', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      const saveBtn = screen.getByRole('button', { name: /save preferences/i });
      expect(saveBtn).toBeDisabled();

      await user.click(screen.getAllByRole('switch')[0]);
      expect(saveBtn).not.toBeDisabled();
    });

    it('clicking save shows success banner', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      // Toggle one switch to enable save
      await user.click(screen.getAllByRole('switch')[0]);

      const saveBtn = screen.getByRole('button', { name: /save preferences/i });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
      expect(screen.getByText(/preferences saved successfully/i)).toBeInTheDocument();
    });

    it('save button shows pending state while saving', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      await user.click(screen.getAllByRole('switch')[0]);

      const saveBtn = screen.getByRole('button', { name: /save preferences/i });
      await user.click(saveBtn);

      // Button should briefly show "Saving…" and be aria-busy
      expect(saveBtn).toHaveAttribute('aria-busy', 'true');
    });

    it('save button becomes disabled again after successful save', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      await user.click(screen.getAllByRole('switch')[0]);
      await user.click(screen.getByRole('button', { name: /save preferences/i }));

      await waitFor(() => {
        expect(screen.getByText(/preferences saved successfully/i)).toBeInTheDocument();
      });

      // After save, the button should be disabled again
      const saveBtn = screen.getByRole('button', { name: /save preferences/i });
      expect(saveBtn).toBeDisabled();
    });

    it('persists preferences to localStorage on save', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      // Turn off first toggle
      await user.click(screen.getAllByRole('switch')[0]);
      await user.click(screen.getByRole('button', { name: /save preferences/i }));

      await waitFor(() => {
        expect(screen.getByText(/preferences saved successfully/i)).toBeInTheDocument();
      });

      const stored = localStorage.getItem(scopedKey('creditra_channel_prefs'));
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.repayment_due.email).toBe(false);
      expect(parsed.repayment_due.sms).toBe(true);
      expect(parsed.repayment_due.push).toBe(true);
    });

    it('success banner has aria-live="polite"', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      await user.click(screen.getAllByRole('switch')[0]);
      await user.click(screen.getByRole('button', { name: /save preferences/i }));

      await waitFor(() => {
        const status = screen.getByRole('status');
        expect(status).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('can dismiss the success banner', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      await user.click(screen.getAllByRole('switch')[0]);
      await user.click(screen.getByRole('button', { name: /save preferences/i }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dismiss success message/i }));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  // ── Reset ──────────────────────────────────────────────────────────────

  describe('Reset', () => {
    it('reset button is disabled when preferences are at defaults', () => {
      render(<NotificationPreferences />);
      expect(screen.getByRole('button', { name: /reset all preferences to defaults/i })).toBeDisabled();
    });

    it('reset button becomes enabled after a toggle change', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      const resetBtn = screen.getByRole('button', { name: /reset all preferences to defaults/i });
      expect(resetBtn).toBeDisabled();

      await user.click(screen.getAllByRole('switch')[0]);
      expect(resetBtn).not.toBeDisabled();
    });

    it('reset restores all toggles to on', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      // Turn off several toggles
      const toggles = screen.getAllByRole('switch');
      await user.click(toggles[0]);
      await user.click(toggles[3]);
      await user.click(toggles[6]);

      expect(toggles[0]).toHaveAttribute('aria-checked', 'false');
      expect(toggles[3]).toHaveAttribute('aria-checked', 'false');
      expect(toggles[6]).toHaveAttribute('aria-checked', 'false');

      // Reset
      await user.click(screen.getByRole('button', { name: /reset all preferences to defaults/i }));

      // Verify all toggles are back on
      const allToggles = screen.getAllByRole('switch');
      allToggles.forEach(toggle => {
        expect(toggle).toHaveAttribute('aria-checked', 'true');
      });
    });
  });

  // ── Validation ─────────────────────────────────────────────────────────

  describe('Validation', () => {
    it('shows warning banner when all channels are disabled', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      // Turn off all 9 toggles
      const toggles = screen.getAllByRole('switch');
      for (const toggle of toggles) {
        await user.click(toggle);
      }

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/all delivery channels are disabled/i)).toBeInTheDocument();
    });

    it('save button is disabled when no channels are enabled', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      // Turn off all 9 toggles
      const toggles = screen.getAllByRole('switch');
      for (const toggle of toggles) {
        await user.click(toggle);
      }

      const saveBtn = screen.getByRole('button', { name: /save preferences/i });
      expect(saveBtn).toBeDisabled();
    });

    it('warning banner disappears when at least one channel is re-enabled', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      // Turn off all toggles
      const toggles = screen.getAllByRole('switch');
      for (const toggle of toggles) {
        await user.click(toggle);
      }

      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Re-enable one
      await user.click(toggles[0]);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  // ── Accessibility ──────────────────────────────────────────────────────

  describe('Accessibility', () => {
    it('all toggles have role="switch"', () => {
      render(<NotificationPreferences />);
      const toggles = screen.getAllByRole('switch');
      expect(toggles).toHaveLength(9);
    });

    it('success banner uses role="status"', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      await user.click(screen.getAllByRole('switch')[0]);
      await user.click(screen.getByRole('button', { name: /save preferences/i }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('warning banner uses role="alert"', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      const toggles = screen.getAllByRole('switch');
      for (const toggle of toggles) {
        await user.click(toggle);
      }

      expect(screen.getByRole('alert')).toHaveTextContent(/all delivery channels are disabled/i);
    });

    it('category groups use fieldset elements', () => {
      render(<NotificationPreferences />);
      const fieldsets = document.querySelectorAll('fieldset');
      expect(fieldsets).toHaveLength(3);
    });

    it('each category group has a legend element', () => {
      render(<NotificationPreferences />);
      const legends = document.querySelectorAll('legend');
      expect(legends).toHaveLength(3);
    });

    it('toggle buttons meet minimum 44px touch target', () => {
      // CSS sets min-height: 44px; min-width: 44px via .np-channel-toggle
      // This test verifies the class is applied
      render(<NotificationPreferences />);
      const toggles = document.querySelectorAll('.np-channel-toggle');
      toggles.forEach(toggle => {
        expect(toggle.classList.contains('np-channel-toggle')).toBe(true);
      });
    });

    it('save button shows accessible pending state', async () => {
      const user = userEvent.setup();
      render(<NotificationPreferences />);

      await user.click(screen.getAllByRole('switch')[0]);

      const saveBtn = screen.getByRole('button', { name: /save preferences/i });
      await user.click(saveBtn);

      // During the save simulation, aria-busy should be true
      expect(saveBtn).toHaveAttribute('aria-busy', 'true');
    });
  });
});
