import { describe, it, expect, afterEach } from 'vitest';
import { detectBrowserFamily, getWalletBrowserSupport } from '../walletSupport';

describe('walletSupport', () => {
  const originalIsSecureContext = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
  const originalOpen = window.open;
  const originalUserAgent = Object.getOwnPropertyDescriptor(navigator, 'userAgent');

  afterEach(() => {
    if (originalIsSecureContext) {
      Object.defineProperty(window, 'isSecureContext', originalIsSecureContext);
    } else {
      delete (window as unknown as Record<string, unknown>).isSecureContext;
    }

    window.open = originalOpen;

    if (originalUserAgent) {
      Object.defineProperty(navigator, 'userAgent', originalUserAgent);
    }
  });

  it('returns supported for a secure desktop browser context', () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      configurable: true,
    });

    const result = getWalletBrowserSupport();
    expect(result.browserSupported).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.browserFamily).toBe('chromium');
  });

  it('returns unsupported in an insecure context', () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
    });

    const result = getWalletBrowserSupport();
    expect(result.browserSupported).toBe(false);
    expect(result.reason).toMatch(/secure/i);
  });

  it('handles an empty UA string gracefully without false unsupported flag', () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'userAgent', {
      value: '',
      configurable: true,
    });

    expect(detectBrowserFamily('')).toBe('unknown');
    const result = getWalletBrowserSupport();
    expect(result.browserSupported).toBe(true);
    expect(result.browserFamily).toBe('unknown');
    expect(result.reason).toBeNull();
  });

  it('returns unsupported when window.open is not a function', () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });
    (window as unknown as { open: unknown }).open = undefined;

    const result = getWalletBrowserSupport();
    expect(result.browserSupported).toBe(false);
    expect(result.reason).toMatch(/open/i);
  });

  it('returns unsupported for mobile user agents', () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    const result = getWalletBrowserSupport();
    expect(result.browserSupported).toBe(false);
    expect(result.browserFamily).toBe('mobile');
    expect(result.reason).toMatch(/mobile/i);
  });
});
