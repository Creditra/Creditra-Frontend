import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreditLineAging } from './CreditLineAging';
import { resetClock, setClockForTests } from '../lib/clock';
import { REPAY_TEST_CREDIT_LINES } from '@/test/fixtures/repayCreditLines';
import type { CreditLine, CreditLineStatus } from '../types/creditLine';

// Fixed "today": 20 March 2025, midday local time. Built with the local-time
// constructor so the calendar day is identical in every timezone.
const FIXED_NOW = () => new Date(2025, 2, 20, 12, 0, 0);

const baseLine = REPAY_TEST_CREDIT_LINES[0];

/**
 * Build a line from the shared repay fixture. `nextPaymentDate` is cleared by
 * default so the delinquency start comes only from `statusHistory`; the
 * missed-payment rule has its own tests below.
 */
function makeLine(overrides: Partial<CreditLine> = {}): CreditLine {
  return { ...baseLine, nextPaymentDate: undefined, statusHistory: [], ...overrides };
}

describe('CreditLineAging', () => {
  beforeEach(() => {
    setClockForTests(FIXED_NOW);
  });

  afterEach(() => {
    resetClock();
  });

  describe('non-delinquent lines', () => {
    it.each<CreditLineStatus>(['Active', 'Closed', 'Frozen'])(
      'renders nothing for a %s line',
      (status) => {
        const { container } = render(
          <CreditLineAging
            line={makeLine({
              status,
              statusHistory: [{ status, date: '2025-03-01' }],
              // Overdue payment date: only the line's status keeps the tag away.
              nextPaymentDate: '2025-03-01',
            })}
          />,
        );

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByText(/days past due/)).not.toBeInTheDocument();
      },
    );

    it('renders nothing for a cured line even when its history has a past delinquency', () => {
      const { container } = render(
        <CreditLineAging
          line={makeLine({
            status: 'Active',
            statusHistory: [
              { status: 'Suspended', date: '2025-01-10' },
              { status: 'Active', date: '2025-02-01' },
            ],
            nextPaymentDate: '2025-03-01',
          })}
        />,
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('delinquent lines', () => {
    it('renders the tag for a Suspended line with the expected days and title', () => {
      render(
        <CreditLineAging
          line={makeLine({
            status: 'Suspended',
            statusHistory: [{ status: 'Suspended', date: '2025-03-05' }],
          })}
        />,
      );

      // 5 Mar -> 20 Mar = 15 calendar days
      expect(screen.getByText('15 days past due')).toBeInTheDocument();

      const tag = screen.getByTitle(/^Past due since /);
      // Locale-independent: only assert the year and day, never the month name.
      expect(tag).toHaveAttribute('title', expect.stringMatching(/2025/));
      expect(tag).toHaveAttribute('title', expect.stringMatching(/\b5\b/));
    });

    it('renders the tag for a Defaulted line, counting from the start of the episode', () => {
      render(
        <CreditLineAging
          line={makeLine({
            status: 'Defaulted',
            statusHistory: [
              { status: 'Active', date: '2025-01-01' },
              { status: 'Suspended', date: '2025-02-10' },
              { status: 'Defaulted', date: '2025-02-18' },
            ],
          })}
        />,
      );

      // Episode began when it was Suspended on 10 Feb (not the 18 Feb default):
      // 18 remaining days of February + 20 days of March = 38.
      expect(screen.getByText('38 days past due')).toBeInTheDocument();

      const tag = screen.getByTitle(/^Past due since /);
      expect(tag).toHaveAttribute('title', expect.stringMatching(/2025/));
      expect(tag).toHaveAttribute('title', expect.stringMatching(/\b10\b/));
    });

    it('uses an earlier missed payment date as the start of the aging', () => {
      render(
        <CreditLineAging
          line={makeLine({
            status: 'Suspended',
            statusHistory: [{ status: 'Suspended', date: '2025-03-10' }],
            nextPaymentDate: '2025-03-01',
          })}
        />,
      );

      // 1 Mar -> 20 Mar = 19 days, not 10 days from the suspension.
      expect(screen.getByText('19 days past due')).toBeInTheDocument();
      expect(screen.getByTitle(/^Past due since /)).toHaveAttribute(
        'title',
        expect.stringMatching(/\b1\b/),
      );
    });

    it('is deterministic: the day count follows the injected clock', () => {
      const line = makeLine({
        status: 'Suspended',
        statusHistory: [{ status: 'Suspended', date: '2025-03-05' }],
      });

      const { rerender } = render(<CreditLineAging line={line} />);
      expect(screen.getByText('15 days past due')).toBeInTheDocument();

      setClockForTests(() => new Date(2025, 2, 21, 0, 30, 0));
      rerender(<CreditLineAging line={{ ...line }} />);
      expect(screen.getByText('16 days past due')).toBeInTheDocument();
    });

    it('renders nothing when the delinquency started today (zero days past due)', () => {
      const { container } = render(
        <CreditLineAging
          line={makeLine({
            status: 'Suspended',
            statusHistory: [{ status: 'Suspended', date: '2025-03-20' }],
          })}
        />,
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when the delinquency is dated in the future', () => {
      const { container } = render(
        <CreditLineAging
          line={makeLine({
            status: 'Defaulted',
            statusHistory: [{ status: 'Defaulted', date: '2025-04-01' }],
          })}
        />,
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('missing or unusable dates', () => {
    it.each<CreditLineStatus>(['Suspended', 'Defaulted'])(
      'renders nothing for a %s line with no history and no payment date',
      (status) => {
        const { container } = render(
          <CreditLineAging line={makeLine({ status })} />,
        );

        expect(container).toBeEmptyDOMElement();
      },
    );

    it('renders nothing when the only dates are unparseable', () => {
      const { container } = render(
        <CreditLineAging
          line={makeLine({
            status: 'Suspended',
            statusHistory: [{ status: 'Suspended', date: 'not-a-date' }],
            nextPaymentDate: '2025-02-30',
          })}
        />,
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when the next payment is still in the future and there is no history', () => {
      const { container } = render(
        <CreditLineAging
          line={makeLine({ status: 'Suspended', nextPaymentDate: '2025-04-01' })}
        />,
      );

      expect(container).toBeEmptyDOMElement();
    });
  });
});
