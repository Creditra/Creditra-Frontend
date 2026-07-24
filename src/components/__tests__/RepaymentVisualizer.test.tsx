import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RepaymentVisualizer } from '../RepaymentVisualizer';

const BASE = {
  principal: 100_000,
  apr: 8.5,
  monthlyPayment: 2500,
};

describe('RepaymentVisualizer', () => {
  it('renders the section heading', () => {
    render(<RepaymentVisualizer {...BASE} />);
    expect(screen.getByRole('region', { name: 'Repayment plan visualizer' })).toBeInTheDocument();
    expect(screen.getByText('Repayment Plan')).toBeInTheDocument();
  });

  it('shows empty state when principal is 0', () => {
    render(<RepaymentVisualizer {...BASE} principal={0} />);
    expect(
      screen.getByText(/Enter a valid principal/i),
    ).toBeInTheDocument();
  });

  it('shows empty state when monthlyPayment is 0', () => {
    render(<RepaymentVisualizer {...BASE} monthlyPayment={0} />);
    expect(screen.getByText(/Enter a valid principal/i)).toBeInTheDocument();
  });

  it('renders the SVG chart with accessible role', () => {
    render(<RepaymentVisualizer {...BASE} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders term and total interest summary', () => {
    render(<RepaymentVisualizer {...BASE} />);
    // summary line contains "months" and "$X total interest"
    // Use getAllByText since the SR table caption also contains these words
    expect(screen.getAllByText(/month/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/total interest/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the SR-only data table with correct headers', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const tables = screen.getAllByRole('table');
    // At least one table (SR table always present)
    expect(tables.length).toBeGreaterThanOrEqual(1);
    // SR table has required column headers
    expect(screen.getAllByRole('columnheader', { name: /Month/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: /Interest/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: /Principal/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders a legend with principal and interest labels', () => {
    render(<RepaymentVisualizer {...BASE} />);
    expect(screen.getAllByText(/Principal remaining/i).length).toBeGreaterThanOrEqual(1);
    // "Cumulative interest" appears in the legend and also as a table header
    expect(screen.getAllByText(/Cumulative interest/i).length).toBeGreaterThanOrEqual(1);
  });

  it('schedule table toggle expands visible rows', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const summary = screen.getByText(/Schedule table/i);
    // Open details
    fireEvent.click(summary);
    // Should now show a "Show all" button or visible table rows
    const tables = screen.getAllByRole('table');
    expect(tables.length).toBeGreaterThanOrEqual(2);
  });

  it('caps term at maxMonths', () => {
    // Very low payment — would take forever; capped at maxMonths=6
    render(<RepaymentVisualizer principal={100_000} apr={8.5} monthlyPayment={3000} maxMonths={6} />);
    // "6 month" appears in both the visible header and SR table caption
    expect(screen.getAllByText(/6 month/).length).toBeGreaterThanOrEqual(1);
  });

  it('has no tooltip by default', () => {
    render(<RepaymentVisualizer {...BASE} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows tooltip on mouse move over SVG', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const svg = screen.getByRole('img');
    // Simulate mousemove — jsdom won't compute getBoundingClientRect but fires the handler
    fireEvent.mouseMove(svg, { clientX: 100, clientY: 100 });
    // Tooltip should appear (role="status" aria-live)
    expect(screen.getByRole('status')).toBeInTheDocument();
    // "Month" appears in the tooltip heading AND in the SR table caption; use getAllByText
    expect(screen.getAllByText(/Month/).length).toBeGreaterThanOrEqual(1);
  });

  it('hides tooltip on mouse leave', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const svg = screen.getByRole('img');
    fireEvent.mouseMove(svg, { clientX: 100, clientY: 100 });
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.mouseLeave(svg);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

// ─── Accessibility caption / aria-label tests (chart-captions feature) ────────

describe('RepaymentVisualizer — accessible chart captions', () => {
  // ── chartAriaLabel prop ────────────────────────────────────────────────────

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
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('aria-label', customLabel);
  });

  it('changing chartAriaLabel prop updates the SVG aria-label', () => {
    const { rerender } = render(<RepaymentVisualizer {...BASE} chartAriaLabel="First label" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'First label');

    rerender(<RepaymentVisualizer {...BASE} chartAriaLabel="Second label" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Second label');
  });

  it('removing chartAriaLabel reverts the SVG to the default aria-label', () => {
    const { rerender } = render(
      <RepaymentVisualizer {...BASE} chartAriaLabel="Custom label" />,
    );
    rerender(<RepaymentVisualizer {...BASE} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Stacked area chart showing principal and cumulative interest over repayment months',
    );
  });

  // ── caption prop ───────────────────────────────────────────────────────────

  it('SR table caption is auto-generated from term and total interest when caption is omitted', () => {
    render(<RepaymentVisualizer {...BASE} />);
    // The <caption> element is inside .sr-only table; query it via the DOM
    const caption = document.querySelector('table.sr-only caption');
    expect(caption).toBeInTheDocument();
    // Auto-generated caption contains "month" and a dollar sign for total interest
    expect(caption?.textContent).toMatch(/month/i);
    expect(caption?.textContent).toMatch(/\$/);
    expect(caption?.textContent).toMatch(/total interest/i);
  });

  it('SR table caption uses the caption override when provided', () => {
    const customCaption = 'Home improvement loan — 48 months · $4,230 total interest';
    render(<RepaymentVisualizer {...BASE} caption={customCaption} />);
    const caption = document.querySelector('table.sr-only caption');
    expect(caption).toBeInTheDocument();
    expect(caption?.textContent).toBe(customCaption);
  });

  it('auto-generated caption includes the correct term length', () => {
    // maxMonths=6 forces a 6-month schedule
    render(
      <RepaymentVisualizer
        principal={100_000}
        apr={8.5}
        monthlyPayment={3000}
        maxMonths={6}
      />,
    );
    const caption = document.querySelector('table.sr-only caption');
    expect(caption?.textContent).toMatch(/6 month/i);
  });

  it('auto-generated caption uses singular "month" when termMonths is 1', () => {
    // Very small loan, very large payment → paid off in 1 month
    render(
      <RepaymentVisualizer principal={100} apr={0} monthlyPayment={1000} />,
    );
    const caption = document.querySelector('table.sr-only caption');
    // Should read "1 month" not "1 months"
    expect(caption?.textContent).toMatch(/\b1 month\b/i);
    expect(caption?.textContent).not.toMatch(/1 months/i);
  });

  // ── SR table structure ─────────────────────────────────────────────────────

  it('SR table has an aria-label "Repayment schedule data table"', () => {
    render(<RepaymentVisualizer {...BASE} />);
    expect(
      screen.getByRole('table', { name: 'Repayment schedule data table' }),
    ).toBeInTheDocument();
  });

  it('SR table is visually hidden (has sr-only class)', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const srTable = document.querySelector('table.sr-only');
    expect(srTable).toBeInTheDocument();
  });

  // ── Empty state — no chart/table rendered ─────────────────────────────────

  it('does not render the SVG or SR table when principal is 0', () => {
    render(<RepaymentVisualizer {...BASE} principal={0} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('table.sr-only')).not.toBeInTheDocument();
  });
});

// ─── Responsive breakpoints (Tailwind) tests ───────────────────────────────

describe('RepaymentVisualizer — responsive breakpoints', () => {
  it('section wrapper has responsive padding classes', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const section = screen.getByRole('region', { name: 'Repayment plan visualizer' });
    expect(section).toHaveClass('p-4', 'sm:p-5', 'md:p-6', 'lg:p-8');
  });

  it('header uses responsive flex layout', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const heading = screen.getByText('Repayment Plan');
    const header = heading.parentElement;
    expect(header).toHaveClass('flex', 'flex-col', 'sm:flex-row', 'sm:justify-between', 'mb-4', 'sm:mb-6', 'lg:mb-8', 'gap-1', 'sm:gap-4', 'lg:gap-6');
  });

  it('legend uses responsive flex layout', () => {
    render(<RepaymentVisualizer {...BASE} />);
    // Find legend container via text
    const legendItem = screen.getAllByText(/Principal remaining/i)[0];
    const legendWrapper = legendItem.parentElement;
    expect(legendWrapper).toHaveClass('flex', 'flex-wrap', 'gap-3', 'sm:gap-4', 'lg:gap-6', 'mt-3', 'sm:mt-4', 'lg:mt-6', 'text-xs', 'lg:text-sm');
  });

  it('tooltip uses responsive padding and min-width', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const svg = screen.getByRole('img');
    fireEvent.mouseMove(svg, { clientX: 100, clientY: 100 });
    const tooltip = screen.getByRole('status');
    expect(tooltip).toHaveClass('p-2', 'sm:p-3', 'lg:p-4', 'min-w-[140px]', 'sm:min-w-[160px]', 'lg:min-w-[200px]', 'text-xs', 'lg:text-sm');
  });

  it('visible table wrapper has responsive negative margin for bleed', () => {
    render(<RepaymentVisualizer {...BASE} />);
    const summary = screen.getByText(/Schedule table/i);
    fireEvent.click(summary); // Open details
    
    // Find the visible table wrapper
    const table = screen.getAllByRole('table').find((t) => !t.classList.contains('sr-only'));
    const wrapper = table?.parentElement;
    expect(wrapper).toHaveClass('overflow-x-auto', '-mx-4', 'sm:mx-0', 'px-4', 'sm:px-0');
  });
});
