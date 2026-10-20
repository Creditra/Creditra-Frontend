/**
 * @fileoverview Tests for src/components/Skeleton.tsx
 *
 * Covers:
 *   - Existing behaviour (class names, style props, aria attributes, shapes)
 *   - GrantFox FWC26: `variant` prop (`default` | `subtle`)
 *   - GrantFox FWC26: CSS token declarations in Skeleton.css
 *   - GrantFox FWC26 #690: shape parity — `pill` shape, radius tokens
 *   - GrantFox FWC26 #834: shape parity — `card` shape (--radius-lg)
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Skeleton } from './Skeleton';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── CSS token tests ───────────────────────────────────────────────────────

describe('Skeleton.css — themed tokens (FWC26)', () => {
  const cssPath = resolve(__dirname, './Skeleton.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('declares --skeleton-bg token using var(--border) (visible against surface)', () => {
    expect(css).toContain('--skeleton-bg');
    expect(css).toContain('--skeleton-bg: var(--border');
    expect(css).not.toMatch(/--skeleton-bg:\s*var\(--surface-raised/);
  });

  it('uses --skeleton-bg as the background-color (not a hard-coded hex)', () => {
    expect(css).toMatch(/background-color:\s*var\(--skeleton-bg\)/);
  });

  it('declares --skeleton-highlight token for the shimmer stripe', () => {
    expect(css).toContain('--skeleton-highlight');
  });

  it('uses --skeleton-highlight in the shimmer gradient', () => {
    expect(css).toContain('var(--skeleton-highlight)');
  });

  it('declares --skeleton-radius token resolved via var(--radius-md)', () => {
    expect(css).toContain('--skeleton-radius');
    // Must resolve through --radius-md so skeleton radius matches card radius
    expect(css).toContain('var(--radius-md');
  });

  // FWC26 #690: additional radius tokens for shape parity
  it('declares --skeleton-radius-sm token resolved via var(--radius-sm)', () => {
    expect(css).toContain('--skeleton-radius-sm');
    expect(css).toContain('var(--radius-sm');
  });

  it('declares --skeleton-radius-pill token resolved via var(--radius-full)', () => {
    expect(css).toContain('--skeleton-radius-pill');
    expect(css).toContain('var(--radius-full');
  });

  // FWC26 #834: card shape token for outer page-level card containers
  it('declares --skeleton-radius-card token resolved via var(--radius-lg)', () => {
    expect(css).toContain('--skeleton-radius-card');
    expect(css).toContain('var(--radius-lg');
  });

  it('suppresses shimmer animation under prefers-reduced-motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    const rmBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rmBlock).toContain('animation: none');
  });

  it('suppresses shimmer animation under [data-motion="reduced"]', () => {
    expect(css).toContain('[data-motion="reduced"]');
    const motionBlock = css.slice(css.indexOf('[data-motion="reduced"]'));
    expect(motionBlock).toContain('animation: none');
  });
});

// ── Shape parity token tests (FWC26 #690 and #834) ──────────────────────────

describe('Skeleton.css — shape parity (FWC26 #690 and #834)', () => {
  const cssPath = resolve(__dirname, './Skeleton.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('.skeleton--pill class applies var(--skeleton-radius-pill)', () => {
    expect(css).toContain('.skeleton--pill');
    const pillBlock = css.slice(css.indexOf('.skeleton--pill'));
    expect(pillBlock).toContain('var(--skeleton-radius-pill)');
  });

  it('.skeleton--rounded applies var(--skeleton-radius) matching --radius-md', () => {
    expect(css).toContain('.skeleton--rounded');
    const roundedIdx = css.lastIndexOf('.skeleton--rounded');
    const roundedBlock = css.slice(roundedIdx, css.indexOf('}', roundedIdx));
    expect(roundedBlock).toContain('var(--skeleton-radius)');
  });

  it('.skeleton--circular uses border-radius: 50%', () => {
    expect(css).toContain('.skeleton--circular');
    const circularIdx = css.indexOf('.skeleton--circular');
    const circularBlock = css.slice(circularIdx, css.indexOf('}', circularIdx));
    expect(circularBlock).toContain('border-radius: 50%');
  });

  // FWC26 #834: card shape for outer page-level card containers
  it('.skeleton--card class applies var(--skeleton-radius-card)', () => {
    expect(css).toContain('.skeleton--card');
    const cardIdx = css.indexOf('.skeleton--card');
    const cardBlock = css.slice(cardIdx, css.indexOf('}', cardIdx));
    expect(cardBlock).toContain('var(--skeleton-radius-card)');
  });
});

// ── Component behaviour tests ─────────────────────────────────────────────

describe('Skeleton', () => {
  it('renders correctly with given custom styles', () => {
    const { container } = render(
      <Skeleton width="100px" height="50px" className="custom-class" />
    );
    const element = container.firstChild as HTMLElement;

    expect(element).toBeInTheDocument();
    expect(element.className).toContain('skeleton');
    expect(element.className).toContain('custom-class');
    expect(element.style.width).toBe('100px');
    expect(element.style.height).toBe('50px');
  });

  it('applies the skeleton shape (radius token) via CSS', () => {
    render(<Skeleton data-testid="skeleton-element" />);
    const element = screen.getByTestId('skeleton-element');

    // jsdom can't reliably resolve CSS variables/computed styles,
    // so we assert the skeleton carries the class rule that defines border-radius.
    expect(element.className).toContain('skeleton');
  });

  it('spreads additional HTML attributes properly', () => {
    render(<Skeleton data-testid="skeleton-element" aria-hidden="true" />);
    const element = screen.getByTestId('skeleton-element');

    expect(element).toBeInTheDocument();
    expect(element.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies shape classes correctly', () => {
    const { container: containerRect } = render(<Skeleton shape="rectangular" />);
    expect((containerRect.firstChild as HTMLElement).className).toContain(
      'skeleton--rectangular'
    );

    const { container: containerCirc } = render(<Skeleton shape="circular" />);
    expect((containerCirc.firstChild as HTMLElement).className).toContain(
      'skeleton--circular'
    );

    const { container: containerRound } = render(<Skeleton shape="rounded" />);
    expect((containerRound.firstChild as HTMLElement).className).toContain(
      'skeleton--rounded'
    );
  });

  // FWC26 #834: card shape for outer page-level containers
  it('shape="card" applies skeleton--card class', () => {
    const { container } = render(<Skeleton shape="card" />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('skeleton--card')).toBe(true);
    expect(el.classList.contains('skeleton')).toBe(true);
  });

  it('shape="card" is mutually exclusive with other shape classes', () => {
    const { container } = render(<Skeleton shape="card" />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('skeleton--circular')).toBe(false);
    expect(el.classList.contains('skeleton--rounded')).toBe(false);
    expect(el.classList.contains('skeleton--pill')).toBe(false);
    expect(el.classList.contains('skeleton--rectangular')).toBe(false);
  });

  // FWC26 #690: pill shape for badge/chip placeholders
  it('shape="pill" applies skeleton--pill class', () => {
    const { container } = render(<Skeleton shape="pill" />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('skeleton--pill')).toBe(true);
    expect(el.classList.contains('skeleton')).toBe(true);
  });

  it('shape="pill" is mutually exclusive with other shape classes', () => {
    const { container } = render(<Skeleton shape="pill" />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('skeleton--circular')).toBe(false);
    expect(el.classList.contains('skeleton--rounded')).toBe(false);
    expect(el.classList.contains('skeleton--rectangular')).toBe(false);
  });

  // ── FWC26: variant prop ────────────────────────────────────────────────

  it('defaults to variant="default" (no skeleton--subtle class)', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('skeleton--subtle')).toBe(false);
  });

  it('variant="default" does not add skeleton--subtle class', () => {
    const { container } = render(<Skeleton variant="default" />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('skeleton--subtle')).toBe(false);
  });

  it('variant="subtle" adds skeleton--subtle class', () => {
    const { container } = render(<Skeleton variant="subtle" />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('skeleton--subtle')).toBe(true);
  });

  it('variant="subtle" still carries base skeleton class', () => {
    const { container } = render(<Skeleton variant="subtle" />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('skeleton')).toBe(true);
  });

  it('custom className is preserved alongside variant class', () => {
    const { container } = render(
      <Skeleton variant="subtle" className="my-custom" />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('skeleton--subtle')).toBe(true);
    expect(el.classList.contains('my-custom')).toBe(true);
  });

  it('style prop is merged with width/height', () => {
    const { container } = render(
      <Skeleton width="80px" height="20px" style={{ borderRadius: '50%' }} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('80px');
    expect(el.style.height).toBe('20px');
    expect(el.style.borderRadius).toBe('50%');
  });

  it('numeric width/height values are applied as-is (px assumed by React)', () => {
    const { container } = render(<Skeleton width={120} height={40} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('120px');
    expect(el.style.height).toBe('40px');
  });

  // ── FWC26 #690: shape parity — variant + shape combos ─────────────────

  it('variant="subtle" + shape="pill" applies both modifier classes', () => {
    const { container } = render(<Skeleton variant="subtle" shape="pill" />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('skeleton--pill')).toBe(true);
    expect(el.classList.contains('skeleton--subtle')).toBe(true);
    expect(el.classList.contains('skeleton')).toBe(true);
  });

  it('aria-hidden defaults to true for decorative skeleton placeholders', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    // Skeletons are decorative — screen readers should skip them
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('aria-hidden can be overridden to false for labelled skeletons', () => {
    const { container } = render(
      <Skeleton aria-hidden={false} aria-label="Loading credit lines" />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('false');
    expect(el.getAttribute('aria-label')).toBe('Loading credit lines');
  });

  // ── FWC26 #854: shape="inherit" and the `as` escape hatch ─────────────

  it('shape="inherit" applies the radius-inheriting modifier', () => {
    const { container } = render(<Skeleton shape="inherit" />);
    const el = container.firstChild as HTMLElement;
    // Used when the skeleton fills a real page element whose own rule already
    // sets the corner radius — keeps one source of truth for the shape.
    expect(el.classList.contains('skeleton--inherit')).toBe(true);
    expect(el.classList.contains('skeleton')).toBe(true);
  });

  it('renders a div by default', () => {
    const { container } = render(<Skeleton />);
    expect((container.firstChild as HTMLElement).tagName).toBe('DIV');
  });

  it('as="span" renders a span so the placeholder is valid inside phrasing content', () => {
    const { container } = render(<Skeleton as="span" />);
    expect((container.firstChild as HTMLElement).tagName).toBe('SPAN');
  });

  it('as="span" keeps every other prop behaviour identical to the div form', () => {
    const { container } = render(
      <Skeleton as="span" shape="pill" variant="subtle" width={64} height={12} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('skeleton')).toBe(true);
    expect(el.classList.contains('skeleton--pill')).toBe(true);
    expect(el.classList.contains('skeleton--subtle')).toBe(true);
    expect(el.style.width).toBe('64px');
    expect(el.style.height).toBe('12px');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('a span skeleton nests inside a paragraph without an invalid-nesting warning', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <p>
        <Skeleton as="span" width="10ch" />
      </p>
    );

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
