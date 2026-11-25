// types/auth.types.ts

/**
 * Payload shape of the sign-in form. `emailOrUsername` is intentionally
 * a single field so we don't force the user to remember which one they
 * registered with — the backend disambiguates server-side.
 */
export interface LoginFormData {
  emailOrUsername: string
  password: string
  /** When true, the session cookie is extended past browser-close. */
  rememberMe: boolean
}

/** Payload shape of the registration form. */
export interface RegisterFormData {
  email: string
  password: string
  /** Must equal `password`; validated client-side before submission. */
  confirmPassword: string
  /** Must be true at submission; backed by an inline error if unchecked. */
  acceptTerms: boolean
}

/** Step 1 of password reset: the user enters the email to receive a reset link. */
export interface PasswordResetRequestData {
  email: string
}

/** Step 2 of password reset: the user follows the link and sets a new password. */
export interface PasswordResetData {
  /** Single-use token from the reset email URL. */
  token: string
  newPassword: string
  /** Must equal `newPassword`; validated client-side before submission. */
  confirmPassword: string
}

/**
 * Backend-issued error shape for auth flows.
 *
 * When `field` is present, the UI attaches the error to that input via
 * `aria-describedby`; when absent, the error is surfaced as a form-level
 * banner.
 */
export interface AuthError {
  field?: string
  message: string
  code?: AuthErrorCode
}

export type AuthErrorCode =
  | 'user_rejected'
  | 'wrong_network'
  | 'challenge_expired'
  | 'invalid_challenge'
  | 'wallet_error'
  | 'request_failed'
  | 'configuration_error'

/** SEP-10 transaction returned by the authentication endpoint. */
export interface Sep10Challenge {
  transaction: string
  network_passphrase: string
}

/** Authenticated session returned after a SEP-10 challenge is verified. */
export interface Sep10Session {
  token: string
}

/**
 * Coarse password-strength bucket produced by
 * `src/utils/password-strength.ts`. Drives the meter colour and copy on
 * the registration form.
 */
export type PasswordStrength = 'weak' | 'medium' | 'strong'
