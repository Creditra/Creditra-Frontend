/**
 * Discriminator for the Stellar wallets we support in the UI.
 *
 * Each value must correspond to a branch in `src/utils/wallet.ts` and to
 * an option rendered by `WalletConnectionModal`.
 */
export type WalletType = 'freighter' | 'albedo' | 'xbull' | 'rabet';

export interface WalletInfo {
  type: WalletType;
  publicKey: string;
  network: string;
}

/**
 * The minimal record persisted to `localStorage` for the active session.
 *
 * Deliberately holds only the wallet `type`: the address is re-derived from
 * the extension on reconnect, so no public key is ever written to storage.
 * `v` versions the record so older (v1) shapes can be migrated on read.
 */
export interface StoredWalletPreference {
  v: 2;
  type: WalletType;
}

/**
 * Lifecycle states of the wallet connection, used by the WalletContext
 * reducer and surfaced to UI for spinners, retry buttons, and badges.
 *
 * `reconnecting` — auto-reconnect on page load is in progress (no user
 *   interaction required; a non-blocking banner is shown if it takes
 *   longer than RECONNECT_TIMEOUT_MS).
 */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'connected'
  | 'error';

export type WalletErrorType = 'not_found' | 'connection_failed' | 'wrong_network' | 'user_rejected';

/**
 * Error thrown during wallet connection.
 * 
 * Extends Error so `instanceof` checks work and stack traces are preserved.
 * The `type` discriminator classifies the failure category for UI messaging.
 */
export class WalletConnectError extends Error {
  constructor(
    public readonly type: WalletErrorType,
    message: string
  ) {
    super(message);
    this.name = 'WalletConnectError';
    // Restore prototype chain for instanceof checks in transpiled ES5
    Object.setPrototypeOf(this, WalletConnectError.prototype);
  }
}

/**
 * @deprecated Use WalletConnectError class instead.
 * Kept for backward compatibility during migration.
 */
export interface WalletError {
  type: WalletErrorType;
  message: string;
}
