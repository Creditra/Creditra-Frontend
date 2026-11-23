import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RepayCalendar from '../RepayCalendar';

vi.mock('@/data/mockData', () => ({
  MOCK_CREDIT_LINES: [
    {
      id: 'CL-2024-001',
      name: 'Primary Business Line That Is Quite Long For Testing',
      status: 'Active',
      limit: 500000,
      utilized: 187500,
      apr: 8.5,
      riskScore: 720,
      collateral: 'Commercial Real Estate',
      openedAt: '2024-03-15',
      updatedAt: '2025-02-20T14:32:00Z',
      nextPaymentDate: '2025-03-20',
      nextPaymentAmount: 3200,
      transactions: [],
      statusHistory: [],
    },
    {
      id: 'CL-2024-002',
      name: 'Short Line',
      status: 'Active',
      limit: 250000,
      utilized: 210000,
      apr: 9.25,
      riskScore: 685,
      collateral: 'Accounts Receivable',
      openedAt: '2024-06-01',
      updatedAt: '2025-02-19T09:15:00Z',
      nextPaymentDate: '2025-04-05',
      nextPaymentAmount: 5100,
      transactions: [],
      statusHistory: [],
    },
  ],
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/repay/calendar']}>
      <RepayCalendar />
    </MemoryRouter>,
  );
}

describe('RepayCalendar', () => {
  it('renders the page heading', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: /repayment calendar/i }),
    ).toBeInTheDocument();
  });

  it('renders breadcrumb navigation', () => {
    renderPage();
    expect(
      screen.getByRole('navigation', { name: /breadcrumb/i }),
    ).toBeInTheDocument();
  });

  it('shows Dashboard link in breadcrumb', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/');
  });

  it('shows Credit Lines link in breadcrumb', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Credit Lines' })).toHaveAttribute('href', '/credit-lines');
  });

  it('marks the current page in breadcrumb with aria-current', () => {
    renderPage();
    const currentPage = screen.getByText((_, el) =>
      el?.getAttribute('aria-current') === 'page',
    );
    expect(currentPage).toBeInTheDocument();
  });

  it('truncates long breadcrumb labels with ellipsis', () => {
    renderPage();
    // The breadcrumb item includes "Primary Business Line That Is Quite Long For Testing"
    // which should be truncated because it exceeds the threshold
    const truncated = screen.getByText((content) => {
      return content.includes('\u2026');
    });
    expect(truncated).toBeInTheDocument();
  });

  it('provides title attribute for truncated breadcrumb labels', () => {
    renderPage();
    // Full text should be available via title attribute
    const titled = screen.getByText((_, el) => {
      const title = el?.getAttribute('title');
      return title?.includes('Primary Business Line That Is Quite Long For Testing') === true;
    });
    expect(titled).toBeInTheDocument();
  });

  it('shows the repayment schedule', () => {
    renderPage();
    expect(screen.getByText('All Scheduled Payments')).toBeInTheDocument();
  });

  it('shows summary stats', () => {
    renderPage();
    expect(screen.getByText('Active lines')).toBeInTheDocument();
    expect(screen.getByText('Total installments')).toBeInTheDocument();
    expect(screen.getAllByText('Remaining').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a back button with accessible label', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /back to credit lines/i }),
    ).toBeInTheDocument();
  });

  it('has proper heading hierarchy', () => {
    renderPage();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Repayment Calendar');
  });
});
