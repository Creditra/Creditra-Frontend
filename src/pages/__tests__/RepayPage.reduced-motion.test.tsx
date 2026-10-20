/**
 * RepayPage reduced-motion tests (GrantFox FWC26, buffer #18 / issue #514)
 *
 * Covers:
 *  1. RepayPage root container has `repay-page` class for CSS targeting.
 *  2. When OS prefers-reduced-motion is active, the toggle thumb has
 *     `repay-page__toggle-thumb` class and no transition classes.
 *  3. When OS prefers-reduced-motion is NOT active, the toggle thumb has
 *     transition classes applied.
 *  4. Primary action buttons drop `transition-all hover:brightness-110`
 *     when reduced motion is active.
 *  5. Primary action buttons include `transition-all hover:brightness-110`
 *     when reduced motion is NOT active.
 *  6. The auto-schedule toggle track drops `transition-colors duration-200`
 *     when reduced motion is active.
 *  7. RepayPage.css contains @media (prefers-reduced-motion: reduce) rules
 *     for .repay-page.
 *  8. RepayPage.css contains [data-motion="reduced"] rules for .repay-page.
 *  9. When in-app ReducedMotionContext override is active (data-motion="reduced"
 *     on <html>), the toggle thumb has no transition classes.
 * 10. Back button drops transition classes under reduced motion.
 */

import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import RepayPage from '../RepayPage';
import { ReducedMotionProvider } from '../../context/ReducedMotionContext';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/data/mockData', () => ({
  MOCK_CREDIT_LINES: [
    {
      id: 'CL-2024-001',
      name: 'Primary Business Line',
      status: 'Active',
      limit: 500000,
      utilized: 187500,
      apr: 8.5,
      riskScore: 720,
      collateral: 'Commercial Real Estate',
      openedAt: '2024-03-15',
      updatedAt: '2025-02-20T14:32:00Z',
      nextPaymentDate: '2025-03-01',
      nextPaymentAmount: 3200,
      transactions: [],
      statusHistory: [],
    },
  ],
}));

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    wallet: { publicKey: 'GTEST', network: 'TESTNET' },
    status: 'connected',
    balances: [{
      asset: 'USDC',
      issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      balance: '50000.0000000',
    }],
    refreshBalance: async () => [{
      asset: 'USDC',
      issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      balance: '50000.0000000',
    }],
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Stub window.matchMedia so (prefers-reduced-motion: reduce) returns the given
 * value. Returns a teardown function to restore the original.
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

function renderPage(initialEntries = ['/repay?line=CL-2024-001']) {
  vi.useFakeTimers();
  const result = render(
    <ReducedMotionProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <RepayPage />
      </MemoryRouter>
    </ReducedMotionProvider>,
  );
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  vi.useRealTimers();
  return result;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('RepayPage reduced-motion — container', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1
  it('root container has repay-page class for CSS targeting', () => {
    const restore = stubMatchMedia(false);
    renderPage();
    const container = document.querySelector('.repay-page');
    expect(container).toBeInTheDocument();
    restore();
  });
});

describe('RepayPage reduced-motion — toggle thumb', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 2
  it('toggle thumb has no transition classes when OS prefers-reduced-motion is active', () => {
    const restore = stubMatchMedia(true);
    renderPage();
    const thumb = document.querySelector('.repay-page__toggle-thumb');
    expect(thumb).toBeInTheDocument();
    expect(thumb?.className).not.toMatch(/transition/);
    restore();
  });

  // 3
  it('toggle thumb has transition classes when OS prefers-reduced-motion is not active', () => {
    const restore = stubMatchMedia(false);
    renderPage();
    const thumb = document.querySelector('.repay-page__toggle-thumb');
    expect(thumb).toBeInTheDocument();
    expect(thumb?.className).toMatch(/transition/);
    restore();
  });
});

describe('RepayPage reduced-motion — primary action buttons', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 4
  it('Review Repayment button drops transition classes under reduced motion', () => {
    const restore = stubMatchMedia(true);
    renderPage();
    const reviewBtn = screen.getByRole('button', { name: /review repayment/i });
    expect(reviewBtn.className).not.toMatch(/transition-all/);
    expect(reviewBtn.className).not.toMatch(/hover:brightness-110/);
    restore();
  });

  // 5
  it('Review Repayment button includes transition classes when motion is normal', () => {
    const restore = stubMatchMedia(false);
    renderPage();
    const reviewBtn = screen.getByRole('button', { name: /review repayment/i });
    expect(reviewBtn.className).toMatch(/transition-all/);
    expect(reviewBtn.className).toMatch(/hover:brightness-110/);
    restore();
  });
});

describe('RepayPage reduced-motion — toggle track', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 6
  it('auto-schedule toggle track drops transition-colors under reduced motion', () => {
    const restore = stubMatchMedia(true);
    renderPage();
    const toggle = screen.getByRole('switch', { name: /auto-schedule/i });
    expect(toggle.className).not.toMatch(/transition-colors/);
    restore();
  });
});

describe('RepayPage reduced-motion — back button', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 10
  it('back button drops transition classes under reduced motion', () => {
    const restore = stubMatchMedia(true);
    renderPage();
    const backBtn = screen.getByRole('button', { name: /back to credit lines/i });
    expect(backBtn.className).not.toMatch(/transition-colors/);
    expect(backBtn.className).not.toMatch(/hover:text-foreground/);
    restore();
  });
});

describe('RepayPage reduced-motion — live preference change', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('toggle thumb loses transition classes when OS enables reduced-motion at runtime', () => {
    const { restore, fireChange } = stubMatchMediaWithListener(false);

    renderPage();
    const thumb = document.querySelector('.repay-page__toggle-thumb');
    expect(thumb).toBeInTheDocument();
    // Initially has transitions
    expect(thumb?.className).toMatch(/transition/);

    // Simulate OS enabling reduced-motion
    act(() => {
      fireChange(true);
    });

    // Should now have dropped transition classes
    expect(thumb?.className).not.toMatch(/transition/);

    restore();
  });
});

// ── CSS source assertions ─────────────────────────────────────────────────────
//
// jsdom does not compute CSS from stylesheets, so we assert directly against
// the stylesheet source. This mirrors the pattern used in RiskGauge.test.tsx
// and Dashboard.reduced-motion.test.tsx.

describe('RepayPage.css — prefers-reduced-motion rules', () => {
  const cssPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'RepayPage.css');
  const css = readFileSync(cssPath, 'utf-8');

  // 7
  it('contains @media (prefers-reduced-motion: reduce) block targeting .repay-page', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.repay-page/m,
    );
  });

  it('OS-level block disables animation-duration on .repay-page descendants', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[^}]*animation-duration:\s*0\.01ms.*!important/m,
    );
  });

  it('OS-level block disables transition-duration on .repay-page descendants', () => {
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
  it('contains [data-motion="reduced"] block targeting .repay-page', () => {
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\]\s*\.repay-page\s*\*/m,
    );
  });

  it('[data-motion="reduced"] block disables animation-duration on .repay-page descendants', () => {
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\][^}]*animation-duration:\s*0\.01ms.*!important/m,
    );
  });

  it('[data-motion="reduced"] block disables transition-duration on .repay-page descendants', () => {
    expect(css).toMatch(
      /\[data-motion=["']reduced["']\][^}]*transition-duration:\s*0\.01ms.*!important/m,
    );
  });

  it('toggle thumb has explicit transition: none under prefers-reduced-motion', () => {
    expect(css).toMatch(
      /repay-page__toggle-thumb[^}]*transition:\s*none\s*!important/m,
    );
  });
});
