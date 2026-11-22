/**
 * Advisory browser support check for Stellar wallet extensions.
 *
 * NOTE: This check is strictly advisory. Feature checks and coarse user-agent
 * family detection cannot guarantee whether a specific browser or extension
 * will work in every environment, and web-based wallets such as Albedo do not
 * require a browser extension.
 */

export type BrowserFamily = 'chromium' | 'firefox' | 'safari' | 'mobile' | 'legacy' | 'unknown';

export interface WalletBrowserSupport {
  /** Whether the current browser environment appears able to run wallet extensions. */
  browserSupported: boolean;
  /** Human-readable advisory reason when `browserSupported` is `false`, otherwise `null`. */
  reason: string | null;
  /** Coarse browser family inferred from `navigator.userAgent` (advisory). */
  browserFamily: BrowserFamily;
}

/**
 * Infer a coarse browser family from a user-agent string.
 * Advisory only; empty or unrecognized user-agent strings resolve to `'unknown'`.
 */
export function detectBrowserFamily(userAgent: string): BrowserFamily {
  const ua = userAgent.trim();
  if (!ua) {
    return 'unknown';
  }

  if (/MSIE|Trident\//i.test(ua)) {
    return 'legacy';
  }

  if (/iPhone|iPad|iPod|Android|Mobile/i.test(ua)) {
    return 'mobile';
  }

  if (/Firefox\//i.test(ua)) {
    return 'firefox';
  }

  if (/Chrome\/|Chromium\/|Edg\/|OPR\//i.test(ua)) {
    return 'chromium';
  }

  if (/Safari\//i.test(ua)) {
    return 'safari';
  }

  return 'unknown';
}

/**
 * Perform an advisory check of whether the current browser environment can
 * support browser wallet extensions based on feature checks and a coarse
 * user-agent family check.
 */
export function getWalletBrowserSupport(): WalletBrowserSupport {
  if (typeof window === 'undefined') {
    return {
      browserSupported: false,
      reason: 'Browser window environment is unavailable.',
      browserFamily: 'unknown',
    };
  }

  const userAgent =
    typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
      ? navigator.userAgent
      : '';
  const browserFamily = detectBrowserFamily(userAgent);

  if (window.isSecureContext === false) {
    return {
      browserSupported: false,
      reason: 'Wallet extensions require a secure (HTTPS) context.',
      browserFamily,
    };
  }

  if (typeof window.open !== 'function') {
    return {
      browserSupported: false,
      reason: 'This browser cannot open wallet extension or web-wallet windows.',
      browserFamily,
    };
  }

  if (browserFamily === 'legacy') {
    return {
      browserSupported: false,
      reason: 'This browser does not support modern wallet extensions.',
      browserFamily,
    };
  }

  if (browserFamily === 'mobile') {
    return {
      browserSupported: false,
      reason: 'Mobile browsers generally do not support desktop wallet extensions.',
      browserFamily,
    };
  }

  return {
    browserSupported: true,
    reason: null,
    browserFamily,
  };
}
