/**
 * KbdHint.test.tsx
 *
 * Unit tests for the KbdHint component.
 *
 * API reference:
 *   keys        — string | string[]
 *   label?      — string   (displayed next to keys)
 *   description? — string  (sr-only text override)
 *   separator?  — '/' | '+'  (default '/')
 *   variant?    — 'inline' | 'badge'
 *   className?  — string
 *   aria-label? — string
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KbdHint } from './KbdHint';

describe('KbdHint', () => {
  // ── Core rendering ─────────────────────────────────────────────────────────

  it('renders a single key', () => {
    render(<KbdHint keys="Esc" />);
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  it('renders multiple keys', () => {
    render(<KbdHint keys={['⌘', 'K']} />);
    expect(screen.getByText('⌘')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('renders a string shorthand for keys', () => {
    render(<KbdHint keys="Tab" label="Focus next" />);
    expect(screen.getByText('Tab')).toBeInTheDocument();
    expect(screen.getByText('Focus next')).toBeInTheDocument();
  });

  it('does not render if keys is an empty array', () => {
    const { container } = render(<KbdHint keys={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  // ── Separator ─────────────────────────────────────────────────────────────

  it('renders the default "/" separator between multiple keys', () => {
    render(<KbdHint keys={['←', '→']} />);
    // separator is aria-hidden; query the DOM directly
    const separator = document.querySelector('.kbd-hint-separator');
    expect(separator).toBeInTheDocument();
    expect(separator?.textContent).toBe('/');
  });

  it('renders the "+" separator when separator prop is "+"', () => {
    render(<KbdHint keys={['Ctrl', 'K']} separator="+" />);
    const separator = document.querySelector('.kbd-hint-separator');
    expect(separator).toBeInTheDocument();
    expect(separator?.textContent).toBe('+');
  });

  it('does not render a separator for a single key', () => {
    render(<KbdHint keys={['C']} />);
    expect(document.querySelector('.kbd-hint-separator')).not.toBeInTheDocument();
  });

  // ── Screen reader text ────────────────────────────────────────────────────

  it('generates sr-only text from label and keys when no description is given', () => {
    render(<KbdHint keys={['←', '→']} label="Navigate" />);
    const srEl = document.querySelector('.sr-only');
    expect(srEl).toBeInTheDocument();
    expect(srEl?.textContent).toContain('Navigate (← →)');
  });

  it('uses a custom description as sr-only text when provided', () => {
    render(<KbdHint keys="?" description="Open help overlay" />);
    const srEl = document.querySelector('.sr-only');
    expect(srEl?.textContent).toBe('Open help overlay');
  });

  it('falls back to "Keyboard shortcut: <keys>" when no label or description', () => {
    render(<KbdHint keys="Esc" />);
    const srEl = document.querySelector('.sr-only');
    expect(srEl?.textContent).toBe('Keyboard shortcut: Esc');
  });

  // ── Accessible container attributes ──────────────────────────────────────

  it('has role="group" on the container', () => {
    render(<KbdHint keys="Enter" label="Submit" />);
    expect(screen.getByRole('group')).toBeInTheDocument();
  });

  it('applies custom aria-label when provided', () => {
    render(<KbdHint keys="Esc" aria-label="Close dialog" />);
    expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Close dialog');
  });

  // ── Variants ──────────────────────────────────────────────────────────────

  it('applies badge variant class when specified', () => {
    const { container } = render(<KbdHint keys="Tab" variant="badge" />);
    expect(container.firstChild).toHaveClass('kbd-hint-badge');
  });

  it('applies custom className to the container', () => {
    const { container } = render(<KbdHint keys="Enter" className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });

  // ── Label rendering ───────────────────────────────────────────────────────

  it('renders label text next to the key chips', () => {
    render(<KbdHint keys="Esc" label="Close" />);
    // Label is aria-hidden; use DOM directly
    const label = document.querySelector('.kbd-hint-label');
    expect(label).toBeInTheDocument();
    expect(label?.textContent).toBe('Close');
  });

  it('does not render a label element when label prop is omitted', () => {
    render(<KbdHint keys="Esc" />);
    expect(document.querySelector('.kbd-hint-label')).not.toBeInTheDocument();
  });
});
