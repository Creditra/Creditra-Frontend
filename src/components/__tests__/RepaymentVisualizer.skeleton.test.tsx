/**
 * RepaymentVisualizer first-paint skeleton (GrantFox FWC26 / issue #609)
 *
 * Covers:
 *  - Controlled `loading` prop shows themed skeleton with a11y attributes
 *  - Chart / schedule content is absent while loading
 *  - First-paint bootstrap (loading omitted) paints skeleton then content
 *  - Skeleton composes the shared `Skeleton` primitive (shape parity)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import {
  RepaymentVisualizer,
  RepaymentVisualizerSkeleton,
} from '../RepaymentVisualizer';
import * as ReducedMotionContext from '../../context/ReducedMotionContext';

vi.spyOn(ReducedMotionContext, 'useReducedMotion').mockReturnValue({
  motionOverride: 'system',
  toggleMotionOverride: vi.fn(),
  setMotionOverride: vi.fn(),
  isReducedMotionActive: false,
});

const BASE = {
  principal: 50_000,
  apr: 7.5,
  monthlyPayment: 1_500,
};

describe('RepaymentVisualizerSkeleton', () => {
  it('announces loading with role=status, aria-busy, and accessible name', () => {
    render(<RepaymentVisualizerSkeleton />);
    const region = screen.getByRole('status', {
      name: /loading repayment plan visualizer/i,
    });
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveAttribute(
      'data-testid',
      'repayment-visualizer-skeleton',
    );
  });

  it('renders themed Skeleton placeholders including a 220px chart block', () => {
    const { container } = render(<RepaymentVisualizerSkeleton />);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
    const chart = container.querySelector('.rv-skeleton__chart') as HTMLElement;
    expect(chart).toBeInTheDocument();
    expect(chart.style.height).toBe('220px');
  });
});

describe('RepaymentVisualizer — loading / first-paint (issue #609)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the skeleton when loading={true} and hides the chart', () => {
    const { container } = render(
      <RepaymentVisualizer {...BASE} loading={true} />,
    );

    expect(
      screen.getByRole('status', {
        name: /loading repayment plan visualizer/i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Repayment Plan')).not.toBeInTheDocument();
    expect(container.querySelector('svg[role="img"]')).not.toBeInTheDocument();
  });

  it('skips the skeleton when loading={false}', () => {
    render(<RepaymentVisualizer {...BASE} loading={false} />);
    expect(screen.getByText('Repayment Plan')).toBeInTheDocument();
    expect(
      screen.queryByTestId('repayment-visualizer-skeleton'),
    ).not.toBeInTheDocument();
  });

  it('paints the skeleton on first mount, then the chart after the bootstrap timer', () => {
    const { container } = render(<RepaymentVisualizer {...BASE} />);

    expect(
      screen.getByTestId('repayment-visualizer-skeleton'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Repayment Plan')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(
      screen.queryByTestId('repayment-visualizer-skeleton'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Repayment Plan')).toBeInTheDocument();
    expect(container.querySelectorAll('.skeleton').length).toBe(0);
  });
});
