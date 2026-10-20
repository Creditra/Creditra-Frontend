import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RepayCalendar } from './RepayCalendar';

describe('RepayCalendar', () => {
  const sampleEvents = [
    { date: '2026-08-01', amount: 1500, label: 'Monthly payment' },
    { date: '2026-09-01', amount: 1500, label: 'Monthly payment' },
  ];

  it('renders events with dates and amounts', () => {
    render(<RepayCalendar events={sampleEvents} />);
    expect(screen.getByText('Upcoming Payments')).toBeInTheDocument();
    expect(screen.getAllByText('Monthly payment').length).toBe(2);
  });

  it('renders empty state when no events', () => {
    render(<RepayCalendar events={[]} />);
    expect(screen.getByText('No upcoming payments.')).toBeInTheDocument();
  });

  it('uses aria-live="polite" region', () => {
    render(<RepayCalendar events={sampleEvents} />);
    const section = screen.getByLabelText('Repayment calendar');
    expect(section).toHaveAttribute('aria-live', 'polite');
  });

  it('renders children below the calendar', () => {
    render(
      <RepayCalendar events={sampleEvents}>
        <button>Set up autopay</button>
      </RepayCalendar>,
    );
    expect(
      screen.getByRole('button', { name: 'Set up autopay' }),
    ).toBeInTheDocument();
  });

  it('renders time elements with dateTime attributes', () => {
    render(<RepayCalendar events={sampleEvents} />);
    const times = document.querySelectorAll('time');
    expect(times.length).toBe(2);
    expect(times[0]).toHaveAttribute('dateTime', '2026-08-01');
  });

  it('does not render a status chip when status is omitted', () => {
    render(<RepayCalendar events={sampleEvents} />);
    expect(document.querySelector('.repay-calendar__status-chip')).not.toBeInTheDocument();
  });

  it('renders a labeled, pattern-classed status chip for each of the four statuses', () => {
    const events = [
      { date: '2026-08-01', amount: 100, label: 'A', status: 'paid' as const },
      { date: '2026-08-02', amount: 100, label: 'B', status: 'upcoming' as const },
      { date: '2026-08-03', amount: 100, label: 'C', status: 'due-soon' as const },
      { date: '2026-08-04', amount: 100, label: 'D', status: 'overdue' as const },
    ];
    render(<RepayCalendar events={events} />);

    expect(screen.getByText('Paid')).toHaveClass('repay-status-pattern--paid');
    expect(screen.getByText('Upcoming')).toHaveClass('repay-status-pattern--upcoming');
    expect(screen.getByText('Due soon')).toHaveClass('repay-status-pattern--due-soon');
    expect(screen.getByText('Overdue')).toHaveClass('repay-status-pattern--overdue');
  });

  it('status chips are not solely color-coded — each has a distinct visible text label', () => {
    const events = [
      { date: '2026-08-01', amount: 100, label: 'A', status: 'paid' as const },
      { date: '2026-08-02', amount: 100, label: 'B', status: 'overdue' as const },
    ];
    render(<RepayCalendar events={events} />);
    const chips = document.querySelectorAll('.repay-calendar__status-chip');
    const labels = Array.from(chips).map((chip) => chip.textContent);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
