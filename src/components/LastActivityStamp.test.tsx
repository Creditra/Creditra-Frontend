import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { LastActivityStamp } from './LastActivityStamp';

// ─── Fixture ─────────────────────────────────────────────────────────────────
//
// A fixed "now" makes every assertion deterministic without faking the clock.
const NOW = new Date('2025-07-25T13:00:00Z');

// 3 minutes before NOW → relative label should include "3 minutes"
const THREE_MINUTES_AGO = new Date(NOW.getTime() - 3 * 60 * 1000).toISOString();

// 2 hours before NOW → relative label should include "2 hours"
const TWO_HOURS_AGO = new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString();

// Same day, 5 seconds before NOW → "just now"
const JUST_NOW = new Date(NOW.getTime() - 5 * 1000).toISOString();

// 2 days before NOW → absolute-style date (e.g. "Jul 23")
const TWO_DAYS_AGO = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

// ─────────────────────────────────────────────────────────────────────────────

describe('LastActivityStamp', () => {
  // ── Relative label rendering ─────────────────────────────────────────────

  describe('relative label', () => {
    it('renders the "Last activity:" prefix', () => {
      render(<LastActivityStamp timestamp={THREE_MINUTES_AGO} now={NOW} />);
      expect(screen.getByText(/Last activity:/i)).toBeInTheDocument();
    });

    it('shows "3 minutes ago" for a timestamp 3 minutes in the past', () => {
      render(<LastActivityStamp timestamp={THREE_MINUTES_AGO} now={NOW} />);
      expect(screen.getByText(/3 minutes ago/i)).toBeInTheDocument();
    });

    it('shows "2 hours ago" for a timestamp 2 hours in the past', () => {
      render(<LastActivityStamp timestamp={TWO_HOURS_AGO} now={NOW} />);
      expect(screen.getByText(/2 hours ago/i)).toBeInTheDocument();
    });

    it('shows "just now" for a very recent timestamp (< 10 s)', () => {
      render(<LastActivityStamp timestamp={JUST_NOW} now={NOW} />);
      expect(screen.getByText(/just now/i)).toBeInTheDocument();
    });

    it('shows an absolute date for timestamps older than 48 h', () => {
      render(<LastActivityStamp timestamp={TWO_DAYS_AGO} now={NOW} />);
      // formatRelative returns "Jul 23" for same-year, > 48 h
      // The label appears in both the relative span and inside the tooltip ("Jul 23, 2025 …")
      // Scope to the specific relative span to avoid ambiguity.
      const relativeSpan = document
        .querySelector('.last-activity-stamp__relative');
      expect(relativeSpan).not.toBeNull();
      expect(relativeSpan!.textContent).toMatch(/jul 23/i);
    });

    it('accepts a Date object as well as an ISO string', () => {
      const dateObj = new Date(THREE_MINUTES_AGO);
      render(<LastActivityStamp timestamp={dateObj} now={NOW} />);
      expect(screen.getByText(/3 minutes ago/i)).toBeInTheDocument();
    });
  });

  // ── <time> element semantics ─────────────────────────────────────────────

  describe('<time> element', () => {
    it('renders a <time> element', () => {
      const { container } = render(
        <LastActivityStamp timestamp={THREE_MINUTES_AGO} now={NOW} />,
      );
      expect(container.querySelector('time')).toBeInTheDocument();
    });

    it('sets a machine-readable dateTime attribute on the <time> element', () => {
      const { container } = render(
        <LastActivityStamp timestamp={THREE_MINUTES_AGO} now={NOW} />,
      );
      const timeEl = container.querySelector('time');
      // Must be a valid ISO 8601 datetime
      expect(timeEl).toHaveAttribute('dateTime');
      const dt = timeEl!.getAttribute('dateTime')!;
      expect(new Date(dt).toISOString()).toBe(dt);
    });

    it('the <time> carries the full accessible label for screen readers', () => {
      render(<LastActivityStamp timestamp={THREE_MINUTES_AGO} now={NOW} />);
      // The aria-label must include the relative string
      const timeEl = screen.getByLabelText(/last activity: 3 minutes ago/i);
      expect(timeEl.tagName).toBe('TIME');
    });
  });

  // ── Tooltip ──────────────────────────────────────────────────────────────

  describe('tooltip', () => {
    it('renders a tooltip element with role="tooltip"', () => {
      render(<LastActivityStamp timestamp={THREE_MINUTES_AGO} now={NOW} />);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('shows the absolute datetime string in the tooltip', () => {
      render(<LastActivityStamp timestamp={THREE_MINUTES_AGO} now={NOW} />);
      const tooltip = screen.getByRole('tooltip');
      // Should contain the formatted absolute datetime
      // e.g. "Jul 25, 2025, 12:57 AM" — we check for the year as a stable token
      expect(tooltip.textContent).toMatch(/2025/);
    });

    it('wires the trigger to the tooltip via aria-describedby', () => {
      render(<LastActivityStamp timestamp={THREE_MINUTES_AGO} now={NOW} />);
      const trigger = screen.getByRole('button', {
        name: /show exact date and time/i,
      });
      const tooltip = screen.getByRole('tooltip');
      expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
    });

    it('trigger is keyboard focusable (tabIndex=0)', () => {
      render(<LastActivityStamp timestamp={THREE_MINUTES_AGO} now={NOW} />);
      const trigger = screen.getByRole('button', {
        name: /show exact date and time/i,
      });
      expect(trigger).toHaveAttribute('tabindex', '0');
    });

    it('trigger receives focus when tabbed to', async () => {
      const user = userEvent.setup();
      render(<LastActivityStamp timestamp={THREE_MINUTES_AGO} now={NOW} />);
      const trigger = screen.getByRole('button', {
        name: /show exact date and time/i,
      });
      await user.tab();
      expect(trigger).toHaveFocus();
    });
  });

  // ── Additional className prop ────────────────────────────────────────────

  describe('className prop', () => {
    it('applies the root class and the extra className', () => {
      const { container } = render(
        <LastActivityStamp
          timestamp={THREE_MINUTES_AGO}
          now={NOW}
          className="custom-class"
        />,
      );
      const root = container.firstChild as HTMLElement;
      expect(root).toHaveClass('last-activity-stamp');
      expect(root).toHaveClass('custom-class');
    });

    it('does not add spurious classes when className is omitted', () => {
      const { container } = render(
        <LastActivityStamp timestamp={THREE_MINUTES_AGO} now={NOW} />,
      );
      const root = container.firstChild as HTMLElement;
      expect(root).toHaveClass('last-activity-stamp');
      // className attribute should only contain the base class
      expect(root.className.trim()).toBe('last-activity-stamp');
    });
  });

  // ── SVG icon ─────────────────────────────────────────────────────────────

  describe('clock icon', () => {
    it('renders an SVG clock icon', () => {
      const { container } = render(
        <LastActivityStamp timestamp={THREE_MINUTES_AGO} now={NOW} />,
      );
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('marks the SVG as aria-hidden so screen readers skip it', () => {
      const { container } = render(
        <LastActivityStamp timestamp={THREE_MINUTES_AGO} now={NOW} />,
      );
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles a timestamp equal to now gracefully (just now)', () => {
      render(<LastActivityStamp timestamp={NOW.toISOString()} now={NOW} />);
      expect(screen.getByText(/just now/i)).toBeInTheDocument();
    });

    it('falls back gracefully when lastActivityAt is undefined — caller provides updatedAt', () => {
      // Simulates the CreditLines.tsx usage: line.lastActivityAt ?? line.updatedAt
      const updatedAt = TWO_HOURS_AGO;
      render(
        <LastActivityStamp timestamp={updatedAt} now={NOW} />,
      );
      expect(screen.getByText(/2 hours ago/i)).toBeInTheDocument();
    });
  });
});
