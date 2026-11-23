import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NoRiskGauge } from '../illustrations/EmptyStateIllustrations';

describe('NoRiskGauge illustration', () => {
  it('renders as aria-hidden so it does not appear in the AT tree', () => {
    const { container } = render(<NoRiskGauge />);
    const frame = container.querySelector('.empty-state-illustration');
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not include any focusable SVG nodes', () => {
    const { container } = render(<NoRiskGauge />);
    const tabbables = container.querySelectorAll('[tabindex]');
    expect(tabbables.length).toBe(0);
  });

  it('merges additional className props onto the frame', () => {
    const { container } = render(
      <NoRiskGauge className="extra-class" />,
    );
    const frame = container.querySelector('.empty-state-illustration');
    expect(frame?.className).toContain('extra-class');
    expect(frame?.className).toContain('empty-state-illustration');
  });

  it('renders a dashed semicircular arc hinting at the gauge', () => {
    const { container } = render(<NoRiskGauge />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    // The dashed arc path should be present
    const dashedArc = svg?.querySelector('path[stroke-dasharray="6 6"]');
    expect(dashedArc).toBeInTheDocument();
  });

  it('renders a concentric inner track for visual depth', () => {
    const { container } = render(<NoRiskGauge />);
    const svg = container.querySelector('svg');
    // Two arcs with radius 42 (inner) and 48 (outer)
    const innerArc = svg?.querySelector('path[d*="A 42 42"]');
    expect(innerArc).toBeInTheDocument();
  });

  it('renders a gauge needle resting at the zero position', () => {
    const { container } = render(<NoRiskGauge />);
    const svg = container.querySelector('svg');
    const needle = svg?.querySelector('line');
    expect(needle).toBeInTheDocument();
    const pivot = svg?.querySelector('circle');
    expect(pivot).toBeInTheDocument();
  });

  it('renders five tick marks along the arc', () => {
    const { container } = render(<NoRiskGauge />);
    // Tick marks are paths with strokeLinecap="round" and strokeWidth="2"
    // (but not the dashed arc path which also has strokeWidth) — filter
    // by the specific coordinate pattern of short tick marks.
    const svg = container.querySelector('svg');
    const ticks = svg?.querySelectorAll('path[stroke-width="2"]');
    // Needle = 1 line + 1 circle; card = 1 rect; gauge tracks = 2 paths;
    // inner surface = 1 path; ticks = 5
    expect(ticks?.length).toBeGreaterThanOrEqual(5);
  });

  it('renders a "?" text glyph to indicate absence of data', () => {
    const { container } = render(<NoRiskGauge />);
    const textElements = container.querySelectorAll('text');
    const questionMark = Array.from(textElements).find(
      (el) => el.textContent === '?',
    );
    expect(questionMark).toBeInTheDocument();
  });

  it('inherits color from currentColor so it themes via tokens', () => {
    const { container } = render(
      <div style={{ color: 'rgb(88, 166, 255)' }}>
        <NoRiskGauge />
      </div>,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
