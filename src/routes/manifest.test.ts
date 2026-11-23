import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnabledRoutes, ROUTE_MANIFEST } from './manifest';
import {
  COMMAND_PALETTE_DEFAULT_ITEMS,
  getCommandPaletteDefaultItems,
} from '../components/CommandPalette';
import { ROUTE_METADATA } from '../components/RouteAnnouncer';
import { resetFeatureOverrides } from '../config/features';

describe('Route Manifest', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetFeatureOverrides();
  });

  it('keeps page names and descriptions unique', () => {
    const pageNames = ROUTE_MANIFEST.map((r) => r.pageName);
    const descriptions = ROUTE_MANIFEST.map((r) => r.description);

    expect(new Set(pageNames).size).toBe(pageNames.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it('excludes /landing from the manifest and metadata', () => {
    expect(ROUTE_MANIFEST.find((r) => r.path === '/landing')).toBeUndefined();
    expect(ROUTE_METADATA.find((r) => r.path === '/landing')).toBeUndefined();
  });

  it('includes metadata for all previously missing routes', () => {
    const paths = ROUTE_MANIFEST.map((r) => r.path);
    const required = [
      '/linked-accounts',
      '/notification-preferences',
      '/repay',
      '/repay/success',
      '/settings',
      '/settings/notifications',
      '/profile',
      '/docs',
      '/credit-report',
    ];
    for (const p of required) {
      expect(paths).toContain(p);
    }
  });

  it('derives command palette items from enabled nav.palette entries', () => {
    const paletteRoutes = getEnabledRoutes().filter((r) => Boolean(r.nav?.palette));
    for (const r of paletteRoutes) {
      const found = COMMAND_PALETTE_DEFAULT_ITEMS.find((item) => item.action === r.path);
      expect(found).toBeDefined();
      expect(found?.label).toBe(r.nav!.palette!.label);
      expect(found?.description).toBe(r.nav!.palette!.description);
    }
  });

  it('derives header navigation from enabled nav.header entries', () => {
    const headerRoutes = getEnabledRoutes().filter((r) => Boolean(r.nav?.header));
    expect(headerRoutes.length).toBe(6);
    const headerPaths = headerRoutes.map((r) => r.path);
    expect(headerPaths).toEqual([
      '/',
      '/transactions',
      '/credit-lines',
      '/open-credit',
      '/dutch-auctions',
      '/docs',
    ]);
  });

  it('omits feature-gated routes by default and enables them when flagged on', () => {
    const defaultPaths = getEnabledRoutes().map((r) => r.path);
    expect(defaultPaths).not.toContain('/collateral-swap');
    expect(defaultPaths).not.toContain('/autopay');
    expect(
      getCommandPaletteDefaultItems().find((i) => i.action === '/collateral-swap'),
    ).toBeUndefined();
    expect(
      getCommandPaletteDefaultItems().find((i) => i.action === '/autopay'),
    ).toBeUndefined();

    vi.stubEnv('VITE_FEATURE_COLLATERAL_SWAP', 'true');
    expect(getEnabledRoutes().map((r) => r.path)).toContain('/collateral-swap');
    expect(getEnabledRoutes().map((r) => r.path)).not.toContain('/autopay');
    expect(
      getCommandPaletteDefaultItems().find((i) => i.action === '/collateral-swap'),
    ).toBeDefined();

    vi.stubEnv('VITE_FEATURE_AUTOPAY', 'true');
    expect(getEnabledRoutes().map((r) => r.path)).toContain('/autopay');
    expect(
      getCommandPaletteDefaultItems().find((i) => i.action === '/autopay'),
    ).toBeDefined();
  });
});
