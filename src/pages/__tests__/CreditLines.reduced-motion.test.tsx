/**
 * CreditLines reduced-motion tests (issue #574 / GrantFox FWC26)
 *
 * Covers:
 *  1. The page root exposes `credit-lines-page` class for CSS targeting.
 *  2. `data-reduced-motion="true"` is set on the root when the OS
 *     `prefers-reduced-motion: reduce` media query matches.
 *  3. `data-reduced-motion="false"` is set on the root when the OS media
 *     query does not match (the default after `src/test/setup.ts`).
 *  4. The data attribute updates when the OS media query fires a change
 *     event at runtime (response to live preference changes, not just
 *     initial mount state).
 *  5. The page still renders credit-line cards, filter controls, and
 *     utilization bars under reduced-motion — the fallback is structural,
 *     never a no-op when there are no lines to display.
 *  6. WCAG 2.4.11 invariant: the in-stylesheet reduced-motion blocks do
 *     NOT strip the focus outline (`outline: none` / `outline: 0`) that
 *     `.cl-card:focus-visible` relies on for keyboard users.
 *  7. CSS source assertions: the `@media (prefers-reduced-motion: reduce)`
 *     block inside `CreditLines.css` covers the named selectors that
 *     actually own an animation/transition (`.cl-card`, `.cl-card:hover`,
 *     `.cl-util-fill`, `.cl-filter-group select`, `.cl-sort-dir`,
 *     `.cl-primary-btn`, `.cl-action-btn`, `.cl-empty`).
 *  8. CSS source assertions: the `[data-motion="reduced"]` mirror covers
 *     the same selectors with `!important` so the in-app override beats
 *     future base-style additions.
 */

import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import CreditLines from '../CreditLines';
import { ReducedMotionProvider } from '../../context/ReducedMotionContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Stub window.matchMedia so (prefers-reduced-motion: reduce) returns the
 * given value.  Returns a teardown function.  Mirrors the helper used by
 * Dashboard.reduced-motion.test.tsx and RepayPage.reduced-motion.test.tsx.
 */
function stubMatchMedia(matches: boolean) {
  const original = window.matchMedia;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  return () => {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: original });
  };
}

/** Stub matchMedia so we can fire change events to test live updates. */
function stubMatchMediaWithListener(initialMatches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const original = window.matchMedia;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? initialMatches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_event: string, cb: (e: MediaQueryListEvent) => void) => {
        if (query === '(prefers-reduced-motion: reduce)') listeners.push(cb);
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  return {
    restore: () => {
      Object.defineProperty(window, 'matchMedia', { writable: true, value: original });
    },
    fireChange: (newMatches: boolean) => {
      listeners.forEach((cb) => cb({ matches: newMatches } as MediaQueryListEvent));
    },
  };
}

function renderPage() {
  vi.useFakeTimers();
  const result = render(
    <ReducedMotionProvider>
      <MemoryRouter>
        <CreditLines />
      </MemoryRouter>
    </ReducedMotionProvider>,
  );
  // Advance past the 600 ms isLoading skeleton so tests see real content
  act(() => { vi.advanceTimersByTime(700); });
  vi.useRealTimers();
  return result;
}

/**
 * Pull all top-level rule bodies that immediately follow one of the given
 * triggers out of a stylesheet.  Handles nested braces so an inner `{}`
 * inside a media block does not terminate early.
 */
function extractBlocks(css: string, trigger: RegExp): string[] {
  const flags = trigger.flags.includes('g') ? trigger.flags : trigger.flags + 'g';
  const re = new RegExp(trigger.source, flags);
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) {
    const start = re.lastIndex;
    let depth = 0;
    let i = start;
    while (i < css.length) {
      const ch = css[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          out.push(css.slice(start, i));
          re.lastIndex = i + 1;
          break;
        }
      }
      i += 1;
    }
  }
  return out;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CreditLines — reduced-motion data attribute', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1
  it('root has credit-lines-page class for CSS targeting', () => {
    const restore = stubMatchMedia(false);
    renderPage();
    expect(document.querySelector('.credit-lines-page')).toBeInTheDocument();
    restore();
  });

  // 2
  it('root has data-reduced-motion="true" when OS prefers-reduced-motion is active', () => {
    const restore = stubMatchMedia(true);
    renderPage();
    const root = document.querySelector('.credit-lines-page') as HTMLElement | null;
    expect(root).toBeInTheDocument();
    expect(root?.getAttribute('data-reduced-motion')).toBe('true');
    restore();
  });

  // 3
  it('root has data-reduced-motion="false" when OS prefers-reduced-motion is not active', () => {
    const restore = stubMatchMedia(false);
    renderPage();
    const root = document.querySelector('.credit-lines-page') as HTMLElement | null;
    expect(root).toBeInTheDocument();
    expect(root?.getAttribute('data-reduced-motion')).toBe('false');
    restore();
  });
});

describe('CreditLines — live preference change', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 4
  it('data-reduced-motion updates when OS media query fires a change event', () => {
    const { restore, fireChange } = stubMatchMediaWithListener(false);

    renderPage();
    const root = document.querySelector('.credit-lines-page') as HTMLElement | null;
    expect(root?.getAttribute('data-reduced-motion')).toBe('false');

    act(() => {
      fireChange(true);
    });

    expect(root?.getAttribute('data-reduced-motion')).toBe('true');

    restore();
  });
});

describe('CreditLines — structural invariants under reduced-motion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 5
  it('still renders credit-line cards, filters, and utilization bars', () => {
    const restore = stubMatchMedia(true);
    renderPage();

    // Page chrome
    expect(screen.getByText('Credit Lines')).toBeInTheDocument();

    // Filter controls survive the reduced-motion render path
    expect(screen.getByText('All Statuses')).toBeInTheDocument();

    // Credit-line cards from mock data survive.  The line name appears in
    // multiple places on the rendered page (the card header and the
    // repayment-schedule entries) so we use getAllByText rather than
    // getByText.
    expect(
      screen.getAllByText('Primary Business Line').length,
    ).toBeGreaterThan(0);

    // Utilization bars are still rendered — the @media suppression of the
    // width tween is purely visual, the DOM still carries the elements.
    expect(document.querySelectorAll('.cl-util-fill').length).toBeGreaterThan(0);

    restore();
  });
});

// ── CSS source assertions ────────────────────────────────────────────────────
//
// jsdom does not compute CSS from stylesheets, so we assert directly against
// the stylesheet source.  Mirrors the pattern used in
// Dashboard.reduced-motion.test.tsx and RepayPage.reduced-motion.test.tsx.
//
// Each @media regex uses `[\s\S]*?` (lazy) instead of `[^}]*\{[^}]*` so it
// can cross intermediate rule-bodies that contain `}` before reaching the
// selector we care about — naive greedy `[^}]*` gets stuck at the first
// `}` inside the @media block.

function loadCss(): string {
  const cssPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'CreditLines.css',
  );
  return readFileSync(cssPath, 'utf-8');
}

describe('CreditLines.css — prefers-reduced-motion rules', () => {
  const css = loadCss();

  // 7 — @media block exists
  it('contains @media (prefers-reduced-motion: reduce) block', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it('@media block disables animation and transition on .cl-card', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.cl-card\s*\{[^}]*animation:\s*none/,
    );
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.cl-card\s*\{[^}]*transition:\s*none/,
    );
  });

  it('@media block disables hover transform and box-shadow on .cl-card', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.cl-card:hover\s*\{[^}]*transform:\s*none/,
    );
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.cl-card:hover\s*\{[^}]*box-shadow:\s*none/,
    );
  });

  it('@media block disables transition on .cl-util-fill', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.cl-util-fill\s*\{[^}]*transition:\s*none/,
    );
  });

  it('@media block disables transitions on .cl-filter-group select', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.cl-filter-group\s+select\s*\{[^}]*transition:\s*none/,
    );
  });

  it('@media block disables transition on .cl-sort-dir', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.cl-sort-dir\s*\{[^}]*transition:\s*none/,
    );
  });

  it('@media block disables transitions on .cl-primary-btn and .cl-action-btn', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.cl-primary-btn\s*\{[^}]*transition:\s*none/,
    );
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.cl-action-btn\s*\{[^}]*transition:\s*none/,
    );
  });

  it('@media block disables the .cl-empty entrance animation', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.cl-empty\s*\{[^}]*animation:\s*none/,
    );
  });

  // 8 — [data-motion="reduced"] block mirrors the OS-level rule with !important
  it('contains [data-motion="reduced"] selector cover for .cl-card', () => {
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\]\s*\.cl-card\s*\{[^}]*animation:\s*none\s*!important/,
    );
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\]\s*\.cl-card\s*\{[^}]*transition:\s*none\s*!important/,
    );
  });

  it('[data-motion="reduced"] selector disables hover lift on .cl-card', () => {
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\]\s*\.cl-card:hover\s*\{[^}]*transform:\s*none\s*!important/,
    );
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\]\s*\.cl-card:hover\s*\{[^}]*box-shadow:\s*none\s*!important/,
    );
  });

  it('[data-motion="reduced"] selector disables transitions on .cl-util-fill', () => {
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\]\s*\.cl-util-fill\s*\{[^}]*transition:\s*none\s*!important/,
    );
  });

  it('[data-motion="reduced"] grouped selector covers filter / sort / CTA selectors', () => {
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\]\s*\.cl-filter-group\s+select,[^]*?transition:\s*none\s*!important/,
    );
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\]\s*\.cl-sort-dir,[^]*?transition:\s*none\s*!important/,
    );
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\]\s*\.cl-primary-btn,[^]*?transition:\s*none\s*!important/,
    );
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\]\s*\.cl-action-btn\s*\{[^}]*transition:\s*none\s*!important/,
    );
  });

  it('[data-motion="reduced"] selector disables the .cl-empty entrance animation', () => {
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\]\s*\.cl-empty\s*\{[^}]*animation:\s*none\s*!important/,
    );
  });

  // 6 — WCAG 2.4.11 invariant.  The reduced-motion blocks MUST NOT touch
  // `outline` on `.cl-card` because `.cl-card:focus-visible` is the canonical
  // keyboard focus ring.  Asserted against the stylesheet source so the
  // invariant survives jsdom's lack of style computation.
  it('reduced-motion blocks do not strip the .cl-card focus outline (WCAG 2.4.11)', () => {
    const reduceMotionBodies = extractBlocks(
      css,
      /@media\s*\(prefers-reduced-motion:\s*reduce\)/g,
    );
    expect(reduceMotionBodies.length).toBeGreaterThan(0);
    reduceMotionBodies.forEach((body) => {
      expect(body).not.toMatch(/outline\s*:\s*(?:none|0)/);
    });
    const inAppBodies = extractBlocks(css, /\[data-motion=["']reduced["']\]/g);
    expect(inAppBodies.length).toBeGreaterThan(0);
    inAppBodies.forEach((body) => {
      expect(body).not.toMatch(/outline\s*:\s*(?:none|0)/);
    });
  });
});
