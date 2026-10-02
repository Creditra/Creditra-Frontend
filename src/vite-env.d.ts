/// <reference types="vite/client" />
/// <reference types="@testing-library/jest-dom/vitest" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_REPAY_CONFIRM_THRESHOLD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


