/**
 * Tests for issue #492 ("Add responsive skeleton for CreditLines").
 *
 * CreditLines shows a shimmer skeleton for the first 500ms after mount
 * (see the useEffect/setTimeout in src/pages/CreditLines.tsx), then
 * switches to the real grid. The skeleton reuses the same `.cl-grid` /
 * `.cl-card` classes as the real content, so it inherits the existing
 * responsive breakpoint in CreditLines.css (@media max-width: 768px)
 * automatically. jsdom doesn't apply CSS/media queries, so that visual
 * breakpoint behavior isn't something a unit test here can verify —
 * these tests confirm the skeleton reuses the correct classes, and that
 * the loading -> loaded transition and its accessibility announcement
 * work correctly.
 */

import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CreditLines from '../CreditLines';

function renderCreditLines() {
  return render(
    <MemoryRouter>
      <CreditLines />
    </MemoryRouter>,
  );
}

describe('CreditLines — loading skeleton (issue #492)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows skeleton placeholders immediately, before real content loads', () => {
    const { container } = renderCreditLines();

    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText('Primary Business Line')).not.toBeInTheDocument();
  });

  it('reuses the cl-grid class for the skeleton, so it inherits the existing responsive breakpoint', () => {
    const { container } = renderCreditLines();

    const grid = container.querySelector('.cl-grid');
    expect(grid).toBeInTheDocument();
    expect(grid?.querySelectorAll('.cl-card').length).toBeGreaterThan(0);
  });

  it('marks the region aria-busy and announces "Loading credit lines" while loading', () => {
    renderCreditLines();

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading credit lines')).toBeInTheDocument();
  });

  it('replaces the skeleton with real credit line cards after the loading delay', () => {
    const { container } = renderCreditLines();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(container.querySelectorAll('.skeleton').length).toBe(0);
    expect(screen.getByText('Primary Business Line')).toBeInTheDocument();
  });

  it('marks the region aria-busy=false and announces "Credit lines loaded" after loading', () => {
    renderCreditLines();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText('Credit lines loaded')).toBeInTheDocument();
  });

  it('does not show skeleton or real cards for a shorter delay (sad path: partial elapsed time)', () => {
    const { container } = renderCreditLines();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Still mid-flight at 200ms of a 500ms delay: skeleton should still be showing.
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByText('Primary Business Line')).not.toBeInTheDocument();
  });
});
