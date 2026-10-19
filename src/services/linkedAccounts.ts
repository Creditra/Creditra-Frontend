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
  ConnectionStatus,
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

const VALID_PROVIDERS: readonly AccountProvider[] = ['google', 'github', 'twitter', 'facebook'];
const VALID_STATUSES: readonly ConnectionStatus[] = ['connected', 'pending', 'error', 'disconnected'];

function isValidDateString(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const d = new Date(val);
  return !isNaN(d.getTime());
}

/**
 * Guard checking provider, status, ISO dates, and required string fields.
 * Returns LinkedAccount or null if malformed. Never throws.
 */
export function parseLinkedAccount(raw: unknown): LinkedAccount | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.id !== 'string' || obj.id.trim() === '') {
    return null;
  }

  if (typeof obj.provider !== 'string' || !VALID_PROVIDERS.includes(obj.provider as AccountProvider)) {
    return null;
  }

  if (typeof obj.status !== 'string' || !VALID_STATUSES.includes(obj.status as ConnectionStatus)) {
    return null;
  }

  if (typeof obj.displayName !== 'string') {
    return null;
  }

  if (typeof obj.externalId !== 'string') {
    return null;
  }

  if (!isValidDateString(obj.connectedAt)) {
    return null;
  }

  if (obj.lastVerified !== undefined && !isValidDateString(obj.lastVerified)) {
    return null;
  }

  let error: AccountLinkError | undefined = undefined;
  if (obj.error !== undefined) {
    if (typeof obj.error === 'object' && obj.error !== null && !Array.isArray(obj.error)) {
      const errObj = obj.error as Record<string, unknown>;
      if (typeof errObj.code === 'string' && typeof errObj.message === 'string') {
        error = {
          code: errObj.code as AccountLinkError['code'],
          message: errObj.message,
          ...(isValidDateString(errObj.timestamp) ? { timestamp: errObj.timestamp } : {}),
        };
      }
    }
  }

  return {
    id: obj.id,
    provider: obj.provider as AccountProvider,
    status: obj.status as ConnectionStatus,
    displayName: obj.displayName,
    externalId: obj.externalId,
    connectedAt: obj.connectedAt,
    ...(obj.lastVerified !== undefined ? { lastVerified: obj.lastVerified as string } : {}),
    ...(error !== undefined ? { error } : {}),
  };
}

export interface LinkedAccountsStorage {
  readJson: <T>(key: string, fallback: T) => T;
  writeJson: <T>(key: string, value: T) => void;
}

export interface LinkedAccountsDependencies {
  now?: () => number;
  randomId?: () => string;
  shouldFailVerification?: () => boolean;
  storage?: LinkedAccountsStorage;
}

function defaultRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback if randomUUID is unavailable
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    // deterministic fallback using current time
    for (let i = 0; i < 16; i++) {
      bytes[i] = (Date.now() + i * 37) & 0xff;
    }
  }
  // Format as uuid-like hex
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function defaultShouldFailVerification(): boolean {
  try {
    return import.meta.env?.VITE_SIMULATE_LINK_FAILURES === 'true';
  } catch {
    return false;
  }
}

export function createLinkedAccountsService(deps: LinkedAccountsDependencies = {}) {
  const now = deps.now ?? (() => Date.now());
  const randomId = deps.randomId ?? defaultRandomId;
  const shouldFailVerification = deps.shouldFailVerification ?? defaultShouldFailVerification;
  const storage = deps.storage ?? { readJson, writeJson };

  function readAndValidateAccounts(): LinkedAccount[] {
    const raw = storage.readJson<unknown>(STORAGE_KEY, []);
    if (!Array.isArray(raw)) {
      storage.writeJson(STORAGE_KEY, []);
      return [];
    }

    const validAccounts: LinkedAccount[] = [];
    let hadInvalid = false;

    for (const item of raw) {
      const parsed = parseLinkedAccount(item);
      if (parsed) {
        validAccounts.push(parsed);
      } else {
        hadInvalid = true;
      }
    }

    if (hadInvalid) {
      storage.writeJson(STORAGE_KEY, validAccounts);
    }

    return validAccounts;
  }

  async function fetchLinkedAccounts(): Promise<LinkedAccount[]> {
    await delay(MOCK_API_DELAY);

    try {
      const accounts = readAndValidateAccounts();
      return accounts.filter(acc => acc.status !== 'disconnected');
    } catch (error) {
      const linkError: AccountLinkError = {
        code: 'provider_error',
        message: 'Failed to fetch linked accounts',
      };
      throw linkError;
    }
  }

  async function initiateLinkAccount(request: LinkAccountRequest): Promise<LinkAccountResponse> {
    return offlineMutation({
      fn: async () => {
        await delay(400);

        // Check if provider is already linked
        const existing = readAndValidateAccounts();
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
        const currentTime = now();
        const idToken = randomId();
        const state = `${request.provider}-${currentTime}-${idToken}`;

        // Store pending state
        storage.writeJson('creditra:oauth-state', { state, provider: request.provider, timestamp: currentTime });

        // Return mock OAuth URL (in production, this would be the real provider URL)
        return {
          authUrl: `/oauth/${request.provider}?state=${state}&redirect=${encodeURIComponent(request.redirectUrl || '/linked-accounts')}`,
          state,
        };
      },
    });
  }

  async function completeOAuthLink(request: CompleteOAuthRequest): Promise<LinkedAccount> {
    return offlineMutation({
      fn: async () => {
        await delay(MOCK_API_DELAY);

        // Verify state token
        const storedState = storage.readJson<{ state: string; provider: string; timestamp: number } | null>('creditra:oauth-state', null);

        if (!storedState || storedState.state !== request.state || storedState.provider !== request.provider) {
          const error: AccountLinkError = {
            code: 'auth_failed',
            message: 'Invalid OAuth state. Please try again.',
          };
          throw error;
        }

        // Check if state is expired (10 minutes)
        const currentTime = now();
        if (currentTime - storedState.timestamp > 10 * 60 * 1000) {
          const error: AccountLinkError = {
            code: 'token_expired',
            message: 'OAuth session expired. Please try again.',
          };
          throw error;
        }

        const idSuffix = randomId();
        const isoNow = new Date(currentTime).toISOString();

        // Create new linked account
        const newAccount: LinkedAccount = {
          id: `${request.provider}-${currentTime}-${idSuffix}`,
          provider: request.provider,
          status: 'connected',
          displayName: `${PROVIDER_INFO[request.provider].name} User`, // In production, from OAuth
          externalId: `user-${idSuffix}@${request.provider}.com`,
          connectedAt: isoNow,
          lastVerified: isoNow,
        };

        // Save to storage
        const accounts = readAndValidateAccounts();
        accounts.push(newAccount);
        storage.writeJson(STORAGE_KEY, accounts);

        // Clean up OAuth state
        storage.writeJson('creditra:oauth-state', null);

        return newAccount;
      },
    });
  }

  async function disconnectAccount(accountId: string): Promise<void> {
    return offlineMutation({
      fn: async () => {
        await delay(600);

        const accounts = readAndValidateAccounts();
        const accountIndex = accounts.findIndex(acc => acc.id === accountId);

        if (accountIndex === -1) {
          const error: AccountLinkError = {
            code: 'not_found',
            message: 'Account not found',
          };
          throw error;
        }

        // Mark as disconnected instead of deleting for audit trail
        accounts[accountIndex].status = 'disconnected';
        storage.writeJson(STORAGE_KEY, accounts);
      },
    });
  }

  async function reconnectAccount(accountId: string): Promise<LinkAccountResponse> {
    return offlineMutation({
      fn: async () => {
        await delay(400);

        const accounts = readAndValidateAccounts();
        const account = accounts.find(acc => acc.id === accountId);

        if (!account) {
          const error: AccountLinkError = {
            code: 'not_found',
            message: 'Account not found',
          };
          throw error;
        }

        // Initiate new OAuth flow for this provider
        return initiateLinkAccount({ provider: account.provider });
      },
    });
  }

  async function verifyAccount(accountId: string): Promise<LinkedAccount> {
    return offlineMutation({
      fn: async () => {
        await delay(1000);

        const accounts = readAndValidateAccounts();
        const accountIndex = accounts.findIndex(acc => acc.id === accountId);

        if (accountIndex === -1) {
          const error: AccountLinkError = {
            code: 'not_found',
            message: 'Account not found',
          };
          throw error;
        }

        const currentTime = now();
        const isoNow = new Date(currentTime).toISOString();

        // Update last verified timestamp
        accounts[accountIndex].lastVerified = isoNow;

        // Simulate verification failure based on policy
        if (shouldFailVerification()) {
          accounts[accountIndex].status = 'error';
          accounts[accountIndex].error = {
            code: 'provider_error',
            message: 'Unable to verify account. The token may have been revoked.',
            timestamp: isoNow,
          };
        } else {
          accounts[accountIndex].status = 'connected';
          delete accounts[accountIndex].error;
        }

        storage.writeJson(STORAGE_KEY, accounts);
        return accounts[accountIndex];
      },
    });
  }

  return {
    fetchLinkedAccounts,
    initiateLinkAccount,
    completeOAuthLink,
    disconnectAccount,
    reconnectAccount,
    verifyAccount,
  };
}

// Default instance for backward compatibility
const defaultService = createLinkedAccountsService();

export const fetchLinkedAccounts = defaultService.fetchLinkedAccounts;
export const initiateLinkAccount = defaultService.initiateLinkAccount;
export const completeOAuthLink = defaultService.completeOAuthLink;
export const disconnectAccount = defaultService.disconnectAccount;
export const reconnectAccount = defaultService.reconnectAccount;
export const verifyAccount = defaultService.verifyAccount;
