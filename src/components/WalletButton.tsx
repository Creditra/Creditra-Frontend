import { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { WalletConnectionModal } from './WalletConnectionModal';
import { OnboardingFlow } from './OnboardingFlow';
import './WalletButton.css';

export const WalletButton = () => {
  const { wallet, status, disconnect } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleConnect = () => {
    setShowModal(true);
  };

  const handleSuccess = () => {
    const hasCompletedOnboarding = localStorage.getItem('onboarding_completed');
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (wallet && status === 'connected') {
    return (
      <div className="wallet-connected">
        <button 
          className="wallet-address-btn" 
          onClick={() => setShowDropdown(!showDropdown)}
          aria-haspopup="true"
          aria-expanded={showDropdown}
          aria-label={`Wallet connected: ${formatAddress(wallet.publicKey)}`}
        >
          <span className="status-dot" aria-hidden="true"></span>
          <span className="sr-only">Status: Connected</span>
          {formatAddress(wallet.publicKey)}
        </button>
        {showDropdown && (
          <div className="wallet-dropdown" role="menu">
            <div className="dropdown-item" role="menuitem">
              <span className="label">Wallet:</span>
              <span className="value">{wallet.type}</span>
            </div>
            <div className="dropdown-item" role="menuitem">
              <span className="label">Network:</span>
              <span className="value">{wallet.network}</span>
            </div>
            <button className="disconnect-btn" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button className="connect-wallet-btn" onClick={handleConnect}>
        Connect Wallet
      </button>
      <WalletConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
      />
      <OnboardingFlow
        isOpen={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
        onSkip={() => setShowOnboarding(false)}
      />
    </>
  );
};
