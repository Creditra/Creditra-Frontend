import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

interface VercelRewrite {
  source: string;
  destination: string;
}

interface VercelHeader {
  key: string;
  value: string;
}

interface VercelHeaderRule {
  source: string;
  headers: VercelHeader[];
}

interface VercelConfig {
  rewrites?: VercelRewrite[];
  headers?: VercelHeaderRule[];
}

const configPath = resolve(__dirname, '..', '..', 'vercel.json');

function loadConfig(): VercelConfig {
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as VercelConfig;
}

/**
 * Convert a Vercel route source pattern into a RegExp.
 * Vercel sources use path-to-regexp syntax: `:id` for single segments,
 * `:id*` for rest, and optional groups written as `(?:.)*`-style patterns.
 * This helper handles the common cases used in this repo.
 */
function sourceToRegex(source: string): RegExp {
  // Escape regex special characters except for the path parameter syntax.
  const escaped = source
    .replace(/[.+?^${}()|[\\]]/g, '\\$&')
    // `:id*` -> match anything (including slashes)
    .replace(/:\w+\*/g, '.*')
    // `:id` -> match a single path segment
    .replace(/:\w+(?:\)?.*)?/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

describe('vercel.json SPA rewrite', () => {
  const config = loadConfig();
  const rewrites = config.rewrites ?? [];

  it('has at least one rewrite rule', () => {
    expect(rewrites.length).greaterThan(0);
  });

  it('rewrites the SPA root to index.html', () => {
    const spaRewrite = rewrites.find((rule) => rule.destination === '/index.html');
    expect(spaRewrite).toBeDefined();
  });

  it('matches client-side routes like /dutch-auctions', () => {
    const spaRewrite = rewrites.find((rule) => rule.destination === '/index.html');
    expect(spaRewrite).toBeDefined();
    const re = sourceToRegex(spaRewrite!.source);
    expect(re.test('/dutch-auctions')).toBe(true);
  });

  it('matches nested client-side routes like /settings/notifications', () => {
    const spaRewrite = rewrites.find((rule) => rule.destination === '/index.html');
    expect(spaRewrite).toBeDefined();
    const re = sourceToRegex(spaRewrite!.source);
    expect(re.test('/settings/notifications')).toBe(true);
  });

  it('does not match hashed asset files like /assets/index-abc.js', () => {
    const spaRewrite = rewrites.find((rule) => rule.destination === '/index.html');
    expect(spaRewrite).toBeDefined();
    const re = sourceToRegex(spaRewrite!.source);
    expect(re.test('/assets/index-abc.js')).toBe(false);
  });

  it('does not match other static asset extensions', () => {
    const spaRewrite = rewrites.find((rule) => rule.destination === '/index.html');
    expect(spaRewrite).toBeDefined();
    const re = sourceToRegex(spaRewrite!.source);
    for (const asset of [
      '/favicon.svg',
      '/logo.png',
      '/styles.css',
      '/worker.js',
      '/fonts/inter.woff2',
    ]) {
      expect(re.test(asset), `${asset} should not be rewritten`).toBe(false);
    }
  });
});

describe('vercel.json security headers', () => {
  const config = loadConfig();
  const headerRules = config.headers ?? [];

  // Find the catch-all rule that covers every route.
  const catchAll = headerRules.find((rule) => rule.source === '/(.*)');

  it('has a header rule with source "/(.*)"', () => {
    expect(catchAll).toBeDefined();
  });

  it('sets X-Content-Type-Options to nosniff', () => {
    const h = catchAll?.headers.find((x) => x.key === 'X-Content-Type-Options');
    expect(h).toBeDefined();
    expect(h?.value).toBe('nosniff');
  });

  it('sets Referrer-Policy to strict-origin-when-cross-origin', () => {
    const h = catchAll?.headers.find((x) => x.key === 'Referrer-Policy');
    expect(h).toBeDefined();
    expect(h?.value).toBe('strict-origin-when-cross-origin');
  });

  it('sets Permissions-Policy disabling camera, microphone, geolocation, payment and usb', () => {
    const h = catchAll?.headers.find((x) => x.key === 'Permissions-Policy');
    expect(h).toBeDefined();
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
      expect(h?.value, `Permissions-Policy should disable ${feature}`).toContain(`${feature}=()`);
    }
  });

  it('sets X-Frame-Options to DENY', () => {
    const h = catchAll?.headers.find((x) => x.key === 'X-Frame-Options');
    expect(h).toBeDefined();
    expect(h?.value).toBe('DENY');
  });

  it('sets Content-Security-Policy with frame-ancestors none', () => {
    const h = catchAll?.headers.find((x) => x.key === 'Content-Security-Policy');
    expect(h).toBeDefined();
    expect(h?.value).toContain("frame-ancestors 'none'");
  });

  it('has no duplicate header keys in the catch-all rule', () => {
    const keys = catchAll?.headers.map((x) => x.key) ?? [];
    const unique = new Set(keys);
    expect(keys.length).toBe(unique.size);
  });

  it('vercel.json remains valid JSON and keeps the SPA rewrite intact', () => {
    expect(config.rewrites).toBeDefined();
    const spaRewrite = config.rewrites?.find((r) => r.destination === '/index.html');
    expect(spaRewrite).toBeDefined();
    expect(spaRewrite?.source).toBe('/((?!.*\\.).*)')
  });
});
