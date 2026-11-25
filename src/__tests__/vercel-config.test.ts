import { readFileSync, readdirSync } from 'node:fs';
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

  function parseCsp(csp: string): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const directive of csp.split(';')) {
      const trimmed = directive.trim();
      if (!trimmed) continue;
      const [name, ...values] = trimmed.split(/\s+/);
      map.set(name, values);
    }
    return map;
  }

  it('sets strict Content-Security-Policy with no unsafe-inline or unsafe-eval in script-src', () => {
    const h = catchAll?.headers.find((x) => x.key === 'Content-Security-Policy');
    expect(h).toBeDefined();
    const csp = parseCsp(h!.value);

    // script-src checks
    const scriptSrc = csp.get('script-src');
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");

    // default-src
    const defaultSrc = csp.get('default-src');
    expect(defaultSrc).toBeDefined();
    expect(defaultSrc).toContain("'self'");

    // style-src
    const styleSrc = csp.get('style-src');
    expect(styleSrc).toBeDefined();
    expect(styleSrc).toContain("'self'");

    // connect-src covering Horizon and Soroban RPC hosts
    const connectSrc = csp.get('connect-src');
    expect(connectSrc).toBeDefined();
    expect(connectSrc).toContain("'self'");
    expect(connectSrc).toContain('https://horizon-testnet.stellar.org');
    expect(connectSrc).toContain('https://horizon.stellar.org');
    expect(connectSrc).toContain('https://soroban-testnet.stellar.org');
    expect(connectSrc).toContain('https://soroban.stellar.org');

    // img-src
    const imgSrc = csp.get('img-src');
    expect(imgSrc).toBeDefined();
    expect(imgSrc).toContain("'self'");
    expect(imgSrc).toContain('data:');
    expect(imgSrc).toContain('https:');

    // object-src, base-uri, frame-ancestors
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
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

describe('Content Security Policy compliance in codebase', () => {
  const rootDir = resolve(__dirname, '..', '..');
  const srcDir = resolve(rootDir, 'src');
  const indexHtmlPath = resolve(rootDir, 'index.html');

  function getSourceFiles(dir: string): string[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
          files.push(...getSourceFiles(fullPath));
        }
      } else if (/\.(tsx|jsx|ts|js)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('index.html contains no inline script or style elements', () => {
    const html = readFileSync(indexHtmlPath, 'utf-8');
    expect(html).not.toMatch(/<style\b[^>]*>/i);

    const scriptTags = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
    expect(scriptTags.length).toBeGreaterThan(0);
    for (const tag of scriptTags) {
      expect(tag, 'script tag in index.html must have src attribute').toMatch(/\bsrc\s*=/i);
      const inner = tag.replace(/<script\b[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      expect(inner, 'script tag in index.html with src should not contain inline code').toBe('');
    }
  });

  it('no JSX <style> or <script> elements appear in src components/pages', () => {
    const files = getSourceFiles(srcDir);
    const violations: { file: string; line: number; match: string }[] = [];

    const jsxStyleOrScript = /<(?:style|script)[\s>{]/;

    for (const file of files) {
      if (
        file.endsWith('.test.ts') ||
        file.endsWith('.test.tsx') ||
        file.endsWith('.spec.ts') ||
        file.endsWith('.spec.tsx')
      ) {
        continue;
      }
      const relativePath = file.replace(rootDir, '');
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          return;
        }
        if (jsxStyleOrScript.test(line)) {
          violations.push({
            file: relativePath,
            line: index + 1,
            match: line.trim(),
          });
        }
      });
    }

    expect(
      violations,
      `Found inline <style> or <script> JSX elements violating CSP:\n${violations.map((v) => `  ${v.file}:${v.line} -> ${v.match}`).join('\n')}`,
    ).toEqual([]);
  });
});

