import React, { useRef } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { RepayModal } from '../RepayModal';
import {
  setCreditWriteClientForTesting,
  SorobanWriteError,
  type CreditWriteClient,
} from '@/services/credit/sorobanWriteClient';

// Suppress DOM side-effects from companion hooks
vi.mock('@/hooks/useBodyScrollLock', () => ({ useBodyScrollLock: vi.fn() }));
vi.mock('@/hooks/useInertBackdrop', () => ({ useInertBackdrop: vi.fn() }));

// Suppress InlineHelpOverlay (renders HelpCenter which is heavy and unrelated)
vi.mock('../InlineHelpOverlay', () => ({
  InlineHelpOverlay: () => null,
}));

const defaultCreditLine = {
  id: 'CL-001',
  name: 'Primary Credit Line',
  limit: 10_000,
  utilized: 3_000,
  apr: 12,
};

function TestWrapper({
  onClose = vi.fn(),
  onSuccess = vi.fn(),
}: {
  onClose?: () => void;
  onSuccess?: (amount: number) => void;
}) {
  const repayTriggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={repayTriggerRef} data-testid="repay-trigger">
        Repay
      </button>
      <RepayModal
        creditLine={defaultCreditLine}
        walletBalance={5_000}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </>
  );
}

describe('RepayModal – focus trap (A11Y-002)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a dialog with the correct ARIA attributes', () => {
    render(<TestWrapper />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'repay-modal-title');
  });

  // A11Y-002: useFocusTrap called with { isActive } object form, not a plain boolean.
  // The trap must move focus into the modal on mount.
  it('activates focus trap and moves focus into the modal', () => {
    vi.useFakeTimers();
    render(<TestWrapper />);

    // Flush the 50 ms defer inside useFocusTrap
    act(() => {
      vi.runAllTimers();
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    vi.useRealTimers();
  });

  it('closes when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<TestWrapper onClose={onClose} />);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Regression: focus must return to the "Repay" trigger button on close.
  // Uses a wrapper that owns the trigger ref and passes it via triggerRef.
  it('returns focus to the triggering Repay button on close', async () => {
    function WithTriggerRef() {
      const triggerRef = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = React.useState(true);

      return (
        <>
          <button ref={triggerRef} data-testid="repay-trigger" onClick={() => setOpen(true)}>
            Repay
          </button>
          {open && (
            <RepayModal
              creditLine={defaultCreditLine}
              walletBalance={5_000}
              onClose={() => setOpen(false)}
              onSuccess={vi.fn()}
              triggerRef={triggerRef}
            />
          )}
        </>
      );
    }

    render(<WithTriggerRef />);

    // Close via Escape; useFocusTrap cleanup returns focus to triggerRef
    await userEvent.keyboard('{Escape}');

    expect(document.activeElement).toBe(screen.getByTestId('repay-trigger'));
  });
});

describe('RepayModal – Repay all shortcut', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('pre-fills the exact payoff including accrued interest when Repay all is clicked', async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);

    await user.click(screen.getByTestId('repay-all-shortcut'));

    const input = screen.getByTestId('repay-amount-input') as HTMLInputElement;
    expect(input.value).toBe('3030.00');
    expect(input).toHaveAttribute('readonly');
    expect(screen.getByTestId('repay-all-edit')).toBeInTheDocument();
  });

  it('announces lock and unlock changes via a polite live region', async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);

    await user.click(screen.getByTestId('repay-all-shortcut'));

    const live = screen.getByTestId('repay-all-lock-announcement');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live.textContent).toMatch(/locked at/i);
    expect(live.textContent).toMatch(/3,030/);

    await user.click(screen.getByTestId('repay-all-edit'));
    expect(live.textContent).toMatch(/unlocked/i);
  });

  it('unlocks the field and restores manual editing when Edit is pressed', async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);

    await user.click(screen.getByTestId('repay-all-shortcut'));
    await user.click(screen.getByTestId('repay-all-edit'));

    const input = screen.getByTestId('repay-amount-input') as HTMLInputElement;
    expect(input).not.toHaveAttribute('readonly');

    await user.clear(input);
    await user.type(input, '500');
    expect(input.value).toBe('500');
  });

  it('applies locked-state styling class for AA contrast affordance', async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);

    await user.click(screen.getByTestId('repay-all-shortcut'));

    const input = screen.getByTestId('repay-amount-input');
    expect(input).toHaveClass('repay-modal-input--locked');
  });

  it('exposes a 44px minimum hit target on Repay all and Edit buttons', () => {
    render(<TestWrapper />);

    const repayAll = screen.getByTestId('repay-all-shortcut');
    expect(repayAll).toHaveClass('repay-modal-repay-all-btn');
  });

  it('does not render any <style> element into the DOM', () => {
    const { container } = render(<TestWrapper />);
    expect(container.querySelector('style')).toBeNull();
    expect(document.querySelector('style')).toBeNull();
  });
});

describe('RepayModal – Soroban write client integration', () => {
  afterEach(() => {
    setCreditWriteClientForTesting(null);
    vi.clearAllMocks();
  });

  it('submits repayment via write client and displays the real txHash', async () => {
    const user = userEvent.setup();
    const txHash = 'b'.repeat(64);
    const repayCredit = vi.fn().mockResolvedValue({ txHash, status: 'SUCCESS' });
    setCreditWriteClientForTesting({
      submitContractCall: vi.fn(),
      drawCredit: vi.fn(),
      repayCredit,
    } as unknown as CreditWriteClient);

    render(<TestWrapper />);

    await user.type(screen.getByTestId('repay-amount-input'), '500');
    await user.click(screen.getByRole('button', { name: /review repayment/i }));
    await user.click(screen.getByRole('button', { name: /confirm repayment/i }));

    await waitFor(() => {
      expect(screen.getByTestId('repay-tx-hash')).toHaveTextContent(txHash);
    });
    expect(repayCredit).toHaveBeenCalledTimes(1);
    expect(repayCredit).toHaveBeenCalledWith(
      'CL-001',
      '500',
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^idem_/) }),
    );
  });

  it('returns to review step with a non-terminal message on wallet user_rejected', async () => {
    const user = userEvent.setup();
    const repayCredit = vi
      .fn()
      .mockRejectedValue(
        new SorobanWriteError('user_rejected', 'User declined signature'),
      );
    setCreditWriteClientForTesting({
      submitContractCall: vi.fn(),
      drawCredit: vi.fn(),
      repayCredit,
    } as unknown as CreditWriteClient);

    render(<TestWrapper />);

    await user.type(screen.getByTestId('repay-amount-input'), '500');
    await user.click(screen.getByRole('button', { name: /review repayment/i }));
    await user.click(screen.getByRole('button', { name: /confirm repayment/i }));

    await waitFor(() => {
      expect(screen.getByTestId('repay-submit-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('repay-submit-error')).toHaveTextContent(/cancelled/i);
    expect(screen.getByRole('button', { name: /confirm repayment/i })).toBeInTheDocument();
  });
});

describe('RepayModal – repayment submission service', () => {
  const mockedSubmitRepayment = vi.mocked(submitRepayment);
  const originalOnLineDescriptor = Object.getOwnPropertyDescriptor(
    window.navigator,
    'onLine',
  );

  function setOnlineStatus(online: boolean) {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => online,
    });
  }

  async function goToReviewStep(user: ReturnType<typeof userEvent.setup>, amount = '500') {
    const input = screen.getByTestId('repay-amount-input');
    await user.clear(input);
    await user.type(input, amount);
    await user.click(screen.getByRole('button', { name: /review repayment/i }));
  }

  beforeEach(() => {
    setOnlineStatus(true);
    mockedSubmitRepayment.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalOnLineDescriptor) {
      Object.defineProperty(window.navigator, 'onLine', originalOnLineDescriptor);
    } else {
      setOnlineStatus(true);
    }
  });

  it('stays pending until submitRepayment resolves and displays the service txId', async () => {
    let resolveSubmission!: (value: { txId: string; completedAt: string }) => void;
    mockedSubmitRepayment.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmission = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<TestWrapper />);
    await goToReviewStep(user, '500');

    await user.click(screen.getByRole('button', { name: /confirm repayment/i }));

    expect(screen.getByText(/processing repayment/i)).toBeInTheDocument();
    expect(screen.queryByText(/repayment successful/i)).not.toBeInTheDocument();
    expect(mockedSubmitRepayment).toHaveBeenCalledTimes(1);
    expect(mockedSubmitRepayment).toHaveBeenCalledWith(
      expect.objectContaining({
        creditLineId: defaultCreditLine.id,
        amount: 500,
        idempotencyKey: expect.stringMatching(/^idem_/),
        signal: expect.any(AbortSignal),
      }),
    );

    await act(async () => {
      resolveSubmission({
        txId: '0xdeadbeef12345678',
        completedAt: '2026-11-24T12:00:00.000Z',
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/repayment successful/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId('repay-tx-hash')).toHaveTextContent('0xdeadbeef12345678');
  });

  it('shows an error on service rejection and allows retrying with the same idempotencyKey', async () => {
    mockedSubmitRepayment
      .mockRejectedValueOnce(new Error('Network timeout while broadcasting transaction'))
      .mockResolvedValueOnce({
        txId: '0xabcdef0123456789',
        completedAt: '2026-11-24T12:01:00.000Z',
      });

    const user = userEvent.setup();
    render(<TestWrapper />);
    await goToReviewStep(user, '500');

    await user.click(screen.getByRole('button', { name: /confirm repayment/i }));

    const alert = await screen.findByTestId('repay-submit-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent(/network timeout while broadcasting transaction/i);
    expect(screen.queryByText(/repayment successful/i)).not.toBeInTheDocument();

    const firstKey = mockedSubmitRepayment.mock.calls[0][0].idempotencyKey;

    await user.click(screen.getByRole('button', { name: /confirm repayment/i }));

    await waitFor(() => {
      expect(screen.getByText(/repayment successful/i)).toBeInTheDocument();
    });
    expect(mockedSubmitRepayment).toHaveBeenCalledTimes(2);
    expect(mockedSubmitRepayment.mock.calls[1][0].idempotencyKey).toBe(firstKey);
    expect(screen.getByTestId('repay-tx-hash')).toHaveTextContent('0xabcdef0123456789');
  });

  it('fails fast when offline without calling submitRepayment or faking success', async () => {
    setOnlineStatus(false);

    const user = userEvent.setup();
    render(<TestWrapper />);
    await goToReviewStep(user, '500');

    await user.click(screen.getByRole('button', { name: /confirm repayment/i }));

    const alert = await screen.findByTestId('repay-submit-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent(/offline/i);
    expect(mockedSubmitRepayment).not.toHaveBeenCalled();
    expect(screen.queryByText(/repayment successful/i)).not.toBeInTheDocument();
  });

  it('guards against double-clicking Confirm Repayment', async () => {
    let resolveSubmission!: (value: { txId: string; completedAt: string }) => void;
    mockedSubmitRepayment.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmission = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<TestWrapper />);
    await goToReviewStep(user, '500');

    const confirmBtn = screen.getByRole('button', { name: /confirm repayment/i });
    await user.dblClick(confirmBtn);

    expect(mockedSubmitRepayment).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmission({
        txId: '0x1122334455667788',
        completedAt: '2026-11-24T12:02:00.000Z',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('repay-tx-hash')).toHaveTextContent('0x1122334455667788');
    });
  });
});
