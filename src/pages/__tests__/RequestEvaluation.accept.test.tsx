import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { RequestEvaluation } from '../RequestEvaluation';
import { creditService } from '@/services/credit';
import { resetGlobalCreditLines, getGlobalCreditLines } from '@/hooks/useCreditLines';

const mockWallet = {
  publicKey: 'GBZXTESTWALLETADDRESS12345',
  network: 'TESTNET',
  type: 'freighter' as const,
};

let currentWalletState = {
  wallet: mockWallet as any,
  status: 'connected' as string,
  connect: vi.fn(),
};

vi.mock('@/context/WalletContext', async () => {
  const actual = await vi.importActual<any>('@/context/WalletContext');
  return {
    ...actual,
    useWallet: () => currentWalletState,
  };
});

describe('RequestEvaluation — Accept Offer Flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetGlobalCreditLines();
    currentWalletState = {
      wallet: mockWallet,
      status: 'connected',
      connect: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Scenario 1: Disconnected wallet on /open-credit
  it('Scenario 1: Disconnected wallet on /open-credit disables Start and shows "Connect wallet" prompt', () => {
    currentWalletState = {
      wallet: null,
      status: 'disconnected',
      connect: vi.fn(),
    };

    render(
      <MemoryRouter>
        <RequestEvaluation />
      </MemoryRouter>
    );

    const startBtn = screen.getByRole('button', { name: 'Start' });
    expect(startBtn).toBeDisabled();
    expect(screen.getByText('Connect wallet to start')).toBeInTheDocument();
    expect(screen.getByText(/A connected wallet is required/i)).toBeInTheDocument();
  });

  // Helper to drive the component to Step 4 with an approved offer
  const driveToStep4Offer = () => {
    render(
      <MemoryRouter>
        <RequestEvaluation />
      </MemoryRouter>
    );

    // Step 1: Start
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    // Step 2: Begin Evaluation
    fireEvent.click(screen.getByRole('button', { name: 'Begin Evaluation' }));

    // Step 3: Advance 46 seconds to complete evaluation
    // To ensure deterministic approved offer, mock Math.random
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    act(() => {
      vi.advanceTimersByTime(46000);
    });
  };

  // Scenario 2: Accept with a valid offer
  it('Scenario 2: Accept with a valid offer calls acceptOffer once, creates new line, and links to step 5 with ?highlight=', async () => {
    const acceptOfferSpy = vi.spyOn(creditService, 'acceptOffer');
    driveToStep4Offer();

    expect(screen.getByText('Credit Limit Offered')).toBeInTheDocument();

    // Toggle Preview Terms
    const termsDetails = screen.getByText('Preview Terms and Conditions').closest('details')!;
    termsDetails.open = true;
    fireEvent(termsDetails, new Event('toggle'));

    const acceptBtn = screen.getByRole('button', { name: 'Accept Credit Line' });
    expect(acceptBtn).toBeEnabled();

    await act(async () => {
      fireEvent.click(acceptBtn);
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(acceptOfferSpy).toHaveBeenCalledTimes(1);
    expect(acceptOfferSpy).toHaveBeenCalledWith(mockWallet.publicKey, expect.any(String));

    // Confirm Step 5 rendered
    expect(screen.getByText('Credit line created successfully')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Go to Credit Lines' });
    expect(link.getAttribute('href')).toMatch(/\/credit-lines\?highlight=CL-/);

    // Verify credit lines updated
    const lines = getGlobalCreditLines();
    expect(lines.some((l) => l.status === 'Active')).toBe(true);
  });

  // Scenario 3: Double-click Accept
  it('Scenario 3: Double-click Accept issues exactly one acceptOffer call', async () => {
    let resolveAccept: (val: any) => void;
    const acceptPromise = new Promise((resolve) => {
      resolveAccept = resolve;
    });
    const acceptOfferSpy = vi.spyOn(creditService, 'acceptOffer').mockReturnValue(acceptPromise as any);

    driveToStep4Offer();
    const termsDetails = screen.getByText('Preview Terms and Conditions').closest('details')!;
    termsDetails.open = true;
    fireEvent(termsDetails, new Event('toggle'));

    const acceptBtn = screen.getByRole('button', { name: 'Accept Credit Line' });
    fireEvent.click(acceptBtn);
    fireEvent.click(acceptBtn);

    expect(acceptOfferSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAccept!({ id: 'CL-9999', status: 'Active' });
    });

    expect(acceptOfferSpy).toHaveBeenCalledTimes(1);
  });

  // Scenario 4: Offer expires (fake timers)
  it('Scenario 4: Offer expires disabled Accept, shows Re-run evaluation, and announces at 60s', () => {
    driveToStep4Offer();
    const termsDetails = screen.getByText('Preview Terms and Conditions').closest('details')!;
    termsDetails.open = true;
    fireEvent(termsDetails, new Event('toggle'));

    expect(screen.getByText(/Offer expires in 14:59|Offer expires in 15:00/)).toBeInTheDocument();

    // Advance to 60s remaining (14 minutes = 840s)
    act(() => {
      vi.advanceTimersByTime(14 * 60 * 1000);
    });

    // Check announcement live region
    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent('Offer expires in 1 minute');

    // Advance past expiry (remaining 61s)
    act(() => {
      vi.advanceTimersByTime(61 * 1000);
    });

    expect(screen.getByText('Offer expired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept Credit Line' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Re-run evaluation' }).length).toBeGreaterThan(0);
  });

  // Scenario 5: Wallet switches between evaluation and accept
  it('Scenario 5: Wallet switches between evaluation and accept invalidates offer with wallet message', () => {
    const { rerender } = render(
      <MemoryRouter>
        <RequestEvaluation />
      </MemoryRouter>
    );

    // Step 1: Start
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    // Step 2: Begin Evaluation
    fireEvent.click(screen.getByRole('button', { name: 'Begin Evaluation' }));

    // Mock Math.random
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    act(() => {
      vi.advanceTimersByTime(46000);
    });

    const termsDetails = screen.getByText('Preview Terms and Conditions').closest('details')!;
    termsDetails.open = true;
    fireEvent(termsDetails, new Event('toggle'));

    // Switch wallet
    currentWalletState = {
      wallet: {
        publicKey: 'GDIFFERENTWALLET987654321',
        network: 'TESTNET',
        type: 'freighter' as const,
      },
      status: 'connected',
      connect: vi.fn(),
    };

    // Re-render to propagate context change
    rerender(
      <MemoryRouter>
        <RequestEvaluation />
      </MemoryRouter>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('This offer was issued to a different wallet.');
    expect(screen.getByRole('button', { name: 'Accept Credit Line' })).toBeDisabled();
  });

  // Scenario 6: acceptOffer rejects
  it('Scenario 6: acceptOffer rejects shows an error with role="alert", user stays on step 4, and Retry works', async () => {
    let shouldFail = true;
    const acceptOfferSpy = vi.spyOn(creditService, 'acceptOffer').mockImplementation(async () => {
      if (shouldFail) {
        throw new Error('Transaction rejected on-chain');
      }
      return { id: 'CL-8888', status: 'Active' } as any;
    });

    driveToStep4Offer();
    const termsDetails = screen.getByText('Preview Terms and Conditions').closest('details')!;
    termsDetails.open = true;
    fireEvent(termsDetails, new Event('toggle'));

    const acceptBtn = screen.getByRole('button', { name: 'Accept Credit Line' });
    await act(async () => {
      fireEvent.click(acceptBtn);
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Transaction rejected on-chain');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    // User stays on step 4
    expect(screen.getByText('Results')).toBeInTheDocument();

    // Now test Retry
    shouldFail = false;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByText('Credit line created successfully')).toBeInTheDocument();
  });

  // Scenario 7: Regression - step 5 is unreachable without a successful acceptOffer
  it('Scenario 7: Regression - step 5 is unreachable without a successful acceptOffer', () => {
    driveToStep4Offer();
    // Without clicking accept or if accept is disabled
    expect(screen.queryByText('Credit line created successfully')).not.toBeInTheDocument();
    expect(screen.queryByText('Go to Credit Lines')).not.toBeInTheDocument();
  });
});
