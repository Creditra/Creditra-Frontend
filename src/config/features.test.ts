import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isFeatureEnabled,
  parseFeatureFlagValue,
  resetFeatureOverrides,
  setFeatureOverride,
} from './features';

describe('feature flags', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetFeatureOverrides();
  });

  it('defaults all flags to off when env vars are unset', () => {
    expect(isFeatureEnabled('collateralSwap')).toBe(false);
    expect(isFeatureEnabled('autopay')).toBe(false);
  });

  it('enables flags for exact "true" or "1"', () => {
    vi.stubEnv('VITE_FEATURE_COLLATERAL_SWAP', 'true');
    vi.stubEnv('VITE_FEATURE_AUTOPAY', '1');

    expect(isFeatureEnabled('collateralSwap')).toBe(true);
    expect(isFeatureEnabled('autopay')).toBe(true);
  });

  it('strictly rejects falsy, empty, uppercase, and other non-matching values', () => {
    const disabledValues = [
      undefined,
      '',
      'false',
      '0',
      'TRUE',
      'True',
      ' true ',
      'yes',
      'on',
      '2',
    ];

    for (const value of disabledValues) {
      expect(parseFeatureFlagValue(value)).toBe(false);
    }

    vi.stubEnv('VITE_FEATURE_AUTOPAY', 'TRUE');
    vi.stubEnv('VITE_FEATURE_COLLATERAL_SWAP', 'false');
    expect(isFeatureEnabled('autopay')).toBe(false);
    expect(isFeatureEnabled('collateralSwap')).toBe(false);

    vi.stubEnv('VITE_FEATURE_AUTOPAY', '');
    expect(isFeatureEnabled('autopay')).toBe(false);
  });

  it('supports runtime test overrides and reset', () => {
    setFeatureOverride('autopay', true);
    expect(isFeatureEnabled('autopay')).toBe(true);
    expect(isFeatureEnabled('collateralSwap')).toBe(false);

    vi.stubEnv('VITE_FEATURE_COLLATERAL_SWAP', 'true');
    setFeatureOverride('collateralSwap', false);
    expect(isFeatureEnabled('collateralSwap')).toBe(false);

    setFeatureOverride('collateralSwap', undefined);
    expect(isFeatureEnabled('collateralSwap')).toBe(true);

    resetFeatureOverrides();
    expect(isFeatureEnabled('autopay')).toBe(false);
  });
});
