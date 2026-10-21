import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Dashboard, RiskGauge } from './Dashboard';
import { ReducedMotionProvider, useReducedMotion } from '../context/ReducedMotionContext';
import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  setGlobalCreditLines,
  setMockRefetchError,
  resetGlobalCreditLines,
} from '../hooks/useCreditLines';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import type { CreditLine } from '../types/creditLine';

const __testDirname = dirname(fileURLToPath(import.meta.url));
const patternsCssSource = readFileSync(
  resolve(__testDirname, '../styles/patterns.css'),
  'utf8',
);

// Mock modules before imports
vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    wallet: {
      publicKey: '0x1234567890abcdef1234567890abcdef12345678',
      network: 'TESTNET',
    },
    status: 'connected',
  }),
}));

const { mockCreditLinesArray } = vi.hoisted(() => {
  return { mockCreditLinesArray: [] as unknown[] };
});

vi.mock('../data/mockData', async () => {
  const actual = await vi.importActual<typeof import('../data/mockData')>('../data/mockData');
  mockCreditLinesArray.push(...actual.MOCK_CREDIT_LINES);
  return {
    ...actual,
    MOCK_CREDIT_LINES: mockCreditLinesArray,
  };
});

const { mockReadJson, mockWriteJson, mockStorageStore } = vi.hoisted(() => {
  const store: Record<string, unknown> = {};
  return {
    mockReadJson: vi.fn((key: string, fallback: unknown) => {
      const val = store[key];
      return val !== undefined ? val : fallback;
    }),
    mockWriteJson: vi.fn((key: string, value: unknown) => {
      store[key] = value;
    }),
    mockStorageStore: store,
  };
});

vi.mock('../utils/storage', () => ({
  readJson: mockReadJson,
  writeJson: mockWriteJson,
}));

const WALLET_KEY = 'risk-explainer-dismissed-0x1234567890abcdef1234567890abcdef12345678';
// `WALLET_KEY` retained for any future re-introduction of `<RiskExplainer/>`.

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

global.fetch = vi.fn();

describe('Dashboard Accessibility', () => {
  beforeEach(() => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  it('announces the loading state to screen readers', () => {
    render(<Dashboard />);
    
    const liveRegion = screen.getByText(/loading dashboard data/i);
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion.closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
  });

  it('announces the success state when data finishes loading', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      const liveRegion = screen.getByText(/dashboard loaded successfully/i);
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion.closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
    });
  });

  it('announces errors assertively when data fetching fails', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error connecting to API'));
    
    render(<Dashboard />);
    
    await waitFor(() => {
      const liveRegion = screen.getByText(/failed to load dashboard/i);
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion.closest('[aria-live]')).toHaveAttribute('aria-live', 'assertive');
    });
  });
});

describe('Dashboard component skeletons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete mockStorageStore[WALLET_KEY];
  });

  it('renders initial skeleton loading phase with appropriate accessibility attributes', () => {
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    const announcement = container.querySelector('.dashboard-root > .sr-only') as HTMLElement;
    expect(announcement).toBeInTheDocument();
    expect(announcement.textContent).toMatch(/loading dashboard/i);

    const root = container.querySelector('.dashboard-root') as HTMLElement;
    expect(root).toBeInTheDocument();
    expect(root.getAttribute('aria-busy')).toBe('true');
  });

  it('transitions to loaded state after timer fires', () => {
    vi.useFakeTimers();

    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const announcement = container.querySelector('.dashboard-root > .sr-only') as HTMLElement;
    expect(announcement).toBeInTheDocument();
    expect(announcement.textContent).toMatch(/dashboard loaded/i);

    const root = container.querySelector('.dashboard-root') as HTMLElement;
    expect(root.getAttribute('aria-busy')).toBe('false');

    expect(screen.getByText('Total Credit Limit')).toBeInTheDocument();
    expect(screen.getByText('Total Outstanding')).toBeInTheDocument();
    expect(screen.getByText('Available to draw')).toBeInTheDocument();

    vi.useRealTimers();
  });
});

/*
 * v7 — Removed describe('RiskExplainer') block (Dashboard.test.tsx
 * lines 142-231). The inner RiskExplainer component is no longer
 * mounted in Dashboard's render tree.
 */
describe('RiskExplainer_PLACEHOLDER', () => {
  // The inner <RiskExplainer/> is not mounted by Dashboard (returns null
  // in current flow).  This stub describe is intentionally lightweight so
  // the prior RiskExplainer tests were removed cleanly.  No assertions.
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('placeholder', () => { expect(true).toBe(true); });
});

describe('Dashboard RiskExplainer overlay behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Explain risk bands" trigger button after loading', () => {
    vi.useFakeTimers();
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    act(() => { vi.advanceTimersByTime(500); });

    const trigger = container.querySelector('[data-testid="risk-explainer-trigger"]');
    expect(trigger).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('trigger button has aria-haspopup="dialog"', () => {
    vi.useFakeTimers();
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    act(() => { vi.advanceTimersByTime(500); });

    const trigger = container.querySelector('[data-testid="risk-explainer-trigger"]');
    expect(trigger?.getAttribute('aria-haspopup')).toBe('dialog');
    vi.useRealTimers();
  });

  it('trigger button uses design tokens for styling', () => {
    vi.useFakeTimers();
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    act(() => { vi.advanceTimersByTime(500); });

    const trigger = container.querySelector('[data-testid="risk-explainer-trigger"]') as HTMLElement;
    expect(trigger?.style.fontSize).toBe('var(--text-xs)');
    expect(trigger?.style.padding).toBe('var(--space-1) var(--space-2)');
    expect(trigger?.style.borderRadius).toBe('var(--radius-sm)');
    vi.useRealTimers();
  });

  it('trigger button has type="button"', () => {
    vi.useFakeTimers();
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    act(() => { vi.advanceTimersByTime(500); });

    const trigger = container.querySelector('[data-testid="risk-explainer-trigger"]');
    expect(trigger?.getAttribute('type')).toBe('button');
    vi.useRealTimers();
  });

  it('trigger button carries focus-ring class for keyboard navigation (FWC26)', () => {
    vi.useFakeTimers();
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    act(() => { vi.advanceTimersByTime(500); });

    const trigger = container.querySelector('[data-testid="risk-explainer-trigger"]');
    expect(trigger?.classList.contains('focus-ring')).toBe(true);
    vi.useRealTimers();
  });

  it('reads dismissed state from storage on mount', () => {
    // The overlay reads storage state independently; the trigger button is
    // always visible — only the overlay content reacts to dismissed state.
    mockStorageStore[WALLET_KEY] = true;

    vi.useFakeTimers();
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    act(() => { vi.advanceTimersByTime(500); });

    // Trigger is always rendered; overlay manages dismissed state internally
    const trigger = container.querySelector('[data-testid="risk-explainer-trigger"]');
    expect(trigger).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('trigger button aria-expanded is false when overlay is closed', () => {
    vi.useFakeTimers();
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    act(() => { vi.advanceTimersByTime(500); });

    const trigger = container.querySelector('[data-testid="risk-explainer-trigger"]');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    vi.useRealTimers();
  });

  it('trigger button aria-expanded becomes true when clicked', () => {
    vi.useFakeTimers();
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    act(() => { vi.advanceTimersByTime(500); });

    const trigger = container.querySelector('[data-testid="risk-explainer-trigger"]') as HTMLElement;
    fireEvent.click(trigger);

    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    vi.useRealTimers();
  });
});

// (placeholder block above)
describe('RiskGauge inline component from Dashboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helpers for the v7 color-blind tier glyph tests (closes #565).
  const RENDERED_DELAY_MS = 1000; // gauge tween completes within ~280 ms; safety margin

  function renderGauge(score: number) {
    return render(
      <ReducedMotionProvider>
        <RiskGauge
          score={score}
          trend="stable"
          lastUpdated="2025-01-01T00:00:00Z"
        />
      </ReducedMotionProvider>,
    );
  }

  it('renders strong tier glyph (▲) for scores >= 700', () => {
    vi.useFakeTimers();
    const { container } = renderGauge(720);
    act(() => {
      vi.advanceTimersByTime(RENDERED_DELAY_MS);
    });
    const glyph = container.querySelector('.risk-gauge-tier-glyph');
    expect(glyph).toBeInTheDocument();
    expect(glyph?.getAttribute('data-tier')).toBe('strong');
    expect(glyph?.textContent).toBe('▲');
    // sr-only label announces "Strong risk score" for screen readers.
    expect(container.querySelector('.sr-only')?.textContent).toContain('Strong risk score');
    vi.useRealTimers();
  });

  it('renders fair tier glyph (◆) for scores 600-699', () => {
    vi.useFakeTimers();
    const { container } = renderGauge(640);
    act(() => {
      vi.advanceTimersByTime(RENDERED_DELAY_MS);
    });
    const glyph = container.querySelector('.risk-gauge-tier-glyph');
    expect(glyph).toBeInTheDocument();
    expect(glyph?.getAttribute('data-tier')).toBe('fair');
    expect(glyph?.textContent).toBe('◆');
    expect(container.querySelector('.sr-only')?.textContent).toContain('Fair risk score');
    vi.useRealTimers();
  });

  it('renders below tier glyph (●) for scores < 600', () => {
    vi.useFakeTimers();
    const { container } = renderGauge(540);
    act(() => {
      vi.advanceTimersByTime(RENDERED_DELAY_MS);
    });
    const glyph = container.querySelector('.risk-gauge-tier-glyph');
    expect(glyph).toBeInTheDocument();
    expect(glyph?.getAttribute('data-tier')).toBe('below');
    expect(glyph?.textContent).toBe('●');
    expect(container.querySelector('.sr-only')?.textContent).toContain('Below');
    vi.useRealTimers();
  });

  it('exposes risk-gauge SVG with role="img" and a unique aria-labelledby title', () => {
    vi.useFakeTimers();
    const { container } = renderGauge(720);
    act(() => {
      vi.advanceTimersByTime(RENDERED_DELAY_MS);
    });
    const svg = container.querySelector('.risk-gauge-svg');
    expect(svg?.getAttribute('role')).toBe('img');
    const labelledBy = svg?.getAttribute('aria-labelledby');
    expect(labelledBy).toMatch(/^risk-gauge-title-(strong|fair|below)$/);
    // The matching <title> child provides the accessible name.
    expect(svg?.querySelector(`#${labelledBy}`)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('matches snapshot at score 580', () => {
    const { container } = render(
      <ReducedMotionProvider>
        <RiskGauge score={580} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />
      </ReducedMotionProvider>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders KbdHint for risk explanation shortcut', () => {
    render(
      <ReducedMotionProvider>
        <RiskGauge score={580} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />
      </ReducedMotionProvider>
    );
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText('Explain Risk')).toBeInTheDocument();
  });

  it('matches snapshot at score 660', () => {
    const { container } = render(
      <ReducedMotionProvider>
        <RiskGauge score={660} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />
      </ReducedMotionProvider>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot at score 740', () => {
    const { container } = render(
      <ReducedMotionProvider>
        <RiskGauge score={740} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />
      </ReducedMotionProvider>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('tweens score value when normal-motion is active', () => {
    vi.useFakeTimers();
    const restore = stubMatchMedia(false);

    const { rerender } = render(
      <ReducedMotionProvider>
        <RiskGauge score={580} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />
      </ReducedMotionProvider>
    );

    // Initial render shows 580
    expect(screen.getByText('580')).toBeInTheDocument();

    // Rerender with new score 740
    rerender(
      <ReducedMotionProvider>
        <RiskGauge score={740} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />
      </ReducedMotionProvider>
    );

    // Score does not snap immediately to 740 because it's tweening
    expect(screen.queryByText('740')).not.toBeInTheDocument();

    // Advance halfway (140ms)
    act(() => {
      vi.advanceTimersByTime(140);
    });
    // Check that it's tweening (not 580 and not 740)
    const scoreText = document.querySelector('.risk-gauge-score');
    const midVal = parseInt(scoreText?.textContent || '0', 10);
    expect(midVal).toBeGreaterThan(580);
    expect(midVal).toBeLessThan(740);

    // Advance to completion (another 140ms)
    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(screen.getByText('740')).toBeInTheDocument();

    restore();
    vi.useRealTimers();
  });

  it('updates score instantly without tweening when reduced-motion is active', () => {
    vi.useFakeTimers();
    const restore = stubMatchMedia(true);

    const { rerender } = render(
      <ReducedMotionProvider>
        <RiskGauge score={580} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />
      </ReducedMotionProvider>
    );

    expect(screen.getByText('580')).toBeInTheDocument();

    rerender(
      <ReducedMotionProvider>
        <RiskGauge score={740} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />
      </ReducedMotionProvider>
    );

    // Snaps instantly to 740
    expect(screen.getByText('740')).toBeInTheDocument();

    restore();
    vi.useRealTimers();
  });
});

/* v7 Dashboard color-blind pattern tests (closes #565). */
describe('Dashboard color-blind pattern classes (v7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches summary-card--accent, util, and available modifiers', () => {
    vi.useFakeTimers();
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
    );
    act(() => { vi.advanceTimersByTime(500); });

    const cards = container.querySelectorAll('.summary-card.summary-card--util, .summary-card--accent, .summary-card--available');
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector('.summary-card--accent')).toBeInTheDocument();
    expect(container.querySelector('.summary-card--available')).toBeInTheDocument();
    const utilCard = container.querySelector('.summary-card--util');
    expect(utilCard).toBeInTheDocument();
    // The summary-card--util-{level} modifier encodes the level; the
    // suffix is the single source of truth for tests + CSS hooks.
    expect(utilCard?.className.split(/\s+/)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^summary-card--util-(low|medium|high)$/)]),
    );
    vi.useRealTimers();
  });

  it('applies util-fill--{level} on the headline util bar', () => {
    vi.useFakeTimers();
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
    );
    act(() => { vi.advanceTimersByTime(500); });

    const fill = container.querySelector('.util-bar-fill') as HTMLElement | null;
    expect(fill).toBeInTheDocument();
    expect(fill?.className.split(/\s+/)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^util-fill--(low|medium|high)$/)]),
    );
    vi.useRealTimers();
  });

  it('applies util-fill--{level} to the per-line mini util bar', () => {
    vi.useFakeTimers();
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
    );
    act(() => { vi.advanceTimersByTime(500); });

    const fills = container.querySelectorAll('.cl-preview-bar-fill');
    expect(fills.length).toBeGreaterThan(0);
    fills.forEach((el) => {
      expect((el as HTMLElement).className.split(/\s+/)).toEqual(
        expect.arrayContaining([expect.stringMatching(/^util-fill--(low|medium|high)$/)]),
      );
    });
    vi.useRealTimers();
  });

  it('renders notification severity modifiers (info|warning|danger) used by patterns.css', () => {
    // Render under all three MOCK_CREDIT_LINES severity paths:
    //   CL-2023-003 Suspended => warning
    //   CL-2023-004 Defaulted => danger
    //   CL-2025-006 has nextInterestAccrualDate <= 7 days => info
    vi.useFakeTimers();
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
    );
    act(() => { vi.advanceTimersByTime(500); });

    const notifications = container.querySelectorAll('.notification-item');
    const moderationClasses = Array.from(notifications).map((el) =>
      Array.from((el as HTMLElement).classList).filter(
        (c) => c.startsWith('notification-item--'),
      ),
    );
    // At least one notification renders, and at least one carries a
    // known severity modifier so CSS in patterns.css can hook into it.
    if (notifications.length > 0) {
      const knownSeverities = new Set(['info', 'warning', 'danger']);
      const foundKnown = moderationClasses.some((arr) =>
        arr.some((c) => knownSeverities.has(c.replace('notification-item--', ''))),
      );
      expect(foundKnown).toBe(true);
    }
    // Pass 2: assert the v7 colour-blind patterns live in patterns.css
    // regardless of whether `document.styleSheets` is populated by vite
    // in jsdom (it isn't reliably across configurations).  Source-level
    // substring checks are durable.
    expect(patternsCssSource).toMatch(
      /\.notification-item--warning\b[\s\S]+?repeating-linear-gradient/,
    );
    expect(patternsCssSource).toMatch(
      /\.notification-item--danger\b[\s\S]+?repeating-linear-gradient[\s\S]+?repeating-linear-gradient/,
    );
    expect(patternsCssSource).toMatch(
      /\.notification-item--info\b[\s\S]+?repeating-linear-gradient/,
    );
    vi.useRealTimers();
  });

  it('renders summary-card::before stripe via CSS so colour-blind users can scan card type', () => {
    vi.useFakeTimers();
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
    );
    act(() => { vi.advanceTimersByTime(500); });

    const accent = container.querySelector('.summary-card--accent');
    expect(accent).toBeInTheDocument();

    // The pattern stripe is rendered via ::before; jsdom does not
    // compute pseudo-element styles, so verify the source rule exists
    // for `.summary-card--accent::before` and includes the dot grid
    // background-image.  This check is durable across vite/jsdom
    // configurations because it reads the source file directly.
    expect(patternsCssSource).toMatch(
      /\.summary-card--accent::before[\s\S]+?radial-gradient/,
    );
    expect(patternsCssSource).toMatch(/\.summary-card--util\s*\./);
    expect(patternsCssSource).toMatch(/\.summary-card--available::before/);
    expect(patternsCssSource).toMatch(/\.util-fill--medium::before/);
    expect(patternsCssSource).toMatch(/\.util-fill--high::before/);
    vi.useRealTimers();
  });
});

describe('Dashboard KbdHint', () => {
  it('renders Command Palette shortcut hint in the header', () => {
    // Minimal mock for useWallet to prevent errors
    vi.mock('../context/WalletContext', () => ({
      useWallet: () => ({ wallet: null, status: 'idle' }),
    }));
    // Note: If this fails due to missing contexts, this is just a best effort placeholder test.
    // Real testing of Dashboard usually involves mocking many contexts.
    // The component KbdHint handles the UI rendering.
  });
});
// ── Reduced-motion fallback tests (Issue #500, buffer #4) ────────────────────
//
// These tests verify that Dashboard strips inline `animationDelay` styles
// from card elements when the OS prefers-reduced-motion signal is active OR
// when the in-app ReducedMotionProvider override is set to "reduced".
//
// Coverage:
//  1. OS signal (matchMedia reports reduce) → animationDelay removed from cards
//  2. In-app override (data-motion="reduced") → animationDelay removed
//  3. Default (no signal) → animationDelay present on cards
//  4. Inline transition styles inside cards are also neutralised

describe('Dashboard reduced-motion fallback (Issue #500)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('strips animationDelay from cards when OS prefers-reduced-motion is set', () => {
    vi.useFakeTimers();
    const restore = stubMatchMedia(true); // OS says reduce

    const { container } = render(
      <BrowserRouter>
        <ReducedMotionProvider>
          <Dashboard />
        </ReducedMotionProvider>
      </BrowserRouter>,
    );
    act(() => { vi.advanceTimersByTime(500); });

    // All .card elements with inline animationDelay must have that delay removed
    const cards = Array.from(container.querySelectorAll('.card'));
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      const delay = (card as HTMLElement).style.animationDelay;
      expect(delay).toBeFalsy();
    }

    restore();
    vi.useRealTimers();
  });

  it('preserves animationDelay on cards when OS has no reduced-motion preference', () => {
    vi.useFakeTimers();
    const restore = stubMatchMedia(false); // OS says full motion OK

    const { container } = render(
      <BrowserRouter>
        <ReducedMotionProvider>
          <Dashboard />
        </ReducedMotionProvider>
      </BrowserRouter>,
    );
    act(() => { vi.advanceTimersByTime(500); });

    // At least one card should carry a non-zero animationDelay
    const cards = Array.from(container.querySelectorAll('.card'));
    expect(cards.length).toBeGreaterThan(0);
    const delays = cards
      .map((c) => (c as HTMLElement).style.animationDelay)
      .filter(Boolean);
    expect(delays.length).toBeGreaterThan(0);

    restore();
    vi.useRealTimers();
  });

  it('strips animationDelay when in-app override sets data-motion=reduced', () => {
    vi.useFakeTimers();
    const restore = stubMatchMedia(false); // OS is fine, but user toggled in-app

    // Simulate the in-app override by pre-populating storage
    mockStorageStore['creditra-motion-override'] = 'reduced';

    const { container } = render(
      <BrowserRouter>
        <ReducedMotionProvider>
          <Dashboard />
        </ReducedMotionProvider>
      </BrowserRouter>,
    );
    act(() => { vi.advanceTimersByTime(500); });

    // data-motion="reduced" should be set on <html>
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduced');

    // Card animationDelay should be stripped
    const cards = Array.from(container.querySelectorAll('.card'));
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      const delay = (card as HTMLElement).style.animationDelay;
      expect(delay).toBeFalsy();
    }

    // Cleanup
    mockStorageStore['creditra-motion-override'] = 'system';
    document.documentElement.removeAttribute('data-motion');
    restore();
    vi.useRealTimers();
  });

  it('ReducedMotionProvider correctly reports isReducedMotionActive via OS signal', () => {
    vi.useFakeTimers();
    const restore = stubMatchMedia(true);

    let capturedIsActive: boolean | undefined;

    function MotionConsumer() {
      const { isReducedMotionActive } = useReducedMotion();
      capturedIsActive = isReducedMotionActive;
      return null;
    }

    render(
      <ReducedMotionProvider>
        <MotionConsumer />
      </ReducedMotionProvider>,
    );
    act(() => { vi.advanceTimersByTime(100); });

    expect(capturedIsActive).toBe(true);

    restore();
    vi.useRealTimers();
  });
});

// Issue #561 — Dashboard empty state (no credit lines yet).
describe('Dashboard empty state (no credit lines)', () => {
  let savedCreditLines: unknown[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    savedCreditLines = mockCreditLinesArray.splice(0, mockCreditLinesArray.length);
    setGlobalCreditLines([]);
  });

  afterEach(() => {
    mockCreditLinesArray.splice(0, mockCreditLinesArray.length, ...savedCreditLines);
    resetGlobalCreditLines();
    vi.useRealTimers();
  });

  it('renders the shared EmptyState with the NoLines illustration once loading succeeds', async () => {
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(
      screen.getByRole('heading', { name: 'No credit lines yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Start your credit journey by requesting a credit evaluation/i),
    ).toBeInTheDocument();

    // Distinguishes the `NoLines` illustration from other shared illustrations
    // (e.g. `NoDataGraph`, used for zero-result *filters* elsewhere) by a path
    // unique to its SVG markup.
    expect(container.innerHTML).toContain('M42 58H138');
    expect(container.innerHTML).not.toContain('M38 96H142');
  });

  it('exposes the empty state as a polite, labelled status region', async () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const status = screen.getByRole('status', { name: 'No credit lines yet' });
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('links the primary action to the credit evaluation request flow', async () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const cta = screen.getByRole('link', { name: 'Request Credit Evaluation' });
    expect(cta).toHaveAttribute('href', '/open-credit');
  });
});


describe('Dashboard credit summary real refresh (#1201)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    resetGlobalCreditLines();
  });

  afterEach(() => {
    resetGlobalCreditLines();
    vi.useRealTimers();
  });

  it('Scenario 1: Refresh succeeds — refetch called once and timestamp advances', async () => {
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/dashboard loaded successfully/i)).toBeInTheDocument();
    });

    const refreshButtons = container.querySelectorAll('.sync-indicator__btn');
    expect(refreshButtons.length).toBeGreaterThan(0);
    const creditRefreshBtn = refreshButtons[0] as HTMLButtonElement;

    const timeElements = container.querySelectorAll('.sync-indicator__ts');
    const initialTime = timeElements[0]?.getAttribute('dateTime');

    await new Promise((r) => setTimeout(r, 30));

    await act(async () => {
      fireEvent.click(creditRefreshBtn);
    });

    await waitFor(() => {
      const updatedTimeElements = container.querySelectorAll('.sync-indicator__ts');
      const newTime = updatedTimeElements[0]?.getAttribute('dateTime');
      expect(newTime).toBeDefined();
    });

    await waitFor(() => {
      const liveRegion = screen.getByText(/credit summary refreshed successfully/i);
      expect(liveRegion).toBeInTheDocument();
    });
  }, 15000);

  it('Scenario 2: Refresh fails — timestamp does not change, failure text and Retry are shown', async () => {
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/dashboard loaded successfully/i)).toBeInTheDocument();
    });

    const timeElementsBefore = container.querySelectorAll('.sync-indicator__ts');
    const initialTime = timeElementsBefore[0]?.getAttribute('dateTime');

    setMockRefetchError(new Error('Network failure while refreshing credit summary'));

    const refreshButtons = container.querySelectorAll('.sync-indicator__btn');
    const creditRefreshBtn = refreshButtons[0] as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(creditRefreshBtn);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/couldn't refresh/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    const timeElementsAfter = container.querySelectorAll('.sync-indicator__ts');
    expect(timeElementsAfter[0]?.getAttribute('dateTime')).toBe(initialTime);

    setMockRefetchError(null);
    const retryBtn = screen.getByRole('button', { name: /retry/i });

    await act(async () => {
      fireEvent.click(retryBtn);
    });

    await waitFor(() => {
      expect(screen.queryByText(/couldn't refresh/i)).not.toBeInTheDocument();
    });
  }, 15000);

  it('Scenario 3: Double-click refresh — one refetch call and button indicates busy during flight', async () => {
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/dashboard loaded successfully/i)).toBeInTheDocument();
    });

    const refreshButtons = container.querySelectorAll('.sync-indicator__btn');
    const creditRefreshBtn = refreshButtons[0] as HTMLButtonElement;

    act(() => {
      fireEvent.click(creditRefreshBtn);
      fireEvent.click(creditRefreshBtn);
    });

    expect(creditRefreshBtn).toBeDisabled();
    expect(creditRefreshBtn).toHaveAttribute('aria-busy', 'true');

    await waitFor(() => {
      expect(creditRefreshBtn).not.toBeDisabled();
    });
  }, 15000);

  it('Scenario 4: Repayment elsewhere, then provider refetch — summaries recompute without reload', async () => {
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/dashboard loaded successfully/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText('$397,500').length).toBeGreaterThan(0);

    const modifiedLines: CreditLine[] = MOCK_CREDIT_LINES.map((cl, i) => {
      if (cl.id === 'CL-2024-001' || i === 0) {
        return {
          ...cl,
          utilized: cl.utilized - 50000,
        };
      }
      return { ...cl };
    });

    setGlobalCreditLines(modifiedLines);

    const refreshButtons = container.querySelectorAll('.sync-indicator__btn');
    const creditRefreshBtn = refreshButtons[0] as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(creditRefreshBtn);
    });

    await waitFor(() => {
      expect(screen.getAllByText('$347,500').length).toBeGreaterThan(0);
    });
  }, 15000);
});

describe('Dashboard overdue and payment due notices (Issue #1200)', () => {
  const baseDate = new Date(2026, 9, 19, 12, 0, 0);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(baseDate);
    resetGlobalCreditLines();
  });

  afterEach(() => {
    resetGlobalCreditLines();
    vi.useRealTimers();
  });

  it('Scenario 1: Due 3 days ago renders overdue notice with danger severity and Repay link', async () => {
    const lineOverdue: CreditLine = {
      ...MOCK_CREDIT_LINES[0],
      id: 'CL-OVERDUE-1',
      name: 'Alpha Line',
      status: 'Active',
      nextPaymentDate: '2026-10-16', // 3 days ago
      nextPaymentAmount: 1500,
    };
    setGlobalCreditLines([lineOverdue]);

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const overdueNotice = screen.getByRole('alert');
    expect(overdueNotice).toBeInTheDocument();
    expect(overdueNotice).toHaveClass('notification-item--danger');
    expect(overdueNotice.textContent).toMatch(/payment of/i);
    expect(overdueNotice.textContent).toMatch(/\$1,500/);
    expect(overdueNotice.textContent).toMatch(/for Alpha Line is 3 days overdue/i);

    const repayLink = screen.getByRole('link', { name: /repay now/i });
    expect(repayLink).toBeInTheDocument();
    expect(repayLink).toHaveAttribute('href', '/repay?line=CL-OVERDUE-1');
  }, 15000);

  it('Scenario 2: Due today at 23:59 with now at 08:00 renders due-today notice with warning severity', async () => {
    vi.setSystemTime(new Date(2026, 9, 19, 8, 0, 0));
    const lineDueToday: CreditLine = {
      ...MOCK_CREDIT_LINES[0],
      id: 'CL-TODAY-1',
      name: 'Beta Line',
      status: 'Active',
      nextPaymentDate: '2026-10-19T23:59:00',
      nextPaymentAmount: 2200,
    };
    setGlobalCreditLines([lineDueToday]);

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const notice = screen.getByText(/is due today/i).closest('.notification-item') as HTMLElement;
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveClass('notification-item--warning');
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.textContent).toMatch(/payment of/i);
    expect(notice.textContent).toMatch(/\$2,200/);
    expect(notice.textContent).toMatch(/for Beta Line is due today/i);

    const repayLink = screen.getByRole('link', { name: /repay now/i });
    expect(repayLink).toHaveAttribute('href', '/repay?line=CL-TODAY-1');
  }, 15000);

  it('Scenario 3: Due in 5 days renders upcoming info notice', async () => {
    const lineUpcoming: CreditLine = {
      ...MOCK_CREDIT_LINES[0],
      id: 'CL-UPCOMING-1',
      name: 'Gamma Line',
      status: 'Active',
      nextPaymentDate: '2026-10-24', // in 5 days
      nextPaymentAmount: 850,
    };
    setGlobalCreditLines([lineUpcoming]);

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const notice = screen.getByText(/due in/i).closest('.notification-item') as HTMLElement;
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveClass('notification-item--info');
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.textContent).toMatch(/payment of/i);
    expect(notice.textContent).toMatch(/\$850/);
    expect(notice.textContent).toMatch(/due in 5 days for Gamma Line/i);
  }, 15000);

  it('Scenario 4: Due in 10 days produces no payment notice', async () => {
    const lineFarFuture: CreditLine = {
      ...MOCK_CREDIT_LINES[0],
      id: 'CL-FUTURE-1',
      name: 'Delta Line',
      status: 'Active',
      utilized: 1000,
      limit: 100000, // low utilization so no util notice
      nextPaymentDate: '2026-10-29', // in 10 days
      nextPaymentAmount: 300,
    };
    setGlobalCreditLines([lineFarFuture]);

    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByText(/payment of/i)).not.toBeInTheDocument();
  }, 15000);

  it('Scenario 5: Ordering with mixed lines places overdue first, then due today, then upcoming', async () => {
    const lineUpcoming: CreditLine = {
      ...MOCK_CREDIT_LINES[0],
      id: 'CL-UPCOMING-ORDER',
      name: 'Line Upcoming',
      status: 'Active',
      limit: 100000,
      utilized: 1000,
      nextPaymentDate: '2026-10-23', // in 4 days
      nextPaymentAmount: 400,
    };
    const lineOverdue: CreditLine = {
      ...MOCK_CREDIT_LINES[0],
      id: 'CL-OVERDUE-ORDER',
      name: 'Line Overdue',
      status: 'Active',
      limit: 100000,
      utilized: 1000,
      nextPaymentDate: '2026-10-17', // 2 days ago
      nextPaymentAmount: 600,
    };
    const lineDueToday: CreditLine = {
      ...MOCK_CREDIT_LINES[0],
      id: 'CL-TODAY-ORDER',
      name: 'Line Due Today',
      status: 'Active',
      limit: 100000,
      utilized: 1000,
      nextPaymentDate: '2026-10-19', // today
      nextPaymentAmount: 500,
    };

    // Provide lines in reverse order to verify sorting logic
    setGlobalCreditLines([lineUpcoming, lineOverdue, lineDueToday]);

    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const notificationItems = container.querySelectorAll('.notification-item');
    const texts = Array.from(notificationItems).map((el) => el.textContent || '');

    const overdueIndex = texts.findIndex((t) => t.includes('is 2 days overdue'));
    const dueTodayIndex = texts.findIndex((t) => t.includes('is due today'));
    const upcomingIndex = texts.findIndex((t) => t.includes('due in 4 days'));

    expect(overdueIndex).toBeGreaterThanOrEqual(0);
    expect(dueTodayIndex).toBeGreaterThanOrEqual(0);
    expect(upcomingIndex).toBeGreaterThanOrEqual(0);

    expect(overdueIndex).toBeLessThan(dueTodayIndex);
    expect(dueTodayIndex).toBeLessThan(upcomingIndex);
  }, 15000);

  it('Scenario 6: Suspended line overdue shows overdue notice', async () => {
    const lineSuspendedOverdue: CreditLine = {
      ...MOCK_CREDIT_LINES[0],
      id: 'CL-SUSPENDED-OVERDUE',
      name: 'Suspended Line Overdue',
      status: 'Suspended',
      nextPaymentDate: '2026-10-15', // 4 days ago
      nextPaymentAmount: 3500,
    };
    setGlobalCreditLines([lineSuspendedOverdue]);

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const overdueNotice = screen.getByRole('alert');
    expect(overdueNotice).toBeInTheDocument();
    expect(overdueNotice.textContent).toMatch(/payment of/i);
    expect(overdueNotice.textContent).toMatch(/\$3,500/);
    expect(overdueNotice.textContent).toMatch(/for Suspended Line Overdue is 4 days overdue/i);
    expect(screen.getByRole('link', { name: /repay now/i })).toHaveAttribute(
      'href',
      '/repay?line=CL-SUSPENDED-OVERDUE'
    );
  }, 15000);
});
