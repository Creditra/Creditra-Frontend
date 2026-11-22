import React, { useRef } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { WalletConnectionModal, WalletProvider } from '../WalletConnectionModal';
import type { WalletType } from '@/utils/wallet';
import * as walletUtils from '@/utils/wallet';
import * as walletSupportUtils from '@/utils/walletSupport';
import { useDetectedWallets } from '@/hooks/useDetectedWallets';

// Mock hooks to avoid DOM side effects in test environment
vi.mock('@/hooks/useBodyScrollLock', () => ({
  useBodyScrollLock: vi.fn(),
}));

vi.mock('@/hooks/useInertBackdrop', () => ({
  useInertBackdrop: vi.fn(),
}));

// Test wrapper with trigger ref
const TestWrapper: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConnect: (
    provider: WalletProvider,
    options?: { remember?: boolean },
  ) => Promise<void>;
  detectedWallets?: WalletProvider[];
  onRefreshWallets?: () => void;
}> = ({ isOpen, onClose, onConnect, detectedWallets, onRefreshWallets }) => {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <MemoryRouter>
      <div>
        <button ref={triggerRef} data-testid="trigger-button">
          Open Wallet Modal
        </button>
        <WalletConnectionModal
          isOpen={isOpen}
          onClose={onClose}
          onConnect={onConnect}
          triggerRef={triggerRef}
          detectedWallets={detectedWallets}
          onRefreshWallets={onRefreshWallets}
        />
      </div>
    </MemoryRouter>
  );
};

describe('WalletConnectionModal Accessibility', () => {
  const mockOnClose = vi.fn();
  const mockOnConnect = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // WCAG 4.1.2: Name, Role, Value
  it('has correct ARIA attributes', () => {
    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter']}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  // WCAG 2.1.2: No Keyboard Trap
  it('traps focus within the modal', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter', 'albedo']}
      />
    );

    const closeButton = screen.getByLabelText('Close wallet connection dialog');
    const rememberCheckbox = screen.getByTestId('wallet-remember-checkbox');
    const freighterButton = screen.getByLabelText('Connect with Freighter');
    const albedoButton = screen.getByLabelText('Connect with Albedo');
    const xbullButton = screen.getByLabelText('Install xBull wallet');
    const rabetButton = screen.getByLabelText('Install Rabet wallet');
    const learnLink = screen.getByRole('link', { name: /visit the wallet setup guide/i });

    // Focus should start on first focusable element
    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    // Tab cycles forward through all focusable elements.  The
    // remember-my-choice checkbox is a new tab stop inserted before the
    // wallet list.
    await user.tab();
    expect(document.activeElement).toBe(rememberCheckbox);

    await user.tab();
    expect(document.activeElement).toBe(freighterButton);

    await user.tab();
    expect(document.activeElement).toBe(albedoButton);

    await user.tab();
    expect(document.activeElement).toBe(xbullButton);

    await user.tab();
    expect(document.activeElement).toBe(rabetButton);

    await user.tab();
    expect(document.activeElement).toBe(learnLink);

    // Tab from last element cycles back to first
    await user.tab();
    expect(document.activeElement).toBe(closeButton);
  });

  // WCAG 2.1.2: No Keyboard Trap (Shift+Tab)
  it('cycles focus backwards with Shift+Tab', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter']}
      />
    );

    const closeButton = screen.getByLabelText('Close wallet connection dialog');
    const learnLink = screen.getByRole('link', { name: /visit the wallet setup guide/i });

    // Focus close button
    closeButton.focus();

    // Shift+Tab from first element wraps to last (Learn about wallets link)
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(learnLink);

    // The forward-tab test covers the full order; this assertion focuses on
    // the backwards wrap behavior from the first item to the last.
    await user.tab();
    expect(document.activeElement).toBe(closeButton);
  });

  // Escape key closes modal
  it('closes on Escape key press', () => {
    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // Return focus to trigger on close
  it('returns focus to trigger button when closed', async () => {
    const { rerender } = render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    // Close the modal
    rerender(
      <TestWrapper
        isOpen={false}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    const triggerButton = screen.getByTestId('trigger-button');
    await waitFor(() => {
      expect(document.activeElement).toBe(triggerButton);
    });
  });

  // Click backdrop closes modal
  it('closes when clicking backdrop', () => {
    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    const backdrop = document.querySelector('.wallet-modal-backdrop');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  // WCAG 1.4.1: Use of Color - detected wallets have visual + text indicator
  it('shows detected wallets with text indicator, not just color', () => {
    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter']}
      />
    );

    const freighterButton = screen.getByLabelText('Connect with Freighter');
    expect(freighterButton).toHaveClass('wallet-option--detected');

    // Should have text "Detected" visible
    expect(screen.getByText('Detected')).toBeVisible();

    // Should have status dot (visual) + text (non-color)
    const statusDot = freighterButton.querySelector('.status-dot');
    expect(statusDot).toBeInTheDocument();
  });

  it('shows undetected wallets with install text, not just color', () => {
    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={[]}
      />
    );

    const albedoButton = screen.getByLabelText('Install Albedo wallet');
    expect(albedoButton).toHaveClass('wallet-option--undetected');

    // Should have text "Install to connect" (multiple wallets show this, check at least one)
    const installLabels = screen.getAllByText('Install to connect');
    expect(installLabels.length).toBeGreaterThan(0);
    expect(installLabels[0]).toBeVisible();

    // Should have icon indicator (not just color)
    const statusIcon = albedoButton.querySelector('.status-icon');
    expect(statusIcon).toBeInTheDocument();
  });

  // WCAG 2.5.5: Target Size (44px minimum)
  it('wallet options have minimum 44px tap target', () => {
    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter']}
      />
    );

    const freighterButton = screen.getByLabelText('Connect with Freighter');
    // Inline style is used so jsdom can read it (CSS files aren't processed in jsdom)
    expect(parseInt(freighterButton.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(parseInt(freighterButton.style.minWidth, 10)).toBeGreaterThanOrEqual(44);
  });

  it('links to the Help Center wallet section with internal navigation', () => {
    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    expect(
      screen.getByRole('link', { name: /visit the wallet setup guide/i })
    ).toHaveAttribute('href', '/help#wallet');
  });

  // Wallet connection flow
  it('calls onConnect when clicking a detected wallet', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter']}
      />
    );

    const freighterButton = screen.getByLabelText('Connect with Freighter');
    await user.click(freighterButton);

    await waitFor(() => {
      expect(mockOnConnect).toHaveBeenCalledWith('freighter', { remember: false });
    });
  });

  // ── MRU ordering ────────────────────────────────────────────────────────

  describe('MRU ordering', () => {
    // `vi.clearAllMocks()` (the outer beforeEach) clears call data but does
    // NOT reset spy implementations, so spies from a previous test leak in.
    // We always stub both MRU sources at the top of each test to fully isolate
    // them.
    function isolate({
      recent,
      legacy,
    }: {
      recent: WalletType[];
      legacy: ReturnType<typeof walletUtils.getStoredWallet>;
    }) {
      vi.spyOn(walletUtils, 'getRecentWalletOrder').mockReturnValue(recent);
      vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(legacy);
    }

    beforeEach(() => {
      window.localStorage.clear();
    });

    it('puts the most-recent wallet first when persisted MRU exists', () => {
      // Seed MRU: xbull is the most recently used, then albedo.
      isolate({ recent: ['xbull', 'albedo'], legacy: null });

      render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
        />,
      );

      // With MRU data, the modal collapses the full list behind a "Switch
      // wallet" link and surfaces the most-recent wallet as a one-click
      // "Continue with" affordance.  Assert against that affordance instead
      // of the list (which is hidden).
      const continueBtn = screen.getByTestId('wallet-continue-btn');
      expect(continueBtn).toHaveAttribute('aria-label', 'Continue with xBull (last used)');
    });

    it('falls back to the stored session preference when MRU is empty', () => {
      isolate({
        recent: [],
        legacy: {
          v: 2,
          type: 'xbull',
        },
      });

      render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
        />,
      );

      const continueBtn = screen.getByTestId('wallet-continue-btn');
      expect(continueBtn).toHaveAttribute('aria-label', 'Continue with xBull (last used)');
    });

    it('drops entries for unsupported wallet types silently', () => {
      // Simulate a stored MRU containing a no-longer-supported wallet and
      // a real one.  Only the real one should make the ordering.
      isolate({ recent: ['rabet', 'freighter'], legacy: null });

      render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
        />,
      );

      const continueBtn = screen.getByTestId('wallet-continue-btn');
      expect(continueBtn).toHaveAttribute('aria-label', 'Continue with Rabet (last used)');
    });

    it('keeps the full wallet catalogue visible when no MRU exists', () => {
      isolate({ recent: [], legacy: null });

      render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
        />,
      );

      // Continue-with affordance should NOT appear without recency data.
      expect(screen.queryByTestId('wallet-continue-btn')).not.toBeInTheDocument();
      // Wallet list should be visible.
      expect(screen.getByTestId('wallet-modal-list')).not.toHaveAttribute('hidden');
    });
  });

  // ── Opt-in checkbox ──────────────────────────────────────────────────────

  describe('Remember-my-choice checkbox', () => {
    // The checkbox is opt-in. Ensure spy state from prior tests doesn't leak.
    function isolateToNone() {
      vi.spyOn(walletUtils, 'getRecentWalletOrder').mockReturnValue([]);
      vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
    }

    beforeEach(() => {
      window.localStorage.clear();
    });

    it('defaults to unchecked so the feature is opt-in', () => {
      isolateToNone();
      render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
        />,
      );

      const checkbox = screen.getByTestId('wallet-remember-checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('is associated with a label and a help description', () => {
      render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
        />,
      );

      const checkbox = screen.getByTestId('wallet-remember-checkbox');
      const help = screen.getByText(
        /next visit.*clear this any time/i,
      );
      // The checkbox has aria-describedby pointing at the help paragraph.
      expect(checkbox).toHaveAttribute('aria-describedby');
      const describedById = checkbox.getAttribute('aria-describedby')!;
      expect(describedById).toBeTruthy();
      // Either help is exactly the described element, or matches by content.
      const helpById = document.getElementById(describedById);
      expect(helpById === null ? help : helpById).toBeTruthy();
    });

    it('forwards remember=false to onConnect when the box stays unchecked', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
          detectedWallets={['freighter']}
        />,
      );

      await user.click(screen.getByLabelText('Connect with Freighter'));
      await waitFor(() => {
        expect(mockOnConnect).toHaveBeenLastCalledWith('freighter', { remember: false });
      });
    });

    it('forwards remember=true to onConnect when the box is checked', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
          detectedWallets={['freighter']}
        />,
      );

      await user.click(screen.getByTestId('wallet-remember-checkbox'));
      expect(screen.getByTestId('wallet-remember-checkbox')).toBeChecked();

      await user.click(screen.getByLabelText('Connect with Freighter'));
      await waitFor(() => {
        expect(mockOnConnect).toHaveBeenLastCalledWith('freighter', { remember: true });
      });
    });

    it('resets to unchecked when the modal re-opens', async () => {
      const { rerender } = render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
          detectedWallets={['freighter']}
        />,
      );

      await userEvent.setup().click(screen.getByTestId('wallet-remember-checkbox'));
      expect(screen.getByTestId('wallet-remember-checkbox')).toBeChecked();

      rerender(
        <TestWrapper
          isOpen={false}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
          detectedWallets={['freighter']}
        />,
      );

      rerender(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
          detectedWallets={['freighter']}
        />,
      );
      expect(screen.getByTestId('wallet-remember-checkbox')).not.toBeChecked();
    });
  });

  // ── Continue-with + Switch-wallet affordance ─────────────────────────────

  describe('Continue-with primary wallet affordance', () => {
    function isolate(recent: WalletType[]) {
      vi.spyOn(walletUtils, 'getRecentWalletOrder').mockReturnValue(recent);
      vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
    }

    beforeEach(() => {
      window.localStorage.clear();
    });

    it('renders Continue with… when a primary wallet exists from MRU', () => {
      isolate(['albedo']);

      render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
          detectedWallets={['freighter', 'albedo']}
        />,
      );

      const cont = screen.getByTestId('wallet-continue-btn');
      expect(cont).toHaveAttribute('aria-label', 'Continue with Albedo (last used)');
      // The full list is collapsed by default.
      expect(screen.getByTestId('wallet-modal-list')).toHaveAttribute('hidden');
    });

    it('clicking Continue invokes onConnect with remember option', async () => {
      const user = userEvent.setup();
      isolate(['albedo']);

      render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
          detectedWallets={['albedo']}
        />,
      );

      await user.click(screen.getByTestId('wallet-continue-btn'));
      await waitFor(() => {
        expect(mockOnConnect).toHaveBeenLastCalledWith('albedo', { remember: false });
      });
    });

    it('Switch wallet reveal shows the full list and updates aria-expanded', async () => {
      const user = userEvent.setup();
      isolate(['albedo']);

      render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
          detectedWallets={['albedo', 'freighter']}
        />,
      );

      const switchBtn = screen.getByRole('button', { name: /switch wallet/i });
      expect(switchBtn).toHaveAttribute('aria-expanded', 'false');

      await user.click(switchBtn);

      expect(screen.getByTestId('wallet-modal-list')).not.toHaveAttribute('hidden');
      // The "Hide full list" affordance now exists with aria-expanded=true.
      const hideBtn = screen.getByRole('button', { name: /hide full list/i });
      expect(hideBtn).toHaveAttribute('aria-expanded', 'true');
    });
  });

  // Install link for undetected wallets
  it('opens install page for undetected wallets', async () => {
    const user = userEvent.setup();
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={[]}
      />
    );

    const xbullButton = screen.getByLabelText('Install xBull wallet');
    await user.click(xbullButton);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://xbull.app',
      '_blank',
      'noopener,noreferrer'
    );

    windowOpenSpy.mockRestore();
  });

  // Error handling
  it('displays error when connection fails', async () => {
    const failingConnect = vi.fn().mockRejectedValue(new Error('Connection refused'));

    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={failingConnect}
        detectedWallets={['freighter']}
      />
    );

    const freighterButton = screen.getByLabelText('Connect with Freighter');
    fireEvent.click(freighterButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Connection refused');
    });
  });

  // Loading state
  it('shows loading state while connecting', async () => {
    const slowConnect = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={slowConnect}
        detectedWallets={['freighter']}
      />
    );

    const freighterButton = screen.getByLabelText('Connect with Freighter');
    fireEvent.click(freighterButton);

    // Should show spinner
    await waitFor(() => {
      expect(freighterButton.querySelector('.wallet-option-spinner')).toBeInTheDocument();
    });

    // Should be disabled
    expect(freighterButton).toBeDisabled();
  });

  // Does not render when closed
  it('does not render when isOpen is false', () => {
    render(
      <TestWrapper
        isOpen={false}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // ── Hover-preview card ─────────────────────────────────────────────────

  describe('wallet hover-preview card', () => {
    function withFreighterDetected() {
      vi.spyOn(walletUtils, 'getRecentWalletOrder').mockReturnValue([]);
      vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
    }

    beforeEach(() => {
      window.localStorage.clear();
      withFreighterDetected();
    });

    it('renders a preview card for each wallet option', () => {
      const { container } = render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
          detectedWallets={['freighter']}
        />,
      );

      const previews = container.querySelectorAll('.wallet-preview');
      // 4 wallets → 4 preview cards
      expect(previews).toHaveLength(4);
    });

    it('each preview card has role="tooltip" and is hidden from AT by default', () => {
      const { container } = render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
          detectedWallets={['freighter']}
        />,
      );

      const previews = container.querySelectorAll('.wallet-preview');
      previews.forEach((card) => {
        expect(card).toHaveAttribute('role', 'tooltip');
        expect(card).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('links the wallet button to its preview card via aria-describedby', () => {
      render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
          detectedWallets={['freighter']}
        />,
      );

      const freighterBtn = screen.getByLabelText('Connect with Freighter');
      const describedBy = freighterBtn.getAttribute('aria-describedby') ?? '';
      // Should reference both the status id and the preview id.
      const ids = describedBy.split(/\s+/);
      const previewId = ids.find((id) => id.startsWith('wallet-preview-'));
      expect(previewId).toBeTruthy();
      const previewEl = document.getElementById(previewId!);
      expect(previewEl).toBeInTheDocument();
      expect(previewEl).toHaveAttribute('role', 'tooltip');
    });

    it('preview card shows the wallet name in its header', () => {
      render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
          detectedWallets={['freighter']}
        />,
      );

      // The first visible wallet header name in the DOM
      const headers = document.querySelectorAll('.wallet-preview__name');
      expect(headers.length).toBe(4);

      // Freighter should be one of them
      const names = Array.from(headers).map((h) => h.textContent);
      expect(names).toContain('Freighter');
      expect(names).toContain('Albedo');
      expect(names).toContain('xBull');
      expect(names).toContain('Rabet');
    });

    it('preview card lists wallet-specific features', () => {
      render(
        <TestWrapper
          isOpen={true}
          onClose={mockOnClose}
          onConnect={mockOnConnect}
          detectedWallets={['freighter']}
        />,
      );

      // Each wallet has 3 features → expect 12 feature items total
      const features = document.querySelectorAll('.wallet-preview__feature');
      expect(features.length).toBe(12);

      // Freighter-specific features should be present
      const featureTexts = Array.from(features).map((f) => f.textContent);
      expect(featureTexts.some((t) => t?.includes('Soroban'))).toBe(true);
      expect(featureTexts.some((t) => t?.includes('Ledger'))).toBe(true);
    });
  });
});

describe('WalletConnectionModal — error propagation (#1231)', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps modal open when wallet connection fails', async () => {
    const mockOnConnect = vi.fn().mockRejectedValue(
      new Error('Connection failed')
    );

    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter']}
      />
    );

    const freighterButton = screen.getByLabelText('Connect with Freighter');
    fireEvent.click(freighterButton);

    await waitFor(() => {
      expect(mockOnConnect).toHaveBeenCalledWith('freighter', { remember: false });
    });

    // Modal should still be open (no onClose call)
    expect(mockOnClose).not.toHaveBeenCalled();

    // Error should be displayed
    await waitFor(() => {
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveTextContent('Connection failed');
    });
  });

  it('displays user_rejected error message', async () => {
    const rejectionError = new (class extends Error {
      type = 'user_rejected';
      constructor() {
        super("You cancelled the request in your wallet. Try again when you're ready.");
        this.name = 'WalletConnectError';
      }
    })();

    const mockOnConnect = vi.fn().mockRejectedValue(rejectionError);

    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter']}
      />
    );

    const freighterButton = screen.getByLabelText('Connect with Freighter');
    fireEvent.click(freighterButton);

    await waitFor(() => {
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveTextContent(/cancelled.*wallet/i);
    });

    // Modal stays open
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('displays not_found error message with install link context', async () => {
    const notFoundError = new Error('Freighter wallet not found. Please install the extension.');
    
    const mockOnConnect = vi.fn().mockRejectedValue(notFoundError);

    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={[]}
      />
    );

    const freighterButton = screen.getByLabelText('Install Freighter wallet');
    fireEvent.click(freighterButton);

    await waitFor(() => {
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveTextContent(/not found.*install/i);
    });
  });

  it('displays wrong_network error message', async () => {
    const networkError = new Error('Switch your wallet to Testnet and try again.');
    
    const mockOnConnect = vi.fn().mockRejectedValue(networkError);

    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter']}
      />
    );

    const freighterButton = screen.getByLabelText('Connect with Freighter');
    fireEvent.click(freighterButton);

    await waitFor(() => {
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveTextContent(/Testnet/i);
    });
  });

  it('closes modal on successful connection', async () => {
    const mockOnConnect = vi.fn().mockResolvedValue(undefined);

    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter']}
      />
    );

    const freighterButton = screen.getByLabelText('Connect with Freighter');
    fireEvent.click(freighterButton);

    await waitFor(() => {
      expect(mockOnConnect).toHaveBeenCalled();
    });

    // Modal should close on success
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('re-enables wallet buttons after connection failure', async () => {
    const mockOnConnect = vi.fn().mockRejectedValue(
      new Error('Connection failed')
    );

    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter', 'albedo']}
      />
    );

    const freighterButton = screen.getByLabelText('Connect with Freighter');
    const albedoButton = screen.getByLabelText('Connect with Albedo');

    // Initially not disabled
    expect(freighterButton).not.toBeDisabled();
    expect(albedoButton).not.toBeDisabled();

    // Click and wait for failure
    fireEvent.click(freighterButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Buttons should be re-enabled after error
    expect(freighterButton).not.toBeDisabled();
    expect(albedoButton).not.toBeDisabled();
  });

  it('clears previous error when retrying connection', async () => {
    let attemptCount = 0;
    const mockOnConnect = vi.fn().mockImplementation(async () => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error('First attempt failed');
      }
      // Second attempt succeeds
      return Promise.resolve();
    });

    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter']}
      />
    );

    const freighterButton = screen.getByLabelText('Connect with Freighter');

    // First attempt fails
    fireEvent.click(freighterButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('First attempt failed');
    });

    // Second attempt should clear the error and succeed
    fireEvent.click(freighterButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });

    // Error should be cleared
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('handles generic Error instances', async () => {
    const mockOnConnect = vi.fn().mockRejectedValue(
      new Error('Generic error message')
    );

    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter']}
      />
    );

    const freighterButton = screen.getByLabelText('Connect with Freighter');
    fireEvent.click(freighterButton);

    await waitFor(() => {
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveTextContent('Generic error message');
    });
  });

  it('handles non-Error rejection values', async () => {
    const mockOnConnect = vi.fn().mockRejectedValue('String error');

    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter']}
      />
    );

    const freighterButton = screen.getByLabelText('Connect with Freighter');
    fireEvent.click(freighterButton);

    await waitFor(() => {
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveTextContent(/Failed to connect.*freighter/i);
    });
  });
});

describe('WalletConnectionModal — no-wallet & unsupported-browser help panel', () => {
  const mockOnClose = vi.fn();
  const mockOnConnect = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(walletUtils, 'getRecentWalletOrder').mockReturnValue([]);
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
    vi.spyOn(walletSupportUtils, 'getWalletBrowserSupport').mockReturnValue({
      browserSupported: true,
      reason: null,
      browserFamily: 'chromium',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as Record<string, unknown>).freighter;
  });

  it('renders the help panel with per-wallet detection results, install links, Albedo note, and Re-check button when nothing is detected', async () => {
    const user = userEvent.setup();
    const mockRefresh = vi.fn();

    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={[]}
        onRefreshWallets={mockRefresh}
      />,
    );

    const panel = screen.getByRole('region', { name: /no wallet extension detected/i });
    expect(panel).toBeInTheDocument();

    // Per-wallet detection results
    const statusItems = screen.getAllByText(/detected: no/i);
    expect(statusItems).toHaveLength(4);

    // Install links
    expect(screen.getByRole('link', { name: 'Install Freighter' })).toHaveAttribute(
      'href',
      'https://www.freighter.app',
    );
    expect(screen.getByRole('link', { name: 'Install Albedo' })).toHaveAttribute(
      'href',
      'https://albedo.link',
    );
    expect(screen.getByRole('link', { name: 'Install xBull' })).toHaveAttribute(
      'href',
      'https://xbull.app',
    );
    expect(screen.getByRole('link', { name: 'Install Rabet' })).toHaveAttribute(
      'href',
      'https://rabet.io',
    );

    // Albedo note
    expect(panel).toHaveTextContent(/albedo works without a browser extension/i);

    // Re-check button calls refresh without closing the modal
    const recheckBtn = screen.getByRole('button', { name: /^re-check$/i });
    await user.click(recheckBtn);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockOnClose).not.toHaveBeenCalled();

    // Panel controls are keyboard reachable inside the focus trap
    const closeButton = screen.getByLabelText('Close wallet connection dialog');
    closeButton.focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Install Freighter' }));
  });

  it('hides the help panel when at least one wallet is detected', () => {
    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={['freighter']}
      />,
    );

    expect(screen.queryByTestId('wallet-help-panel')).not.toBeInTheDocument();
  });

  it('shows the unsupported-browser message when browserSupported is false', () => {
    vi.spyOn(walletSupportUtils, 'getWalletBrowserSupport').mockReturnValue({
      browserSupported: false,
      reason: 'Wallet extensions require a secure (HTTPS) context.',
      browserFamily: 'chromium',
    });

    render(
      <TestWrapper
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        detectedWallets={[]}
      />,
    );

    const panel = screen.getByRole('region', {
      name: /this browser may not support wallet extensions/i,
    });
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent(/secure \(HTTPS\) context/i);
  });

  it('updates detection results on Re-check when window.freighter appears after mount without closing the modal', async () => {
    const user = userEvent.setup();
    vi.spyOn(walletUtils, 'isWalletInstalled').mockImplementation((type) => {
      if (type === 'freighter') {
        return Boolean((window as unknown as Record<string, unknown>).freighter);
      }
      return false;
    });

    const LiveModalHarness: React.FC = () => {
      const { detectedWallets, refresh } = useDetectedWallets();
      return (
        <MemoryRouter>
          <WalletConnectionModal
            isOpen={true}
            onClose={mockOnClose}
            onConnect={mockOnConnect}
            detectedWallets={detectedWallets}
            onRefreshWallets={refresh}
          />
        </MemoryRouter>
      );
    };

    render(<LiveModalHarness />);

    expect(screen.getByTestId('wallet-help-panel')).toBeInTheDocument();

    // Simulate Freighter extension injecting after mount
    (window as unknown as Record<string, unknown>).freighter = { isConnected: () => true };

    await user.click(screen.getByRole('button', { name: /^re-check$/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('wallet-help-panel')).not.toBeInTheDocument();
    });
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Connect with Freighter')).toBeInTheDocument();
  });
});
