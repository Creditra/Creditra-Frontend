/**
 * HighContrastToggle tests
 *
 * Cover:
 *  1. Renders a role="switch" button.
 *  2. aria-checked reflects the current contrast mode.
 *  3. Clicking the button calls toggleContrast.
 *  4. axe-core reports no accessibility violations in normal mode.
 *  5. axe-core reports no accessibility violations in high-contrast mode.
 *
 * Note on contrast ratio verification:
 *   jsdom does not compute CSS custom property values, so pixel-level contrast
 *   ratios cannot be verified here. The token values chosen in index.css are
 *   documented with their computed ratios and can be audited with a real
 *   browser run of axe-core (e.g. via Playwright + @axe-core/playwright).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { HighContrastToggle } from './HighContrastToggle';
import {
  ContrastProvider,
  type ContrastMode,
} from '../context/ContrastContext';

// ── Helper: ensure attribute is clean between tests ──────────────────────────

beforeEach(() => {
  document.documentElement.removeAttribute('data-contrast');
  window.localStorage.clear();
});

// ── Helper: render the toggle inside a real provider ─────────────────────────

function renderToggle(preloadedMode?: ContrastMode) {
  if (preloadedMode) {
    window.localStorage.setItem(
      'creditra-contrast',
      JSON.stringify(preloadedMode),
    );
  }
  return render(
    <ContrastProvider>
      <HighContrastToggle />
    </ContrastProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('HighContrastToggle', () => {
  it('renders a switch button', () => {
    renderToggle();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('aria-checked is false when mode is normal', () => {
    renderToggle('normal');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('aria-checked is true when mode is high', () => {
    renderToggle('high');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking the switch toggles the mode from normal to high', async () => {
    renderToggle('normal');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
  });

  it('passes axe audit in normal-contrast mode', async () => {
    const { container } = renderToggle('normal');
    const results = await axe.run(container);
    expect(results.violations).toHaveLength(0);
  });

  it('passes axe audit in high-contrast mode', async () => {
    const { container } = renderToggle('high');
    const results = await axe.run(container);
    expect(results.violations).toHaveLength(0);
  });

  it('renders compact variant without label group', () => {
    render(
      <ContrastProvider>
        <HighContrastToggle compact />
      </ContrastProvider>,
    );
    expect(
      screen.queryByText('High Contrast'),
    ).not.toBeInTheDocument();
    // The switch still exists
    expect(screen.getByRole('switch')).toBeInTheDocument();
    // compact variant has aria-label directly on button
    expect(screen.getByRole('switch')).toHaveAttribute(
      'aria-label',
      'Toggle high contrast mode',
    );
  });

  it('shows "Following system setting" when no user preference is stored', async () => {
    renderToggle();
    expect(
      screen.getByText(/Following system setting/i),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('switch'));
    expect(
      screen.queryByText(/Following system setting/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Persisted across sessions/i),
    ).toBeInTheDocument();
  });
});
