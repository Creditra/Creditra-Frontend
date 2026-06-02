/**
 * WalletConnectionModal.tsx
 *
 * Accessible wallet connection dialog with:
 * - Focus trap (Tab cycles within modal, Shift+Tab cycles backwards)
 * - Escape key closes modal
 * - Return focus to trigger button on close
 * - Background content marked inert
 * - Body scroll locked while open
 * - Mobile bottom sheet with safe-area insets
 * - Visual differentiation of detected vs undetected wallets
 * - ARIA: role="dialog", aria-modal="true", aria-labelledby
 *
 * WCAG 2.1 AA: 2.1.2 (No Keyboard Trap), 2.4.3 (Focus Order),
 *              4.1.2 (Name, Role, Value), 1.4.1 (Use of Color)
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useInertBackdrop } from '@/hooks/useInertBackdrop';
import './WalletConnectionModal.css';

// Wallet provider definitions
export type WalletProvider = 'freighter' | 'albedo' | 'xbull' | 'rabet';

interface WalletOption {
  id: WalletProvider;
  name: string;
  icon: string;
  description: string;
  installUrl: string;
}

const WALLET_OPTIONS: WalletOption[] = [
  {
    id: 'freighter',
    name: 'Freighter',
    icon: '/assets/wallets/freighter.svg',
    description: 'Browser extension wallet for Stellar',
    installUrl: 'https://www.freighter.app',
  },
  {
    id: 'albedo',
    name: 'Albedo',
    icon: '/assets/wallets/albedo.svg',
    description: 'Web-based Stellar wallet',
    installUrl: 'https://albedo.link',
  },
  {
    id: 'xbull',
    name: 'xBull',
    icon: '/assets/wallets/xbull.svg',
    description: 'Mobile and desktop Stellar wallet',
    installUrl: 'https://xbull.app',
  },
  {
    id: 'rabet',
    name: 'Rabet',
    icon: '/assets/wallets/rabet.svg',
    description: 'Stellar wallet for desktop',
    installUrl: 'https://rabet.io',
  },
];

interface WalletConnectionModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when a wallet is selected */
  onConnect: (provider: WalletProvider) => void;
  /** Ref to the trigger button that opened the modal (for return focus) */
  triggerRef?: React.RefObject<<HTMLElement | null>;
  /** Currently detected/available wallets */
  detectedWallets?: WalletProvider[];
}

/**
 * WalletConnectionModal
 *
 * Primary entry point for wallet selection. Implemented as a fully accessible
 * dialog with focus trapping, inert backdrop, and mobile-safe bottom sheet layout.
 */
export const WalletConnectionModal: React.FC<<WalletConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  triggerRef,
  detectedWallets = [],
}) => {
  const [connectingId, setConnectingId] = useState<<WalletProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const modalId = 'wallet-connection-modal';

  // Close handler with error reset
  const handleClose = useCallback(() => {
    setError(null);
    setConnectingId(null);
    onClose();
  }, [onClose]);

  // Wallet selection handler
  const handleWalletSelect = useCallback(
    async (provider: WalletProvider) => {
      setError(null);
      setConnectingId(provider);

      try {
        await onConnect(provider);
        handleClose();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `Failed to connect to ${provider}. Please try again.`
        );
        setConnectingId(null);
      }
    },
    [onConnect, handleClose]
  );

  // Install handler for undetected wallets
  const handleInstall = useCallback((wallet: WalletOption) => {
    window.open(wallet.installUrl, '_blank', 'noopener,noreferrer');
  }, []);

  // Accessibility hooks
  const containerRef = useFocusTrap({
    isActive: isOpen,
    triggerRef,
    onEscape: handleClose,
  });

  useBodyScrollLock({ isLocked: isOpen });
  useInertBackdrop({ isInert: isOpen, modalId });

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div
      id={modalId}
      className="wallet-modal-portal"
      aria-hidden="false"
    >
      {/* Backdrop overlay */}
      <div
        className="wallet-modal-backdrop"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog container */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        aria-describedby="wallet-modal-description"
        className="wallet-modal-dialog"
      >
        {/* Header */}
        <div className="wallet-modal-header">
          <h2 id="wallet-modal-title" className="wallet-modal-title">
            Connect Wallet
          </h2>
          <p id="wallet-modal-description" className="wallet-modal-description">
            Select a wallet to connect to Creditra
          </p>
          <button
            className="wallet-modal-close"
            onClick={handleClose}
            aria-label="Close wallet connection dialog"
            type="button"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div
            className="wallet-modal-error"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        {/* Wallet options list */}
        <ul className="wallet-modal-list" role="listbox" aria-label="Available wallet providers">
          {WALLET_OPTIONS.map((wallet) => {
            const isDetected = detectedWallets.includes(wallet.id);
            const isConnecting = connectingId === wallet.id;
            const isDisabled = connectingId !== null && !isConnecting;

            return (
              <li key={wallet.id} role="none">
                <button
                  className={`wallet-option ${isDetected ? 'wallet-option--detected' : 'wallet-option--undetected'}`}
                  onClick={() =>
                    isDetected ? handleWalletSelect(wallet.id) : handleInstall(wallet)
                  }
                  disabled={isDisabled}
                  aria-label={
                    isDetected
                      ? `Connect with ${wallet.name}${isConnecting ? ', connecting' : ''}`
                      : `Install ${wallet.name} wallet`
                  }
                  aria-describedby={`wallet-status-${wallet.id}`}
                  type="button"
                >
                  {/* Icon */}
                  <div className="wallet-option-icon" aria-hidden="true">
                    <img
                      src={wallet.icon}
                      alt=""
                      width="40"
                      height="40"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
                  <div className="wallet-option-info">
                    <span className="wallet-option-name">{wallet.name}</span>
                    <span className="wallet-option-description">
                      {wallet.description}
                    </span>
                    <span
                      id={`wallet-status-${wallet.id}`}
                      className={`wallet-option-status ${isDetected ? 'wallet-option-status--detected' : 'wallet-option-status--undetected'}`}
                    >
                      {isDetected ? (
                        <>
                          <span className="status-dot" aria-hidden="true" />
                          Detected
                        </>
                      ) : (
                        <>
                          <span className="status-icon" aria-hidden="true">⬇</span>
                          Install to connect
                        </>
                      )}
                    </span>
                  </div>

                  {/* Action indicator */}
                  <span className="wallet-option-action" aria-hidden="true">
                    {isConnecting ? (
                      <span className="wallet-option-spinner" />
                    ) : isDetected ? (
                      '→'
                    ) : (
                      '↗'
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Footer note */}
        <div className="wallet-modal-footer">
          <p className="wallet-modal-note">
            New to Stellar?{' '}
            <a
              href="https://stellar.org/wallets"
              target="_blank"
              rel="noopener noreferrer"
              className="wallet-modal-link"
            >
              Learn about wallets
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};