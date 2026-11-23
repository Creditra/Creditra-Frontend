export type FeatureFlag = 'collateralSwap' | 'autopay';

const overrides = new Map<FeatureFlag, boolean>();

function readFeatureEnv(flag: FeatureFlag): string | undefined {
  switch (flag) {
    case 'collateralSwap':
      return import.meta.env.VITE_FEATURE_COLLATERAL_SWAP;
    case 'autopay':
      return import.meta.env.VITE_FEATURE_AUTOPAY;
  }
}

/**
 * Strictly parses a build-time feature flag environment variable.
 *
 * Only exact `'true'` or `'1'` (case-sensitive, no whitespace) enables the flag.
 * All other values — including `undefined`, `''`, `'false'`, `'0'`, and `'TRUE'` —
 * evaluate to `false` (default off).
 */
export function parseFeatureFlagValue(value: unknown): boolean {
  return value === 'true' || value === '1';
}

/**
 * Returns whether the given build-time feature flag is enabled.
 *
 * Checks runtime test overrides first, then falls back to `import.meta.env.VITE_FEATURE_*`.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  if (overrides.has(flag)) {
    return overrides.get(flag)!;
  }
  return parseFeatureFlagValue(readFeatureEnv(flag));
}

/**
 * Test helper to override a feature flag without stubbing `import.meta.env`.
 * Pass `undefined` to clear the override for `flag`.
 */
export function setFeatureOverride(
  flag: FeatureFlag,
  enabled: boolean | undefined,
): void {
  if (enabled === undefined) {
    overrides.delete(flag);
  } else {
    overrides.set(flag, enabled);
  }
}

/**
 * Test helper to clear all runtime feature flag overrides.
 */
export function resetFeatureOverrides(): void {
  overrides.clear();
}
