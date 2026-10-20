/**
 * @fileoverview Tests for Issue #691 — visible focus-visible outlines on
 * every interactive element in CreditLines.
 *
 * jsdom cannot compute :focus-visible pseudo-class styles, so these tests
 * assert structural correctness (the CSS rules exist and target the right
 * selectors) rather than rendered outline colors. Actual rendering is
 * covered by the visual regression suite per the note in focus.test.tsx.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cleanup, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreditLines from '../CreditLines';

// Real wall-clock waits for the component's internal 600ms loading timer
// get flaky as the suite grows (system load, CPU contention). Fake timers
// make the wait deterministic instead of racing the real clock.
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function renderPage() {
  render(
    <BrowserRouter>
      <CreditLines />
    </BrowserRouter>,
  );
  // Flush the component's internal 600ms isLoading timer deterministically.
  await vi.advanceTimersByTimeAsync(700);
}

describe('focus.css — CreditLines (#691) coverage', () => {
  const css = readFileSync(resolve(__dirname, '../../styles/focus.css'), 'utf-8');

  it('defines a focus-visible rule for the primary header actions', () => {
    expect(css).toContain('.cl-primary-btn:focus-visible');
  });

  it('defines a focus-visible rule for the sort-direction toggle', () => {
    expect(css).toContain('.cl-sort-dir:focus-visible');
  });

  it('defines a focus-visible rule for the status/sort filter selects', () => {
    expect(css).toContain('.cl-filters select:focus-visible');
  });

  it('defines a focus-visible rule for the credit-line card container', () => {
    expect(css).toContain('.cl-card:focus-visible');
  });

  it('defines a focus-visible rule for the per-card compare checkbox', () => {
    expect(css).toContain('.cl-row-select input:focus-visible');
  });

  it('defines a focus-visible rule for the row-menu (⋯) trigger', () => {
    expect(css).toContain('.cl-card [aria-haspopup="true"]:focus-visible');
  });

  it('uses :focus-visible, never bare :focus, for these rules', () => {
    for (const selector of ['.cl-primary-btn', '.cl-sort-dir', '.cl-card']) {
      const bareFocus = new RegExp(`\\${selector}:focus(?!-visible)\\b`);
      expect(css).not.toMatch(bareFocus);
    }
  });
});

describe('CreditLines page — interactive elements are keyboard-reachable', () => {
  it('"Compare Selected" button is a real <button>, focusable by default', async () => {
    await renderPage();
    const btn = screen.getByRole('button', { name: /Compare Selected/i });
    expect(btn.tagName).toBe('BUTTON');
  });

  it('"+ Open New Line" link is focusable and has accessible text', async () => {
    await renderPage();
    const link = screen.getByRole('link', { name: /Open New Line/i });
    expect(link).toBeInTheDocument();
  });

  it('disabled "Full Compare" link is removed from tab order (tabIndex -1)', async () => {
    await renderPage();
    const link = screen.getByRole('link', {
      name: /Select exactly 2 credit lines/i,
    });
    expect(link).toHaveAttribute('tabindex', '-1');
  });

  it('each credit line card is keyboard-focusable (tabIndex 0)', async () => {
    await renderPage();
    const cards = document.querySelectorAll('.cl-card');
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach((card) => {
      expect(card).toHaveAttribute('tabindex', '0');
    });
  });

  it('each credit line card exposes a labeled compare checkbox', async () => {
    await renderPage();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(3);
    checkboxes.forEach((cb) => {
      expect(cb).toHaveAccessibleName(/Select .* for comparison/i);
    });
  });

  it('Status and Sort By selects are present and labeled', async () => {
    await renderPage();
    expect(screen.getByText('Status', { selector: '.cl-filter-group label' })).toBeInTheDocument();
    expect(screen.getByText('Sort By', { selector: '.cl-filter-group label' })).toBeInTheDocument();
  });

  it('each row-menu (⋯) trigger has aria-haspopup and an accessible name', async () => {
    await renderPage();
    const triggers = screen.getAllByRole('button', { name: /Menu for/i });
    expect(triggers.length).toBeGreaterThan(0);
    triggers.forEach((trigger) => {
      expect(trigger).toHaveAttribute('aria-haspopup', 'true');
    });
  });
});