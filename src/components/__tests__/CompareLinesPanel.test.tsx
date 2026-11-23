import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CompareLinesPanel from '../CompareLinesPanel';
import type { CreditLine } from '../../types/creditLine';
import { fmt, fmtDate } from '../../utils/tokens';

function makeCreditLine(overrides: Partial<CreditLine> = {}): CreditLine {
  return {
    id: 'CL-001',
    name: 'Primary Business Line',
    status: 'Active',
    limit: 100_000,
    utilized: 40_000,
    apr: 8.5,
    riskScore: 760,
    openedAt: '2025-01-15T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    transactions: [],
    statusHistory: [],
    ...overrides,
  };
}

describe('CompareLinesPanel', () => {
  it('renders both lines in ascending id order regardless of input order', () => {
    const lineA = makeCreditLine({ id: 'CL-001', name: 'Alpha Line', limit: 50_000, utilized: 10_000 });
    const lineB = makeCreditLine({ id: 'CL-002', name: 'Beta Line', limit: 80_000, utilized: 20_000 });

    const { container } = render(
      <CompareLinesPanel lines={[lineB, lineA]} onClose={vi.fn()} />,
    );

    expect(container.querySelector('#compare-panel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Compare Credit Lines' })).toBeInTheDocument();

    const nameLabels = screen.getAllByText('Name');
    expect(nameLabels).toHaveLength(2);
    expect(nameLabels[0].nextElementSibling).toHaveTextContent('Alpha Line');
    expect(nameLabels[1].nextElementSibling).toHaveTextContent('Beta Line');

    // Formatted values
    const limitLabels = screen.getAllByText('Limit');
    expect(limitLabels[0].nextElementSibling).toHaveTextContent(fmt(50_000));
    expect(limitLabels[1].nextElementSibling).toHaveTextContent(fmt(80_000));

    const availableLabels = screen.getAllByText('Available');
    expect(availableLabels[0].nextElementSibling).toHaveTextContent(fmt(40_000));
    expect(availableLabels[1].nextElementSibling).toHaveTextContent(fmt(60_000));

    const openedLabels = screen.getAllByText('Opened');
    expect(openedLabels[0].nextElementSibling).toHaveTextContent(fmtDate(lineA.openedAt));
    expect(openedLabels[1].nextElementSibling).toHaveTextContent(fmtDate(lineB.openedAt));
  });

  it('highlights differing fields with an accent border and leaves equal fields transparent', () => {
    const lineA = makeCreditLine({
      id: 'CL-001',
      name: 'Alpha Line',
      status: 'Active',
      limit: 100_000,
      utilized: 25_000,
      apr: 7.5,
      riskScore: 780,
      openedAt: '2025-03-01T00:00:00Z',
    });
    const lineB = makeCreditLine({
      id: 'CL-002',
      name: 'Beta Line',
      status: 'Active',
      limit: 100_000,
      utilized: 50_000,
      apr: 7.5,
      riskScore: 710,
      openedAt: '2025-03-01T00:00:00Z',
    });

    render(<CompareLinesPanel lines={[lineA, lineB]} onClose={vi.fn()} />);

    // Differing fields -> accent border
    for (const label of ['Name', 'Utilized', 'Available', 'Risk Score']) {
      const cells = screen.getAllByText(label);
      expect((cells[0].nextElementSibling as HTMLElement).style.borderLeft).toBe(
        '3px solid var(--accent)',
      );
      expect((cells[1].nextElementSibling as HTMLElement).style.borderLeft).toBe(
        '3px solid var(--accent)',
      );
    }

    // Equal fields -> transparent border
    for (const label of ['Status', 'Limit', 'APR', 'Opened']) {
      const cells = screen.getAllByText(label);
      expect((cells[0].nextElementSibling as HTMLElement).style.borderLeft).toBe(
        '3px solid transparent',
      );
      expect((cells[1].nextElementSibling as HTMLElement).style.borderLeft).toBe(
        '3px solid transparent',
      );
    }
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const lines = [makeCreditLine({ id: 'CL-001' }), makeCreditLine({ id: 'CL-002' })];

    render(<CompareLinesPanel lines={lines} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Close compare panel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('allows reaching the close button via Tab and activating it with Enter and Space', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const lines = [makeCreditLine({ id: 'CL-001' }), makeCreditLine({ id: 'CL-002' })];

    render(<CompareLinesPanel lines={lines} onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: 'Close compare panel' });
    await user.tab();
    expect(closeBtn).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const lines = [makeCreditLine({ id: 'CL-001' }), makeCreditLine({ id: 'CL-002' })];

    render(<CompareLinesPanel lines={lines} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when fewer than two lines are provided', () => {
    const { container: singleContainer } = render(
      <CompareLinesPanel lines={[makeCreditLine({ id: 'CL-001' })]} onClose={vi.fn()} />,
    );
    expect(singleContainer.firstChild).toBeNull();

    const { container: emptyContainer } = render(
      <CompareLinesPanel lines={[]} onClose={vi.fn()} />,
    );
    expect(emptyContainer.firstChild).toBeNull();
  });
});
