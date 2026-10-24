/**
 * LinkedAccounts Page
 *
 * Manage external account connections (Google, GitHub, Twitter, Facebook).
 * Users can link new accounts, disconnect existing ones, and reconnect
 * accounts with expired tokens.
 *
 * Accessibility features:
 * - Keyboard navigation for all actions
 * - ARIA live regions for status announcements
 * - Focus management during async operations
 * - High contrast mode support
 *
 * Route: /linked-accounts
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link as LinkIcon, Unlink, RefreshCw, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react';
import {
  fetchLinkedAccounts,
  initiateLinkAccount,
  completeOAuthLink,
  cancelLinkAccount,
  disconnectAccount,
  reconnectAccount,
  PROVIDER_INFO,
} from '../services/linkedAccounts';
import type { LinkedAccount, AccountProvider, AccountLinkError } from '../types/linkedAccount';
import { Skeleton } from '../components/Skeleton';
import { PendingButton } from '../components/PendingButton';
import { Tooltip } from '../components/Tooltip';
import { useConfirm } from '../components/ConfirmDialog';
import { accountStripeStyle, colorFromId } from '../utils/colorFromId';
import './LinkedAccounts.css';

/**
 * Provider card with connect/disconnect actions.
 */
interface ProviderCardProps {
  provider: AccountProvider;
  account: LinkedAccount | null;
  onConnect: (provider: AccountProvider) => void;
  onDisconnect: (accountId: string) => void;
  onReconnect: (accountId: string) => void;
  onCancelPending: (provider: AccountProvider) => void;
  isLoading: boolean;
  loadingAccountId: string | null;
  /** IDs currently being batch-disconnected — drives per-card busy state */
  pendingDisconnectIds: Set<string>;
}

function ProviderCard({
  provider,
  account,
  onConnect,
  onDisconnect,
  onReconnect,
  onCancelPending,
  isLoading,
  loadingAccountId,
  pendingDisconnectIds,
}: ProviderCardProps) {
  const info = PROVIDER_INFO[provider];
  const isConnected = account?.status === 'connected';
  const hasError = account?.status === 'error';
  const isPendingAccount = account?.status === 'pending';
  const isPending = loadingAccountId === account?.id;
  const isBatchPending = account ? pendingDisconnectIds.has(account.id) : false;
  // Stable per-account identity stripe (falls back to provider key when unlinked).
  const stripeId = account?.id ?? `provider:${provider}`;
  const stripeColor = colorFromId(stripeId);

  const cardStatus = isConnected
    ? 'connected'
    : isPendingAccount
      ? 'pending'
      : hasError
        ? 'error'
        : 'not connected';

  return (
    <div
      className={`provider-card ${isConnected ? 'provider-card--connected' : ''} ${isPendingAccount ? 'provider-card--pending' : ''} ${hasError ? 'provider-card--error' : ''}`}
      role="article"
      aria-label={`${info.name} account ${cardStatus}`}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Decorative identity stripe — meaning carried by the provider name below */}
      <span aria-hidden="true" style={accountStripeStyle(stripeId)} />
      <div className="provider-card__header">
        <div className="provider-card__icon" style={{ backgroundColor: info.color }} aria-hidden="true">
          {info.icon}
        </div>
        <div className="provider-card__info">
          <h3 className="provider-card__name">
            <span
              aria-hidden="true"
              className="provider-card__swatch"
              style={{ background: stripeColor }}
            />
            {info.name}
          </h3>
          {isConnected && account && (
            <p className="provider-card__details">
              <span className="provider-card__email">{account.externalId}</span>
              <span className="provider-card__status">
                <CheckCircle className="icon-sm" aria-hidden="true" />
                Connected
              </span>
            </p>
          )}
          {isPendingAccount && (
            <p className="provider-card__details">
              <span className="provider-card__status">
                Waiting for {info.name} authorization…
              </span>
            </p>
          )}
          {hasError && account?.error && (
            <p className="provider-card__error" role="alert">
              <AlertCircle className="icon-sm" aria-hidden="true" />
              {account.error.message}
            </p>
          )}
        </div>
      </div>

      <div className="provider-card__actions">
        {!account && (
          <PendingButton
            onClick={() => onConnect(provider)}
            disabled={isLoading}
            pending={false}
            pendingLabel="Connecting…"
            className="btn-secondary btn-sm"
            aria-label={`Connect ${info.name} account`}
          >
            <LinkIcon className="icon-sm" aria-hidden="true" />
            Connect
          </PendingButton>
        )}

        {isPendingAccount && (
          <button
            onClick={() => onCancelPending(provider)}
            disabled={isLoading}
            className="btn-danger btn-sm"
            aria-label={`Cancel pending ${info.name} link`}
          >
            <Unlink className="icon-sm" aria-hidden="true" />
            Cancel
          </button>
        )}

        {isConnected && account && (
          <button
            onClick={() => onDisconnect(account.id)}
            disabled={isLoading || isBatchPending}
            className="btn-danger btn-sm"
            aria-label={`Disconnect ${info.name} account`}
            aria-busy={isBatchPending || undefined}
          >
            {isBatchPending ? (
              <RefreshCw className="icon-sm" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" />
            ) : (
              <Unlink className="icon-sm" aria-hidden="true" />
            )}
            Disconnect
          </button>
        )}

        {hasError && account && (
          <PendingButton
            onClick={() => onReconnect(account.id)}
            disabled={isLoading}
            pending={isPending}
            pendingLabel="Reconnecting…"
            className="btn-secondary btn-sm"
            aria-label={`Reconnect ${info.name} account`}
          >
            <RefreshCw className="icon-sm" aria-hidden="true" />
            Reconnect
          </PendingButton>
        )}

        {isConnected && account && (
          <span className="provider-card__timestamp">
            Connected {new Date(account.connectedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Provider Picker Menu ──────────────────────────────────────────────────────

const ALL_PROVIDERS: AccountProvider[] = ['google', 'github', 'twitter', 'facebook'];

interface ProviderPickerProps {
  /** Providers that are already connected or pending — excluded from the menu */
  connectedProviders: Set<AccountProvider>;
  onSelect: (provider: AccountProvider) => void;
  disabled: boolean;
}

/**
 * WAI-ARIA menu-button pattern.
 * Opens a menu of unlinked providers; when all are linked shows a static label.
 * Keyboard: ArrowDown/ArrowUp navigate items, Enter/Space select, Escape closes.
 */
function ProviderPicker({ connectedProviders, onSelect, disabled }: ProviderPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const availableProviders = ALL_PROVIDERS.filter(p => !connectedProviders.has(p));
  const allLinked = availableProviders.length === 0;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  // Focus first item when menu opens
  useEffect(() => {
    if (open && availableProviders.length > 0) {
      setActiveIndex(0);
      requestAnimationFrame(() => {
        itemRefs.current[0]?.focus();
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (activeIndex + 1) % availableProviders.length;
      setActiveIndex(next);
      itemRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (activeIndex - 1 + availableProviders.length) % availableProviders.length;
      setActiveIndex(prev);
      itemRefs.current[prev]?.focus();
    }
  };

  const handleSelect = (provider: AccountProvider) => {
    setOpen(false);
    triggerRef.current?.focus();
    onSelect(provider);
  };

  const menuId = 'provider-picker-menu';

  if (allLinked) {
    return (
      <span
        className="sticky-action-bar__all-linked"
        aria-label="All providers linked"
        data-testid="all-providers-linked"
      >
        <CheckCircle className="icon-sm" aria-hidden="true" />
        <span className="sticky-action-bar__label">All providers linked</span>
      </span>
    );
  }

  return (
    <div className="provider-picker" style={{ position: 'relative' }}>
      <Tooltip
        label="Connect a new account"
        position="top"
        hoverDelay={400}
        longPressDelay={500}
      >
        <button
          ref={triggerRef}
          onClick={() => setOpen(prev => !prev)}
          onKeyDown={handleTriggerKeyDown}
          disabled={disabled}
          className="btn-secondary btn-sm pending-btn"
          aria-label="Connect new account from toolbar"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          data-testid="provider-picker-trigger"
        >
          <LinkIcon className="icon-sm" aria-hidden="true" />
          <span className="sticky-action-bar__label">Connect</span>
          <ChevronDown className="icon-sm" aria-hidden="true" />
        </button>
      </Tooltip>

      {open && (
        <ul
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label="Select provider to connect"
          className="provider-picker__menu"
          onKeyDown={handleMenuKeyDown}
          data-testid="provider-picker-menu"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: '4px',
            listStyle: 'none',
            padding: '4px 0',
            margin: 0,
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '160px',
            zIndex: 100,
          }}
        >
          {availableProviders.map((provider, index) => {
            const info = PROVIDER_INFO[provider];
            return (
              <li key={provider} role="none">
                <button
                  ref={el => { itemRefs.current[index] = el; }}
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => handleSelect(provider)}
                  className="provider-picker__item"
                  data-testid={`provider-picker-item-${provider}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textAlign: 'left',
                  }}
                >
                  <span aria-hidden="true">{info.icon}</span>
                  {info.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Disconnect-All result types ───────────────────────────────────────────────

interface DisconnectResult {
  account: LinkedAccount;
  success: boolean;
}

/**
 * Main LinkedAccounts page component.
 */
export interface LinkedAccountsProps {
  redirect?: (url: string) => void;
}

export function LinkedAccounts({ redirect = (url: string) => window.location.assign(url) }: LinkedAccountsProps = {}) {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadingAccountId, setLoadingAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  /** IDs currently being processed by Disconnect All (per-card busy state) */
  const [pendingDisconnectIds, setPendingDisconnectIds] = useState<Set<string>>(new Set());

  /** Accounts that failed in the last Disconnect All attempt — drives Retry failed */
  const [failedDisconnects, setFailedDisconnects] = useState<LinkedAccount[]>([]);

  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Fetch linked accounts and process OAuth callback params on mount
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError(null);

        // Check for OAuth callback query parameters: code and state
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');

        if (code && state) {
          // Identify provider from state (state format: "<provider>-<timestamp>-<rand>")
          const provider = state.split('-')[0] as AccountProvider;
          try {
            await completeOAuthLink({ provider, code, state });
            showSuccessMessage(`${PROVIDER_INFO[provider]?.name || 'Account'} account linked`);
            // Clean URL query params without reloading
            if (window.history && window.history.replaceState) {
              const cleanUrl = window.location.pathname;
              window.history.replaceState({}, document.title, cleanUrl);
            }
          } catch (err) {
            const linkError = err as AccountLinkError;
            if (linkError.code === 'token_expired') {
              setError('The authorization link has expired. Please try connecting again.');
            } else if (linkError.code === 'auth_failed') {
              setError('Authorization failed. Please try connecting again.');
            } else if (linkError.code === 'already_linked') {
              setError('This account is already linked.');
            } else {
              setError(linkError.message || 'Failed to complete account connection.');
            }
          }
        }

        const data = await fetchLinkedAccounts();
        setAccounts(data);

        // If returned without callback params and there is a pending account, show "Linking was not completed"
        if (!code && !state) {
          const pending = data.find(acc => acc.status === 'pending');
          if (pending) {
            setIncompletePendingProvider(pending.provider);
          }
        }
      } catch (err) {
        setError('Failed to load linked accounts. Please try again.');
        console.error('Load accounts error:', err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  // Clean up message timeout on unmount
  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  // Sticky bar visibility: appears when header scrolls out of view
  useEffect(() => {
    const onScroll = () => {
      const el = headerRef.current;
      if (el) {
        setScrolled(el.getBoundingClientRect().bottom < 0);
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchLinkedAccounts();
      setAccounts(data);
    } catch (err) {
      setError('Failed to load linked accounts. Please try again.');
      console.error('Load accounts error:', err);
    } finally {
      setLoading(false);
    }
  };

  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message);
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    messageTimeoutRef.current = setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  const handleConnect = async (provider: AccountProvider) => {
    try {
      setActionLoading(true);
      setError(null);

      const response = await initiateLinkAccount({ provider });

      // In production, redirect to OAuth URL
      // For now, simulate successful connection
      showSuccessMessage(`${PROVIDER_INFO[provider].name} account linked successfully`);
      await loadAccounts();

      // Hand off to provider authorization URL without announcing success
      redirect(response.authUrl);
    } catch (err) {
      const error = err as AccountLinkError;
      setError(error.message || `Failed to connect ${PROVIDER_INFO[provider].name} account`);
      console.error('Connect error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelPending = async (provider: AccountProvider) => {
    try {
      setActionLoading(true);
      setError(null);
      await cancelLinkAccount(provider);
      setIncompletePendingProvider(null);
      await loadAccounts();
    } catch (err) {
      setError('Failed to cancel pending link. Please try again.');
      console.error('Cancel pending error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return;

    const providerName = PROVIDER_INFO[account.provider].name;
    const confirmed = await confirm({
      title: `Disconnect ${providerName}?`,
      body: `Disconnecting ${providerName} may lower your credit evaluation score. You can reconnect later.`,
      confirmLabel: `Disconnect ${providerName}`,
    });

    if (!confirmed) return;

    try {
      setActionLoading(true);
      setLoadingAccountId(accountId);
      setError(null);

      await disconnectAccount(accountId);
      showSuccessMessage(`${providerName} account disconnected`);
      await loadAccounts();
    } catch (err) {
      setError(`Failed to disconnect account. Please try again.`);
      console.error('Disconnect error:', err);
    } finally {
      setActionLoading(false);
      setLoadingAccountId(null);
    }
  };

  const handleReconnect = async (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return;

    try {
      setActionLoading(true);
      setLoadingAccountId(accountId);
      setError(null);

      const response = await reconnectAccount(accountId);

      // In production, redirect to OAuth URL
      // For now, simulate successful reconnection
      showSuccessMessage(`${PROVIDER_INFO[account.provider].name} account reconnected successfully`);
      await loadAccounts();

      // Hand off to provider authorization URL without announcing success
      redirect(response.authUrl);
    } catch (err) {
      setError(`Failed to reconnect account. Please try again.`);
      console.error('Reconnect error:', err);
    } finally {
      setActionLoading(false);
      setLoadingAccountId(null);
    }
  };

  /**
   * Builds the human-readable summary message from Promise.allSettled results.
   * - All succeeded: "All N accounts disconnected"
   * - Partial: "Disconnected X and Y. Z could not be disconnected — try again."
   * - All failed: "Could not disconnect X, Y, Z. Please try again."
   */
  const buildDisconnectMessage = (results: DisconnectResult[]): string => {
    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (failed.length === 0) {
      return `All ${succeeded.length} account${succeeded.length === 1 ? '' : 's'} disconnected`;
    }

    if (succeeded.length === 0) {
      const names = failed.map(r => PROVIDER_INFO[r.account.provider].name).join(', ');
      return `Could not disconnect ${names}. Please try again.`;
    }

    const succeededNames = succeeded.map(r => PROVIDER_INFO[r.account.provider].name).join(' and ');
    const failedNames = failed.map(r => PROVIDER_INFO[r.account.provider].name).join(', ');
    return `Disconnected ${succeededNames}. ${failedNames} could not be disconnected — try again.`;
  };

  /**
   * Run Disconnect All (or Retry failed) using Promise.allSettled so that
   * per-account outcomes are always known regardless of individual failures.
   */
  const runDisconnectAll = useCallback(
    async (targetAccounts: LinkedAccount[]) => {
      if (targetAccounts.length === 0) return;

      // Mark every targeted account as pending (per-card busy state)
      setPendingDisconnectIds(new Set(targetAccounts.map(a => a.id)));
      setActionLoading(true);
      setError(null);
      setFailedDisconnects([]);

      const settled = await Promise.allSettled(
        targetAccounts.map(acc => disconnectAccount(acc.id)),
      );

      const results: DisconnectResult[] = targetAccounts.map((acc, i) => ({
        account: acc,
        success: settled[i].status === 'fulfilled',
      }));

      const newFailed = results.filter(r => !r.success).map(r => r.account);

      setPendingDisconnectIds(new Set());
      setActionLoading(false);

      const msg = buildDisconnectMessage(results);

      // Reload accounts first, then set error/failed state so that
      // loadAccounts (which clears error) doesn't wipe our message.
      await loadAccounts();

      setFailedDisconnects(newFailed);
      if (newFailed.length === 0) {
        showSuccessMessage(msg);
      } else {
        setError(msg);
      }
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleDisconnectAll = async () => {
    const connectedAccounts = accounts.filter(acc => acc.status === 'connected');
    if (connectedAccounts.length === 0) return;

    const count = connectedAccounts.length;
    const accountWord = count === 1 ? 'account' : 'accounts';
    const confirmed = await confirm({
      title: `Disconnect all ${count} ${accountWord}?`,
      body: `Disconnecting ${count} linked ${accountWord} may lower your credit evaluation score. You can reconnect later.`,
      confirmLabel: 'Disconnect All',
    });
    if (!confirmed) return;

    await runDisconnectAll(connectedAccounts);
  };

  /** Retry only the accounts that failed in the previous Disconnect All attempt. */
  const handleRetryFailed = async () => {
    await runDisconnectAll(failedDisconnects);
  };

  const connectedCount = useMemo(
    () => accounts.filter((a) => a.status === 'connected').length,
    [accounts],
  );

  /** Set of connected/pending provider ids — used by ProviderPicker to exclude them */
  const connectedProviders = useMemo<Set<AccountProvider>>(
    () =>
      new Set(
        accounts
          .filter(a => a.status === 'connected' || a.status === 'pending')
          .map(a => a.provider),
      ),
    [accounts],
  );

  const availableProviders: AccountProvider[] = ['google', 'github', 'twitter', 'facebook'];

  return (
    <div className="linked-accounts">
      {/* Header */}
      <div className="linked-accounts__header" ref={headerRef} data-testid="linked-accounts-header">
        <div>
          <h1>Linked Accounts</h1>
          <p className="subtitle">
            Connect your external accounts to enhance your Creditra experience.
            Linking accounts can improve your credit evaluation and enable additional features.
          </p>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="banner-alert banner-alert--danger" role="alert">
          <AlertCircle className="icon" aria-hidden="true" />
          <div className="banner-alert__content">
            <p>{error}</p>
            {failedDisconnects.length > 0 && (
              <button
                onClick={handleRetryFailed}
                className="btn-secondary btn-sm"
                style={{ marginTop: '8px' }}
                data-testid="retry-failed-btn"
              >
                Retry failed
              </button>
            )}
          </div>
          <button
            onClick={() => { setError(null); setFailedDisconnects([]); }}
            className="banner-alert__close"
            aria-label="Dismiss error"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {incompletePendingProvider && (
        <div className="banner-alert banner-alert--danger" role="alert">
          <AlertCircle className="icon" aria-hidden="true" />
          <div className="banner-alert__content">
            <p>Linking was not completed</p>
            <div className="banner-alert__actions">
              <button
                onClick={() => handleConnect(incompletePendingProvider)}
                className="btn-secondary btn-sm"
              >
                Retry
              </button>
              <button
                onClick={() => handleCancelPending(incompletePendingProvider)}
                className="btn-danger btn-sm"
                aria-label="Cancel linking"
              >
                Cancel
              </button>
            </div>
          </div>
          <button
            onClick={() => setIncompletePendingProvider(null)}
            className="banner-alert__close"
            aria-label="Dismiss error"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {successMessage && (
        <div className="banner-alert banner-alert--success" role="status" aria-live="polite">
          <CheckCircle className="icon" aria-hidden="true" />
          <div className="banner-alert__content">
            <p>{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="banner-alert__close"
            aria-label="Dismiss success message"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="card card-large">
        <h2>
          <LinkIcon className="icon" aria-hidden="true" />
          Available Providers
        </h2>
        <p className="linked-accounts__description">
          Connect one or more accounts below. Your information is secure and used only
          for identity verification and credit assessment.
        </p>

        {loading ? (
          <div className="linked-accounts__loading" aria-busy="true" aria-label="Loading accounts">
            <div className="provider-card">
              <div className="provider-card__header">
                <Skeleton style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Skeleton style={{ width: '120px', height: '20px', marginBottom: '8px' }} />
                  <Skeleton style={{ width: '180px', height: '14px' }} />
                </div>
              </div>
            </div>
            <div className="provider-card">
              <div className="provider-card__header">
                <Skeleton style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Skeleton style={{ width: '120px', height: '20px', marginBottom: '8px' }} />
                  <Skeleton style={{ width: '180px', height: '14px' }} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="linked-accounts__grid" role="list" aria-label="Available providers">
            {availableProviders.map((provider) => {
              const account = accounts.find(acc => acc.provider === provider && acc.status !== 'disconnected');
              return (
                <div key={provider} role="listitem">
                  <ProviderCard
                    provider={provider}
                    account={account || null}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                    onReconnect={handleReconnect}
                    onCancelPending={handleCancelPending}
                    isLoading={actionLoading}
                    loadingAccountId={loadingAccountId}
                    pendingDisconnectIds={pendingDisconnectIds}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Security Notice */}
        <div className="linked-accounts__security" role="note">
          <div className="security-icon" aria-hidden="true">🔒</div>
          <div className="security-content">
            <h3>Security & Privacy</h3>
            <ul>
              <li>We use industry-standard OAuth 2.0 for secure authentication</li>
              <li>Your credentials are never stored on our servers</li>
              <li>You can disconnect any account at any time</li>
              <li>Linked accounts may improve your credit evaluation score</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Sticky Bottom Action Bar ─────────────────────────────────── */}
      <div
        className={`sticky-action-bar ${scrolled ? 'sticky-action-bar--visible' : ''}`}
        role="toolbar"
        aria-label="Linked accounts actions"
        data-testid="sticky-action-bar"
      >
        <div className="sticky-action-bar__inner">
          <div className="sticky-action-bar__status">
            {connectedCount > 0 ? (
              <span className="sticky-action-bar__count">
                <CheckCircle className="icon-sm" aria-hidden="true" />
                {connectedCount} connected
              </span>
            ) : (
              <span className="sticky-action-bar__count">
                No accounts linked
              </span>
            )}
          </div>
          <div className="sticky-action-bar__actions">
            {/* Provider picker replaces the hard-coded Google Connect button */}
            <ProviderPicker
              connectedProviders={connectedProviders}
              onSelect={handleConnect}
              disabled={actionLoading}
            />
            {connectedCount > 0 && (
              <Tooltip
                label="Disconnect all linked accounts"
                position="top"
                hoverDelay={400}
                longPressDelay={500}
              >
                <button
                  onClick={handleDisconnectAll}
                  disabled={actionLoading}
                  className="btn-danger btn-sm"
                  aria-label="Disconnect all accounts from toolbar"
                >
                  <Unlink className="icon-sm" aria-hidden="true" />
                  <span className="sticky-action-bar__label">Disconnect All</span>
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}
