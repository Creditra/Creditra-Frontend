import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConnectWalletPrompt } from './ConnectWalletPrompt';

const connect = vi.fn();

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({ connect }),
}));

vi.mock('./WalletConnectionModal', () => ({
  WalletConnectionModal: ({
    isOpen,
    onClose,
    onConnect,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConnect: (provider: string, options?: unknown) => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label="Mock wallet modal">
        <button type="button" onClick={onClose}>
          mock-close
        </button>
        <button
          type="button"
          onClick={() => onConnect('freighter', { remember: true })}
        >
          mock-connect
        </button>
      </div>
    ) : null,
}));

describe('ConnectWalletPrompt', () => {
  beforeEach(() => {
    connect.mockReset();
  });

  it('renders a region labelled by the "Connect wallet" heading', () => {
    render(<ConnectWalletPrompt assetCode="USDC" />);
    const region = screen.getByRole('region', { name: 'Connect wallet' });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-labelledby', 'connect-wallet-title');
  });

  it.each(['USDC', 'XLM', 'EURC'])(
    'shows the %s asset code in the copy',
    (assetCode) => {
      render(<ConnectWalletPrompt assetCode={assetCode} />);
      expect(
        screen.getByText(
          `Connect a wallet to check your ${assetCode} balance and make a repayment.`,
        ),
      ).toBeInTheDocument();
    },
  );

  it('keeps the modal closed until the button is clicked', () => {
    render(<ConnectWalletPrompt assetCode="USDC" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the modal when the Connect wallet button is clicked', () => {
    render(<ConnectWalletPrompt assetCode="USDC" />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes the modal when onClose is called', () => {
    render(<ConnectWalletPrompt assetCode="USDC" />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));
    fireEvent.click(screen.getByRole('button', { name: 'mock-close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();
  });

  it('calls connect once with provider and options, and closes the modal', () => {
    render(<ConnectWalletPrompt assetCode="USDC" />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));
    fireEvent.click(screen.getByRole('button', { name: 'mock-connect' }));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith('freighter', { remember: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
