/**
 * External account provider types that can be linked to a Creditra account.
 * 
 * Supported providers:
 * - google: Google OAuth integration
 * - github: GitHub OAuth integration
 * - twitter: Twitter OAuth integration
 * - facebook: Facebook OAuth integration
 */
export type AccountProvider = 'google' | 'github' | 'twitter' | 'facebook';

/**
 * Connection status of a linked external account.
 * 
 * - connected: Account is actively linked
 * - pending: OAuth flow initiated but not completed
 * - error: Last connection attempt failed
 * - disconnected: Account was previously connected but is now unlinked
 */
export type ConnectionStatus = 'connected' | 'pending' | 'error' | 'disconnected';

/**
 * Represents a single linked external account.
 */
export interface LinkedAccount {
  /** Unique identifier for this linked account relationship */
  id: string;
  /** The OAuth provider name */
  provider: AccountProvider;
  /** Current connection state */
  status: ConnectionStatus;
  /** User's display name or email on the external provider */
  displayName: string;
  /** User's unique identifier on the external provider (e.g., email, username) */
  externalId: string;
  /** ISO 8601 timestamp when the account was first linked */
  connectedAt: string;
  /** ISO 8601 timestamp of last successful sync or verification */
  lastVerified?: string;
  /** Optional error details when status is 'error' */
  error?: AccountLinkError;
}

/**
 * Error details for failed account linking operations.
 */
export interface AccountLinkError {
  /** Error code for programmatic handling */
  code: 'auth_failed' | 'already_linked' | 'provider_error' | 'network_error' | 'token_expired' | 'not_found';
  /** Human-readable error message */
  message: string;
  /** Optional timestamp of when the error occurred */
  timestamp?: string;
}

/**
 * Payload for initiating a new account link.
 */
export interface LinkAccountRequest {
  provider: AccountProvider;
  /** Optional redirect URL after OAuth flow completes */
  redirectUrl?: string;
}

/**
 * Response from initiating a new account link.
 */
export interface LinkAccountResponse {
  /** OAuth authorization URL to redirect the user to */
  authUrl: string;
  /** State token for CSRF protection */
  state: string;
}

/**
 * Payload for completing OAuth callback.
 */
export interface CompleteOAuthRequest {
  provider: AccountProvider;
  /** Authorization code from OAuth provider */
  code: string;
  /** State token for verification */
  state: string;
}
