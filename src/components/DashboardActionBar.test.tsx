/**
 * DashboardActionBar.test.tsx
 *
 * Focused test suite for the DashboardActionBar component.
 *
 * Coverage areas:
 *   1. Rendering — bar is hidden by default, visible on scroll
 *   2. Content   — correct buttons shown based on hasLines/hasUtilized
 *   3. Accessibility — toolbar role, ARIA labels
 *   4. Reduced motion — no motion class when reduced motion is active
 *   5. Scroll threshold — configurable scroll threshold
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { DashboardActionBar } from './DashboardActionBar';
import { ReducedMotionProvider } from '../context/ReducedMotionContext';

// ─── Mock scrollTo ──────────────────────────────────────────────────────────

beforeEach(() => {
  // jsdom doesn't support scrollY, so we stub it
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const MOCK_CREDIT_LINES = [
  { id: 'cl-1', name: 'Line 1', status: 'Active' as const, limit: 10000, utilized: 3000, riskScore: 650, updatedAt: '2025-01-01T00:00:00Z', apr: 8.5, openedAt: '2024-06-01T00:00:00Z', transactions: [], statusHistory: [] },
  { id: 'cl-2', name: 'Line 2', status: 'Active' as const, limit: 20000, utilized: 8000, riskScore: 720, updatedAt: '2025-01-01T00:00:00Z', apr: 7.2, openedAt: '2024-06-01T00:00:00Z', transactions: [], statusHistory: [] },
];

function renderBar(props: Partial<Parameters<typeof DashboardActionBar>[0]> = {}) {
  return render(
    <BrowserRouter>
      <ReducedMotionProvider>
        <DashboardActionBar
          hasLines={true}
          hasUtilized={true}
          activeLinesOnly={MOCK_CREDIT_LINES}
          totalAvailable={15000}
          totalUtilized={11000}
          creditLines={MOCK_CREDIT_LINES}
          {...props}
        />
      </ReducedMotionProvider>
    </BrowserRouter>
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('DashboardActionBar visibility', () => {
  it('is hidden when scrollY is below threshold', () => {
    window.scrollY = 0;
    renderBar();
    const bar = screen.getByRole('toolbar', { hidden: true });
    expect(bar).toHaveAttribute('hidden');
    expect(bar).not.toHaveClass('dashboard-action-bar--visible');
  });

  it('is visible when scrollY exceeds threshold', () => {
    window.scrollY = 400;
    renderBar();
    const bar = screen.getByRole('toolbar');
    expect(bar).not.toHaveAttribute('hidden');
    expect(bar).toHaveClass('dashboard-action-bar--visible');
  });

  it('respects custom scrollThreshold', () => {
    window.scrollY = 200;
    renderBar({ scrollThreshold: 100 });
    const bar = screen.getByRole('toolbar');
    expect(bar).not.toHaveAttribute('hidden');
    expect(bar).toHaveClass('dashboard-action-bar--visible');
  });
});

describe('DashboardActionBar content', () => {
  it('shows Draw Credit button when hasLines and active lines exist', () => {
    window.scrollY = 400;
    renderBar();
    expect(screen.getByText('Draw Credit')).toBeInTheDocument();
    expect(screen.getByText('15.0K')).toBeInTheDocument(); // totalAvailable formatted
  });

  it('shows Repay button when hasUtilized', () => {
    window.scrollY = 400;
    renderBar();
    expect(screen.getByText('Repay')).toBeInTheDocument();
    expect(screen.getByText('11.0K')).toBeInTheDocument(); // totalUtilized formatted
  });

  it('shows Open Credit Line when no lines exist', () => {
    window.scrollY = 400;
    renderBar({ hasLines: false, hasUtilized: false, activeLinesOnly: [], totalAvailable: 0, totalUtilized: 0, creditLines: [] });
    expect(screen.getByText('Open Credit Line')).toBeInTheDocument();
    expect(screen.queryByText('Draw Credit')).not.toBeInTheDocument();
  });

  it('always shows View Credit Lines', () => {
    window.scrollY = 400;
    renderBar();
    expect(screen.getByText('View Credit Lines')).toBeInTheDocument();
  });

  it('shows CopyLoanButton when hasLines', () => {
    window.scrollY = 400;
    renderBar();
    // CopyLoanButton renders a button with "Copy" text
    expect(screen.getByRole('toolbar').querySelectorAll('a').length).toBeGreaterThanOrEqual(3);
  });
});

describe('DashboardActionBar accessibility', () => {
  it('has toolbar role and aria-label', () => {
    window.scrollY = 400;
    renderBar();
    const bar = screen.getByRole('toolbar');
    expect(bar).toHaveAttribute('aria-label', 'Quick actions');
  });

  it('has data-visible attribute', () => {
    window.scrollY = 400;
    renderBar();
    const bar = screen.getByRole('toolbar');
    expect(bar.getAttribute('data-visible')).toBe('true');
  });
});

describe('DashboardActionBar reduced motion', () => {
  it('adds no-motion class when reduced motion is active', () => {
    // Mock matchMedia for reduced motion
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    window.scrollY = 400;
    renderBar();
    const bar = screen.getByRole('toolbar');
    expect(bar).toHaveClass('dashboard-action-bar--no-motion');

    window.matchMedia = original;
  });
});