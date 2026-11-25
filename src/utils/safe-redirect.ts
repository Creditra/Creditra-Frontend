/**
 * Safe return path for the post-OAuth redirect.
 *
 * The OAuth flow lets callers supply a `redirectUrl` (for example
 * `LinkAccountRequest.redirectUrl`). That value is attacker-controlled, so it
 * must never be embedded in the OAuth URL or written to storage verbatim.
 *
 * `safeReturnPath` only accepts same-origin, in-app paths. Everything else
 * silently falls back to `fallback`. In development a warning is logged with
 * the rejection reason so bad call sites are visible during development.
 *
 * Validation is done by parsing with the `URL` constructor and comparing
 * origins — never by regex alone.
 */
const MAX_LENGTH = 512;
const ALLOWED_PREFIXES = [
  '/linked-accounts',
  '/profile',
  '/settings',
  '/open-credit',
  '/dashboard',
];
const ROOT_PATH = '/';
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

type RejectReason =
  | 'not-a-string'
  | 'too-long'
  | 'not-relative'
  | 'control-characters'
  | 'parse-error'
  | 'cross-origin'
  | 'not-allowlisted';

export function safeReturnPath(input: unknown, fallback = '/linked-accounts'): string {
  if (typeof input !== 'string') {
    warn('not-a-string');
    return fallback;
  }

  if (input.length > MAX_LENGTH) {
    warn('too-long');
    return fallback;
  }

  // Must start with a single '/' and not be protocol-relative ('//') or use a
  // backslash trick ('/\...').
  if (!input.startsWith('/') || input.startsWith('//') || input.startsWith('/\\')) {
    warn('not-relative');
    return fallback;
  }

  // No control characters or backslashes.
  if (CONTROL_CHARACTERS.test(input) || input.includes('\\')) {
    warn('control-characters');
    return fallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(input, window.location.origin);
  } catch {
    warn('parse-error');
    return fallback;
  }

  // Must resolve to the same origin (blocks absolute and protocol-relative URLs).
  if (parsed.origin !== window.location.origin) {
    warn('cross-origin');
    return fallback;
  }

  // Path must be the app root or an allowlisted in-app route prefix.
  const isAllowed =
    parsed.pathname === ROOT_PATH ||
    ALLOWED_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix));

  if (!isAllowed) {
    warn('not-allowlisted');
    return fallback;
  }

  return parsed.pathname + parsed.search + parsed.hash;
}

function warn(reason: RejectReason): void {
  if (import.meta.env.DEV) {
    console.warn(`[safeReturnPath] rejected redirect: ${reason}`);
  }
}
