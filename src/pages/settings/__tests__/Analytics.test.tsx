import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import AnalyticsSettings from '../Analytics';

beforeEach(() => {
  window.localStorage.clear();
});

describe('AnalyticsSettings', () => {
  // ── Rendering ────────────────────────────────────────────────────────────

  it('renders the Analytics page heading', () => {
    render(<AnalyticsSettings />);

    expect(
      screen.getByRole('heading', { level: 1, name: /^analytics$/i }),
    ).toBeInTheDocument();
  });

  it('renders the Analytics Controls section heading', () => {
    render(<AnalyticsSettings />);

    expect(
      screen.getByRole('heading', { name: /analytics controls/i }),
    ).toBeInTheDocument();
  });

  it('renders all four category toggles plus the master toggle', () => {
    render(<AnalyticsSettings />);

    // 4 categories + 1 master = 5 switches
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(5);
  });

  // ── Default state (opt-in: all OFF) ──────────────────────────────────────

  it('all category toggles default to off (opt-in)', () => {
    render(<AnalyticsSettings />);

    const switches = screen.getAllByRole('switch');
    // Master toggle (index 0) should also be off because no categories are on
    for (const toggle of switches) {
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    }
  });

  // ── Master toggle ────────────────────────────────────────────────────────

  it('master toggle enables all categories', async () => {
    const user = userEvent.setup();
    render(<AnalyticsSettings />);

    const masterToggle = screen.getByRole('switch', {
      name: /enable all analytics categories/i,
    });
    await user.click(masterToggle);

    const switches = screen.getAllByRole('switch');
    for (const toggle of switches) {
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    }
  });

  it('master toggle disables all categories when all are enabled', async () => {
    const user = userEvent.setup();
    render(<AnalyticsSettings />);

    const masterToggle = screen.getByRole('switch', {
      name: /enable all analytics categories/i,
    });

    // Enable all
    await user.click(masterToggle);
    // Then disable all
    await user.click(masterToggle);

    const switches = screen.getAllByRole('switch');
    for (const toggle of switches) {
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    }
  });

  // ── Individual toggle ────────────────────────────────────────────────────

  it('individual category toggle works independently', async () => {
    const user = userEvent.setup();
    render(<AnalyticsSettings />);

    const usageToggle = screen.getByRole('switch', {
      name: /usage analytics/i,
    });

    // Initially off
    expect(usageToggle).toHaveAttribute('aria-checked', 'false');

    // Toggle on
    await user.click(usageToggle);
    expect(usageToggle).toHaveAttribute('aria-checked', 'true');

    // Other toggles should remain off
    const perfToggle = screen.getByRole('switch', {
      name: /^performance analytics$/i,
    });
    expect(perfToggle).toHaveAttribute('aria-checked', 'false');
  });

  // ── Save / Dirty state ───────────────────────────────────────────────────

  it('save button is disabled when no changes have been made', () => {
    render(<AnalyticsSettings />);

    const saveButton = screen.getByRole('button', {
      name: /save preferences/i,
    });
    expect(saveButton).toBeDisabled();
  });

  it('save button is enabled after a toggle change', async () => {
    const user = userEvent.setup();
    render(<AnalyticsSettings />);

    const usageToggle = screen.getByRole('switch', {
      name: /usage analytics/i,
    });
    await user.click(usageToggle);

    const saveButton = screen.getByRole('button', {
      name: /save preferences/i,
    });
    expect(saveButton).not.toBeDisabled();
  });

  // ── Reset ────────────────────────────────────────────────────────────────

  it('reset button restores all toggles to defaults', async () => {
    const user = userEvent.setup();
    render(<AnalyticsSettings />);

    // Toggle usage on
    const usageToggle = screen.getByRole('switch', {
      name: /usage analytics/i,
    });
    await user.click(usageToggle);
    expect(usageToggle).toHaveAttribute('aria-checked', 'true');

    // Reset
    const resetButton = screen.getByRole('button', {
      name: /reset all analytics preferences to defaults/i,
    });
    await user.click(resetButton);

    expect(usageToggle).toHaveAttribute('aria-checked', 'false');
  });

  it('reset button is disabled when prefs already match defaults', () => {
    render(<AnalyticsSettings />);

    const resetButton = screen.getByRole('button', {
      name: /reset all analytics preferences to defaults/i,
    });
    expect(resetButton).toBeDisabled();
  });

  // ── Accessibility ────────────────────────────────────────────────────────

  it('main element has aria-labelledby pointing to heading', () => {
    const { container } = render(<AnalyticsSettings />);

    const main = container.querySelector('main');
    expect(main).toHaveAttribute('aria-labelledby', 'analytics-page-title');
  });

  it('each toggle has a descriptive aria-label', () => {
    render(<AnalyticsSettings />);

    expect(
      screen.getByRole('switch', { name: /enable all analytics categories/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: /usage analytics/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: /^performance analytics$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: /crash reports analytics/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: /feature flags analytics/i }),
    ).toBeInTheDocument();
  });

  it('aria-live polite region is present', () => {
    const { container } = render(<AnalyticsSettings />);

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
  });

  // ── localStorage persistence ─────────────────────────────────────────────

  it('saves preferences to localStorage on save', async () => {
    const user = userEvent.setup();
    render(<AnalyticsSettings />);

    // Toggle usage on
    const usageToggle = screen.getByRole('switch', {
      name: /usage analytics/i,
    });
    await user.click(usageToggle);

    // Click save
    const saveButton = screen.getByRole('button', {
      name: /save preferences/i,
    });
    await user.click(saveButton);

    // Wait for the simulated save delay
    await screen.findByText(/saved successfully/i);

    const stored = JSON.parse(
      window.localStorage.getItem('creditra_analytics_prefs') ?? '{}',
    );
    expect(stored.usage).toBe(true);
    expect(stored.performance).toBe(false);
    expect(stored.crash_reports).toBe(false);
    expect(stored.feature_flags).toBe(false);
  });

  // ── Privacy note ─────────────────────────────────────────────────────────

  it('renders the privacy info note', () => {
    render(<AnalyticsSettings />);

    expect(
      screen.getByText(/your privacy matters/i),
    ).toBeInTheDocument();
  });
});
