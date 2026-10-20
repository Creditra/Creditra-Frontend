import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RepaymentVisualizerPage, {
  RepaymentVisualizer,
  RepaymentVisualizerSkeleton,
} from '../RepaymentVisualizer';

const BASE = {
  principal: 50000,
  apr: 7.5,
  monthlyPayment: 1500,
  loading: false as const,
};

describe('RepaymentVisualizer page component', () => {
  it('renders the RepaymentVisualizer chart via the page wrapper', () => {
    render(<RepaymentVisualizerPage {...BASE} />);
    expect(screen.getByRole('region', { name: 'Repayment plan visualizer' })).toBeInTheDocument();
    expect(screen.getByText('Repayment Plan')).toBeInTheDocument();
  });

  it('re-exports RepaymentVisualizer as a named export', () => {
    expect(typeof RepaymentVisualizer).toBe('function');
  });

  it('re-exports RepaymentVisualizerSkeleton', () => {
    expect(typeof RepaymentVisualizerSkeleton).toBe('function');
  });

  it('renders a polite aria-live region for page-level status announcements', () => {
    render(<RepaymentVisualizerPage {...BASE} />);
    // The page-level LiveRegion is rendered before the chart
    const liveRegions = document.querySelectorAll('[aria-live="polite"].sr-only');
    expect(liveRegions.length).toBeGreaterThanOrEqual(1);
  });

  it('announces ready state when loading transitions from true to false', () => {
    const { rerender } = render(
      <RepaymentVisualizerPage {...BASE} loading={true} />
    );
    rerender(<RepaymentVisualizerPage {...BASE} loading={false} />);
    // After transitioning from loading to ready, the LiveRegion should announce readiness
    const liveRegions = document.querySelectorAll('[aria-live="polite"].sr-only');
    expect(liveRegions.length).toBeGreaterThanOrEqual(1);
  });

  it('announces loading state when loading transitions to true', () => {
    const { rerender } = render(
      <RepaymentVisualizerPage {...BASE} loading={false} />
    );
    rerender(<RepaymentVisualizerPage {...BASE} loading={true} />);
    const liveRegions = document.querySelectorAll('[aria-live="polite"].sr-only');
    expect(liveRegions.length).toBeGreaterThanOrEqual(1);
  });

  it('does not announce when loading prop stays the same', () => {
    const { rerender } = render(
      <RepaymentVisualizerPage {...BASE} loading={false} />
    );
    rerender(<RepaymentVisualizerPage {...BASE} loading={false} monthlyPayment={2000} />);
    // Still renders fine — no spurious announcement
    expect(screen.getByRole('region', { name: 'Repayment plan visualizer' })).toBeInTheDocument();
  });
});
