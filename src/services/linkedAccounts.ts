/**
 * Linked Accounts Service
 *
 * API integration for managing external account links (Google, GitHub, etc.).
 * All functions return promises and throw typed errors on failure.
 *
 * In production, these would call real API endpoints. For now, they simulate
 * backend behavior with localStorage persistence and realistic timing.
 *
 * Offline safety: reads use readCache via localStorage (works offline natively),
 * mutations are guarded by offlineMutation so they never fake success when
 * the browser is offline.
 */

import { readJson, writeJson } from '../utils/storage';
import { offlineMutation } from '../utils/offline';
import type {
  LinkedAccount,
  AccountProvider,
  LinkAccountRequest,
  LinkAccountResponse,
  CompleteOAuthRequest,
  AccountLinkError,
} from '../types/linkedAccount';

const STORAGE_KEY = 'creditra:linked-accounts';
const MOCK_API_DELAY = 800; // Simulate network latency

/**
 * Simulates API delay for realistic UX testing.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Provider metadata for UI display.
 */
export const PROVIDER_INFO: Record<AccountProvider, { name: string; icon: string; color: string }> = {
  google: { name: 'Google', icon: '🔵', color: '#4285f4' },
  github: { name: 'GitHub', icon: '⚫', color: '#24292e' },
  twitter: { name: 'Twitter', icon: '🐦', color: '#1da1f2' },
  facebook: { name: 'Facebook', icon: '🔷', color: '#1877f2' },
};

/**
 * Fetch all linked accounts for the current user.
 * 
 * @returns Promise resolving to array of linked accounts
 * @throws Error if fetch fails
 */
export async function fetchLinkedAccounts(): Promise<LinkedAccount[]> {
  await delay(MOCK_API_DELAY);
  
  try {
    const accounts = readJson<LinkedAccount[]>(STORAGE_KEY, []);
    return accounts.filter(acc => acc.status !== 'disconnected');
  } catch (error) {
    throw new Error('Failed to fetch linked accounts');
  }
}

/**
 * Initiate OAuth flow to link a new external account.
 * 
 * @param request - Provider and optional redirect URL
 * @returns Promise resolving to OAuth authorization URL and state token
 * @throws Error if provider is already linked or request fails
 */
export async function initiateLinkAccount(request: LinkAccountRequest): Promise<LinkAccountResponse> {
  return offlineMutation({
    fn: async () => {
      await delay(400);

      // Check if provider is already linked
      const existing = readJson<LinkedAccount[]>(STORAGE_KEY, []);
      const alreadyLinked = existing.find(
        acc => acc.provider === request.provider && acc.status === 'connected'
      );

      if (alreadyLinked) {
        const error: AccountLinkError = {
          code: 'already_linked',
          message: `${PROVIDER_INFO[request.provider].name} account is already linked`,
        };
        throw error;
      }

      // Generate state token for CSRF protection
      const state = `${request.provider}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Store pending state
      writeJson('creditra:oauth-state', { state, provider: request.provider, timestamp: Date.now() });

      // Return mock OAuth URL (in production, this would be the real provider URL)
      return {
        authUrl: `/oauth/${request.provider}?state=${state}&redirect=${encodeURIComponent(request.redirectUrl || '/linked-accounts')}`,
        state,
      };
    },
  });
}

/**
 * Complete OAuth flow after provider callback.
 * 
 * @param request - Provider, authorization code, and state token
 * @returns Promise resolving to the newly linked account
 * @throws Error if verification fails or account cannot be linked
 */
export async function completeOAuthLink(request: CompleteOAuthRequest): Promise<LinkedAccount> {
  return offlineMutation({
    fn: async () => {
      await delay(MOCK_API_DELAY);

      // Verify state token
      const storedState = readJson<{ state: string; provider: string; timestamp: number } | null>('creditra:oauth-state', null);

      if (!storedState || storedState.state !== request.state || storedState.provider !== request.provider) {
        const error: AccountLinkError = {
          code: 'auth_failed',
          message: 'Invalid OAuth state. Please try again.',
        };
        throw error;
      }

      // Check if state is expired (10 minutes)
      if (Date.now() - storedState.timestamp > 10 * 60 * 1000) {
        const error: AccountLinkError = {
          code: 'token_expired',
          message: 'OAuth session expired. Please try again.',
        };
        throw error;
      }

      // Create new linked account
      const newAccount: LinkedAccount = {
        id: `${request.provider}-${Date.now()}`,
        provider: request.provider,
        status: 'connected',
        displayName: `${PROVIDER_INFO[request.provider].name} User`, // In production, from OAuth
        externalId: `user-${Math.random().toString(36).substring(7)}@${request.provider}.com`,
        connectedAt: new Date().toISOString(),
        lastVerified: new Date().toISOString(),
      };

      // Save to storage
      const accounts = readJson<LinkedAccount[]>(STORAGE_KEY, []);
      accounts.push(newAccount);
      writeJson(STORAGE_KEY, accounts);

      // Clean up OAuth state
      writeJson('creditra:oauth-state', null);

      return newAccount;
    },
  });
}

/**
 * Disconnect a linked external account.
 * 
 * @param accountId - Unique identifier of the account to disconnect
 * @returns Promise resolving when disconnection is complete
 * @throws Error if account not found or disconnection fails
 */
export async function disconnectAccount(accountId: string): Promise<void> {
  return offlineMutation({
    fn: async () => {
      await delay(600);

      const accounts = readJson<LinkedAccount[]>(STORAGE_KEY, []);
      const accountIndex = accounts.findIndex(acc => acc.id === accountId);

      if (accountIndex === -1) {
        throw new Error('Account not found');
      }

      // Mark as disconnected instead of deleting for audit trail
      accounts[accountIndex].status = 'disconnected';
      writeJson(STORAGE_KEY, accounts);
    },
  });
}

/**
 * Reconnect a previously linked account (refresh OAuth token).
 * 
 * @param accountId - Unique identifier of the account to reconnect
 * @returns Promise resolving to OAuth URL for re-authentication
 * @throws Error if account not found or reconnection fails
 */
export async function reconnectAccount(accountId: string): Promise<LinkAccountResponse> {
  return offlineMutation({
    fn: async () => {
      await delay(400);

      const accounts = readJson<LinkedAccount[]>(STORAGE_KEY, []);
      const account = accounts.find(acc => acc.id === accountId);

      if (!account) {
        throw new Error('Account not found');
      }

      // Initiate new OAuth flow for this provider
      return initiateLinkAccount({ provider: account.provider });
    },
  });
}

/**
 * Verify a linked account's current status with the provider.
 * 
 * @param accountId - Unique identifier of the account to verify
 * @returns Promise resolving to updated account status
 * @throws Error if verification fails
 */
export async function verifyAccount(accountId: string): Promise<LinkedAccount> {
  return offlineMutation({
    fn: async () => {
      await delay(1000);

      const accounts = readJson<LinkedAccount[]>(STORAGE_KEY, []);
      const accountIndex = accounts.findIndex(acc => acc.id === accountId);

      if (accountIndex === -1) {
        throw new Error('Account not found');
      }

      // Update last verified timestamp
      accounts[accountIndex].lastVerified = new Date().toISOString();

      // Simulate random verification failure (10% chance)
      if (Math.random() < 0.1) {
        accounts[accountIndex].status = 'error';
        accounts[accountIndex].error = {
          code: 'provider_error',
          message: 'Unable to verify account. The token may have been revoked.',
          timestamp: new Date().toISOString(),
        };
      } else {
        accounts[accountIndex].status = 'connected';
        delete accounts[accountIndex].error;
      }

      writeJson(STORAGE_KEY, accounts);
      return accounts[accountIndex];
    },
  });
}
