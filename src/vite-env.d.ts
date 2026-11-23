/// <reference types="vite/client" />
/// <reference types="@testing-library/jest-dom/vitest" />

interface ImportMetaEnv {
  readonly VITE_IPFS_GATEWAY?: string;
  readonly VITE_SETTLEMENT_ASSET_CODE?: string;
  readonly VITE_SETTLEMENT_ASSET_ISSUER?: string;

  // Credit network configuration (public values only)
  readonly VITE_STELLAR_NETWORK?: 'TESTNET' | 'PUBLIC' | string;
  readonly VITE_HORIZON_URL?: string;
  readonly VITE_SOROBAN_RPC_URL?: string;
  readonly VITE_STELLAR_NETWORK_PASSPHRASE?: string;
  // Soroban network passphrase read by credit service configuration
  readonly VITE_NETWORK_PASSPHRASE?: string;
  readonly VITE_CREDIT_CONTRACT_ID?: string;
  // Credit data source selector ('mock' | 'soroban'; defaults to 'mock')
  readonly VITE_CREDIT_DATA_SOURCE?: 'mock' | 'soroban' | string;

  // Repayment USD threshold requiring explicit confirmation (plain non-negative number; '0' disables)
  readonly VITE_REPAY_CONFIRM_THRESHOLD?: string;

  // Build-time feature flags (truthy only for 'true' or '1'; default off)
  readonly VITE_FEATURE_COLLATERAL_SWAP?: string;
  readonly VITE_FEATURE_AUTOPAY?: string;
}
