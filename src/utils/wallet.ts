import {
  WalletType,
  WalletInfo,
  WalletConnectError,
  WalletErrorType,
  StoredWalletPreference,
} from '../types/wallet';
import { readJson, writeJson, removeKey } from './storage';
import { isValidAccountId } from './strkey';
import { getCreditNetworkConfig, type CreditNetwork } from '../config/creditNetwork';
import { getWalletAdapter } from './wallets';

// Re-export types for convenience
export {
  WalletConnectError,
  type WalletType,
  type WalletErrorType,
  type StoredWalletPreference,
} from '../types/wallet';

// ─── Error classification and user-facing copy ─────────────────────────────────

/**
 * User-facing error messages for each error type.
 * Centralised so copy updates only need to touch one place.
 */
const ERROR_MESSAGES: Record<WalletErrorType, string> = {
  user_rejected: "You cancelled the request in your wallet. Try again when you're ready.",
  not_found: "Wallet extension not found. Please install it first.",
  wrong_network: "Switch your wallet to Testnet and try again.",
  connection_failed: "Failed to connect. Please try again."
};

/**
 * Classifies a raw error from a wallet extension into a typed WalletConnectError.
 * 
 * Examines the error message and code to determine the failure category:
 * - User rejection (code 4001, or messages containing "reject", "decline", "cancel")
 * - Extension not found
 * - Wrong network
 * - Generic connection failure (catch-all)
 * 
 * Only the derived code and resulting type are logged in development; the raw
 * error object and message are never logged, since they may carry account data.
 */
export const classifyWalletError = (raw: unknown): WalletConnectError => {
  // Already classified errors pass through unchanged
  if (raw instanceof WalletConnectError) {
    return raw;
  }

  // Check if it's a plain WalletError object (legacy format)
  if (
    raw &&
    typeof raw === 'object' &&
    'type' in raw &&
    'message' in raw
  ) {
    const legacyError = raw as { type: WalletErrorType; message: string };
    return new WalletConnectError(legacyError.type, legacyError.message);
  }

  // Extract message and code from the raw error
  const message = raw && typeof raw === 'object' && 'message' in raw
    ? String((raw as any).message)
    : String(raw);
  
  const code = raw && typeof raw === 'object' && 'code' in raw
    ? (raw as any).code
    : undefined;

  // Determine the classified error. The raw error object and its message may
  // carry account data, so they are never logged — only the derived code and
  // resulting type are surfaced in development.
  const result = (() => {
    // Check for user rejection signals
    // EIP-1193 standard error code for user rejection
    if (code === 4001) {
      return new WalletConnectError('user_rejected', ERROR_MESSAGES.user_rejected);
    }

    // Check message for rejection keywords
    const lowerMessage = message.toLowerCase();
    const rejectionKeywords = ['reject', 'decline', 'cancel', 'denied', 'user denied'];
    if (rejectionKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return new WalletConnectError('user_rejected', ERROR_MESSAGES.user_rejected);
    }

    // Check for extension not found
    if (lowerMessage.includes('not found') || lowerMessage.includes('not installed')) {
      return new WalletConnectError('not_found', ERROR_MESSAGES.not_found);
    }

    // Check for network mismatch
    if (lowerMessage.includes('network') || lowerMessage.includes('testnet') || lowerMessage.includes('mainnet')) {
      return new WalletConnectError('wrong_network', ERROR_MESSAGES.wrong_network);
    }

    // Default: generic connection failure
    return new WalletConnectError('connection_failed', ERROR_MESSAGES.connection_failed);
  })();

  // Log only the code and resulting type in development. The raw error object
  // and message are intentionally excluded — they may contain account data.
  // Drop the log entirely when no code is present.
  if (process.env.NODE_ENV === 'development' && code !== undefined) {
    console.error('[classifyWalletError]', { code, type: result.type });
  }

  return result;
};

// ─── Storage keys ──────────────────────────────────────────────────────────────
//
// We namespace wallet-related state under `creditra-wallet-*` to avoid clashes
// with other apps sharing the same origin.  All values are JSON-encodable so
// they can flow through the safe wrappers in `./storage` (private-mode safe,
// quota-safe).
//
//   creditra-wallet-info        — `StoredWalletPreference`, i.e. `{ v: 2, type }`
//                                   for the active session.  Type only: the
//                                   public key is re-asked from the extension
//                                   on reconnect, so it never sits in storage.
//   creditra-wallet-recent      — `WalletType[]` ordered MRU list.
//   creditra-wallet-remember    — `boolean` opt-in flag for auto-reconnect.
//   creditra-wallet-account     — `{ v: 1, type, publicKey }`, written only
//                                   when the user explicitly picks one of
//                                   several accounts, so the choice can be
//                                   restored on the next visit.
//
// The remaining two keys are legacy and only ever read once, to migrate and
// then delete them (see `getStoredWallet`):
//
//   wallet_info                 — v1 `WalletInfo`, which included the address.
//   wallet_preference           — pre-MRU wallet type preference.
const STORAGE_KEY_INFO = 'creditra-wallet-info';
const STORAGE_KEY_RECENT = 'creditra-wallet-recent';
const STORAGE_KEY_REMEMBER = 'creditra-wallet-remember';
const STORAGE_KEY_ACCOUNT = 'creditra-wallet-account';
const STORAGE_KEY_PREFERENCE_LEGACY = 'wallet_preference';
const STORAGE_KEY_INFO_LEGACY = 'wallet_info';

/** Version of the `creditra-wallet-info` record written by this module. */
const WALLET_INFO_VERSION = 2 as const;

// Hard cap on MRU length — covers every supported wallet and then some, so the
// array stays small and the rewrite cost is trivial.
const MRU_MAX_LENGTH = 8;

const validateAccountId = (publicKey: unknown): string => {
  if (!isValidAccountId(publicKey)) {
    throw {
      type: 'connection_failed',
      message: 'Your wallet returned an invalid account address',
    } as WalletError;
  }
  return publicKey;
};

const SUPPORTED_WALLET_TYPES: ReadonlySet<WalletType> = new Set([
  'freighter',
  'albedo',
  'xbull',
  'rabet',
]);

/**
 * Detects whether a given Stellar wallet browser extension is currently
 * installed and exposed on the window object.
 *
 * This is a synchronous, side-effect-free probe — it does not request user
 * permission or trigger any UI from the wallet.
 */
export const isWalletInstalled = (type: WalletType): boolean => {
  return getWalletAdapter(type)?.isInstalled() ?? false;
};

/**
 * Opens a connection to the requested Stellar wallet and returns the
 * public key plus the network the wallet is reporting.
 *
 * Each supported wallet exposes a slightly different surface area, so this
 * function normalises them into a single `WalletInfo` shape and throws a
 * `WalletConnectError` with a stable `type` discriminator on failure.
 */
export const connectWallet = async (type: WalletType): Promise<WalletInfo> => {
  if (!isWalletInstalled(type)) {
    const walletNames: Record<WalletType, string> = {
      freighter: 'Freighter',
      albedo: 'Albedo',
      xbull: 'xBull',
      rabet: 'Rabet'
    };
    throw new WalletConnectError(
      'not_found',
      `${walletNames[type]} wallet not found. Please install the extension.`
    );
  }

  try {
    if (type === 'freighter') {
      const publicKey = validateAccountId(await window.freighter.getPublicKey());
      const network = await window.freighter.getNetwork();
      
      if (network !== 'PUBLIC' && network !== 'TESTNET') {
        throw new WalletConnectError(
          'wrong_network',
          'Please switch to Stellar network in your wallet.'
        );
      }

      return { type, publicKey, network };
    }

    if (type === 'albedo') {
      const result = await window.albedo.publicKey({});
      return { 
        type, 
        publicKey: validateAccountId(result.pubkey),
        network: 'PUBLIC' 
      };
    }

    if (type === 'xbull') {
      const publicKey = validateAccountId(await window.xBullSDK.getPublicKey());
      return { 
        type, 
        publicKey, 
        network: 'PUBLIC' 
      };
    }

    if (type === 'rabet') {
      const result = await window.rabet.connect();
      return { 
        type, 
        publicKey: validateAccountId(result.publicKey),
        network: 'PUBLIC' 
      };
    }

    throw new Error('Unsupported wallet type');
  } catch (error: unknown) {
    // Re-throw if already classified
    if (error instanceof WalletConnectError) {
      throw error;
    }
    
    // Classify and throw
    throw classifyWalletError(error);
  }
};

const isTestnetPassphrase = (networkPassphrase: string): boolean =>
  networkPassphrase.toLowerCase().includes('test');

/**
 * Request a transaction signature from the connected Stellar wallet.
 *
 * Supports Freighter (`signTransaction`), Albedo (`tx`), xBull (`signXDR`),
 * and Rabet (`sign`). Errors (including user cancellation/rejection) are
 * normalized into `WalletConnectError` (with `type: 'user_rejected'` on
 * cancellation).
 */
export const signTransaction = async (
  type: WalletType,
  xdr: string,
  networkPassphrase: string,
): Promise<string> => {
  if (!isWalletInstalled(type)) {
    const walletNames: Record<WalletType, string> = {
      freighter: 'Freighter',
      albedo: 'Albedo',
      xbull: 'xBull',
      rabet: 'Rabet',
    };
    throw new WalletConnectError(
      'not_found',
      `${walletNames[type]} wallet not found. Please install the extension.`,
    );
  }

  const testnet = isTestnetPassphrase(networkPassphrase);

  try {
    if (type === 'freighter') {
      const signFn = window.freighter?.signTransaction;
      if (typeof signFn !== 'function') {
        throw new WalletConnectError(
          'connection_failed',
          'Freighter wallet does not support transaction signing.',
        );
      }
      const result = await signFn.call(window.freighter, xdr, { networkPassphrase });
      if (typeof result === 'string' && result.length > 0) {
        return result;
      }
      if (result && typeof result === 'object') {
        if (result.error) {
          throw new Error(result.error);
        }
        if (typeof result.signedTxXdr === 'string' && result.signedTxXdr.length > 0) {
          return result.signedTxXdr;
        }
      }
      throw new WalletConnectError(
        'connection_failed',
        'Freighter returned an empty signed transaction.',
      );
    }

    if (type === 'albedo') {
      const txFn = window.albedo?.tx;
      if (typeof txFn !== 'function') {
        throw new WalletConnectError(
          'connection_failed',
          'Albedo wallet does not support transaction signing.',
        );
      }
      const result = await txFn.call(window.albedo, {
        xdr,
        network: testnet ? 'testnet' : 'public',
        submit: false,
      });
      if (typeof result?.signed_envelope_xdr === 'string' && result.signed_envelope_xdr.length > 0) {
        return result.signed_envelope_xdr;
      }
      throw new WalletConnectError(
        'connection_failed',
        'Albedo returned an empty signed transaction.',
      );
    }

    if (type === 'xbull') {
      const signXdrFn = window.xBullSDK?.signXDR;
      if (typeof signXdrFn !== 'function') {
        throw new WalletConnectError(
          'connection_failed',
          'xBull wallet does not support transaction signing.',
        );
      }
      const result = await signXdrFn.call(window.xBullSDK, xdr, {
        network: networkPassphrase,
      });
      if (typeof result === 'string' && result.length > 0) {
        return result;
      }
      if (result && typeof result === 'object' && typeof result.xdr === 'string' && result.xdr.length > 0) {
        return result.xdr;
      }
      throw new WalletConnectError(
        'connection_failed',
        'xBull returned an empty signed transaction.',
      );
    }

    if (type === 'rabet') {
      const signFn = window.rabet?.sign;
      if (typeof signFn !== 'function') {
        throw new WalletConnectError(
          'connection_failed',
          'Rabet wallet does not support transaction signing.',
        );
      }
      const result = await signFn.call(window.rabet, xdr, testnet ? 'testnet' : 'mainnet');
      if (typeof result === 'string' && result.length > 0) {
        return result;
      }
      if (result && typeof result === 'object') {
        if (result.error) {
          throw new Error(result.error);
        }
        if (typeof result.xdr === 'string' && result.xdr.length > 0) {
          return result.xdr;
        }
      }
      throw new WalletConnectError(
        'connection_failed',
        'Rabet returned an empty signed transaction.',
      );
    }

    throw new Error('Unsupported wallet type');
  } catch (error: unknown) {
    if (error instanceof WalletConnectError) {
      throw error;
    }
    throw classifyWalletError(error);
  }
};

// ─── Multi-account discovery ─────────────────────────────────────────────────

/**
 * Read an account list from a wallet API that may return either a bare
 * `string[]` or an object with an `addresses` array (Freighter's newer
 * `getAddresses` shape). Anything unexpected yields an empty list so a
 * feature-detection miss never breaks a connection.
 */
async function readAccountList(
  discover: (() => Promise<unknown>) | undefined,
): Promise<string[]> {
  if (typeof discover !== 'function') return [];
  try {
    const result = await discover();
    if (typeof result === 'string') {
      return [result];
    }
    if (Array.isArray(result)) {
      return result.filter((value): value is string => typeof value === 'string');
    }
    if (result && typeof result === 'object') {
      const addresses = (result as { addresses?: unknown }).addresses;
      if (Array.isArray(addresses)) {
        return addresses.filter((value): value is string => typeof value === 'string');
      }
    }
  } catch {
    // Extensions throw for unsupported calls or when access is denied; the
    // caller falls back to the single connected key.
  }
  return [];
}

const dedupeAccounts = (accounts: string[]): string[] => [
  ...new Set(accounts.filter((account) => isValidAccountId(account))),
];

/**
 * Discover the accounts a wallet currently exposes.
 *
 * Feature-detects wallet APIs so this works with older extensions:
 * - Freighter: `getAddresses()` → `getAccounts()` → `getPublicKey()`.
 * - Albedo / xBull / Rabet: only dedicated `getAccounts`/`getAddresses`
 *   methods are used. Calling `publicKey()`/`connect()` again would prompt the
 *   user, which is not acceptable for a passive account listing.
 *
 * Returns `[]` when the wallet is absent or exposes nothing beyond the key the
 * caller already has. Callers should treat an empty list as "single account".
 */
export const getAccounts = async (type: WalletType): Promise<string[]> => {
  if (!isWalletInstalled(type)) return [];

  if (type === 'freighter' && window.freighter) {
    const freighter = window.freighter;
    const discoverers = [freighter.getAddresses, freighter.getAccounts, freighter.getPublicKey];
    for (const discover of discoverers) {
      const accounts = dedupeAccounts(
        await readAccountList(discover ? discover.bind(freighter) : undefined),
      );
      if (accounts.length > 0) return accounts;
    }
    return [];
  }

  const wallet = type === 'albedo'
    ? window.albedo
    : type === 'xbull'
      ? window.xBullSDK
      : type === 'rabet'
        ? window.rabet
        : undefined;

  if (!wallet) return [];

  const discover = wallet.getAddresses ?? wallet.getAccounts;
  return dedupeAccounts(
    await readAccountList(discover ? discover.bind(wallet) : undefined),
  );
};

// ─── Last selected account ───────────────────────────────────────────────────

interface StoredAccount {
  v: 1;
  type: WalletType;
  publicKey: string;
}

/**
 * Remember the account the user explicitly picked when their wallet exposed
 * more than one. Only written on an explicit switch, so single-account users
 * never have an address persisted.
 */
export const saveLastAccount = (type: WalletType, publicKey: string): void => {
  if (!SUPPORTED_WALLET_TYPES.has(type) || !isValidAccountId(publicKey)) return;
  const stored: StoredAccount = { v: 1, type, publicKey };
  writeJson(STORAGE_KEY_ACCOUNT, stored);
};

/** Read the remembered account for `type`, or `null` when none/invalid. */
export const getLastAccount = (type: WalletType): string | null => {
  const raw = readJson<unknown>(STORAGE_KEY_ACCOUNT, null);
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<StoredAccount>;
  if (record.type !== type) return null;
  return typeof record.publicKey === 'string' && isValidAccountId(record.publicKey)
    ? record.publicKey
    : null;
};

/** Drop the remembered account (called on disconnect). */
export const clearLastAccount = (): void => {
  removeKey(STORAGE_KEY_ACCOUNT);
};

// ─── Connection lifecycle helpers ────────────────────────────────────────────

/**
 * Drop the active session from localStorage.  Also clears the opt-in
 * "remember my choice" flag so a future return visit will not auto-connect.
 *
 * IMPORTANT: this call does **not** clear the MRU list (`creditra-wallet-recent`).
 * The MRU ordering reflects the user's activity history, which we want to keep
 * so the modal still surfaces preferred wallets in their natural order after a
 * full disconnect.  MRU entries are only dropped implicitly when the active
 * session no longer makes sense — clearMRU() is the explicit-only escape hatch.
 *
 * Safe to call when nothing is stored (no-ops silently).
 */
export const disconnectWallet = () => {
  removeKey(STORAGE_KEY_INFO);
  removeKey(STORAGE_KEY_INFO_LEGACY);
  removeKey(STORAGE_KEY_PREFERENCE_LEGACY);
  removeKey(STORAGE_KEY_REMEMBER);
  removeKey(STORAGE_KEY_ACCOUNT);
};

/**
 * Explicitly wipe the MRU list.  Not currently called by any user-facing
 * control — exposed so future integrity tools or test helpers can reset
 * recency state without affecting the active session.
 */
export const clearMRU = (): void => {
  removeKey(STORAGE_KEY_RECENT);
};

/**
 * Persist the active session.  Only the wallet **type** is written — the
 * `publicKey`/`network` from `walletInfo` are intentionally dropped, because
 * reconnect re-derives them from the extension.  That keeps the module's
 * promise that no address ever reaches `localStorage`.
 */
export const saveWalletPreference = (walletInfo: WalletInfo) => {
  const stored: StoredWalletPreference = { v: WALLET_INFO_VERSION, type: walletInfo.type };
  writeJson(STORAGE_KEY_INFO, stored);
  // The old `wallet_info` mirror is obsolete: drop it rather than rewrite it.
  removeKey(STORAGE_KEY_INFO_LEGACY);
};

/**
 * Extract a supported wallet type from any stored shape we may find:
 * a bare type string (`wallet_preference`), or an object with a `type` field
 * (v1 `WalletInfo`, v2 `StoredWalletPreference`).  Returns `null` for anything
 * else, including unsupported or missing types.
 */
function extractWalletType(value: unknown): WalletType | null {
  const candidate =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? (value as { type?: unknown }).type
        : undefined;

  return typeof candidate === 'string' && SUPPORTED_WALLET_TYPES.has(candidate as WalletType)
    ? (candidate as WalletType)
    : null;
}

/**
 * Read the stored session, migrating older records on the way.
 *
 * The returned value always has the current shape — `{ v: 2, type }`.  Only the
 * type survives: a v1 `creditra-wallet-info` record (which carried the public
 * key) is reduced to its type, the pre-MRU `wallet_info` / `wallet_preference`
 * keys are folded in as a fallback and then deleted.  The migration is
 * idempotent and needs no user action; a record whose type is missing or
 * unsupported is removed outright so no reconnect is attempted from it.
 */
export const getStoredWallet = (): (StoredWalletPreference & Partial<WalletInfo>) | null => {
  const current = readJson<unknown>(STORAGE_KEY_INFO, null);
  const legacyInfo = readJson<unknown>(STORAGE_KEY_INFO_LEGACY, null);
  const legacyPreference = readJson<unknown>(STORAGE_KEY_PREFERENCE_LEGACY, null);

  // Both legacy keys are obsolete as soon as we have looked at them.
  removeKey(STORAGE_KEY_INFO_LEGACY);
  removeKey(STORAGE_KEY_PREFERENCE_LEGACY);

  const type =
    extractWalletType(current) ??
    extractWalletType(legacyInfo) ??
    extractWalletType(legacyPreference);

  if (!type) {
    // Nothing usable — drop anything we found so it cannot trigger a reconnect.
    if (current !== null) removeKey(STORAGE_KEY_INFO);
    return null;
  }

  const rawObj = (current && typeof current === 'object' ? current : legacyInfo && typeof legacyInfo === 'object' ? legacyInfo : {}) as Record<string, unknown>;
  const stored: StoredWalletPreference & Partial<WalletInfo> = {
    v: WALLET_INFO_VERSION,
    type,
    ...(typeof rawObj.publicKey === 'string' ? { publicKey: rawObj.publicKey } : {}),
    ...(typeof rawObj.network === 'string' ? { network: rawObj.network as any } : {}),
  };
  // Rewrite only when the on-disk record is not already the current shape, so
  // repeated reads stay idempotent.
  if (
    !current ||
    typeof current !== 'object' ||
    (current as StoredWalletPreference).v !== WALLET_INFO_VERSION ||
    (current as StoredWalletPreference).type !== type
  ) {
    writeJson(STORAGE_KEY_INFO, { v: WALLET_INFO_VERSION, type });
  }
  return stored;
};

// ─── MRU (most-recently-used) bookkeeping ────────────────────────────────────

/**
 * Validate a single entry of a (possibly corrupt) stored MRU list.
 * Drops anything that doesn't match a supported wallet type.  This is
 * important because `readJson` will happily surface any JSON we wrote
 * historically, including out-of-date values when the wallet set changes.
 */
function sanitizeMru(value: unknown): WalletType[] {
  if (!Array.isArray(value)) return [];
  const result: WalletType[] = [];
  // Preserve insertion order (the array already encodes recency).
  for (const entry of value) {
    if (
      typeof entry === 'string' &&
      SUPPORTED_WALLET_TYPES.has(entry as WalletType) &&
      !result.includes(entry as WalletType)
    ) {
      result.push(entry as WalletType);
    }
    if (result.length >= MRU_MAX_LENGTH) break;
  }
  return result;
}

/**
 * Read the MRU list.  Last entry is the most-recently-used.
 * Returns `[]` when nothing is stored or the stored value is malformed.
 */
export const getRecentWalletOrder = (): WalletType[] => {
  return sanitizeMru(readJson<unknown>(STORAGE_KEY_RECENT, []));
};

/**
 * Promote `type` to the end (most-recent) of the MRU list.
 * - Removes any prior occurrence so the wallet never appears twice.
 * - Caps the list at `MRU_MAX_LENGTH` entries.
 * - Silent no-op on storage failure (uses the safe wrappers).
 */
export const recordRecentWallet = (type: WalletType): void => {
  if (!SUPPORTED_WALLET_TYPES.has(type)) return;
  const current = getRecentWalletOrder().filter((t) => t !== type);
  current.push(type);
  const trimmed = current.slice(-MRU_MAX_LENGTH);
  writeJson(STORAGE_KEY_RECENT, trimmed);
};

// ─── "Remember my choice" opt-in flag ────────────────────────────────────────

/**
 * `true` when the user explicitly opted in to next-visit auto-connect for
 * their most-recently used wallet.  Defaults to `false` so storage absence
 * is indistinguishable from a fresh "no".
 */
export const isWalletRemembered = (): boolean => {
  return readJson<boolean>(STORAGE_KEY_REMEMBER, false) === true;
};

/**
 * Persist (or clear) the opt-in flag.  When `false`, the key is removed so we
 * do not pollute localStorage with a redundant "false".
 */
export const setWalletRemembered = (remember: boolean): void => {
  if (remember) {
    writeJson(STORAGE_KEY_REMEMBER, true);
  } else {
    removeKey(STORAGE_KEY_REMEMBER);
  }
};


/**
 * Network the app expects wallets to be connected to, derived from the single
 * source of truth in `src/config/creditNetwork.ts`. Falls back to TESTNET when
 * the environment is invalid so importing this module never throws; callers
 * that need the configuration itself still get a loud `ConfigError`.
 */
export const EXPECTED_NETWORK: CreditNetwork = (() => {
  try {
    return getCreditNetworkConfig().network;
  } catch {
    return 'TESTNET';
  }
})();

export const isSwitchSupported = (type: WalletType): boolean => {
  return Boolean(getWalletAdapter(type)?.switchNetwork);
};

export const switchNetwork = async (type: WalletType, network: string): Promise<void> => {
  const adapter = getWalletAdapter(type);
  if (adapter?.switchNetwork) {
    await adapter.switchNetwork(network);
    return;
  }
  throw new Error(`Please open your ${type} wallet and switch to ${network}.`);
};

export const getExplorerBaseUrl = (network: string): string => {
  const normalized = network?.toUpperCase?.() ?? 'PUBLIC';
  try {
    const config = getCreditNetworkConfig();
    // The unified config describes the network the app is deployed against;
    // only reuse its explorer root when the caller asks about that network.
    if (normalized === config.network) {
      return `${config.explorerBaseUrl}/tx`;
    }
  } catch {
    // Invalid environment: fall through to the canonical explorer roots below.
  }
  if (normalized === 'TESTNET') {
    return 'https://stellar.expert/explorer/testnet/tx';
  }
  return 'https://stellar.expert/explorer/public/tx';
};

export const getExplorerTxUrl = (hash: string): string => {
  let network = 'PUBLIC';
  try {
    network = getCreditNetworkConfig().network;
  } catch {
    network = 'PUBLIC';
  }
  return `${getExplorerBaseUrl(network)}/${encodeURIComponent(hash)}`;
};
