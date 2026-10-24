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
 * - Most-recently-used ordering (MRU) of wallet options
 * - Opt-in "Remember my choice" checkbox (NOT pre-checked)
 * - "Continue with X" one-click affordance for the most-recent wallet
 * - "Switch wallet" affordance to surface the full list when collapsed
 * - ARIA: role="dialog", aria-modal="true", aria-labelledby
 *
 * WCAG 2.1 AA: 2.1.2 (No Keyboard Trap), 2.4.3 (Focus Order),
 *              4.1.2 (Name, Role, Value), 1.4.1 (Use of Color),
 *              1.4.11 (Non-text Contrast), 2.5.5 (Target Size)
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useInertBackdrop } from '@/hooks/useInertBackdrop';
import {
  getRecentWalletOrder,
  getStoredWallet,
  type WalletType,
} from '@/utils/wallet';
import type { StoredWalletPreference } from '@/types/wallet';
import { WalletConnectError } from '@/types/wallet';
import './WalletConnectionModal.css';

// Wallet provider definitions
export type WalletProvider = WalletType;

interface WalletOption {
  id: WalletProvider;
  name: string;
  icon: string;
  description: string;
  installUrl: string;
  features: string[];
}

/**
 * Canonical display order when no recency information exists.  Defined as a
 * single source of truth so the modal, the MRU merge, and the tests line up.
 */
const DEFAULT_WALLET_ORDER: WalletOption[] = [
  {
    id: 'freighter',
    name: 'Freighter',
    icon: '/assets/wallets/freighter.svg',
    description: 'Browser extension wallet for Stellar',
    installUrl: 'https://www.freighter.app',
    features: ['Supports Soroban smart contracts', 'Ledger hardware wallet compatible', 'Open source'],
  },
  {
    id: 'albedo',
    name: 'Albedo',
    icon: '/assets/wallets/albedo.svg',
    description: 'Web-based Stellar wallet',
    installUrl: 'https://albedo.link',
    features: ['No installation required', 'Hardware wallet support', 'Built-in asset swap'],
  },
  {
    id: 'xbull',
    name: 'xBull',
    icon: '/assets/wallets/xbull.svg',
    description: 'Mobile and desktop Stellar wallet',
    installUrl: 'https://xbull.app',
    features: ['Cross-platform (mobile + desktop)', 'Built-in DApp browser', 'Multi-account support'],
  },
  {
    id: 'rabet',
    name: 'Rabet',
    icon: '/assets/wallets/rabet.svg',
    description: 'Stellar wallet for desktop',
    installUrl: 'https://rabet.io',
    features: ['Lightweight desktop application', 'Clean minimal interface', 'Beginner-friendly setup'],
  },
];

/**
 * Stable lookup so MRU reordering can find display metadata for any
 * stored wallet type.
 */
const WALLET_OPTIONS_BY_ID: Record<WalletProvider, WalletOption> =
  DEFAULT_WALLET_ORDER.reduce(
    (acc, opt) => {
      acc[opt.id] = opt;
      return acc;
    },
    {} as Record<WalletProvider, WalletOption>,
  );

/** Options accepted by `onConnect`.  All opt-in for privacy. */
export interface WalletConnectOptions {
  /**
   * Persist the user's opt-in to auto-reconnect on next visit.  Defaults
   * to `false` everywhere in the modal — the checkbox is the only way to
   * pass `true`, and it must be clicked deliberately.
   */
  remember?: boolean;
}

interface WalletConnectionModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /**
   * Callback when a wallet is selected.  Implementers should respect the
   * `options.remember` flag and persist it via the safe wrappers in
   * `src/utils/storage.ts`.
   * 
   * Returns a Promise so the modal can distinguish success from failure.
   */
  onConnect: (provider: WalletProvider, options?: WalletConnectOptions) => Promise<void>;
  /** Ref to the trigger button that opened the modal (for return focus) */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** Currently detected/available wallets */
  detectedWallets?: WalletProvider[];
}

const EMPTY_DETECTED_WALLETS: WalletProvider[] = [];

/**
 * WalletConnectionModal
 *
 * Primary entry point for wallet selection. Implemented as a fully accessible
 * dialog with focus trapping, inert backdrop, and mobile-safe bottom sheet layout.
 *
 * MRU ordering + "remember my choice" flow
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. On mount we read `getRecentWalletOrder()` and (for legacy users)
 *      `getStoredWallet()` to honour past activity.
 *   2. The most-recent wallet is pulled out and shown as a one-click
 *      "Continue with X" affordance.  Everything else is collapsed behind a
 *      "Switch wallet" toggle.  This is the new zero-friction path for
 *      returning users who explicitly opted in.
 *   3. A checkbox labelled "Remember my choice" defaults to unchecked so
 *      the behaviour stays opt-in.  The flag is forwarded to `onConnect`
 *      so that the consumer can persist accordingly.
 */
export const WalletConnectionModal: React.FC<WalletConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  triggerRef,
  detectedWallets = EMPTY_DETECTED_WALLETS,
}) => {
  const [connectingId, setConnectingId] = useState<WalletProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Opt-in checkbox — MUST default to `false` per acceptance criteria.
  const [rememberChoice, setRememberChoice] = useState<boolean>(false);
  // Whether the wallet list is collapsed behind "Switch wallet".
  // When we have a most-recent wallet we collapse by default; otherwise
  // we show the full list so first-time users see all options at once.
  const [showFullList, setShowFullList] = useState<boolean>(false);
  const modalId = 'wallet-connection-modal';
  const rememberCheckboxId = useId();

  // ── MRU-aware ordering ─────────────────────────────────────────────────────
  //
  // Compute the display order once per render.  We honour any persisted
  // recency list (`getRecentWalletOrder`); if that is empty we fall back to
  // the stored session preference (type only) so users who already connected
  // once are not served the default ordering on their first post-upgrade visit.

  const { primaryWallet, orderedWallets } = useMemo(() => {
    const recent = getRecentWalletOrder();
    const stored: StoredWalletPreference | null = recent.length === 0 ? getStoredWallet() : null;

    // We only treat a primary wallet as "most recently used" when we have an
    // *actual* recency signal — either a non-empty MRU list or a stored
    // session preference from before the MRU feature shipped.  When neither
    // is present, fall through to the full catalogue so first-time visitors
    // see every option at a glance instead of an arbitrary "Continue with"
    // prompt.
    const hasRecency = recent.length > 0 || stored !== null;

    // Build a unified recency ordering.  A stored session preference is
    // treated as if it were the only MRU entry (most recent by definition).
    const recencyOrder: WalletProvider[] =
      recent.length > 0
        ? recent
        : stored
        ? [stored.type]
        : [];

    // Anything in the recency list that we don't ship metadata for
    // (e.g., a previously supported wallet that we removed) is dropped
    // silently — the modal can't render it anyway.
    const resolvedOrder: WalletOption[] = recencyOrder
      .map((id) => WALLET_OPTIONS_BY_ID[id])
      .filter((opt): opt is WalletOption => Boolean(opt));

    // Append the default-order wallets, excluding anything already in the
    // recency list, so users always see the complete catalogue.
    for (const opt of DEFAULT_WALLET_ORDER) {
      if (!resolvedOrder.some((o) => o.id === opt.id)) {
        resolvedOrder.push(opt);
      }
    }

    return {
      // Distinguish "no recency hint at all" from "first default wallet".
      // `primaryWallet === null` drives whether the Continue block is shown.
      primaryWallet: hasRecency ? resolvedOrder[0] ?? null : null,
      orderedWallets: resolvedOrder,
    };
  }, [isOpen]); // Re-read ordering each time the modal opens.

  // Sort detected wallets before undetected ones, preserving the existing
  // MRU ordering within each group.
  const sortedWallets = useMemo(() => {
    const detectedSet = new Set(detectedWallets);
    const detected: WalletOption[] = [];
    const undetected: WalletOption[] = [];
    for (const wallet of orderedWallets) {
      if (detectedSet.has(wallet.id)) detected.push(wallet);
      else undetected.push(wallet);
    }
    return [...detected, ...undetected];
  }, [orderedWallets, detectedWallets]);

  // When the modal opens we want to start in the collapsed "Continue with
  // X" view if there is a primary wallet, or expanded if there is not.
  // We do this in a layout effect so we don't show stale state mid-render.
  useEffect(() => {
    if (!isOpen) return;
    setShowFullList(primaryWallet === null);
    setRememberChoice(false);
  }, [isOpen, primaryWallet]);

  // Roving tabindex state for the wallet options list.
  // Stores the index of the currently focused/active wallet item.
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const walletButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Reset focusedIndex to the first available (enabled) wallet item whenever the modal opens or list changes.
  useEffect(() => {
    if (!isOpen) return;
    setFocusedIndex(0);
  }, [isOpen, orderedWallets]);

  // Handle roving focus keyboard navigation (ArrowDown, ArrowUp, Home, End)
  const handleKeyDownList = useCallback(
    (e: React.KeyboardEvent) => {
      // Find all selectable (enabled / not aria-disabled) item indices
      const enabledIndices: number[] = [];
      orderedWallets.forEach((_, idx) => {
        // While connecting, non-connecting buttons are disabled
        const isButtonDisabled = connectingId !== null;
        if (!isButtonDisabled) {
          enabledIndices.push(idx);
        }
      });

      if (enabledIndices.length === 0) return;

      let nextIndex: number | undefined;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentPos = enabledIndices.indexOf(focusedIndex);
        if (currentPos === -1) {
          nextIndex = enabledIndices[0];
        } else {
          nextIndex = enabledIndices[(currentPos + 1) % enabledIndices.length];
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentPos = enabledIndices.indexOf(focusedIndex);
        if (currentPos === -1) {
          nextIndex = enabledIndices[enabledIndices.length - 1];
        } else {
          nextIndex = enabledIndices[(currentPos - 1 + enabledIndices.length) % enabledIndices.length];
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = enabledIndices[0];
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = enabledIndices[enabledIndices.length - 1];
      }

      if (nextIndex !== undefined) {
        setFocusedIndex(nextIndex);
        walletButtonRefs.current[nextIndex]?.focus();
      }
    },
    [orderedWallets, connectingId, focusedIndex],
  );

  // Close handler with error reset
  const handleClose = useCallback(() => {
    setError(null);
    setConnectingId(null);
    onClose();
  }, [onClose]);

  // Wallet selection handler — forwards the opt-in flag to the consumer.
  // On failure, the error is displayed in an alert and the modal stays open.
  const handleWalletSelect = useCallback(
    async (provider: WalletProvider) => {
      setError(null);
      setConnectingId(provider);

      try {
        await onConnect(provider, { remember: rememberChoice });
        // Success: close the modal
        handleClose();
      } catch (err) {
        // Connection failed: show error message and keep modal open
        let errorMessage: string;
        
        if (err instanceof WalletConnectError) {
          // Use the user-facing message from the classified error
          errorMessage = err.message;
        } else if (err instanceof Error) {
          errorMessage = err.message;
        } else {
          errorMessage = `Failed to connect to ${provider}. Please try again.`;
        }
        
        setError(errorMessage);
        setConnectingId(null); // Re-enable buttons
      }
    },
    [onConnect, handleClose, rememberChoice],
  );

  // Install handler for undetected wallets
  const handleInstall = useCallback((wallet: WalletOption) => {
    window.open(wallet.installUrl, '_blank', 'noopener,noreferrer');
  }, []);

  // Handlers dedicated to the "Continue with recent" affordance so the
  // primary wallet can be picked up with a single click — no toggling,
  // no checkbox drama.
  const handleContinueWithPrimary = useCallback(async () => {
    if (!primaryWallet) return;
    await handleWalletSelect(primaryWallet.id);
  }, [primaryWallet, handleWalletSelect]);

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

        {/* "Continue with most-recent" affordance — surfaces the user's
            most recently used wallet as a one-click option when we have
            enough information to recommend one.  Collapsed by default
            behind the "Switch wallet" toggle. */}
        {primaryWallet && !showFullList && (
          <div className="wallet-modal-continue">
            <button
              type="button"
              className="wallet-continue-btn"
              onClick={handleContinueWithPrimary}
              disabled={connectingId !== null}
              aria-label={`Continue with ${primaryWallet.name} (last used)`}
              data-testid="wallet-continue-btn"
            >
              <img
                src={primaryWallet.icon}
                alt=""
                width="32"
                height="32"
                aria-hidden="true"
              />
              <span className="wallet-continue-label">
                <span className="wallet-continue-eyebrow">
                  Last used
                </span>
                <span className="wallet-continue-name">
                  Continue with {primaryWallet.name}
                </span>
              </span>
              <span className="wallet-continue-action" aria-hidden="true">
                {connectingId === primaryWallet.id ? (
                  <span className="wallet-option-spinner" />
                ) : (
                  '→'
                )}
              </span>
            </button>
            <button
              type="button"
              className="wallet-switch-link"
              onClick={() => setShowFullList(true)}
              aria-expanded={showFullList}
              aria-controls="wallet-modal-list"
            >
              Switch wallet
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}

        {/* Remember-my-choice opt-in checkbox.  Appears in both the
            collapsed and expanded layouts so the user can opt-in regardless
            of which path they take through the modal.  Defaults unchecked
            per the acceptance criteria. */}
        <label
          className="wallet-remember-choice"
          htmlFor={rememberCheckboxId}
        >
          <input
            id={rememberCheckboxId}
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            aria-describedby="wallet-remember-help"
            data-testid="wallet-remember-checkbox"
          />
          <span className="wallet-remember-label">
            Remember my choice for next time
          </span>
        </label>
        <p
          id="wallet-remember-help"
          className="wallet-remember-help"
        >
          We'll keep you signed in next visit. You can clear this any time
          from the wallet menu.
        </p>

        {/* Wallet options list */}
        <ul
          id="wallet-modal-list"
          className="wallet-modal-list"
          aria-label="Available wallet providers"
          hidden={primaryWallet !== null && !showFullList}
          data-testid="wallet-modal-list"
          onKeyDown={handleKeyDownList}
        >
          {sortedWallets.map((wallet) => {
            const isDetected = detectedWallets.includes(wallet.id);
            const isConnecting = connectingId === wallet.id;
            const isConnectionInProgress = connectingId !== null;
            const isDisabled = isConnectionInProgress;
            const isOtherDisabled = isConnectionInProgress && !isConnecting;

            const previewId = `wallet-preview-${wallet.id}`;

            return (
              <li key={wallet.id} className="wallet-option-wrapper">
                <button
                  ref={(el) => {
                    walletButtonRefs.current[index] = el;
                  }}
                  tabIndex={focusedIndex === index ? 0 : -1}
                  className={`wallet-option ${isDetected ? 'wallet-option--detected' : 'wallet-option--undetected'}`}
                  style={{ minHeight: '44px', minWidth: '44px' }}
                  onClick={() => {
                    setFocusedIndex(index);
                    if (isDetected) {
                      handleWalletSelect(wallet.id);
                    } else {
                      handleInstall(wallet);
                    }
                  }}
                  onFocus={() => {
                    setFocusedIndex(index);
                  }}
                  disabled={isDisabled}
                  aria-disabled={isOtherDisabled ? 'true' : undefined}
                  aria-busy={isConnecting ? 'true' : undefined}
                  aria-label={
                    isDetected
                      ? `${wallet.name}, installed${isConnecting ? ', connecting' : ''}`
                      : `${wallet.name}, not installed, opens install page`
                  }
                  aria-describedby={`wallet-status-${wallet.id} ${previewId}`}
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

                {/* Hover-preview card — shows wallet features on hover/focus */}
                <div
                  id={previewId}
                  className="wallet-preview"
                  role="tooltip"
                  aria-hidden="true"
                >
                  <div className="wallet-preview__header">
                    <img
                      src={wallet.icon}
                      alt=""
                      width="28"
                      height="28"
                      aria-hidden="true"
                    />
                    <span className="wallet-preview__name">{wallet.name}</span>
                  </div>
                  <ul className="wallet-preview__features">
                    {wallet.features.map((feat) => (
                      <li key={feat} className="wallet-preview__feature">
                        <span className="wallet-preview__check" aria-hidden="true">✓</span>
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>

        {/* When collapsed, we keep the "Show all wallets" affordance right
            under the list to make the path back obvious. */}
        {primaryWallet && showFullList && (
          <button
            type="button"
            className="wallet-switch-link wallet-switch-link--inline"
            onClick={() => setShowFullList(false)}
            aria-expanded={true}
            aria-controls="wallet-modal-list"
          >
            Hide full list
            <span aria-hidden="true">×</span>
          </button>
        )}

        {/* Footer note */}
        <div className="wallet-modal-footer">
          <p className="wallet-modal-note">
            Need help connecting?{' '}
            <Link className="wallet-modal-link" to="/help#wallet" onClick={handleClose}>
              Visit the wallet setup guide
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
