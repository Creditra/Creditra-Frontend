/**
 * DrawCreditPage reduced-motion tests (GrantFox FWC26 / issue #693)
 *
 * Covers:
 *  1. Root <main> has the `dc-page` class so CSS rules can target it.
 *  2. When OS prefers-reduced-motion is active, the loading state renders a
 *     static icon (dc-spinner-static) instead of the animated spinner ring.
 *  3. When OS prefers-reduced-motion is NOT active, the animated spinner ring
 *     is rendered during loading.
 *  4. When the in-app ReducedMotionContext override is "reduced", the static
 *     icon is rendered regardless of the OS setting.
 *  5. The static icon is accessible: it is aria-hidden (described by the
 *     parent role="status" aria-label).
 *  6. The role="status" region and aria-live="polite" are present in both
 *     motion modes.
 *  7. DrawCreditPage.css contains @media (prefers-reduced-motion: reduce)
 *     rules scoped to .dc-page.
 *  8. DrawCreditPage.css contains [data-motion="reduced"] rules scoped to
 *     .dc-page.
 *  9. DrawCreditPage.css contains an explicit `animation: none` override for
 *     .dc-spinner-ring under reduced-motion.
 * 10. DrawCreditPage.css contains an explicit `animation: none` override for
 *     .dc-page__card under reduced-motion.
 * 11. Live OS preference change: toggling matchMedia fires a re-render that
 *     swaps spinner ↔ static icon correctly.
 */

import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import DrawCreditPage from './DrawCreditPage';
import { ReducedMotionProvider } from '../context/ReducedMotionContext';
import * as ReducedMotionContext from '../context/ReducedMotionContext';

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// ConfirmationStep has incomplete local pricing bindings in some upstream
// revisions. Mock it with a minimal stand-in so tests can reach the loading
// state without depending on that component's internals.

vi.mock('@/components/ConfirmationStep', () => ({
  ConfirmationStep: ({
    onConfirm,
    isLoading,
  }: {
    onConfirm: () => void;
    isLoading: boolean;
    onBack: () => void;
  }) => (
    <div>
      <h2>Review &amp; Confirm</h2>
      <input type="checkbox" aria-label="I agree to the terms" />
      <button
        type="button"
        onClick={onConfirm}
        disabled={isLoading}
        aria-label="Confirm Draw"
      >
        {isLoading ? 'Processing…' : 'Confirm Draw'}
      </button>
    </div>
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Stub window.matchMedia so `(prefers-reduced-motion: reduce)` returns the
 * given value.  Returns a teardown function to restore the original.
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

/**
 * Stub matchMedia so we can fire change events to test live preference changes.
 * Returns both the teardown and a `fireChange` helper.
 */
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

/** Navigate the wizard to the confirm step. */
async function navigateToConfirmStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: /select business line of credit/i }),
  );
  await user.type(screen.getByRole('spinbutton'), '500');
  await user.click(screen.getByRole('button', { name: /continue/i }));
}

/**
 * Click "Confirm Draw" so handleConfirm sets isLoading + step="status"
 * and the processing indicator renders.
 */
function triggerLoadingState() {
  const confirmBtn = screen.getByRole('button', { name: /confirm draw/i });
  fireEvent.click(confirmBtn);
}

/** Render the page inside the necessary providers. */
function renderPage() {
  const user = userEvent.setup({ delay: null });
  render(
    <ReducedMotionProvider>
      <MemoryRouter>
        <DrawCreditPage />
      </MemoryRouter>
    </ReducedMotionProvider>,
  );
  return { user };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DrawCreditPage reduced-motion — container', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute('data-motion');
    localStorage.removeItem('grantfox_draw_wizard_draft');
    localStorage.removeItem('creditra-motion-override');
  });

  // 1
  it('root <main> has dc-page class for CSS targeting', () => {
    const restore = stubMatchMedia(false);
    renderPage();
    expect(document.querySelector('main.dc-page')).toBeInTheDocument();
    restore();
  });
});

describe('DrawCreditPage reduced-motion — spinner fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute('data-motion');
    localStorage.removeItem('grantfox_draw_wizard_draft');
    localStorage.removeItem('creditra-motion-override');
    vi.useRealTimers();
  });

  // 2
  it('renders static icon when OS prefers-reduced-motion is active', async () => {
    const restore = stubMatchMedia(true);
    const { user } = renderPage();

    await navigateToConfirmStep(user);
    triggerLoadingState();

    expect(document.querySelector('.dc-spinner-static')).toBeInTheDocument();
    expect(document.querySelector('.dc-spinner-ring')).not.toBeInTheDocument();
    restore();
  });

  // 3
  it('renders animated spinner ring when OS prefers-reduced-motion is inactive', async () => {
    const restore = stubMatchMedia(false);
    const { user } = renderPage();

    await navigateToConfirmStep(user);
    triggerLoadingState();

    expect(document.querySelector('.dc-spinner-ring')).toBeInTheDocument();
    expect(document.querySelector('.dc-spinner-static')).not.toBeInTheDocument();
    restore();
  });

  // 4
  it('renders static icon when in-app ReducedMotionContext override is reduced', async () => {
    const restore = stubMatchMedia(false);
    const spy = vi.spyOn(ReducedMotionContext, 'useReducedMotion').mockReturnValue({
      motionOverride: 'reduced',
      toggleMotionOverride: () => {},
      setMotionOverride: () => {},
      isReducedMotionActive: true,
    });
    const { user } = renderPage();

    await navigateToConfirmStep(user);
    triggerLoadingState();

    expect(document.querySelector('.dc-spinner-static')).toBeInTheDocument();
    expect(document.querySelector('.dc-spinner-ring')).not.toBeInTheDocument();
    spy.mockRestore();
    restore();
  });

  // 5
  it('static icon is aria-hidden (status region carries the accessible name)', async () => {
    const restore = stubMatchMedia(true);
    const { user } = renderPage();

    await navigateToConfirmStep(user);
    triggerLoadingState();

    const icon = document.querySelector('.dc-spinner-static');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    restore();
  });
});

describe('DrawCreditPage reduced-motion — status region a11y', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute('data-motion');
    localStorage.removeItem('grantfox_draw_wizard_draft');
    localStorage.removeItem('creditra-motion-override');
  });

  // 6a
  it('role=status region is present under reduced motion', async () => {
    const restore = stubMatchMedia(true);
    const { user } = renderPage();

    await navigateToConfirmStep(user);
    triggerLoadingState();

    const region = screen.getByRole('status', {
      name: /processing your draw request/i,
    });
    expect(region).toHaveAttribute('aria-live', 'polite');
    restore();
  });

  // 6b
  it('role=status region is present when motion is normal', async () => {
    const restore = stubMatchMedia(false);
    const { user } = renderPage();

    await navigateToConfirmStep(user);
    triggerLoadingState();

    const region = screen.getByRole('status', {
      name: /processing your draw request/i,
    });
    expect(region).toHaveAttribute('aria-live', 'polite');
    restore();
  });
});

describe('DrawCreditPage reduced-motion — live OS preference change', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute('data-motion');
    localStorage.removeItem('grantfox_draw_wizard_draft');
    localStorage.removeItem('creditra-motion-override');
  });

  // 11
  it('swaps spinner ↔ static icon when the OS media query fires a change event', async () => {
    const { restore, fireChange } = stubMatchMediaWithListener(false);
    const { user } = renderPage();

    await navigateToConfirmStep(user);
    triggerLoadingState();

    expect(document.querySelector('.dc-spinner-ring')).toBeInTheDocument();
    expect(document.querySelector('.dc-spinner-static')).not.toBeInTheDocument();

    act(() => {
      fireChange(true);
    });

    expect(document.querySelector('.dc-spinner-static')).toBeInTheDocument();
    expect(document.querySelector('.dc-spinner-ring')).not.toBeInTheDocument();

    restore();
  });
});

// ── CSS source assertions ─────────────────────────────────────────────────────
//
// jsdom does not compute CSS from stylesheets, so we assert directly against
// the stylesheet source. This mirrors the pattern used in RiskGauge.test.tsx,
// Dashboard.reduced-motion.test.tsx, and RepayPage.reduced-motion.test.tsx.

describe('DrawCreditPage.css — prefers-reduced-motion rules', () => {
  const cssPath = join(
    dirname(fileURLToPath(import.meta.url)),
    'DrawCreditPage.css',
  );
  const css = readFileSync(cssPath, 'utf-8');

  // 7
  it('contains @media (prefers-reduced-motion: reduce) block targeting .dc-page', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.dc-page/m,
    );
  });

  it('OS-level block disables animation-duration on .dc-page descendants', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[^}]*animation-duration:\s*0\.01ms.*!important/m,
    );
  });

  it('OS-level block disables transition-duration on .dc-page descendants', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[^}]*transition-duration:\s*0\.01ms.*!important/m,
    );
  });

  it('OS-level block sets scroll-behavior to auto', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[^}]*scroll-behavior:\s*auto.*!important/m,
    );
  });

  // 8
  it('contains [data-motion="reduced"] block targeting .dc-page', () => {
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\]\s*\.dc-page\s*\*/m,
    );
  });

  it('[data-motion="reduced"] block disables animation-duration on .dc-page descendants', () => {
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\][^}]*animation-duration:\s*0\.01ms.*!important/m,
    );
  });

  it('[data-motion="reduced"] block disables transition-duration on .dc-page descendants', () => {
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\][^}]*transition-duration:\s*0\.01ms.*!important/m,
    );
  });

  // 9
  it('has explicit animation: none for .dc-spinner-ring under prefers-reduced-motion: reduce', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[^}]*\.dc-page\s*\.dc-spinner-ring[^}]*animation:\s*none/m,
    );
  });

  it('has explicit animation: none for .dc-spinner-ring under [data-motion="reduced"]', () => {
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\]\s*\.dc-page\s*\.dc-spinner-ring[^}]*animation:\s*none/m,
    );
  });

  // 10
  it('has explicit animation: none for .dc-page__card under prefers-reduced-motion: reduce', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[^}]*\.dc-page\s*\.dc-page__card[^}]*animation:\s*none/m,
    );
  });

  it('has explicit animation: none for .dc-page__card under [data-motion="reduced"]', () => {
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\]\s*\.dc-page\s*\.dc-page__card[^}]*animation:\s*none/m,
    );
  });
});
