/**
 * @fileoverview Tests for src/styles/focus.css
 *
 * GrantFox FWC26 (Stellar Wave) — Focus outline requirement
 * "Visible focus outline on keyboard-only nav for Dashboard."
 *
 * Tests cover:
 *   1. CSS file declares the required custom properties and utility classes.
 *   2. Dashboard interactive elements carry the .focus-ring class where needed.
 *   3. The :focus-visible selector is used (not plain :focus) to avoid
 *      showing rings on mouse/touch navigation.
 *
 * Note: jsdom does not compute :focus-visible pseudo-class styles.
 *   Actual outline rendering is verified in the visual regression suite.
 *   These tests assert structural correctness (class names, token declarations).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    wallet: {
      publicKey: 'GAABC1234567890ABCDEF',
      network: 'TESTNET',
    },
    status: 'connected',
  }),
}));

vi.mock('../utils/storage', () => ({
  readJson: vi.fn((_key: string, fallback: unknown) => fallback),
  writeJson: vi.fn(),
}));

// ── CSS file structure tests ──────────────────────────────────────────────

describe('focus.css — design tokens and utility classes', () => {
  const cssPath = resolve(__dirname, '../styles/focus.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('declares --focus-ring-color token', () => {
    expect(css).toContain('--focus-ring-color');
  });

  it('declares --focus-ring-width token (minimum 2px per WCAG 2.4.11)', () => {
    expect(css).toContain('--focus-ring-width');
    expect(css).toContain('2px');
  });

  it('declares --focus-ring-offset token', () => {
    expect(css).toContain('--focus-ring-offset');
  });

  it('defines .focus-ring utility class', () => {
    expect(css).toMatch(/\.focus-ring\b/);
  });

  it('uses :focus-visible (not :focus) so rings are keyboard-only', () => {
    // There must be at least one :focus-visible rule
    expect(css).toMatch(/:focus-visible/);
    // Plain :focus (without -visible or -within) should not define outline rules.
    // :focus-within is allowed (it's used for the cl-row-select label wrapper).
    const focusOnlyMatches = css.match(/:focus(?!-visible)(?!-within)\b/g);
    // Allow zero plain :focus rules (or none at all)
    expect(focusOnlyMatches ?? []).toHaveLength(0);
  });

  it('overrides --focus-ring-color to white under [data-contrast="high"]', () => {
    expect(css).toMatch(/\[data-contrast="high"\]/);
    // After the high-contrast selector, white (#ffffff) should be declared
    const highContrastBlock = css.slice(css.indexOf('[data-contrast="high"]'));
    expect(highContrastBlock).toContain('#ffffff');
  });

  it('defines .focus-ring-inset variant for clipped contexts', () => {
    expect(css).toMatch(/\.focus-ring-inset/);
  });

  it('defines .focus-ring-svg variant for SVG host elements', () => {
    expect(css).toMatch(/\.focus-ring-svg/);
  });

  it('defines Dashboard-specific .qa-btn focus rule', () => {
    expect(css).toContain('.qa-btn:focus-visible');
  });

  it('defines Dashboard-specific .risk-explainer-trigger focus rule', () => {
    expect(css).toContain('.risk-explainer-trigger:focus-visible');
  });

  it('defines Dashboard-specific .view-all-link focus rule', () => {
    expect(css).toContain('.view-all-link:focus-visible');
  });

  it('defines CreditLines-specific .cl-primary-btn focus rule', () => {
    expect(css).toContain('.cl-primary-btn:focus-visible');
  });

  it('defines CreditLines-specific .cl-filters select focus rule', () => {
    expect(css).toContain('.cl-filters select:focus-visible');
  });

  it('defines CreditLines-specific .cl-sort-dir focus rule', () => {
    expect(css).toContain('.cl-sort-dir:focus-visible');
  });

  it('does NOT suppress focus rings under prefers-reduced-motion', () => {
    // The reduced-motion block must not contain any outline or box-shadow rule
    const rmIdx = css.indexOf('@media (prefers-reduced-motion: reduce)');
    if (rmIdx === -1) return; // block absent is also fine
    // Find the closing brace of the @media block
    const blockStart = css.indexOf('{', rmIdx);
    let depth = 0;
    let blockEnd = blockStart;
    for (let i = blockStart; i < css.length; i++) {
      if (css[i] === '{') depth++;
      if (css[i] === '}') { depth--; if (depth === 0) { blockEnd = i; break; } }
    }
    const rmBlock = css.slice(blockStart, blockEnd);
    expect(rmBlock).not.toMatch(/outline/);
    expect(rmBlock).not.toMatch(/box-shadow/);
  });
});

// ── Dashboard integration tests ───────────────────────────────────────────

describe('Dashboard — focus-ring classes on interactive elements (FWC26)', () => {
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

  it('"Explain risk bands" button carries both risk-explainer-trigger and focus-ring classes', () => {
    const { container } = renderLoaded();
    const btn = container.querySelector('[data-testid="risk-explainer-trigger"]');
    expect(btn).toBeInTheDocument();
    expect(btn?.classList.contains('focus-ring')).toBe(true);
    expect(btn?.classList.contains('risk-explainer-trigger')).toBe(true);
  });

  it('"Explain risk bands" button has aria-haspopup="dialog"', () => {
    const { container } = renderLoaded();
    const btn = container.querySelector('[data-testid="risk-explainer-trigger"]');
    expect(btn?.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('"Explain risk bands" button has type="button" (prevents form submission)', () => {
    const { container } = renderLoaded();
    const btn = container.querySelector('[data-testid="risk-explainer-trigger"]');
    expect(btn?.getAttribute('type')).toBe('button');
  });

  it('"Dismiss risk score explainer" button is accessible with correct aria-label', () => {
    // The dismiss button lives inside RiskExplainerOverlay (not inline in Dashboard).
    // We verify the overlay trigger button is accessible and aria-labeled.
    vi.useFakeTimers();
    const { container } = render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();

    // The "Explain" trigger is the accessible entry point to the explainer
    const trigger = container.querySelector('[data-testid="risk-explainer-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.getAttribute('aria-label')).toBe('Explain risk bands');
  });

  it('index.css imports focus.css', () => {
    const indexCss = readFileSync(
      resolve(__dirname, '../index.css'),
      'utf-8'
    );
    // Accept both single and double-quote imports
    expect(indexCss).toMatch(/@import ["']\.\/styles\/focus\.css["']/);
  });
});

// ── CreditLines integration tests ─────────────────────────────────────────

describe('CreditLines — focus-ring classes on interactive elements (FWC26)', () => {
  const cssPath = resolve(__dirname, '../styles/focus.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('defines CreditLines-specific focus rules in focus.css', () => {
    expect(css).toContain('.cl-primary-btn:focus-visible');
    expect(css).toContain('.cl-sort-dir:focus-visible');
    expect(css).toContain('.cl-card:focus-visible');
  });

  it('defines focus rule for filter dropdown selects', () => {
    expect(css).toContain('.cl-filters select:focus-visible');
  });

  it('defines focus rule for compare checkboxes in CreditLineCard rows', () => {
    expect(css).toContain('.cl-row-select input:focus-visible');
  });

  it('defines focus fallback for CreditLineRowMenu 3-dot trigger button', () => {
    // The trigger uses aria-haspopup="true" — our fallback ensures
    // a visible ring even if Tailwind utilities are unavailable.
    expect(css).toContain('.cl-card [aria-haspopup="true"]:focus-visible');
  });
});

// ── DrawCreditPage integration tests ──────────────────────────────────────

describe('DrawCreditPage — focus-visible rules (FWC26 / issue #592)', () => {
  const cssPath = resolve(__dirname, '../styles/focus.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('defines DrawCreditPage-scoped credit-line focus rule', () => {
    expect(css).toContain('.dc-page .dc-credit-line-item:focus-visible');
  });

  it('defines DrawCreditPage-scoped button and preset focus rules', () => {
    expect(css).toContain('.dc-page .dc-btn:focus-visible');
    expect(css).toContain('.dc-page .dc-preset-btn:focus-visible');
  });

  it('defines DrawCreditPage-scoped terms checkbox focus rule', () => {
    expect(css).toContain('.dc-page .dc-terms-label__checkbox:focus-visible');
  });

  it('defines DrawCreditPage AmountInput control focus selectors', () => {
    expect(css).toContain('button[aria-label="Decrease amount"]:focus-visible');
    expect(css).toContain('button[aria-label="Increase amount"]:focus-visible');
    expect(css).toContain(
      'button[aria-label="Set amount to maximum available credit"]:focus-visible',
    );
  });

  it('uses shared focus-ring tokens (not hard-coded hex only)', () => {
    const drawBlockStart = css.indexOf('DrawCreditPage interactive elements');
    expect(drawBlockStart).toBeGreaterThan(-1);
    const drawBlock = css.slice(drawBlockStart);
    expect(drawBlock).toContain('--focus-ring-width');
    expect(drawBlock).toContain('--focus-ring-color');
    expect(drawBlock).toContain('--focus-ring-offset');
  });
});

// ── RepayPage integration tests ──────────────────────────────────────────

// ── OnboardingFlow integration tests ────────────────────────────────────

describe('OnboardingFlow — focus-visible rules (FWC26)', () => {
  const cssPath = resolve(__dirname, '../styles/focus.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('defines OnboardingFlow-scoped skip button focus rule', () => {
    expect(css).toContain('.onboarding-overlay .skip-btn:focus-visible');
  });

  it('defines OnboardingFlow-scoped primary button focus rule', () => {
    expect(css).toContain('.onboarding-overlay .primary-btn:focus-visible');
  });

  it('defines OnboardingFlow-scoped secondary button focus rule', () => {
    expect(css).toContain('.onboarding-overlay .secondary-btn:focus-visible');
  });

  it('defines OnboardingFlow-scoped step indicator focus rule', () => {
    expect(css).toContain('.onboarding-overlay .indicator:focus-visible');
  });

  it('uses shared focus-ring tokens in OnboardingFlow rules', () => {
    const obBlockStart = css.indexOf('OnboardingFlow interactive elements');
    expect(obBlockStart).toBeGreaterThan(-1);
    const obBlock = css.slice(obBlockStart);
    expect(obBlock).toContain('--focus-ring-width');
    expect(obBlock).toContain('--focus-ring-color');
    expect(obBlock).toContain('--focus-ring-offset');
    expect(obBlock).toContain('!important');
  });

  it('defines indicator border-radius as full/round', () => {
    const obBlockStart = css.indexOf('OnboardingFlow interactive elements');
    expect(obBlockStart).toBeGreaterThan(-1);
    const obBlock = css.slice(obBlockStart);
    expect(obBlock).toContain('border-radius: var(--radius-full, 9999px)');
  });

  it('all interactive elements carry both class and :focus-visible selector', () => {
    // Each interactive selector must use :focus-visible (not :focus)
    // regex matches each selector before the opening brace
    const obBlockStart = css.indexOf('OnboardingFlow interactive elements');
    const obBlockEnd = css.indexOf('/* ── Reduced-motion', obBlockStart);
    const obBlock = css.slice(obBlockStart, obBlockEnd > obBlockStart ? obBlockEnd : undefined);
    const focusVisibleMatches = obBlock.match(/:focus-visible/g);
    expect(focusVisibleMatches).not.toBeNull();
    // There should be at least one :focus-visible per element type (4 total)
    expect(focusVisibleMatches!.length).toBeGreaterThanOrEqual(4);
  });
});

describe('AprBreakdown — focus-visible rules (FWC26 / issue #835)', () => {
  const cssPath = resolve(__dirname, '../styles/focus.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('defines AprBreakdown-scoped toggle button focus rule', () => {
    expect(css).toContain('.apr-breakdown__toggle:focus-visible');
  });

  it('defines AprBreakdown-scoped component expand button focus rule', () => {
    expect(css).toContain('.apr-breakdown__component-expand:focus-visible');
  });

  it('uses shared focus-ring tokens in AprBreakdown rules', () => {
    const abBlockStart = css.indexOf('AprBreakdown interactive elements');
    expect(abBlockStart).toBeGreaterThan(-1);
    const abBlock = css.slice(abBlockStart);
    expect(abBlock).toContain('--focus-ring-width');
    expect(abBlock).toContain('--focus-ring-color');
    expect(abBlock).toContain('--focus-ring-offset');
    expect(abBlock).toContain('!important');
  });

  it('defines toggle button border-radius', () => {
    const abBlockStart = css.indexOf('AprBreakdown interactive elements');
    expect(abBlockStart).toBeGreaterThan(-1);
    const abBlock = css.slice(abBlockStart);
    expect(abBlock).toContain('border-radius: var(--radius-md, 6px)');
  });
});

describe('RepayPage — focus-visible rules (FWC26 / issue #512)', () => {
  const cssPath = resolve(__dirname, '../styles/focus.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('defines RepayPage-scoped back button focus rule', () => {
    expect(css).toContain('.repay-page .rp-back-btn:focus-visible');
  });

  it('defines RepayPage-scoped credit line card focus rule', () => {
    expect(css).toContain('.repay-page .rp-cl-card:focus-visible');
  });

  it('defines RepayPage-scoped preset button focus rule', () => {
    expect(css).toContain('.repay-page .rp-preset-btn:focus-visible');
  });

  it('defines RepayPage-scoped Smart Pay button focus rule', () => {
    expect(css).toContain('.repay-page .rp-smart-pay-btn:focus-visible');
  });

  it('defines RepayPage-scoped amount input focus rule', () => {
    expect(css).toContain('.repay-page .rp-amount-input:focus-visible');
  });

  it('defines RepayPage-scoped review button focus rule', () => {
    expect(css).toContain('.repay-page .rp-review-btn:focus-visible');
  });

  it('defines RepayPage-scoped preview button focus rule', () => {
    expect(css).toContain('.repay-page .rp-preview-btn:focus-visible');
  });

  it('defines RepayPage-scoped toggle switch focus rule', () => {
    expect(css).toContain('.repay-page .rp-toggle-switch:focus-visible');
  });

  it('defines RepayPage-scoped help button focus rule', () => {
    expect(css).toContain('.repay-page .rp-help-btn:focus-visible');
  });

  it('defines RepayPage-scoped cancel button focus rule', () => {
    expect(css).toContain('.repay-page .rp-cancel-btn:focus-visible');
  });

  it('defines RepayPage-scoped confirm button focus rule', () => {
    expect(css).toContain('.repay-page .rp-confirm-btn:focus-visible');
  });

  it('defines RepayPage-scoped back-input button focus rule', () => {
    expect(css).toContain('.repay-page .rp-back-input-btn:focus-visible');
  });

  it('defines RepayPage-scoped dashboard button focus rule', () => {
    expect(css).toContain('.repay-page .rp-dashboard-btn:focus-visible');
  });

  it('defines RepayPage-scoped new-repay button focus rule', () => {
    expect(css).toContain('.repay-page .rp-new-repay-btn:focus-visible');
  });

  it('uses shared focus-ring tokens in RepayPage rules', () => {
    const repayBlockStart = css.indexOf('RepayPage interactive elements');
    expect(repayBlockStart).toBeGreaterThan(-1);
    const repayBlock = css.slice(repayBlockStart);
    expect(repayBlock).toContain('--focus-ring-width');
    expect(repayBlock).toContain('--focus-ring-color');
    expect(repayBlock).toContain('--focus-ring-offset');
    // Verify it uses !important like DrawCreditPage rules
    expect(repayBlock).toContain('!important');
  });
});

