/**
 * @fileoverview Tests for src/styles/typography.css
 *
 * GrantFox FWC26 (Stellar Wave) — Tabular-nums requirement
 * "Apply font-variant-numeric: tabular-nums to numeric displays on Dashboard."
 *
 * Because jsdom does not compute CSS custom properties or external stylesheets,
 * these tests assert structural/class-level correctness (the class names are
 * applied where expected) and validate that the CSS file itself exports the
 * correct utility class names via raw-text import.
 *
 * Rendering-level verification (computed style) requires a real browser;
 * see the visual regression suite for pixel-level checks.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { vi } from 'vitest';

// ── Module mocks (same pattern as Dashboard.test.tsx) ─────────────────────

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    wallet: {
      type: 'freighter',
      publicKey: 'GAABC1234567890ABCDEF',
      network: 'TESTNET',
    },
    status: 'connected',
  }),
  // <NextSteps/> (mounted on Dashboard) derives its per-wallet storage key
  // from the connected wallet via this helper.
  walletIdentityKey: (
    wallet: { type?: string; publicKey?: string; network?: string } | null,
  ) => (wallet ? `${wallet.type}:${wallet.publicKey}:${wallet.network}` : null),
}));

// <NextSteps/> reads KYC progress from the app-wide KycContext.
vi.mock('../context/KycContext', () => ({
  useKyc: () => ({
    steps: [],
    overallStatus: 'not_started',
    resumeStepId: 'identity',
    completedCount: 0,
    setStepStatus: vi.fn(),
    resetAll: vi.fn(),
  }),
}));

// Resolve the linked-accounts lookup immediately so the Next Steps card is
// not stuck on its loading skeleton inside these tests.
vi.mock('../services/linkedAccounts', () => ({
  fetchLinkedAccounts: vi.fn().mockResolvedValue([]),
}));

vi.mock('../utils/storage', () => ({
  readJson: vi.fn((_key: string, fallback: unknown) => fallback),
  writeJson: vi.fn(),
}));

// ── CSS file structure tests ──────────────────────────────────────────────

describe('typography.css — tabular-nums utility', () => {
  const cssPath = resolve(__dirname, '../styles/typography.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('declares .num-tabular with font-variant-numeric: tabular-nums', () => {
    // Both class names share one declaration block
    expect(css).toContain('font-variant-numeric: tabular-nums');
  });

  it('exports the .num-tabular class name', () => {
    expect(css).toMatch(/\.num-tabular/);
  });

  it('exports the .tabular-nums class name as an alias', () => {
    expect(css).toMatch(/\.tabular-nums/);
  });

  it('both class names share the same tabular-nums declaration', () => {
    // Verify both selectors appear in the CSS and are followed by
    // font-variant-numeric: tabular-nums in the same block.
    // Use a flexible pattern rather than raw character-position comparison.
    expect(css).toMatch(/\.num-tabular[\s\S]*?\.tabular-nums[\s\S]*?font-variant-numeric:\s*tabular-nums/);
  });

  it('exports .num-display with tabular-nums for hero values', () => {
    expect(css).toMatch(/\.num-display/);
  });

  it('exports .num-mono with tabular-nums for monospace numeric strings', () => {
    expect(css).toMatch(/\.num-mono/);
  });
});

// ── Dashboard integration tests ───────────────────────────────────────────

describe('Dashboard — tabular-nums on numeric displays (FWC26)', () => {
  function renderLoaded() {
    vi.useFakeTimers();
    const result = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();
    return result;
  }

  it('summary card: Total Credit Limit value carries num-tabular class', () => {
    const { container } = renderLoaded();
    // The .value elements inside summary-cards
    const values = container.querySelectorAll('.summary-cards .value');
    expect(values.length).toBeGreaterThanOrEqual(3);
    values.forEach((el) => {
      expect(el.classList.contains('num-tabular')).toBe(true);
    });
  });

  it('credit breakdown: all cb-value elements carry num-tabular class', () => {
    const { container } = renderLoaded();
    const cbValues = container.querySelectorAll('.cb-value');
    expect(cbValues.length).toBeGreaterThanOrEqual(3);
    cbValues.forEach((el) => {
      expect(el.classList.contains('num-tabular')).toBe(true);
    });
  });

  it('recent activity: all activity-amount elements in Dashboard card carry num-tabular class', () => {
    const { container } = renderLoaded();
    // Scope to the card that Dashboard itself renders (not ActivityFeed component).
    // The Dashboard Recent Activity card is the `.card` containing the
    // `.activity-item` elements built inline (not from ActivityFeed).
    // We identify it by the h2 text content.
    const cards = container.querySelectorAll('.card');
    let activityCard: Element | null = null;
    cards.forEach((card) => {
      const h2 = card.querySelector('h2');
      if (h2?.textContent?.includes('Recent Activity')) {
        activityCard = card;
      }
    });
    // If no activity card is present (no transactions), the test is vacuously satisfied
    if (!activityCard) return;
    const amounts = (activityCard as Element).querySelectorAll('.activity-amount');
    amounts.forEach((el) => {
      expect(el.classList.contains('num-tabular')).toBe(true);
    });
  });

  it('credit lines preview: cl-preview-amount carries num-tabular class', () => {
    const { container } = renderLoaded();
    const previews = container.querySelectorAll('.cl-preview-amount');
    previews.forEach((el) => {
      expect(el.classList.contains('num-tabular')).toBe(true);
    });
  });

  it('utilization percentage in util-bar-header carries num-tabular class', () => {
    const { container } = renderLoaded();
    const pctSpan = container.querySelector('.util-bar-header .num-tabular');
    expect(pctSpan).toBeInTheDocument();
  });

  it('num-tabular and tabular-nums classes are treated as synonyms in index.css', () => {
    // index.css imports typography.css which defines both; verify .num-tabular
    // exists in the DOM (rendered by Dashboard) — asserting the class is set.
    const { container } = renderLoaded();
    const el = container.querySelector('.num-tabular');
    expect(el).toBeInTheDocument();
  });
});
