import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { WalletConnectionModal } from './WalletConnectionModal';
import { OnboardingFlow } from './OnboardingFlow';
import { WalletQrCode } from './WalletQrCode';
import { CopyToClipboard } from './CopyToClipboard';
import { formatRelative } from '../utils/dates';
import './WalletButton.css';

export const WalletButton = () => {
  // Pull `isRemembered` and `forgetRememberedChoice` so we can render the
  // "Forget choice" affordance inside the connected-wallet dropdown.
  const {
    wallet,
    status,
    connect,
    disconnect,
    isRemembered,
    forgetRememberedChoice,
  } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showQr, setShowQr] = useState(false);

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

  // "Forget remembered choice" — distinct from Disconnect: it does NOT
  // close the session, only revokes the opt-in for next-visit auto-reconnect.
  // A short status message is announced to assistive tech so the change is
  // not silent.
  const [forgetAnnouncement, setForgetAnnouncement] = useState('');
  // Hold the dismissal timer so it can be cleared on unmount or on the next
  // announcement — no stale setState-after-unmount warnings.
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
  useEffect(() => {
    return () => {
      if (forgetTimeoutRef.current !== null) {
        clearTimeout(forgetTimeoutRef.current);
        forgetTimeoutRef.current = null;
      }
    };
  }, []);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (wallet && status === 'connected') {
    // Notify context about dropdown visibility for polling
    const { balances, lastUpdated, refreshBalance, setDropdownOpen } = useWallet();
    // Ensure polling starts/stops when dropdown visibility changes
    useEffect(() => {
      setDropdownOpen(showDropdown);
    }, [showDropdown, setDropdownOpen]);

    const balanceDisplay = balances ? balances.map((b, i) => (
      <div key={i} className="balance-item">
        <span className="label">Balance ({b.asset}):</span>
        <span className="value">{b.balance}</span>
      </div>
    )) : <span className="value">Unknown</span>;

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [announceMsg, setAnnounceMsg] = useState('');

    const handleRefresh = async () => {
      setIsRefreshing(true);
      try {
        await refreshBalance();
        setAnnounceMsg('Balance refreshed');
      } catch {
        setAnnounceMsg('Failed to refresh balance');
      } finally {
        setIsRefreshing(false);
        // Clear announcement after a short time for screen readers
        setTimeout(() => setAnnounceMsg(''), 3000);
      }
    };

    return (
      <div className="wallet-connected">
        <button
          className="wallet-address-btn"
          onClick={handleToggleDropdown}
          aria-haspopup="true"
          aria-expanded={showDropdown}
          aria-label={`Wallet connected: ${formatAddress(wallet.publicKey)}`}
        >
          <span className="status-dot" aria-hidden="true"></span>
          <span className="sr-only">Status: Connected</span>
          {formatAddress(wallet.publicKey)}
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
            {/* Privacy control: only shown when the user opted-in to remember.
                Keeps the dropdown tidy for users who never opted in. */}
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
  }

  return (
    <>
      <button className="connect-wallet-btn" onClick={handleConnect}>
        Connect Wallet
      </button>
      <WalletConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConnect={handleWalletConnect}
      />
      <OnboardingFlow
        isOpen={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
        onSkip={() => setShowOnboarding(false)}
      />
    </>
  );
};
