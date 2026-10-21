import { useRef, useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { WalletConnectionModal } from './WalletConnectionModal';
import type { WalletProvider } from './WalletConnectionModal';
import type { ConnectOptions } from '../context/WalletContext';

export function ConnectWalletPrompt({ assetCode }: { assetCode: string }) {
  const { connect } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleConnect = (
    provider: WalletProvider,
    options?: ConnectOptions,
  ) => {
    setIsModalOpen(false);
    void connect(provider, options);
  };

  return (
    <section
      className="rounded-lg border border-border bg-surface p-6 text-center"
      aria-labelledby="connect-wallet-title"
    >
      <h2 id="connect-wallet-title" className="text-lg font-semibold text-foreground">
        Connect wallet
      </h2>
      <p className="mt-2 text-sm text-muted">
        Connect a wallet to check your {assetCode} balance and make a repayment.
      </p>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Connect wallet
      </button>
      <WalletConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnect={handleConnect}
        triggerRef={triggerRef}
      />
    </section>
  );
}
