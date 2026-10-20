/// <reference types="vite/client" />
/// <reference types="@testing-library/jest-dom/vitest" />

interface ImportMetaEnv {
  readonly VITE_SETTLEMENT_ASSET_CODE?: string;
  readonly VITE_SETTLEMENT_ASSET_ISSUER?: string;
}
