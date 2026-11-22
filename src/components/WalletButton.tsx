import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { WalletConnectionModal } from './WalletConnectionModal';
import { OnboardingFlow } from './OnboardingFlow';
import { WalletQrCode } from './WalletQrCode';
import { CopyToClipboard } from './CopyToClipboard';
import { formatRelative } from '../utils/dates';
import { useDetectedWallets } from '../hooks/useDetectedWallets';
import './WalletButton.css';

/**
 * Connected wallet dropdown component.
 * Extracted to ensure hooks are called unconditionally.
 */
const ConnectedWalletDropdown = () => {
  const {
    wallet,
    disconnect,
    isRemembered,
    forgetRememberedChoice,
    balances,
    lastUpdated,
    refreshBalance,
    setDropdownOpen,
  } = useWallet();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [announceMsg, setAnnounceMsg] = useState('');
  const announceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "Forget remembered choice" status announcement
  const [forgetAnnouncement, setForgetAnnouncement] = useState('');
  const forgetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleForgetChoice = useCallback(() => {
    forgetRememberedChoice();
    setForgetAnnouncement(
      'Saved wallet preference cleared. You will not be auto-connected next visit.',
    );
    if (forgetTimeoutRef.current !== null) {
      clearTimeout(forgetTimeoutRef.current);
    }
    forgetTimeoutRef.current = setTimeout(() => {
      setForgetAnnouncement('');
      forgetTimeoutRef.current = null;
    }, 3000);
  }, [forgetRememberedChoice]);

  // Notify context about dropdown visibility for polling
  useEffect(() => {
    setDropdownOpen(showDropdown);
  }, [showDropdown, setDropdownOpen]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (forgetTimeoutRef.current !== null) {
        clearTimeout(forgetTimeoutRef.current);
        forgetTimeoutRef.current = null;
      }
      if (announceTimeoutRef.current !== null) {
        clearTimeout(announceTimeoutRef.current);
        announceTimeoutRef.current = null;
      }
    };
  }, []);

  const handleToggleDropdown = () => {
    setShowDropdown(!showDropdown);
    if (showDropdown) {
      setShowQr(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
    setShowQr(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshBalance();
      setAnnounceMsg('Balance refreshed');
    } catch {
      setAnnounceMsg('Failed to refresh balance');
    } finally {
      setIsRefreshing(false);
      // Clear previous timeout before setting new one
      if (announceTimeoutRef.current !== null) {
        clearTimeout(announceTimeoutRef.current);
      }
      announceTimeoutRef.current = setTimeout(() => {
        setAnnounceMsg('');
        announceTimeoutRef.current = null;
      }, 3000);
    }
  };

  const formatPublicAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!wallet) return null;

  const balanceDisplay = balances ? balances.map((b, i) => (
    <div key={i} className="balance-item">
      <span className="label">Balance ({b.asset}):</span>
      <span className="value">{b.balance}</span>
    </div>
  )) : <span className="value">Unknown</span>;

  return (
    <div className="wallet-connected">
      <button
        className="wallet-address-btn"
        onClick={handleToggleDropdown}
        aria-haspopup="true"
        aria-expanded={showDropdown}
        aria-label={`Wallet connected: ${formatPublicAddress(wallet.publicKey)}`}
      >
        <span className="status-dot" aria-hidden="true"></span>
        <span className="sr-only">Status: Connected</span>
        {formatPublicAddress(wallet.publicKey)}
      </button>
      {showDropdown && (
        <div className={`wallet-dropdown ${showQr ? 'wallet-dropdown--expanded' : ''}`} role="menu">
          <div className="dropdown-item" role="menuitem">
            <span className="label">Wallet:</span>
            <span className="value">{wallet.type}</span>
          </div>
          <div className="dropdown-item" role="menuitem">
            <span className="label">Network:</span>
            <span className="value">{wallet.network}</span>
          </div>
          <div className="dropdown-item" role="menuitem">
            <span className="label">Balance:</span>
            <div className="balance-list">{balanceDisplay}</div>
          </div>
          <button
            className="refresh-btn"
            onClick={handleRefresh}
            aria-label="Refresh wallet balance"
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <span className="spinner" aria-hidden="true"></span>
            ) : (
              'Refresh'
            )}
          </button>
          {lastUpdated && (
            <div className="timestamp" role="status" aria-live="polite">
              Last updated: {formatRelative(lastUpdated)}
            </div>
          )}
          <span className="sr-only" role="status" aria-live="polite">{announceMsg}</span>
          <button
            type="button"
            className="qr-btn"
            role="menuitem"
            aria-expanded={showQr}
            onClick={() => setShowQr((v) => !v)}
          >
            {showQr ? 'Hide QR code' : 'Show QR code'}
          </button>
          {showQr && wallet?.publicKey && (
            <div className="wallet-qr-wrapper">
              <WalletQrCode address={wallet.publicKey} />
              <CopyToClipboard
                value={wallet.publicKey}
                ariaLabel="Copy wallet address"
              />
            </div>
          )}
          {isRemembered && (
            <button
              type="button"
              className="forget-btn"
              role="menuitem"
              onClick={handleForgetChoice}
              aria-label="Forget remembered wallet choice for next visit"
            >
              Forget remembered choice
            </button>
          )}
          {forgetAnnouncement && (
            <span className="sr-only" role="status" aria-live="polite">
              {forgetAnnouncement}
            </span>
          )}
          <button
            type="button"
            className="disconnect-btn"
            role="menuitem"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Disconnected wallet button component.
 * Extracted to ensure hooks are called unconditionally.
 */
const DisconnectedWalletButton = () => {
  const { connect } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { detectedWallets } = useDetectedWallets();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const handleConnect = () => {
    setShowModal(true);
  };

  const handleSuccess = () => {
    const hasCompletedOnboarding = localStorage.getItem('onboarding_completed');
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  };

  const handleWalletConnect = async (
    provider: Parameters<typeof connect>[0],
    options?: Parameters<typeof connect>[1]
  ) => {
    const result = await connect(provider, options);
    // Only proceed to success flow if connection succeeded
    if (result.ok) {
      handleSuccess();
    } else {
      // Re-throw the error so the modal can catch it and stay open
      throw result.error;
    }
  };

  return (
    <>
      <button ref={triggerRef} className="connect-wallet-btn" onClick={handleConnect}>
        Connect Wallet
      </button>
      <WalletConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConnect={handleWalletConnect}
        detectedWallets={detectedWallets}
        triggerRef={triggerRef}
      />
      <OnboardingFlow
        isOpen={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
        onSkip={() => setShowOnboarding(false)}
      />
    </>
  );
};

/**
 * Main WalletButton component.
 * Conditionally renders one of two sub-components based on connection status,
 * but all hooks are called unconditionally in their respective components.
 */
export const WalletButton = () => {
  const { wallet, status } = useWallet();

  if (wallet && status === 'connected') {
    return <ConnectedWalletDropdown />;
  }

  return <DisconnectedWalletButton />;
};
