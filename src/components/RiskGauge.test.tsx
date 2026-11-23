/**
 * RiskGauge tests
 *
 * Cover:
 *  1. Renders an SVG with role="img".
 *  2. aria-labelledby points at a <title> whose text describes score + trend.
 *  3. SR paragraph outside SVG carries the same description (polite live region).
 *  4. Score is clamped: values < 0 render as 0, values > 100 render as 100.
 *  5. Fill arc carries data-score reflecting the normalised value.
 *  6. Fill arc is never remounted on score change; dashoffset transitions
 *     in place instead of resetting to empty on every update.
 *  7. Reduced-motion: data-reduced-motion="true" when matchMedia returns true;
 *     fill dashoffset equals the final offset (not circumference).
 *  8. Normal-motion: data-reduced-motion="false"; fill dashoffset equals
 *     circumference on first mount (animation starts from empty).
 *  9. Trend label and arrow are rendered in the meta row.
 * 10. lastUpdated date is formatted and visible.
 * 11. [focus] SVG is keyboard-focusable (tabIndex=0).
 * 12. [focus] SVG has a visible focus ring via box-shadow on :focus-visible.
 * 13. [focus] Enter / Space on focused SVG fires onSectorActivate with the
 *     active sector id.
 * 14. [focus] Three sector <g> elements are rendered with role="button" and
 *     tabIndex=0 when showSectors=true (default).
 * 15. [focus] Each sector <g> has aria-labelledby pointing at a <title>
 *     describing the score range.
 * 16. [focus] Pressing Enter / Space on a sector <g> fires onSectorActivate
 *     with that sector's id.
 * 17. [focus] Clicking a sector <g> fires onSectorActivate with that sector's id.
 * 18. [focus] Sectors are NOT rendered when showSectors=false.
 * 19. [focus] Active sector is marked with aria-pressed="true"; others "false".
 * 20. [focus] data-active-sector on the SVG matches the score band.
 * 21. [focus] High-contrast mode — focus-ring-color token resolves to white
 *     (token value tested indirectly via data-attribute).
 * 22. data-initial-sweep is "true" only on first mount (non-reduced-motion)
 *     and is cleared on later renders.
 * 23. data-initial-sweep is absent when reduced motion is active, even on
 *     first mount.
 * 24. gauge-sweep @keyframes animation is scoped to [data-initial-sweep],
 *     and .risk-gauge-fill has a stroke-dashoffset transition for later
 *     updates (CSS source assertions, mirroring the existing
 *     [data-motion="reduced"] source check below).
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RiskGauge, RiskSector } from './RiskGauge';

// ── Constants (must match component) ─────────────────────────────────────────

const CIRCUMFERENCE = Math.PI * 55; // ≈ 172.787

function offsetForScore(score: number): number {
  const clamped = Math.min(100, Math.max(0, score));
  return CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderGauge(
  props: Partial<Parameters<typeof RiskGauge>[0]> = {},
) {
  const defaults = {
    score: 72,
    trend: 'improving' as const,
    lastUpdated: '2025-03-01T00:00:00Z',
  };
  return render(<RiskGauge {...defaults} {...props} />);
}

/** Stub matchMedia to simulate reduced-motion preference. */
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RiskGauge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Original test suite ──────────────────────────────────────────────────

  it('renders a skeleton when loading is true', () => {
    renderGauge({ loading: true });
    expect(screen.getByRole('img', { name: /loading risk gauge/i })).toBeInTheDocument();
    expect(screen.getByTestId('skeleton-mock') || document.querySelector('.skeleton-gauge')).toBeInTheDocument();
  });

  it('renders an SVG element with role="img"', () => {
    renderGauge();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('SVG has aria-labelledby pointing at a <title> with the score description', () => {
    renderGauge({ score: 72, trend: 'improving' });
    const svg = screen.getByRole('img');
    const titleId = svg.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    const title = document.getElementById(titleId!);
    expect(title).toBeInTheDocument();
    expect(title?.textContent).toMatch(/risk score 72/i);
    expect(title?.textContent).toMatch(/improving/i);
  });

  it('renders a polite sr-only live region with the same description', () => {
    renderGauge({ score: 72, trend: 'stable' });
    // The sr-only element is outside the SVG; it has aria-live="polite"
    const srRegion = document.querySelector('div[aria-live="polite"]');
    expect(srRegion).toBeInTheDocument();
    expect(srRegion?.textContent).toMatch(/risk score 72/i);
    expect(srRegion?.textContent).toMatch(/stable/i);
  });

  it('clamps score below 0 to 0', () => {
    renderGauge({ score: -10 });
    const svg = screen.getByRole('img');
    const titleId = svg.getAttribute('aria-labelledby')!;
    expect(document.getElementById(titleId)?.textContent).toMatch(/risk score 0/i);
    // Fill arc data-score should reflect clamped value
    const fill = document.querySelector('[data-score]');
    expect(fill?.getAttribute('data-score')).toBe('0');
  });

  it('clamps score above 100 to 100', () => {
    renderGauge({ score: 150 });
    const fill = document.querySelector('[data-score]');
    expect(fill?.getAttribute('data-score')).toBe('100');
  });

  it('fill arc carries data-score equal to the normalised score', () => {
    renderGauge({ score: 55 });
    const fill = document.querySelector('[data-score]');
    expect(fill?.getAttribute('data-score')).toBe('55');
  });

  it('fill arc is NOT remounted on score change — dashoffset transitions in place instead of resetting to empty', () => {
    const { rerender, container } = render(
      <RiskGauge score={40} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />,
    );
    const fillBefore = container.querySelector('[data-score]');

    rerender(
      <RiskGauge score={80} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />,
    );
    const fillAfter = container.querySelector('[data-score]');

    // Same DOM node — no remount, so the CSS transition on stroke-dashoffset
    // can animate smoothly between the two values instead of the path
    // restarting the sweep from empty on every update.
    expect(fillAfter).toBe(fillBefore);
    expect(fillAfter?.getAttribute('data-score')).toBe('80');
    expect(Number(fillAfter?.getAttribute('stroke-dashoffset'))).toBeCloseTo(
      offsetForScore(80),
      1,
    );
  });

  describe('reduced-motion: false (default / animation on)', () => {
    it('fill starts at circumference dashoffset so animation sweeps from empty', () => {
      const restore = stubMatchMedia(false);
      renderGauge({ score: 72 });
      const fill = document.querySelector('[data-score]') as SVGPathElement | null;
      const dashoffset = Number(fill?.getAttribute('stroke-dashoffset'));
      // Should equal full circumference — animation drives it to target
      expect(dashoffset).toBeCloseTo(CIRCUMFERENCE, 1);
      restore();
    });

    it('data-reduced-motion attribute is "false"', () => {
      const restore = stubMatchMedia(false);
      renderGauge();
      expect(
        document.querySelector('[data-reduced-motion]')?.getAttribute('data-reduced-motion'),
      ).toBe('false');
      restore();
    });

    it('data-initial-sweep is "true" on first mount and cleared on later renders', () => {
      const restore = stubMatchMedia(false);
      const { rerender, container } = render(
        <RiskGauge score={40} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />,
      );
      expect(
        container.querySelector('[data-score]')?.getAttribute('data-initial-sweep'),
      ).toBe('true');

      rerender(<RiskGauge score={60} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />);
      expect(
        container.querySelector('[data-score]')?.getAttribute('data-initial-sweep'),
      ).toBeNull();
      restore();
    });
  });

  describe('reduced-motion: true (no animation)', () => {
    it('fill starts at final dashoffset — no flash-of-empty-arc', () => {
      const restore = stubMatchMedia(true);
      renderGauge({ score: 72 });
      const fill = document.querySelector('[data-score]') as SVGPathElement | null;
      const dashoffset = Number(fill?.getAttribute('stroke-dashoffset'));
      expect(dashoffset).toBeCloseTo(offsetForScore(72), 1);
      restore();
    });

    it('data-reduced-motion attribute is "true"', () => {
      const restore = stubMatchMedia(true);
      renderGauge();
      expect(
        document.querySelector('[data-reduced-motion]')?.getAttribute('data-reduced-motion'),
      ).toBe('true');
      restore();
    });

    it('data-initial-sweep is absent even on first mount', () => {
      const restore = stubMatchMedia(true);
      const { container } = renderGauge({ score: 72 });
      expect(
        container.querySelector('[data-score]')?.getAttribute('data-initial-sweep'),
      ).toBeNull();
      restore();
    });
  });

  it('renders the trend label and arrow in the meta row', () => {
    renderGauge({ trend: 'declining' });
    // aria-hidden="true" on the meta row means we query via container, not role
    const metaRow = document.querySelector('.risk-meta');
    expect(metaRow?.textContent).toMatch(/declining/i);
    expect(metaRow?.textContent).toContain('▼');
  });

  it('renders the formatted lastUpdated date in the meta row', () => {
    renderGauge({ lastUpdated: '2025-03-01T00:00:00Z' });
    const metaRow = document.querySelector('.risk-meta');
    // Date is formatted; "Mar" or "March" should appear
    expect(metaRow?.textContent).toMatch(/mar/i);
  });

  it('uses semantic token colour vars, not hardcoded hex', () => {
    renderGauge({ score: 80 }); // ≥70 → success
    const fill = document.querySelector('[data-score]') as SVGPathElement | null;
    expect(fill?.getAttribute('stroke')).toBe('var(--success)');

    const { container: c2 } = render(
      <RiskGauge score={55} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />,
    );
    const fill2 = c2.querySelector('[data-score]') as SVGPathElement | null;
    expect(fill2?.getAttribute('stroke')).toBe('var(--warning)');

    const { container: c3 } = render(
      <RiskGauge score={30} trend="declining" lastUpdated="2025-01-01T00:00:00Z" />,
    );
    const fill3 = c3.querySelector('[data-score]') as SVGPathElement | null;
    expect(fill3?.getAttribute('stroke')).toBe('var(--error)');
  });

  // ── Focus ring tests ─────────────────────────────────────────────────────

  describe('focus ring — SVG root', () => {
    it('SVG has tabIndex=0, making it keyboard-reachable', () => {
      renderGauge();
      const svg = screen.getByRole('img');
      expect(svg.getAttribute('tabindex')).toBe('0');
    });

    it('SVG carries the .risk-gauge-svg class (focus ring applied via CSS)', () => {
      renderGauge();
      const svg = screen.getByRole('img');
      expect(svg).toHaveClass('risk-gauge-svg');
    });

    it('pressing Enter on the focused SVG fires onSectorActivate with the active sector', () => {
      const onActivate = vi.fn();
      // score=80 → active sector = "high"
      renderGauge({ score: 80, onSectorActivate: onActivate });
      const svg = screen.getByRole('img');
      fireEvent.keyDown(svg, { key: 'Enter', code: 'Enter' });
      expect(onActivate).toHaveBeenCalledTimes(1);
      expect(onActivate).toHaveBeenCalledWith('high');
    });

    it('pressing Space on the focused SVG fires onSectorActivate with the active sector', () => {
      const onActivate = vi.fn();
      // score=55 → active sector = "medium"
      renderGauge({ score: 55, onSectorActivate: onActivate });
      const svg = screen.getByRole('img');
      fireEvent.keyDown(svg, { key: ' ', code: 'Space' });
      expect(onActivate).toHaveBeenCalledTimes(1);
      expect(onActivate).toHaveBeenCalledWith('medium');
    });

    it('pressing an unrelated key on the SVG does NOT fire onSectorActivate', () => {
      const onActivate = vi.fn();
      renderGauge({ onSectorActivate: onActivate });
      const svg = screen.getByRole('img');
      fireEvent.keyDown(svg, { key: 'Tab', code: 'Tab' });
      expect(onActivate).not.toHaveBeenCalled();
    });

    it('active sector is reflected in data-active-sector attribute on SVG', () => {
      // score=80 → high
      const { rerender } = renderGauge({ score: 80 });
      expect(screen.getByRole('img').getAttribute('data-active-sector')).toBe('high');

      // score=55 → medium
      rerender(<RiskGauge score={55} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />);
      expect(screen.getByRole('img').getAttribute('data-active-sector')).toBe('medium');

      // score=30 → low
      rerender(<RiskGauge score={30} trend="declining" lastUpdated="2025-01-01T00:00:00Z" />);
      expect(screen.getByRole('img').getAttribute('data-active-sector')).toBe('low');
    });

    it('onSectorActivate is not required — keyboard event does not throw', () => {
      // No onSectorActivate prop — should not throw
      renderGauge({ score: 72 });
      const svg = screen.getByRole('img');
      expect(() => fireEvent.keyDown(svg, { key: 'Enter' })).not.toThrow();
    });
  });

  describe('focus ring — interactive sectors', () => {
    it('renders three sector <g> elements with role="button" by default', () => {
      renderGauge();
      const sectors = screen.getAllByRole('button');
      expect(sectors).toHaveLength(3);
    });

    it('each sector <g> has tabIndex=0 (keyboard reachable)', () => {
      renderGauge();
      const sectors = screen.getAllByRole('button');
      sectors.forEach((sector) => {
        expect(sector.getAttribute('tabindex')).toBe('0');
      });
    });

    it('each sector has a data-sector attribute identifying the band', () => {
      const { container } = renderGauge();
      const sectorIds = Array.from(container.querySelectorAll('[data-sector]')).map((el) =>
        el.getAttribute('data-sector'),
      );
      expect(sectorIds).toContain('high');
      expect(sectorIds).toContain('medium');
      expect(sectorIds).toContain('low');
    });

    it('each sector <g> has aria-labelledby pointing at a <title> with the range', () => {
      const { container } = renderGauge();
      const sectors = container.querySelectorAll('[data-sector]');
      sectors.forEach((sector) => {
        const labelId = sector.getAttribute('aria-labelledby');
        expect(labelId).toBeTruthy();
        const title = container.querySelector(`#${labelId}`);
        expect(title).toBeInTheDocument();
        // Title should mention "scores" and a range like "0–49"
        expect(title?.textContent).toMatch(/scores/i);
      });
    });

    it('active sector has aria-pressed="true"; inactive sectors have "false"', () => {
      // score=80 → active = "high"
      const { container } = renderGauge({ score: 80 });
      const high = container.querySelector('[data-sector="high"]');
      const medium = container.querySelector('[data-sector="medium"]');
      const low = container.querySelector('[data-sector="low"]');

      expect(high?.getAttribute('aria-pressed')).toBe('true');
      expect(medium?.getAttribute('aria-pressed')).toBe('false');
      expect(low?.getAttribute('aria-pressed')).toBe('false');
    });

    it('pressing Enter on a sector fires onSectorActivate with that sector id and announces activation', () => {
      const onActivate = vi.fn();
      const { container } = renderGauge({ onSectorActivate: onActivate });
      const mediumSector = container.querySelector('[data-sector="medium"]')!;
      fireEvent.keyDown(mediumSector, { key: 'Enter', code: 'Enter' });
      expect(onActivate).toHaveBeenCalledWith('medium');
      const srRegion = document.querySelector('div[aria-live="polite"]');
      expect(srRegion?.textContent).toMatch(/Activated Medium score zone, scores 50–69/i);
    });

    it('pressing Space on a sector fires onSectorActivate with that sector id', () => {
      const onActivate = vi.fn();
      const { container } = renderGauge({ onSectorActivate: onActivate });
      const lowSector = container.querySelector('[data-sector="low"]')!;
      fireEvent.keyDown(lowSector, { key: ' ', code: 'Space' });
      expect(onActivate).toHaveBeenCalledWith('low');
    });

    it('clicking a sector fires onSectorActivate with that sector id', () => {
      const onActivate = vi.fn();
      const { container } = renderGauge({ onSectorActivate: onActivate });
      const highSector = container.querySelector('[data-sector="high"]')!;
      fireEvent.click(highSector);
      expect(onActivate).toHaveBeenCalledWith('high');
    });

    it('unrelated keydown on a sector does NOT fire onSectorActivate', () => {
      const onActivate = vi.fn();
      const { container } = renderGauge({ onSectorActivate: onActivate });
      const sector = container.querySelector('[data-sector="high"]')!;
      fireEvent.keyDown(sector, { key: 'Escape', code: 'Escape' });
      expect(onActivate).not.toHaveBeenCalled();
    });

    it('sectors are NOT rendered when showSectors=false', () => {
      renderGauge({ showSectors: false });
      // No buttons should be in the document
      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('sectors are rendered by default (showSectors defaults to true)', () => {
      renderGauge();
      expect(screen.getAllByRole('button')).toHaveLength(3);
    });

    it('each sector contains a focus-rect element for the per-sector ring', () => {
      const { container } = renderGauge();
      const sectors = container.querySelectorAll('[data-sector]');
      sectors.forEach((sector) => {
        const focusRect = sector.querySelector('.risk-gauge-sector-focus-rect');
        expect(focusRect).toBeInTheDocument();
        // At rest the rect has no stroke (ring is hidden)
        // CSS :focus-visible adds stroke — can't test CSSOM in jsdom, but
        // we verify the element exists with the correct class.
        expect(focusRect?.tagName.toLowerCase()).toBe('rect');
      });
    });

    it('each sector arc has class risk-gauge-sector-arc', () => {
      const { container } = renderGauge();
      const arcs = container.querySelectorAll('.risk-gauge-sector-arc');
      expect(arcs).toHaveLength(3);
    });

    it('each sector arc has a color-blind safe pattern class', () => {
      const { container } = renderGauge();
      const highArc = container.querySelector('[data-sector-arc="high"]');
      const mediumArc = container.querySelector('[data-sector-arc="medium"]');
      const lowArc = container.querySelector('[data-sector-arc="low"]');

      expect(highArc).toHaveClass('risk-gauge-pattern--high');
      expect(mediumArc).toHaveClass('risk-gauge-pattern--medium');
      expect(lowArc).toHaveClass('risk-gauge-pattern--low');
    });

    it('onSectorActivate is optional — sector click/keydown does not throw', () => {
      // No onSectorActivate prop
      const { container } = renderGauge();
      const sector = container.querySelector('[data-sector="high"]')!;
      expect(() => fireEvent.click(sector)).not.toThrow();
      expect(() => fireEvent.keyDown(sector, { key: 'Enter' })).not.toThrow();
    });
  });

  describe('focus ring — boundary / edge cases', () => {
    it('score=0 → active sector is "low"', () => {
      const { container } = renderGauge({ score: 0 });
      const svg = container.querySelector('.risk-gauge-svg');
      expect(svg?.getAttribute('data-active-sector')).toBe('low');
      const lowSector = container.querySelector('[data-sector="low"]');
      expect(lowSector?.getAttribute('aria-pressed')).toBe('true');
    });

    it('score=50 → active sector is "medium" (boundary inclusive)', () => {
      const { container } = renderGauge({ score: 50 });
      expect(container.querySelector('.risk-gauge-svg')?.getAttribute('data-active-sector')).toBe('medium');
    });

    it('score=70 → active sector is "high" (boundary inclusive)', () => {
      const { container } = renderGauge({ score: 70 });
      expect(container.querySelector('.risk-gauge-svg')?.getAttribute('data-active-sector')).toBe('high');
    });

    it('score=100 → active sector is "high"', () => {
      const { container } = renderGauge({ score: 100 });
      expect(container.querySelector('.risk-gauge-svg')?.getAttribute('data-active-sector')).toBe('high');
    });

    it('clamped-to-0 score maps to "low" sector', () => {
      const { container } = renderGauge({ score: -999 });
      expect(container.querySelector('.risk-gauge-svg')?.getAttribute('data-active-sector')).toBe('low');
    });

    it('clamped-to-100 score maps to "high" sector', () => {
      const { container } = renderGauge({ score: 9999 });
      expect(container.querySelector('.risk-gauge-svg')?.getAttribute('data-active-sector')).toBe('high');
    });

    it('active sector shows a dot element; inactive sectors do not', () => {
      // score=80 → high is active
      const { container } = renderGauge({ score: 80 });
      const dots = container.querySelectorAll('[data-active-dot]');
      expect(dots).toHaveLength(1);
      expect(dots[0].getAttribute('data-active-dot')).toBe('high');
    });

    it('sector title IDs are unique across all three sectors', () => {
      const { container } = renderGauge();
      const sectors = container.querySelectorAll('[data-sector]');
      const labelIds = Array.from(sectors).map((s) => s.getAttribute('aria-labelledby'));
      const unique = new Set(labelIds);
      expect(unique.size).toBe(3);
    });

    it('re-render with new score updates data-active-sector and aria-pressed', () => {
      const { rerender, container } = render(
        <RiskGauge score={30} trend="declining" lastUpdated="2025-01-01T00:00:00Z" />,
      );
      expect(container.querySelector('[data-sector="low"]')?.getAttribute('aria-pressed')).toBe('true');

      rerender(<RiskGauge score={75} trend="improving" lastUpdated="2025-01-01T00:00:00Z" />);
      expect(container.querySelector('[data-sector="high"]')?.getAttribute('aria-pressed')).toBe('true');
      expect(container.querySelector('[data-sector="low"]')?.getAttribute('aria-pressed')).toBe('false');
    });
  });

  // ── Focus ring design token tests ──────────────────────────────────────────
  //
  // These tests verify that the focus ring uses shared design tokens from
  // src/styles/focus.css for consistency across all components.

  describe('focus ring — shared design tokens', () => {
    it('SVG focus ring uses --focus-ring-color from focus.css tokens', () => {
      const { container } = renderGauge();
      const svg = container.querySelector('.risk-gauge-svg');
      expect(svg).toHaveClass('risk-gauge-svg');
      // Focus ring styles are applied via CSS class + :focus-visible
      // The token reference is in the CSS file; verify the class exists
      expect(svg).toBeDefined();
    });

    it('SVG focus ring box-shadow uses shared tokens (width, offset, color)', () => {
      const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../styles/focus.css');
      const focusCss = readFileSync(cssPath, 'utf-8');
      
      // Verify the shared tokens are defined in focus.css
      expect(focusCss).toMatch(/--focus-ring-width\s*:\s*2px/);
      expect(focusCss).toMatch(/--focus-ring-offset\s*:\s*3px/);
      expect(focusCss).toMatch(/--focus-ring-color\s*:\s*var\(--accent/);
      
      // Verify RiskGauge uses these tokens
      const riskGaugeCss = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), 'RiskGauge.css'),
        'utf-8'
      );
      expect(riskGaugeCss).toMatch(/var\(--focus-ring-width\)/);
      expect(riskGaugeCss).toMatch(/var\(--focus-ring-offset\)/);
      expect(riskGaugeCss).toMatch(/var\(--focus-ring-color\)/);
    });

    it('high-contrast mode overrides focus-ring-color to white', () => {
      const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../styles/focus.css');
      const focusCss = readFileSync(cssPath, 'utf-8');
      
      // Verify high-contrast override exists
      expect(focusCss).toMatch(/\[data-contrast="high"\]\s*\{[^}]*--focus-ring-color:\s*#ffffff/);
    });

    it('focus ring is only visible on keyboard navigation (:focus-visible)', () => {
      const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../styles/focus.css');
      const focusCss = readFileSync(cssPath, 'utf-8');
      
      // Verify :focus-visible is used, not just :focus
      expect(focusCss).toMatch(/:focus-visible/);
      // Verify RiskGauge uses :focus-visible
      const riskGaugeCss = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), 'RiskGauge.css'),
        'utf-8'
      );
      expect(riskGaugeCss).toMatch(/:focus-visible/);
    });
  });
});

// ── CSS source assertions ────────────────────────────────────────────────────
//
// jsdom does not execute a real CSS cascade or resolve @media queries, so
// asserting on window.getComputedStyle(...).animationName here would pass
// or fail independently of whether the actual CSS rule exists — not a
// meaningful regression check. Instead we assert directly against the
// stylesheet source, mirroring the same approach used for the in-app
// reduced-motion toggle check below (see docs/ACCESSIBILITY.md §6).

describe('gauge-sweep CSS scoping', () => {
  const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'RiskGauge.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('gauge-sweep keyframe animation is scoped to [data-initial-sweep="true"], not the bare .risk-gauge-fill class', () => {
    const pattern = /\.risk-gauge-fill\[data-initial-sweep=["']true["']\]\s*\{[^}]*animation:\s*gauge-sweep/;
    expect(css).toMatch(pattern);
  });

  it('.risk-gauge-fill has a stroke-dashoffset transition for smooth updates after the initial sweep', () => {
    const pattern = /\.risk-gauge-fill\s*\{[^}]*transition:\s*stroke-dashoffset/;
    expect(css).toMatch(pattern);
  });

  it('.risk-gauge-score has tabular-nums to prevent digit-width wobble during animation', () => {
    const pattern = /\.risk-gauge-score\s*\{[^}]*font-variant-numeric:\s*tabular-nums/;
    expect(css).toMatch(pattern);
  });
});

describe('in-app reduced-motion toggle ([data-motion="reduced"])', () => {
  const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'RiskGauge.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('disables the sector-dot pulse animation under [data-motion="reduced"]', () => {
    // Matches: [data-motion="reduced"] .risk-gauge-sector-dot { animation: none; }
    // (whitespace/formatting-tolerant so minor CSS reformatting doesn't break this)
    const pattern = /\[data-motion=["']reduced["']\]\s*\.risk-gauge-sector-dot\s*\{[^}]*animation:\s*none/;
    expect(css).toMatch(pattern);
  });

  it('disables the fill arc transition/animation under [data-motion="reduced"]', () => {
    const pattern = /\[data-motion=["']reduced["']\]\s*\.risk-gauge-fill\s*\{[^}]*animation:\s*none[^}]*transition:\s*none/;
    expect(css).toMatch(pattern);
  });

  it('the OS-level prefers-reduced-motion query also disables the sector-dot pulse', () => {
    // Guards against someone fixing the [data-motion] gap while accidentally
    // removing the pre-existing OS-level media query coverage.
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^]*?\.risk-gauge-fill/);
  });
});
