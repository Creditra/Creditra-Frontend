import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AgingTagPage } from '../AgingTag';

/**
 * Issue #??? — themed empty state on the AgingTag page (GrantFox FWC26).
 *
 * These tests verify the empty-state render path:
 *
 * - the `<EmptyState />` renders with the success tone when no credit
 *   lines are delinquent
 * - the `NoOverdue` illustration is decorative (aria-hidden)
 * - the helpful CTAs (View Credit Lines + Back to Dashboard) are present
 * - the delinquent-line list collapses when all lines are current
 * - the region uses role="status" + aria-live="polite" + aria-labelledby
 *
 * The populated path is tested by verifying that when mockData includes
 * Defaulted / Suspended lines, the list renders instead of the empty state.
 */

// Mock mockData to return no delinquent lines for the empty-state suite.
// We keep Active and Closed lines — they should not trigger the list.
vi.mock('../../data/mockData', () => ({
  MOCK_CREDIT_LINES: [
    {
      id: 'CL-TEST-001',
      name: 'Healthy Business Line',
      status: 'Active',
      limit: 200000,
      utilized: 50000,
      apr: 7.5,
      riskScore: 750,
      openedAt: '2024-01-01',
      updatedAt: '2025-01-01T00:00:00Z',
      transactions: [],
      statusHistory: [{ status: 'Active', date: '2024-01-01', note: 'Line opened' }],
    },
    {
      id: 'CL-TEST-002',
      name: 'Closed Line',
      status: 'Closed',
      limit: 50000,
      utilized: 0,
      apr: 10.0,
      riskScore: 700,
      openedAt: '2023-06-01',
      updatedAt: '2024-12-01T00:00:00Z',
      transactions: [],
      statusHistory: [
        { status: 'Active', date: '2023-06-01', note: 'Line opened' },
        { status: 'Closed', date: '2024-12-01', note: 'Fully repaid' },
      ],
    },
  ],
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/aging']}>
      <AgingTagPage />
    </MemoryRouter>,
  );
}

describe('AgingTagPage — empty state (GrantFox FWC26)', () => {
  it('renders the themed empty state when no credit lines are delinquent', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'No overdue credit lines' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/all your credit lines are current/i),
    ).toBeInTheDocument();
  });

  it('displays the "All caught up" eyebrow', () => {
    renderPage();

    expect(screen.getByText('All caught up')).toBeInTheDocument();
  });

  it('exposes primary CTA to /credit-lines', () => {
    renderPage();

    const cta = screen.getByRole('link', { name: 'View Credit Lines' });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/credit-lines');
  });

  it('exposes a secondary CTA back to the dashboard', () => {
    renderPage();

    const secondary = screen.getByRole('link', { name: 'Back to Dashboard' });
    expect(secondary).toBeInTheDocument();
    expect(secondary).toHaveAttribute('href', '/');
  });

  it('exposes the empty-state region with role=status and aria-live=polite', () => {
    renderPage();

    const region = screen.getByTestId('aging-empty-state');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-labelledby');
    const labelId = region.getAttribute('aria-labelledby');
    expect(document.getElementById(labelId!)).toHaveTextContent(
      'No overdue credit lines',
    );
    expect(region).toHaveClass('empty-state--success');
  });

  it('renders a decorative illustration with aria-hidden', () => {
    const { container } = renderPage();

    const illustration = container.querySelector('.empty-state-illustration');
    expect(illustration).not.toBeNull();
    expect(illustration?.getAttribute('aria-hidden')).toBe('true');
  });

  it('hides the delinquent-line list when no past-due lines exist', () => {
    renderPage();

    expect(screen.queryByTestId('aging-line-list')).not.toBeInTheDocument();
  });

  it('keeps the page header visible in the empty state', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Aging Credit Lines' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/past due or require attention/i),
    ).toBeInTheDocument();
  });
});

/**
 * Populated state — verify that when mockData includes Defaulted or
 * Suspended lines, the delinquent list renders instead of the empty state.
 */
describe('AgingTagPage — with delinquent lines', () => {
  it('renders the delinquent-line list when past-due lines exist', async () => {
    // Dynamic re-mock for this suite only
    vi.doMock('../../data/mockData', () => ({
      MOCK_CREDIT_LINES: [
        {
          id: 'CL-DEFAULTED-001',
          name: 'Defaulted Line',
          status: 'Defaulted',
          limit: 75000,
          utilized: 75000,
          apr: 14.5,
          riskScore: 490,
          openedAt: '2023-01-01',
          updatedAt: '2024-11-01T10:00:00Z',
          transactions: [],
          statusHistory: [
            { status: 'Active', date: '2023-01-01', note: 'Line opened' },
            { status: 'Defaulted', date: '2024-11-01', note: '90+ days overdue' },
          ],
        },
        {
          id: 'CL-SUSPENDED-001',
          name: 'Suspended Line',
          status: 'Suspended',
          limit: 100000,
          utilized: 45000,
          apr: 11.0,
          riskScore: 610,
          openedAt: '2023-06-01',
          updatedAt: '2025-01-15T16:45:00Z',
          transactions: [],
          statusHistory: [
            { status: 'Active', date: '2023-06-01', note: 'Line opened' },
            { status: 'Suspended', date: '2025-01-15', note: 'Missed payment' },
          ],
        },
      ],
    }));
    vi.resetModules();

    const { AgingTagPage: FreshPage } = await import('../AgingTag');

    render(
      <MemoryRouter initialEntries={['/aging']}>
        <FreshPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('aging-line-list')).toBeInTheDocument();
    expect(screen.queryByTestId('aging-empty-state')).not.toBeInTheDocument();
    expect(screen.getByText('Defaulted Line')).toBeInTheDocument();
    expect(screen.getByText('Suspended Line')).toBeInTheDocument();
  });

  it('shows an AgingTag badge on each delinquent line card', async () => {
    vi.doMock('../../data/mockData', () => ({
      MOCK_CREDIT_LINES: [
        {
          id: 'CL-DEFAULTED-002',
          name: 'Delinquent Line',
          status: 'Defaulted',
          limit: 50000,
          utilized: 50000,
          apr: 13.0,
          riskScore: 520,
          openedAt: '2023-03-01',
          updatedAt: '2024-10-01T08:00:00Z',
          transactions: [],
          statusHistory: [
            { status: 'Active', date: '2023-03-01', note: 'Line opened' },
            { status: 'Defaulted', date: '2024-10-01', note: 'Over 90 days' },
          ],
        },
      ],
    }));
    vi.resetModules();

    const { AgingTagPage: FreshPage } = await import('../AgingTag');

    render(
      <MemoryRouter initialEntries={['/aging']}>
        <FreshPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('aging-line-list')).toBeInTheDocument();
    const agingTag = screen.getByText(/days past due/i);
    expect(agingTag).toBeInTheDocument();
  });

  it('renders a Repay Now link for each delinquent line', async () => {
    vi.doMock('../../data/mockData', () => ({
      MOCK_CREDIT_LINES: [
        {
          id: 'CL-DEFAULTED-003',
          name: 'Repayable Line',
          status: 'Defaulted',
          limit: 30000,
          utilized: 30000,
          apr: 15.0,
          riskScore: 480,
          openedAt: '2023-04-01',
          updatedAt: '2024-12-01T12:00:00Z',
          transactions: [],
          statusHistory: [
            { status: 'Active', date: '2023-04-01', note: 'Line opened' },
            { status: 'Defaulted', date: '2024-12-01', note: 'Overdue' },
          ],
        },
      ],
    }));
    vi.resetModules();

    const { AgingTagPage: FreshPage } = await import('../AgingTag');

    render(
      <MemoryRouter initialEntries={['/aging']}>
        <FreshPage />
      </MemoryRouter>,
    );

    const repayBtn = screen.getByRole('link', { name: 'Repay Now' });
    expect(repayBtn).toBeInTheDocument();
    expect(repayBtn).toHaveAttribute('href', '/repay?line=CL-DEFAULTED-003');
  });

  it('renders the overdue line count in a status region', async () => {
    vi.doMock('../../data/mockData', () => ({
      MOCK_CREDIT_LINES: [
        {
          id: 'CL-DEFAULTED-004',
          name: 'Line One',
          status: 'Defaulted',
          limit: 50000,
          utilized: 25000,
          apr: 12.0,
          riskScore: 550,
          openedAt: '2023-05-01',
          updatedAt: '2025-01-01T00:00:00Z',
          transactions: [],
          statusHistory: [
            { status: 'Active', date: '2023-05-01', note: 'Line opened' },
            { status: 'Defaulted', date: '2025-01-01', note: 'Overdue' },
          ],
        },
        {
          id: 'CL-SUSPENDED-002',
          name: 'Line Two',
          status: 'Suspended',
          limit: 40000,
          utilized: 10000,
          apr: 9.5,
          riskScore: 620,
          openedAt: '2024-01-01',
          updatedAt: '2025-02-01T00:00:00Z',
          transactions: [],
          statusHistory: [
            { status: 'Active', date: '2024-01-01', note: 'Line opened' },
            { status: 'Suspended', date: '2025-02-01', note: 'Missed payment' },
          ],
        },
      ],
    }));
    vi.resetModules();

    const { AgingTagPage: FreshPage } = await import('../AgingTag');

    render(
      <MemoryRouter initialEntries={['/aging']}>
        <FreshPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('2 credit lines past due')).toBeInTheDocument();
  });
});
