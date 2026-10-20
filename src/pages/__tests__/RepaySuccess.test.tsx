import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RepaySuccess from '../RepaySuccess';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// ThemeContext is consumed by RepaySuccessShareCard
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'default' }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const validState = {
  amount: 3200,
  creditLineName: 'Primary Business Line',
  creditLineId: 'CL-2024-001',
  transactionId: 'TXN-1712345678',
  remainingDebt: 184300,
  limit: 500000,
  apr: 8.5,
  nextPaymentAmount: 3200,
  timestamp: '2025-07-25T14:30:00.000Z',
};

const fullPayoffState = {
  ...validState,
  amount: 187500,
  remainingDebt: 0,
  timestamp: '2025-07-25T14:30:00.000Z',
};

const noNextPaymentState = {
  ...validState,
  nextPaymentAmount: undefined,
};

// ─── Test Wrapper ──────────────────────────────────────────────────────────────

/**
 * Renders the RepaySuccess page as a route so we can verify
 * that the navigation contract works correctly.
 */
function renderSuccessPage(state: unknown = validState, initialRoute = '/repay/success') {
  return render(
    <MemoryRouter initialEntries={[{ pathname: initialRoute, state }]}>
      <Routes>
        <Route path="/repay/success" element={<RepaySuccess />} />
        <Route path="/" element={<div data-testid="dashboard-route">Dashboard</div>} />
        <Route path="/repay" element={<div data-testid="repay-route">Repay</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('RepaySuccess page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy paths ─────────────────────────────────────────────────────────

  it('renders the success header with the repayment amount', () => {
    renderSuccessPage();

    expect(
      screen.getByText('You repaid $3,200.00!'),
    ).toBeInTheDocument();
  });

  it('displays the credit line name and success message in the header', () => {
    renderSuccessPage();

    expect(screen.getByText('Primary Business Line')).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes('Your transaction was successful.'),
      ),
    ).toBeInTheDocument();
  });

  it('renders the shareable success card with the repayment details', () => {
    renderSuccessPage();

    expect(
      screen.getByText('Repayment Successful!'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Your credit has been restored'),
    ).toBeInTheDocument();
  });

  it('shows the share card amount and credit line name', () => {
    renderSuccessPage();

    // The RepaySuccessShareCard renders the formatted amount
    const amountElements = screen.getAllByText(/\$3,200/);
    expect(amountElements.length).toBeGreaterThanOrEqual(1);

    // Credit line name is shown in the share card info rows
    expect(
      screen.getByText('Primary Business Line'),
    ).toBeInTheDocument();
  });

  it('shows the repayment summary section', () => {
    renderSuccessPage();

    expect(screen.getByText('Repayment Summary')).toBeInTheDocument();
    expect(screen.getByText('$184,300.00')).toBeInTheDocument(); // remaining debt
    expect(
      screen.getByText('Reduced to 37%'),
    ).toBeInTheDocument(); // new utilization
  });

  it('shows PayoffProjection component', () => {
    renderSuccessPage();

    expect(
      screen.getByText('Payoff Projection'),
    ).toBeInTheDocument();
  });

  it('has Back to Dashboard button', () => {
    renderSuccessPage();

    expect(
      screen.getByRole('button', { name: /back to dashboard/i }),
    ).toBeInTheDocument();
  });

  it('has Make another repayment button', () => {
    renderSuccessPage();

    expect(
      screen.getByRole('button', { name: /make another repayment/i }),
    ).toBeInTheDocument();
  });

  it('navigates to dashboard when Back to Dashboard is clicked', async () => {
    const user = userEvent.setup();
    renderSuccessPage();

    await user.click(
      screen.getByRole('button', { name: /back to dashboard/i }),
    );

    expect(screen.getByTestId('dashboard-route')).toBeInTheDocument();
  });

  it('navigates to /repay when Make another repayment is clicked', async () => {
    const user = userEvent.setup();
    renderSuccessPage();

    await user.click(
      screen.getByRole('button', { name: /make another repayment/i }),
    );

    expect(screen.getByTestId('repay-route')).toBeInTheDocument();
  });

  it('shows a "Back to repayment" button that navigates back', async () => {
    const user = userEvent.setup();
    renderSuccessPage();

    const backBtn = screen.getByRole('button', { name: /back to repayment/i });
    expect(backBtn).toBeInTheDocument();

    await user.click(backBtn);
    expect(screen.getByTestId('repay-route')).toBeInTheDocument();
  });

  // ── Full payoff scenario ───────────────────────────────────────────────

  it('handles full payoff (remaining debt = 0) with special formatting', () => {
    renderSuccessPage(fullPayoffState);

    expect(screen.getByText('You repaid $187,500.00!')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument(); // remaining debt is 0
    expect(screen.getByText('Reduced to 0%')).toBeInTheDocument();
  });

  // ── Missing nextPaymentAmount ──────────────────────────────────────────

  it('renders PayoffProjection without optional nextPaymentAmount', () => {
    renderSuccessPage(noNextPaymentState);

    expect(
      screen.getByText('Payoff Projection'),
    ).toBeInTheDocument();
  });

  // ── Fallback: no state provided ─────────────────────────────────────────

  it('renders a fallback message when no navigation state is provided', () => {
    renderSuccessPage(null, '/repay/success');

    expect(
      screen.getByText('Repayment successful'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /the full details are not available on this screen/,
      ),
    ).toBeInTheDocument();
  });

  it('fallback view has Back to Dashboard button', () => {
    renderSuccessPage(null, '/repay/success');

    expect(
      screen.getByRole('button', { name: /back to dashboard/i }),
    ).toBeInTheDocument();
  });

  it('fallback view has Make another repayment button', () => {
    renderSuccessPage(null, '/repay/success');

    expect(
      screen.getByRole('button', { name: /make another repayment/i }),
    ).toBeInTheDocument();
  });

  it('fallback navigates to dashboard on button click', async () => {
    const user = userEvent.setup();
    renderSuccessPage(null, '/repay/success');

    await user.click(
      screen.getByRole('button', { name: /back to dashboard/i }),
    );

    expect(screen.getByTestId('dashboard-route')).toBeInTheDocument();
  });

  // ── Accessibility ──────────────────────────────────────────────────────

  it('main element has role="status" and aria-live="polite" for screen readers', () => {
    renderSuccessPage();

    const main = screen.getByRole('status');
    expect(main).toHaveAttribute('aria-live', 'polite');
  });

  it('share card has required accessibility attributes', () => {
    renderSuccessPage();

    // The share card renders a heading "Repayment Successful!"
    expect(
      screen.getByRole('heading', { name: /repayment successful/i }),
    ).toBeInTheDocument();
  });

  // ── Responsive text ────────────────────────────────────────────────────

  it('displays the "Repayment Complete" step indicator', () => {
    renderSuccessPage();

    expect(
      screen.getByText('Repayment Complete'),
    ).toBeInTheDocument();
  });

  // ── Edge case: partial data ────────────────────────────────────────────

  it('handles amount and remainingDebt both being 0 gracefully', () => {
    const zeroState = { ...validState, amount: 0, remainingDebt: 0 };
    renderSuccessPage(zeroState);

    expect(screen.getByText('You repaid $0.00!')).toBeInTheDocument();
  });

  // ── Share card interactions ────────────────────────────────────────────

  it('renders the share card with mask details and share buttons', () => {
    renderSuccessPage();

    // Mask details button
    expect(
      screen.getByRole('button', { name: /mask details/i }),
    ).toBeInTheDocument();

    // Share button
    expect(
      screen.getByRole('button', { name: /share repayment summary/i }),
    ).toBeInTheDocument();
  });
});
