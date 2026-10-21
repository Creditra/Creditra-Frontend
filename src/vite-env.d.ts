/// <reference types="vite/client" />
/// <reference types="@testing-library/jest-dom/vitest" />

interface ImportMetaEnv {
  readonly VITE_SETTLEMENT_ASSET_CODE?: string;
  readonly VITE_SETTLEMENT_ASSET_ISSUER?: string;

  // Credit network configuration (public values only)
  readonly VITE_STELLAR_NETWORK?: 'TESTNET' | 'PUBLIC' | string;
  readonly VITE_HORIZON_URL?: string;
  readonly VITE_SOROBAN_RPC_URL?: string;
  readonly VITE_STELLAR_NETWORK_PASSPHRASE?: string;
  readonly VITE_CREDIT_CONTRACT_ID?: string;
}
