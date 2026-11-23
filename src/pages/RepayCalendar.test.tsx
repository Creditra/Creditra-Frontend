import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RepayCalendar } from './RepayCalendar';
import * as icsUtils from '../utils/ics';

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

  it('renders date-only string 2025-03-01 as March 1 regardless of timezone', () => {
    render(
      <RepayCalendar
        events={[{ date: '2025-03-01', amount: 500, label: 'March payment' }]}
      />,
    );
    const timeEl = document.querySelector('time');
    expect(timeEl).not.toBeNull();
    expect(timeEl!.textContent).toMatch(/Mar\s+1|1\s+Mar/i);
    expect(timeEl!.textContent).not.toMatch(/Feb\s+28|28\s+Feb/i);
  });

  it('renders raw string fallback for invalid dates instead of Invalid Date', () => {
    render(
      <RepayCalendar
        events={[{ date: 'TBD', amount: 500, label: 'Pending date' }]}
      />,
    );
    const timeEl = document.querySelector('time');
    expect(timeEl).not.toBeNull();
    expect(timeEl!.textContent).toBe('TBD');
    expect(timeEl!.textContent).not.toContain('Invalid Date');
  });

  describe('Add to calendar (.ics export)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('exports all upcoming events and announces download in live region', () => {
      const downloadSpy = vi
        .spyOn(icsUtils, 'downloadIcs')
        .mockImplementation(() => {});

      render(
        <RepayCalendar
          events={[
            {
              date: '2026-08-01',
              amount: 1500,
              label: 'Working Capital',
              lineId: 'wc-1',
            },
            {
              date: '2026-09-01',
              amount: 750,
              label: 'Autopay Line',
              lineId: 'ap-1',
              frequency: 'monthly',
            },
          ]}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Add to calendar' }));

      expect(downloadSpy).toHaveBeenCalledTimes(1);
      const [filename, content] = downloadSpy.mock.calls[0];
      expect(filename).toBe('creditra-repayments.ics');
      expect(content).toContain('UID:wc-1-2026-08-01@creditra');
      expect(content).toContain('UID:ap-1-2026-09-01@creditra');
      expect(content).toContain('RRULE:FREQ=MONTHLY');
      expect(content).toContain('BEGIN:VALARM');

      expect(screen.getByRole('status')).toHaveTextContent(
        /Downloaded creditra-repayments\.ics with 2 payments/i,
      );
    });

    it('exports a single event when its row button is clicked', () => {
      const downloadSpy = vi
        .spyOn(icsUtils, 'downloadIcs')
        .mockImplementation(() => {});

      render(
        <RepayCalendar
          events={[
            {
              date: '2026-08-01',
              amount: 1500,
              label: 'Equipment Line',
              lineId: 'eq-1',
            },
          ]}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', { name: /Add Equipment Line on .* to calendar/i }),
      );

      expect(downloadSpy).toHaveBeenCalledTimes(1);
      const [filename, content] = downloadSpy.mock.calls[0];
      expect(filename).toBe('creditra-eq-1-2026-08-01.ics');
      expect(content).toContain('UID:eq-1-2026-08-01@creditra');
      expect(screen.getByRole('status')).toHaveTextContent(
        /Downloaded creditra-eq-1-2026-08-01\.ics/i,
      );
    });
  });
});
