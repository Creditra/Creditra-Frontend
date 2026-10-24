import {
  WalletType,
  WalletInfo,
  WalletConnectError,
  WalletErrorType,
  StoredWalletPreference,
} from '../types/wallet';
import { readJson, writeJson, removeKey } from './storage';
import { isValidAccountId } from './strkey';

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
 * Raw error details are logged in development but never shown to users.
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

  // Log raw error in development for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('[classifyWalletError] Raw error:', raw);
  }

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
//
// The remaining two keys are legacy and only ever read once, to migrate and
// then delete them (see `getStoredWallet`):
//
//   wallet_info                 — v1 `WalletInfo`, which included the address.
//   wallet_preference           — pre-MRU wallet type preference.
const STORAGE_KEY_INFO = 'creditra-wallet-info';
const STORAGE_KEY_RECENT = 'creditra-wallet-recent';
const STORAGE_KEY_REMEMBER = 'creditra-wallet-remember';
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

declare global {
  interface Window {
    freighter?: any;
    albedo?: any;
    xBullSDK?: any;
    rabet?: any;
  }
}

/**
 * Detects whether a given Stellar wallet browser extension is currently
 * installed and exposed on the window object.
 *
 * This is a synchronous, side-effect-free probe — it does not request user
 * permission or trigger any UI from the wallet.
 */
export const isWalletInstalled = (type: WalletType): boolean => {
  if (type === 'freighter') return !!window.freighter;
  if (type === 'albedo') return !!window.albedo;
  if (type === 'xbull') return !!window.xBullSDK;
  if (type === 'rabet') return !!window.rabet;
  return false;
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
export const getStoredWallet = (): StoredWalletPreference | null => {
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

  const stored: StoredWalletPreference = { v: WALLET_INFO_VERSION, type };
  // Rewrite only when the on-disk record is not already the current shape, so
  // repeated reads stay idempotent.
  if (
    !current ||
    typeof current !== 'object' ||
    (current as StoredWalletPreference).v !== WALLET_INFO_VERSION ||
    (current as StoredWalletPreference).type !== type
  ) {
    writeJson(STORAGE_KEY_INFO, stored);
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


export const EXPECTED_NETWORK = 'TESTNET';

export const isSwitchSupported = (type: WalletType): boolean => {
  if (type === 'freighter' && window.freighter?.switchNetwork) return true;
  return false;
};

export const switchNetwork = async (type: WalletType, network: string): Promise<void> => {
  if (type === 'freighter' && window.freighter?.switchNetwork) {
    await window.freighter.switchNetwork(network);
    return;
  }
  throw new Error(`Please open your ${type} wallet and switch to ${network}.`);
};

export const getExplorerBaseUrl = (network: string): string => {
  const normalized = network?.toUpperCase?.() ?? 'PUBLIC';
  if (normalized === 'TESTNET') {
    return 'https://stellar.expert/explorer/testnet/tx';
  }
  return 'https://stellar.expert/explorer/public/tx';
};
