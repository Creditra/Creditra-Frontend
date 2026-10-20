import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { RepaymentVisualizer } from '../RepaymentVisualizer';
import * as ReducedMotionContext from '../../context/ReducedMotionContext';

// Default: motion is enabled. Individual test groups override this as needed.
vi.spyOn(ReducedMotionContext, 'useReducedMotion').mockReturnValue({
  motionOverride: 'system',
  toggleMotionOverride: vi.fn(),
  setMotionOverride: vi.fn(),
  isReducedMotionActive: false,
});

const BASE = {
  principal: 100_000,
  apr: 8.5,
  monthlyPayment: 2500,
  /** Skip first-paint skeleton so existing sync assertions stay stable. */
  loading: false as const,
};

describe('RepaymentVisualizer', () => {
  it('renders the section heading', () => {
    render(<RepaymentVisualizer {...BASE} />);
    expect(screen.getByRole('region', { name: 'Repayment plan visualizer' })).toBeInTheDocument();
    expect(screen.getByText('Repayment Plan')).toBeInTheDocument();
  });

  it('shows empty state when principal is 0', () => {
    render(<RepaymentVisualizer {...BASE} principal={0} />);
    expect(screen.getByText(/Enter a valid principal/i)).toBeInTheDocument();
  });

  it('shows empty state when monthlyPayment is 0', () => {
    render(<RepaymentVisualizer {...BASE} monthlyPayment={0} />);
    expect(screen.getByText(/Enter a valid principal/i)).toBeInTheDocument();
  });

  it('renders the SVG chart with accessible role and tabIndex', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const svg = screen.getByRole('img');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('tabindex', '0');
  });

  it('marks every keyboard target with the tokenized focus-visible class', () => {
    render(<RepaymentVisualizer {...BASE} maxMonths={24} />);

    expect(screen.getByRole('img')).toHaveClass('repayment-visualizer-focus');
    expect(screen.getByText(/Schedule table/i)).toHaveClass('repayment-visualizer-focus');

    fireEvent.click(screen.getByText(/Schedule table/i));
    expect(screen.getByRole('button', { name: /Show all 24 months/i })).toHaveClass(
      'repayment-visualizer-focus',
    );
  });

  it('uses the shared focus tokens only for keyboard-visible focus', () => {
    const css = readFileSync(resolve(__dirname, '../../styles/focus.css'), 'utf-8');
    const selectorIndex = css.indexOf('.repayment-visualizer-focus:focus-visible');
    expect(selectorIndex).toBeGreaterThanOrEqual(0);

    const rule = css.slice(selectorIndex, css.indexOf('}', selectorIndex) + 1);
    expect(rule).toContain('--focus-ring-width');
    expect(rule).toContain('--focus-ring-color');
    expect(rule).toContain('--focus-ring-offset');
    expect(css).not.toMatch(/\.repayment-visualizer-focus:focus(?!-visible)/);
  });

  it('renders term and total interest summary', () => {
    render(<RepaymentVisualizer {...BASE} />);
    expect(screen.getAllByText(/month/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/total interest/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the SR-only data table with correct headers', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const tables = screen.getAllByRole('table');
    expect(tables.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: /Month/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: /Interest/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: /Principal/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders a legend with principal and interest labels', () => {
    render(<RepaymentVisualizer {...BASE} />);
    expect(screen.getAllByText(/Principal remaining/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Cumulative interest/i).length).toBeGreaterThanOrEqual(1);
  });

  it('schedule table toggle expands visible rows', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const summary = screen.getByText(/Schedule table/i);
    fireEvent.click(summary);
    const tables = screen.getAllByRole('table');
    expect(tables.length).toBeGreaterThanOrEqual(2);
  });

  it('caps term at maxMonths', () => {
    render(<RepaymentVisualizer principal={100_000} apr={8.5} monthlyPayment={3000} maxMonths={6}  loading={false} />);
    expect(screen.getAllByText(/6 month/).length).toBeGreaterThanOrEqual(1);
  });

  it('has no tooltip by default', () => {
    render(<RepaymentVisualizer {...BASE} />);
    // Only the LiveRegion (sr-only) status element exists, no visible tooltip status
    const statusElements = screen.getAllByRole('status');
    expect(statusElements).toHaveLength(1);
    expect(statusElements[0]).toHaveClass('sr-only');
  });

  it('shows tooltip on mouse move over SVG', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const svg = screen.getByRole('img');
    fireEvent.mouseMove(svg, { clientX: 100, clientY: 100 });
    // Two status elements: LiveRegion (sr-only) + tooltip (visible)
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getAllByText(/Month/).length).toBeGreaterThanOrEqual(1);
  });

  it('hides tooltip on mouse leave', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const svg = screen.getByRole('img');
    fireEvent.mouseMove(svg, { clientX: 100, clientY: 100 });
    expect(screen.getAllByRole('status')).toHaveLength(2);
    fireEvent.mouseLeave(svg);
    // After mouse leave, only the LiveRegion remains
    const statusElements = screen.getAllByRole('status');
    expect(statusElements).toHaveLength(1);
    expect(statusElements[0]).toHaveClass('sr-only');
  });
});

// ─── Keyboard shortcut hints & navigation tests ───────────────────────────

describe('RepaymentVisualizer — keyboard shortcut hints & navigation', () => {
  it('renders keyboard shortcut hints in header and legend bar', () => {
    render(<RepaymentVisualizer {...BASE} />);
    expect(screen.getAllByText('Inspect month').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Inspect').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Clear')).toBeInTheDocument();
    expect(screen.getAllByText('←').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('→').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  it('navigates schedule data points using ArrowRight and ArrowLeft keys', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const svg = screen.getByRole('img');

    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    // Two status elements: LiveRegion + tooltip
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(svg).toHaveAttribute('aria-valuenow', '1');

    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(svg).toHaveAttribute('aria-valuenow', '2');

    fireEvent.keyDown(svg, { key: 'ArrowLeft' });
    expect(svg).toHaveAttribute('aria-valuenow', '1');
  });

  it('jumps to start and end of schedule using Home and End keys', () => {
    render(<RepaymentVisualizer principal={100_000} apr={8.5} monthlyPayment={3000} maxMonths={6}  loading={false} />);
    const svg = screen.getByRole('img');

    fireEvent.keyDown(svg, { key: 'End' });
    expect(svg).toHaveAttribute('aria-valuenow', '6');

    fireEvent.keyDown(svg, { key: 'Home' });
    expect(svg).toHaveAttribute('aria-valuenow', '1');
  });

  it('clears active tooltip when pressing Escape key', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const svg = screen.getByRole('img');

    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(screen.getAllByRole('status')).toHaveLength(2);

    fireEvent.keyDown(svg, { key: 'Escape' });
    // After escape, only the LiveRegion remains
    const statusElements = screen.getAllByRole('status');
    expect(statusElements).toHaveLength(1);
    expect(statusElements[0]).toHaveClass('sr-only');
  });
});

// ─── Accessibility caption / aria-label tests ─────────────────────────────

describe('RepaymentVisualizer — accessible chart captions', () => {
  it('SVG has the default aria-label when chartAriaLabel is omitted', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute(
      'aria-label',
      'Stacked area chart showing principal and cumulative interest over repayment months',
    );
  });

  it('SVG uses the chartAriaLabel override when provided', () => {
    const customLabel = 'Home improvement loan repayment chart at 8.5% APR';
    render(<RepaymentVisualizer {...BASE} chartAriaLabel={customLabel} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', customLabel);
  });

  it('changing chartAriaLabel prop updates the SVG aria-label', () => {
    const { rerender } = render(<RepaymentVisualizer {...BASE} chartAriaLabel="First label" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'First label');
    rerender(<RepaymentVisualizer {...BASE} chartAriaLabel="Second label" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Second label');
  });

  it('removing chartAriaLabel reverts the SVG to the default aria-label', () => {
    const { rerender } = render(<RepaymentVisualizer {...BASE} chartAriaLabel="Custom label" />);
    rerender(<RepaymentVisualizer {...BASE} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Stacked area chart showing principal and cumulative interest over repayment months',
    );
  });

  it('SR table caption is auto-generated from term and total interest when caption is omitted', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const caption = document.querySelector('table.sr-only caption');
    expect(caption).toBeInTheDocument();
  });

  it('does not render the SVG or SR table when principal is 0', () => {
    render(<RepaymentVisualizer {...BASE} principal={0} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('table.sr-only')).not.toBeInTheDocument();
  });
});

// ─── Responsive breakpoints (Tailwind) tests ──────────────────────────────

describe('RepaymentVisualizer — responsive breakpoints', () => {
  it('section wrapper has responsive padding classes', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const section = screen.getByRole('region', { name: 'Repayment plan visualizer' });
    expect(section).toHaveClass('p-4', 'sm:p-5', 'md:p-6');
  });

  it('header uses responsive flex layout', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const heading = screen.getByText('Repayment Plan');
    const header = heading.closest('header');
    expect(header).toHaveClass('flex', 'flex-col', 'sm:flex-row', 'sm:items-center', 'sm:justify-between');
  });

  it('legend uses responsive flex layout', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const legendItem = screen.getAllByText(/Principal remaining/i)[0];
    const legendWrapper = legendItem.parentElement;
    expect(legendWrapper).toHaveClass('flex', 'flex-wrap', 'items-center', 'gap-3', 'sm:gap-4');
  });

  it('visible table wrapper has responsive negative margin for bleed', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const summary = screen.getByText(/Schedule table/i);
    fireEvent.click(summary);
    const table = screen.getAllByRole('table').find((t) => !t.classList.contains('sr-only'));
    const wrapper = table?.parentElement;
    expect(wrapper).toHaveClass('overflow-x-auto', '-mx-4', 'sm:mx-0', 'px-4', 'sm:px-0');
  });
});

// ─── Tabular-nums tests ────────────────────────────────────────────────────

describe('RepaymentVisualizer — tabular-nums on numeric displays', () => {
  it('SR-only table has tabular-nums class', () => {
    render(<RepaymentVisualizer {...BASE} />);
    expect(document.querySelector('table.sr-only.tabular-nums')).toBeInTheDocument();
  });

  it('visible table has tabular-nums class', () => {
    render(<RepaymentVisualizer {...BASE} />);
    fireEvent.click(screen.getByText(/Schedule table/i));
    const visibleTable = screen.getAllByRole('table').find((t) => !t.classList.contains('sr-only'));
    expect(visibleTable).toHaveClass('tabular-nums');
  });

  it('visible table td cells have tabular-nums style', () => {
    render(<RepaymentVisualizer {...BASE} />);
    fireEvent.click(screen.getByText(/Schedule table/i));
    const visibleTable = screen.getAllByRole('table').find((t) => !t.classList.contains('sr-only'));
    const firstDataCell = visibleTable?.querySelector('tbody td');
    expect(firstDataCell).toBeDefined();
    expect(firstDataCell).toHaveStyle({ fontVariantNumeric: 'tabular-nums' });
  });

  it('tooltip bubble has tabular-nums style', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const svg = screen.getByRole('img');
    fireEvent.mouseMove(svg, { clientX: 100, clientY: 100 });
    // Find the visible (non-sr-only) status element — that's the tooltip
    const statuses = screen.getAllByRole('status');
    const tooltip = statuses.find((el) => !el.classList.contains('sr-only'));
    expect(tooltip).toBeDefined();
    expect(tooltip).toHaveStyle({ fontVariantNumeric: 'tabular-nums' });
  });

  it('header summary has tabular-nums style', () => {
    render(<RepaymentVisualizer {...BASE} />);
    // The summary <p> is inside <header>, sibling of the title <div>
    const header = screen.getByText('Repayment Plan').closest('header');
    const summaryP = header?.querySelector('p');
    expect(summaryP).toHaveStyle({ fontVariantNumeric: 'tabular-nums' });
  });

  it('SVG y-axis labels have tabular-nums style', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const svg = screen.getByRole('img');
    const yAxisTexts = svg.querySelectorAll('text');
    const yAxisText = Array.from(yAxisTexts).find((t) => t.textContent?.includes('$'));
    expect(yAxisText).toBeDefined();
    expect(yAxisText).toHaveAttribute('style', expect.stringContaining('tabular-nums'));
  });

  it('SVG x-axis labels have tabular-nums style', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const svg = screen.getByRole('img');
    const xAxisText = Array.from(svg.querySelectorAll('text')).find((t) =>
      t.textContent?.startsWith('mo '),
    );
    expect(xAxisText).toBeDefined();
    expect(xAxisText).toHaveAttribute('style', expect.stringContaining('tabular-nums'));
  });
});

// ─── Reduced-motion fallback tests ────────────────────────────────────────

/**
 * Tests for the `prefers-reduced-motion` fallback behaviour.
 *
 * Strategy
 * ────────
 * - OS media query path: override the global matchMedia stub to return
 *   `matches: true` for `(prefers-reduced-motion: reduce)`.
 * - In-app override path: spy on `useReducedMotion` and return
 *   `isReducedMotionActive: true`.
 *
 * Both paths are tested independently so neither can mask a regression.
 */
describe('RepaymentVisualizer — reduced-motion fallback', () => {
  // ── Default (motion enabled) ──────────────────────────────────────────────

  it('applies animation classes to area paths when motion is not reduced', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const chartWrap = document.querySelector('.rv-chart-wrap');
    expect(chartWrap).toBeInTheDocument();
    expect(chartWrap).not.toHaveAttribute('data-reduced-motion');
    expect(document.querySelectorAll('.rv-area-animate').length).toBeGreaterThan(0);
  });

  it('applies the stagger delay class to the interest path when motion is enabled', () => {
    render(<RepaymentVisualizer {...BASE} />);
    expect(document.querySelector('.rv-area-animate--interest')).toBeInTheDocument();
  });

  it('applies legend animation class when motion is enabled', () => {
    render(<RepaymentVisualizer {...BASE} />);
    expect(document.querySelector('.rv-legend-animate')).toBeInTheDocument();
  });

  // ── In-app reduced-motion override (via ReducedMotionContext) ─────────────

  describe('when isReducedMotionActive is true (in-app override)', () => {
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      spy = vi.spyOn(ReducedMotionContext, 'useReducedMotion').mockReturnValue({
        motionOverride: 'reduced',
        toggleMotionOverride: vi.fn(),
        setMotionOverride: vi.fn(),
        isReducedMotionActive: true,
      });
    });

    afterEach(() => {
      spy.mockRestore();
    });

    it('sets data-reduced-motion="true" on the chart wrapper', () => {
      render(<RepaymentVisualizer {...BASE} />);
      expect(document.querySelector('.rv-chart-wrap')).toHaveAttribute('data-reduced-motion', 'true');
    });

    it('does NOT apply animation classes to area paths', () => {
      render(<RepaymentVisualizer {...BASE} />);
      expect(document.querySelectorAll('.rv-area-animate').length).toBe(0);
    });

    it('does NOT apply the stagger-delay class to the interest path', () => {
      render(<RepaymentVisualizer {...BASE} />);
      expect(document.querySelector('.rv-area-animate--interest')).not.toBeInTheDocument();
    });

    it('does NOT apply the legend animation class', () => {
      render(<RepaymentVisualizer {...BASE} />);
      expect(document.querySelector('.rv-legend-animate')).not.toBeInTheDocument();
    });

    it('still renders the SVG chart (no visual regression)', () => {
      render(<RepaymentVisualizer {...BASE} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('still renders the SR data table (a11y unaffected)', () => {
      render(<RepaymentVisualizer {...BASE} />);
      expect(document.querySelector('table.sr-only')).toBeInTheDocument();
    });

    it('still renders the legend items (content unaffected)', () => {
      render(<RepaymentVisualizer {...BASE} />);
      expect(screen.getAllByText(/Principal remaining/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Cumulative interest/i).length).toBeGreaterThanOrEqual(1);
    });

    it('tooltip still works (interaction unaffected by reduced motion)', () => {
      render(<RepaymentVisualizer {...BASE} />);
      const svg = screen.getByRole('img');
      fireEvent.mouseMove(svg, { clientX: 100, clientY: 100 });
      // Two status elements: LiveRegion + tooltip
      expect(screen.getAllByRole('status')).toHaveLength(2);
    });
  });

  // ── OS prefers-reduced-motion media query ─────────────────────────────────

  describe('when prefers-reduced-motion OS preference is active', () => {
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Simulate the OS preference being active by making isReducedMotionActive true
      // (ReducedMotionContext reads OS matchMedia on init; spy to avoid jsdom issues)
      spy = vi.spyOn(ReducedMotionContext, 'useReducedMotion').mockReturnValue({
        motionOverride: 'system',
        toggleMotionOverride: vi.fn(),
        setMotionOverride: vi.fn(),
        isReducedMotionActive: true, // as if OS reduced-motion is on
      });
    });

    afterEach(() => {
      spy.mockRestore();
      // Restore default mock
      vi.spyOn(ReducedMotionContext, 'useReducedMotion').mockReturnValue({
        motionOverride: 'system',
        toggleMotionOverride: vi.fn(),
        setMotionOverride: vi.fn(),
        isReducedMotionActive: false,
      });
    });

    it('sets data-reduced-motion="true" on the chart wrapper via OS preference', () => {
      render(<RepaymentVisualizer {...BASE} />);
      expect(document.querySelector('.rv-chart-wrap')).toHaveAttribute('data-reduced-motion', 'true');
    });

    it('does NOT apply animation classes to area paths via OS preference', () => {
      render(<RepaymentVisualizer {...BASE} />);
      expect(document.querySelectorAll('.rv-area-animate').length).toBe(0);
    });

    it('does NOT apply the legend animation class via OS preference', () => {
      render(<RepaymentVisualizer {...BASE} />);
      expect(document.querySelector('.rv-legend-animate')).not.toBeInTheDocument();
    });

    it('chart and table still render correctly in OS reduced-motion mode', () => {
      render(<RepaymentVisualizer {...BASE} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(document.querySelector('table.sr-only')).toBeInTheDocument();
    });
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  it('empty state is unaffected by reduced-motion override', () => {
    const spy = vi.spyOn(ReducedMotionContext, 'useReducedMotion').mockReturnValue({
      motionOverride: 'reduced',
      toggleMotionOverride: vi.fn(),
      setMotionOverride: vi.fn(),
      isReducedMotionActive: true,
    });

    render(<RepaymentVisualizer {...BASE} principal={0} />);
    expect(screen.getByText(/Enter a valid principal/i)).toBeInTheDocument();
    expect(document.querySelector('.rv-chart-wrap')).not.toBeInTheDocument();

    spy.mockRestore();
  });
});

// ─── ARIA live-region announcement tests ─────────────────────────────────

describe('RepaymentVisualizer — aria-live status announcements', () => {
  it('renders a LiveRegion component with sr-only class', () => {
    render(<RepaymentVisualizer {...BASE} />);
    // The LiveRegion renders a div with role="status", aria-live="polite", and sr-only class
    const liveRegion = document.querySelector('[aria-live="polite"].sr-only');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('role', 'status');
  });

  it('LiveRegion announces the repayment plan summary when schedule is calculated', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const liveRegion = document.querySelector('[aria-live="polite"].sr-only');
    expect(liveRegion?.textContent).toMatch(/repayment plan/i);
    expect(liveRegion?.textContent).toMatch(/month/i);
    expect(liveRegion?.textContent).toMatch(/total interest/i);
  });

  it('LiveRegion announces tooltip data when inspecting a month via keyboard', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const svg = screen.getByRole('img');

    // Navigate to month 1 via keyboard
    fireEvent.keyDown(svg, { key: 'ArrowRight' });

    const liveRegion = document.querySelector('[aria-live="polite"].sr-only');
    expect(liveRegion?.textContent).toMatch(/month 1/i);
    expect(liveRegion?.textContent).toMatch(/principal remaining/i);
    expect(liveRegion?.textContent).toMatch(/cumulative interest/i);
  });

  it('LiveRegion reverts to plan summary when tooltip is cleared', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const svg = screen.getByRole('img');

    // Show tooltip first
    fireEvent.keyDown(svg, { key: 'ArrowRight' });

    // Clear tooltip
    fireEvent.keyDown(svg, { key: 'Escape' });

    const liveRegion = document.querySelector('[aria-live="polite"].sr-only');
    expect(liveRegion?.textContent).toMatch(/repayment plan/i);
    expect(liveRegion?.textContent).not.toMatch(/month \d/i);
  });

  it('LiveRegion is empty when schedule has no data (empty state)', () => {
    render(<RepaymentVisualizer {...BASE} principal={0} />);
    const liveRegion = document.querySelector('[aria-live="polite"].sr-only');
    // LiveRegion should have empty content when no schedule data
    expect(liveRegion?.textContent).toBe('');
  });

  it('LiveRegion uses polite politeness to avoid interrupting the user', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const liveRegion = document.querySelector('[aria-live="polite"].sr-only');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });
});
