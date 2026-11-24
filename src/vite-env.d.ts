/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
  // Soroban network passphrase read by credit service configuration
  readonly VITE_NETWORK_PASSPHRASE?: string;
  // Credit data source selector ('mock' | 'soroban'; defaults to 'mock')
  readonly VITE_CREDIT_DATA_SOURCE?: 'mock' | 'soroban' | string;

  // Repayment USD threshold requiring explicit confirmation (plain non-negative number; '0' disables)
  readonly VITE_REPAY_CONFIRM_THRESHOLD?: string;
  readonly VITE_NOTIFICATIONS_SSE_URL?: string;
/**
 * Supported build-time variables.
 *
 * Stellar/Soroban network values are read exclusively by
 * `src/config/creditNetwork.ts`; see `.env.example` for defaults and the
 * contract-id policy.
 */
  /** `mock` (default) or `soroban`. */
  readonly VITE_CREDIT_DATA_SOURCE?: 'mock' | 'soroban' | string;

  // Build-time feature flags (truthy only for 'true' or '1'; default off)
  readonly VITE_FEATURE_COLLATERAL_SWAP?: string;
  readonly VITE_FEATURE_AUTOPAY?: string;

  /** Optional version string surfaced in diagnostics bundles. */
  readonly VITE_APP_VERSION?: string;
