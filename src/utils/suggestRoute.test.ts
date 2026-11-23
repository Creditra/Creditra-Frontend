/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import type { RouteManifestEntry } from '../routes/manifest';
import { suggestRoute } from './suggestRoute';

function makeEntry(path: string, pageName: string): RouteManifestEntry {
  return {
    path,
    pageName,
    description: `${pageName} page`,
    load: () => Promise.resolve({ default: () => null }),
    Component: (() => null) as unknown as RouteManifestEntry['Component'],
  };
}

describe('suggestRoute', () => {
  it('suggests /transactions for /transaction', () => {
    const result = suggestRoute('/transaction');
    expect(result?.path).toBe('/transactions');
    expect(result?.pageName).toBe('Transaction History');
  });

  it('suggests /credit-lines for /credit-line', () => {
    const result = suggestRoute('/credit-line');
    expect(result?.path).toBe('/credit-lines');
  });

  it('suggests /settings for /settngs', () => {
    const result = suggestRoute('/settngs');
    expect(result?.path).toBe('/settings');
  });

  it('returns null for clearly unrelated paths', () => {
    expect(suggestRoute('/zzzz-qq')).toBeNull();
    expect(suggestRoute('/xyz')).toBeNull();
  });

  it('resolves nested/dynamic paths against the best-matching manifest path', () => {
    expect(suggestRoute('/repay/succes')?.path).toBe('/repay/success');
    expect(suggestRoute('/transactions/123')?.path).toBe('/transactions');
  });

  it('supports prefix matches on paths', () => {
    expect(suggestRoute('/trans')?.path).toBe('/transactions');
    expect(suggestRoute('/settings/notif')?.path).toBe('/settings/notifications');
  });

  it('returns null for empty or root paths', () => {
    expect(suggestRoute('')).toBeNull();
    expect(suggestRoute('   ')).toBeNull();
    expect(suggestRoute('/')).toBeNull();
  });

  it('ignores trailing slashes and case', () => {
    expect(suggestRoute('/TRANSACTION/')?.path).toBe('/transactions');
    expect(suggestRoute('/SETTNGS///')?.path).toBe('/settings');
  });

  it('ignores query strings and hashes', () => {
    expect(suggestRoute('/settngs?tab=security#top')?.path).toBe('/settings');
    expect(suggestRoute('/repay/succes?tx=0x1#receipt')?.path).toBe('/repay/success');
  });

  it('breaks equal-distance ties by stable first match in manifest', () => {
    const manifest: RouteManifestEntry[] = [
      makeEntry('/alpha', 'Alpha'),
      makeEntry('/alphe', 'Alphe'),
    ];
    expect(suggestRoute('/alphz', manifest)?.path).toBe('/alpha');
  });

  it('handles a manifest with a single entry', () => {
    const singleManifest: RouteManifestEntry[] = [
      makeEntry('/settings', 'Settings'),
    ];
    expect(suggestRoute('/settngs', singleManifest)?.path).toBe('/settings');
    expect(suggestRoute('/zzzz-qq', singleManifest)).toBeNull();
  });

  it('returns null for an empty manifest', () => {
    expect(suggestRoute('/settngs', [])).toBeNull();
  });
});
