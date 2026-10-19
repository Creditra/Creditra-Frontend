import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RepayPage from '../RepayPage';

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    wallet: { publicKey: 'GTEST', network: 'TESTNET' },
    status: 'connected',
    balances: [{
      asset: 'USDC',
      issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      balance: '50000.0000000',
    }],
    refreshBalance: async () => [{
      asset: 'USDC',
      issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      balance: '50000.0000000',
    }],
  }),
}));

vi.mock('@/data/mockData', () => ({
  MOCK_CREDIT_LINES: [
    {
      id: 'CL-2024-001',
      name: 'Primary Business Line',
      status: 'Active',
      limit: 500000,
      utilized: 187500,
      apr: 8.5,
      riskScore: 720,
      collateral: 'Commercial Real Estate',
      openedAt: '2024-03-15',
      updatedAt: '2025-02-20T14:32:00Z',
      nextPaymentDate: '2025-03-01',
      nextPaymentAmount: 3200,
      transactions: [],
      statusHistory: [],
    },
  ],
}));

function renderPage(initialEntries = ['/repay'], advanceTimers = true) {
  const result = render(
    <MemoryRouter initialEntries={initialEntries}>
      <RepayPage />
    </MemoryRouter>,
  );
  
  if (advanceTimers) {
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  }
  
  return result;
}

describe('RepayPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('shows loading skeleton initially', () => {
    renderPage(['/repay'], false);
    expect(screen.getByTestId('repay-loading-skeleton')).toBeInTheDocument();
  });

  it('renders credit line selection when no line is preselected', () => {
    renderPage();
    expect(screen.getByText('Select a credit line to repay')).toBeInTheDocument();
  });

  it('shows available credit lines in selection view', () => {
    renderPage();
    expect(screen.getByText('Primary Business Line')).toBeInTheDocument();
  });

  it('navigates to input view when a credit line is selected', () => {
    renderPage();
    fireEvent.click(screen.getByText('Primary Business Line'));
    expect(screen.getByText('Make a repayment')).toBeInTheDocument();
  });

  it('preselects a credit line when line param is provided', () => {
    renderPage(['/repay?line=CL-2024-001']);
    expect(screen.getByText('Make a repayment')).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.startsWith('Primary Business Line')),
    ).toBeInTheDocument();
  });

  it('shows the PayoffProjection component in input view', () => {
    renderPage(['/repay?line=CL-2024-001']);
    expect(screen.getByText('Payoff Projection')).toBeInTheDocument();
  });

  it('shows current debt amount', () => {
    renderPage(['/repay?line=CL-2024-001']);
    const matches = screen.getAllByText('$187,500.00');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('has quick percentage buttons', () => {
    renderPage(['/repay?line=CL-2024-001']);
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('MAX')).toBeInTheDocument();
  });

  it('Review Repayment button is disabled with no amount', () => {
    renderPage(['/repay?line=CL-2024-001']);
    expect(screen.getByRole('button', { name: /review repayment/i })).toBeDisabled();
  });

  it('has I need help button', () => {
    renderPage(['/repay?line=CL-2024-001']);
    expect(screen.getByText('I need help')).toBeInTheDocument();
  });

  it('has Cancel button', () => {
    renderPage(['/repay?line=CL-2024-001']);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders Smart Pay button when a credit line is selected', () => {
    renderPage(['/repay?line=CL-2024-001']);
    expect(screen.getByRole('button', { name: /smart pay/i })).toBeInTheDocument();
  });

  it('Smart Pay button has correct aria-label with suggested amount', () => {
    renderPage(['/repay?line=CL-2024-001']);
    const button = screen.getByRole('button', { name: /smart pay/i });
    expect(button).toHaveAttribute('aria-label', 'Smart Pay suggested repayment of $3,200.00');
  });

  it('clicking Smart Pay fills the amount input with the suggested value', () => {
    renderPage(['/repay?line=CL-2024-001']);
    const smartPayBtn = screen.getByRole('button', { name: /smart pay/i });
    fireEvent.click(smartPayBtn);
    const input = screen.getByRole('spinbutton', { name: /amount to repay/i });
    expect(input).toHaveValue(3200);
  });

  it('Smart Pay enables Review Repayment when clicked', () => {
    renderPage(['/repay?line=CL-2024-001']);
    const reviewBtn = screen.getByRole('button', { name: /review repayment/i });
    expect(reviewBtn).toBeDisabled();
    const smartPayBtn = screen.getByRole('button', { name: /smart pay/i });
    fireEvent.click(smartPayBtn);
    expect(reviewBtn).not.toBeDisabled();
  });

  describe('Focus-visible outline accessibility (issue #512)', () => {
    it('applies focus-visible classes and rp-back-btn / rp-cl-card classes on selection view', () => {
      renderPage(['/repay']);
      const backBtn = screen.getByRole('button', { name: /back/i });
      expect(backBtn).toHaveClass('focus-visible:outline');
      expect(backBtn).toHaveClass('rp-back-btn');

      const clOption = screen.getByRole('button', { name: /primary business line/i });
      expect(clOption).toHaveClass('focus-visible:outline');
      expect(clOption).toHaveClass('rp-cl-card');
    });

    it('applies focus-visible classes and rp-* classes on input view interactive elements', () => {
      renderPage(['/repay?line=CL-2024-001']);
      const backBtn = screen.getByRole('button', { name: /back to credit lines/i });
      expect(backBtn).toHaveClass('focus-visible:outline');
      expect(backBtn).toHaveClass('rp-back-btn');

      const preset25 = screen.getByRole('button', { name: /25 percent/i });
      expect(preset25).toHaveClass('focus-visible:outline');
      expect(preset25).toHaveClass('rp-preset-btn');

      const smartPayBtn = screen.getByRole('button', { name: /smart pay/i });
      expect(smartPayBtn).toHaveClass('focus-visible:outline');
      expect(smartPayBtn).toHaveClass('rp-smart-pay-btn');

      const input = screen.getByRole('spinbutton', { name: /amount to repay/i });
      expect(input).toHaveClass('focus-visible:outline');
      expect(input).toHaveClass('rp-amount-input');

      const reviewBtn = screen.getByRole('button', { name: /review repayment/i });
      expect(reviewBtn).toHaveClass('focus-visible:outline');
      expect(reviewBtn).toHaveClass('rp-review-btn');
    });

    it('applies focus-visible classes and rp-* classes on help and cancel buttons', () => {
      renderPage(['/repay?line=CL-2024-001']);
      const helpBtn = screen.getByRole('button', { name: /i need help/i });
      expect(helpBtn).toHaveClass('focus-visible:outline');
      expect(helpBtn).toHaveClass('rp-help-btn');

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      expect(cancelBtn).toHaveClass('focus-visible:outline');
      expect(cancelBtn).toHaveClass('rp-cancel-btn');
    });

    it('applies focus-visible classes and rp-* classes on review step buttons', () => {
      renderPage(['/repay?line=CL-2024-001']);
      fireEvent.click(screen.getByRole('button', { name: /smart pay/i }));
      fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));

      // The back button in review step uses rp-back-btn class (not rp-back-input-btn)
      const backBtn = screen.getByRole('button', { name: /back to input/i });
      expect(backBtn).toHaveClass('focus-visible:outline');
      expect(backBtn).toHaveClass('rp-back-btn');

      const confirmBtn = screen.getByRole('button', { name: /confirm repayment/i });
      expect(confirmBtn).toHaveClass('focus-visible:outline');
      expect(confirmBtn).toHaveClass('rp-confirm-btn');
    });

    it('auto-schedule toggle uses focus-visible:outline (not ring) and has rp-toggle-switch class', () => {
      renderPage(['/repay?line=CL-2024-001']);

      // The toggle switch is labelled by the htmlFor/id linkage with "Auto-schedule" text
      const toggle = screen.getByRole('switch', { name: /auto-schedule/i });
      expect(toggle).toHaveClass('focus-visible:outline');
      expect(toggle).toHaveClass('focus-visible:outline-offset-2');
      expect(toggle).toHaveClass('focus-visible:outline-accent');
      expect(toggle).toHaveClass('rp-toggle-switch');
      // Ensure it does NOT have the ring classes
      expect(toggle).not.toHaveClass('focus:outline-none');
      expect(toggle.classList.contains('focus-visible:ring-2')).toBe(false);
    });

    it('help button uses design-token accent color (not hard-coded blue-400)', () => {
      renderPage(['/repay?line=CL-2024-001']);
      const helpBtn = screen.getByRole('button', { name: /i need help/i });
      expect(helpBtn).toHaveClass('focus-visible:outline-accent');
      // Ensure it does NOT have the hard-coded blue-400 class
      expect(helpBtn.classList.contains('focus-visible:outline-blue-400')).toBe(false);
    });

    it('applies focus-visible classes and rp-* classes on success step buttons', () => {
      renderPage(['/repay?line=CL-2024-001']);
      // Navigate to success step
      fireEvent.click(screen.getByRole('button', { name: /smart pay/i }));
      fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm repayment/i }));

      const dashboardBtn = screen.getByRole('button', { name: /back to dashboard/i });
      expect(dashboardBtn).toHaveClass('focus-visible:outline');
      expect(dashboardBtn).toHaveClass('rp-dashboard-btn');

      const newRepayBtn = screen.getByRole('button', { name: /make another repayment/i });
      expect(newRepayBtn).toHaveClass('focus-visible:outline');
      expect(newRepayBtn).toHaveClass('rp-new-repay-btn');
    });

    it('preview modal button has rp-preview-btn class and focus-visible classes', () => {
      renderPage(['/repay?line=CL-2024-001']);
      fireEvent.click(screen.getByRole('button', { name: /smart pay/i }));
      const previewBtn = screen.getByRole('button', { name: /preview consequences modal/i });
      expect(previewBtn).toHaveClass('focus-visible:outline');
      expect(previewBtn).toHaveClass('rp-preview-btn');
    });
  });
});

describe('RepayPage — copy-to-clipboard buttons (FWC26)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders copy button for current debt on input step', () => {
    renderPage(['/repay?line=CL-2024-001']);
    expect(
      screen.getByRole('button', { name: /copy current debt amount/i }),
    ).toBeInTheDocument();
  });

  it('copies current debt amount when copy button is clicked', async () => {
    renderPage(['/repay?line=CL-2024-001']);
    const btn = screen.getByRole('button', { name: /copy current debt amount/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('$187,500.00');
  });

  it('renders copy button for repayment amount on review step', () => {
    renderPage(['/repay?line=CL-2024-001']);
    fireEvent.click(screen.getByRole('button', { name: /smart pay/i }));
    fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
    expect(
      screen.getByRole('button', { name: /copy repayment amount/i }),
    ).toBeInTheDocument();
  });

  it('copies repayment amount on review step', async () => {
    renderPage(['/repay?line=CL-2024-001']);
    fireEvent.click(screen.getByRole('button', { name: /smart pay/i }));
    fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
    const btn = screen.getByRole('button', { name: /copy repayment amount/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('$3,200.00');
  });

  it('renders copy button for remaining debt on success step', () => {
    renderPage(['/repay?line=CL-2024-001']);
    fireEvent.click(screen.getByRole('button', { name: /smart pay/i }));
    fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm repayment/i }));
    expect(
      screen.getByRole('button', { name: /copy remaining debt amount/i }),
    ).toBeInTheDocument();
  });

  it('copies remaining debt amount on success step', async () => {
    renderPage(['/repay?line=CL-2024-001']);
    fireEvent.click(screen.getByRole('button', { name: /smart pay/i }));
    fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm repayment/i }));
    const btn = screen.getByRole('button', { name: /copy remaining debt amount/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    // Smart Pay ($3,200) repay on $187,500 utilized leaves $184,300 remaining
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('$184,300.00');
  });

  it('shows copied feedback after clicking copy button', async () => {
    renderPage(['/repay?line=CL-2024-001']);
    const btn = screen.getByRole('button', { name: /copy current debt amount/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(btn).toHaveAttribute('data-copy-state', 'copied');
  });

  it('resets copy button to idle after feedback duration', async () => {
    renderPage(['/repay?line=CL-2024-001']);
    const btn = screen.getByRole('button', { name: /copy current debt amount/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(btn).toHaveAttribute('data-copy-state', 'copied');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(btn).toHaveAttribute('data-copy-state', 'idle');
  });

  describe('Issue #1140 — global Enter handler and duplicate-submit lock', () => {
    it('Enter on a focused Back button triggers only that button action and does not advance to review', () => {
      renderPage(['/repay?line=CL-2024-001']);
      fireEvent.click(screen.getByRole('button', { name: /smart pay/i }));

      const backBtn = screen.getByRole('button', { name: /back/i });
      backBtn.focus();
      expect(document.activeElement).toBe(backBtn);

      fireEvent.keyDown(backBtn, { key: 'Enter', bubbles: true });

      expect(screen.queryByText(/review your repayment/i)).not.toBeInTheDocument();
      expect(screen.getByText(/repay credit/i)).toBeInTheDocument();
    });

    it('Enter on a focused Back button on review step goes back and does not call confirm', () => {
      renderPage(['/repay?line=CL-2024-001']);
      fireEvent.click(screen.getByRole('button', { name: /smart pay/i }));
      fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
      expect(screen.getByText(/review your repayment/i)).toBeInTheDocument();

      const backToInputBtn = screen.getByRole('button', { name: /back to input/i });
      backToInputBtn.focus();
      expect(document.activeElement).toBe(backToInputBtn);

      fireEvent.click(backToInputBtn);
      fireEvent.keyDown(backToInputBtn, { key: 'Enter', bubbles: true });

      expect(screen.queryByText(/you repaid/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /review repayment/i })).toBeInTheDocument();
    });

    it('Enter with focus on the page body still advances from input to review, and from review to success', () => {
      renderPage(['/repay?line=CL-2024-001']);
      fireEvent.click(screen.getByRole('button', { name: /smart pay/i }));

      document.body.focus();

      fireEvent.keyDown(window, { key: 'Enter', bubbles: true, target: document.body });

      expect(screen.getByText(/review your repayment/i)).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Enter', bubbles: true, target: document.body });

      expect(screen.getByRole('heading', { name: /you repaid/i })).toBeInTheDocument();
    });

    it('Enter on Confirm Repayment button does not double-fire handleConfirm (isSubmitting lock)', () => {
      renderPage(['/repay?line=CL-2024-001']);
      fireEvent.click(screen.getByRole('button', { name: /smart pay/i }));
      fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));

      const confirmBtn = screen.getByRole('button', { name: /confirm repayment/i });
      confirmBtn.focus();

      fireEvent.click(confirmBtn);
      fireEvent.keyDown(confirmBtn, { key: 'Enter', bubbles: true });

      expect(screen.getByRole('heading', { name: /you repaid/i })).toBeInTheDocument();
    });

    it('ignores Enter keydown if event.defaultPrevented is true', () => {
      renderPage(['/repay?line=CL-2024-001']);
      fireEvent.click(screen.getByRole('button', { name: /smart pay/i }));

      const evt = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
      evt.preventDefault();
      window.dispatchEvent(evt);

      expect(screen.queryByText(/review your repayment/i)).not.toBeInTheDocument();
    });

    it('ignores keydown events inside dialog elements', () => {
      renderPage(['/repay?line=CL-2024-001']);
      fireEvent.click(screen.getByRole('button', { name: /smart pay/i }));

      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      const dialogBtn = document.createElement('button');
      dialog.appendChild(dialogBtn);
      document.body.appendChild(dialog);

      fireEvent.keyDown(dialogBtn, { key: 'Enter', bubbles: true });

      expect(screen.queryByText(/review your repayment/i)).not.toBeInTheDocument();

      document.body.removeChild(dialog);
    });
  });
});

/**
 * NOTE: empty-state render tests for `/repay` live in the sibling file
 * `RepayPage.empty.test.tsx`. Mocking `MOCK_CREDIT_LINES = []` inside the
 * same file as the populated-suite risks cross-test mock leakage because
 * top-level `vi.mock(...)` is hoisted and `vi.doMock(...)` is not. Splitting
 * the suites keeps the mocks isolated.
 */
