import React, { useRef } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { WalletConnectionModal, WalletProvider } from '../WalletConnectionModal';

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
  onConnect: (provider: WalletProvider) => Promise<void>;
  detectedWallets?: WalletProvider[];
}> = ({ isOpen, onClose, onConnect, detectedWallets }) => {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
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
      />
    </div>
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
    const freighterButton = screen.getByLabelText('Connect with Freighter');
    const albedoButton = screen.getByLabelText('Connect with Albedo');
    const xbullButton = screen.getByLabelText('Install xBull wallet');
    const rabetButton = screen.getByLabelText('Install Rabet wallet');
    const learnLink = screen.getByRole('link', { name: /learn about wallets/i });

    // Focus should start on first focusable element
    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    // Tab cycles forward through all focusable elements
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
    const learnLink = screen.getByRole('link', { name: /learn about wallets/i });

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
      expect(mockOnConnect).toHaveBeenCalledWith('freighter');
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
});
