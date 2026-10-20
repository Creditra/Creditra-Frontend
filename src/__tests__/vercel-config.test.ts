import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

interface VercelRewrite {
  source: string;
  destination: string;
}

interface VercelConfig {
  rewrites?: VercelRewrite[];
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
    .replace(/:\w+(\)?(.*)?/g, '[^/]+');
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
    expect(spaRewrite).defined;
  });

  it('matches client-side routes like /dutch-auctions', () => {
    const spaRewrite = rewrites.find((rule) => rule.destination === '/index.html');
    expect(spaRewrite).defined();
    const re = sourceToRegex(spaRewrite!.source);
    expect(re.test('/dutch-auctions')).toBe(true);
  });

  it('matches nested client-side routes like /settings/notifications', () => {
    const spaRewrite = rewrites.find((rule) => rule.destination === '/index.html');
    expect(spaRewrite).defined();
    const re = sourceToRegex(spaRewrite!.source);
    expect(re.test('/settings/notifications')).toBe(true);
  });

  it('does not match hashed asset files like /assets/index-abc.js', () => {
    const spaRewrite = rewrites.find((rule) => rule.destination === '/index.html');
    expect(spaRewrite).defined();
    const re = sourceToRegex(spaRewrite!.source);
    expect(re.test('/assets/index-abc.js')).toBe(false);
  });

  it('does not match other static asset extensions', () => {
    const spaRewrite = rewrites.find((rule) => rule.destination === '/index.html');
    expect(spaRewrite).defined();
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
