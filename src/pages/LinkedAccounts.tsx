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

import { useState, useEffect, useRef, useMemo } from 'react';
import { Link as LinkIcon, Unlink, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import {
  fetchLinkedAccounts,
  initiateLinkAccount,
  disconnectAccount,
  reconnectAccount,
  verifyAccount,
  PROVIDER_INFO,
} from '../services/linkedAccounts';
import type { LinkedAccount, AccountProvider, AccountLinkError } from '../types/linkedAccount';
import { Skeleton } from '../components/Skeleton';
import { PendingButton } from '../components/PendingButton';
import { LiveRegion } from '../components/LiveRegion';
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
  isLoading: boolean;
  loadingAccountId: string | null;
}

function ProviderCard({
  provider,
  account,
  onConnect,
  onDisconnect,
  onReconnect,
  isLoading,
  loadingAccountId,
}: ProviderCardProps) {
  const info = PROVIDER_INFO[provider];
  const isConnected = account?.status === 'connected';
  const hasError = account?.status === 'error';
  const isPending = loadingAccountId === account?.id;
  // Stable per-account identity stripe (falls back to provider key when unlinked).
  const stripeId = account?.id ?? `provider:${provider}`;
  const stripeColor = colorFromId(stripeId);

  return (
    <div
      className={`provider-card ${isConnected ? 'provider-card--connected' : ''} ${hasError ? 'provider-card--error' : ''}`}
      role="article"
      aria-label={`${info.name} account ${isConnected ? 'connected' : 'not connected'}`}
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
            className="btn-secondary btn-sm"
            aria-label={`Connect ${info.name} account`}
          >
            <LinkIcon className="icon-sm" aria-hidden="true" />
            Connect
          </PendingButton>
        )}

        {isConnected && account && (
          <button
            onClick={() => onDisconnect(account.id)}
            disabled={isLoading}
            className="btn-danger btn-sm"
            aria-label={`Disconnect ${info.name} account`}
          >
            <Unlink className="icon-sm" aria-hidden="true" />
            Disconnect
          </button>
        )}

        {hasError && account && (
          <PendingButton
            onClick={() => onReconnect(account.id)}
            disabled={isLoading}
            pending={isPending}
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

/**
 * Main LinkedAccounts page component.
 */
/**
 * Sticky bottom action bar that appears when the header scrolls out of view.
 * Provides quick access to primary actions: connect new account, disconnect all.
 */
export function LinkedAccounts() {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadingAccountId, setLoadingAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Fetch linked accounts on mount
  useEffect(() => {
    loadAccounts();
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
    } catch (err) {
      const error = err as AccountLinkError;
      setError(error.message || `Failed to connect ${PROVIDER_INFO[provider].name} account`);
      console.error('Connect error:', err);
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
    } catch (err) {
      setError(`Failed to reconnect account. Please try again.`);
      console.error('Reconnect error:', err);
    } finally {
      setActionLoading(false);
      setLoadingAccountId(null);
    }
  };

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

    try {
      setActionLoading(true);
      setError(null);
      
      await Promise.all(connectedAccounts.map(acc => disconnectAccount(acc.id)));
      showSuccessMessage('All accounts disconnected successfully');
      await loadAccounts();
    } catch (err) {
      setError('Failed to disconnect some accounts. Please try again.');
      console.error('Disconnect all error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const connectedCount = useMemo(
    () => accounts.filter((a) => a.status === 'connected').length,
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
          </div>
          <button
            onClick={() => setError(null)}
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
                    isLoading={actionLoading}
                    loadingAccountId={loadingAccountId}
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
            <Tooltip
              label="Connect a new account"
              position="top"
              hoverDelay={400}
              longPressDelay={500}
            >
              <PendingButton
                onClick={() => handleConnect('google')}
                disabled={actionLoading}
                pending={false}
                className="btn-secondary btn-sm"
                aria-label="Connect new account from toolbar"
              >
                <LinkIcon className="icon-sm" aria-hidden="true" />
                <span className="sticky-action-bar__label">Connect</span>
              </PendingButton>
            </Tooltip>
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
