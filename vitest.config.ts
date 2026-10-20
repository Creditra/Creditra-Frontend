/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirror the @/ alias from vite.config.ts so test imports resolve identically
      "@": path.resolve(__dirname, "./src"),
      /*
       * react-router-dom stub — used when running tests in an offline/shared
       * node_modules environment where the real package is unavailable.
       * The stub provides the minimum API surface needed by the existing tests.
       */
      "react-router-dom": path.resolve(
        __dirname,
        "./src/test/__mocks__/react-router-dom.tsx",
      ),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    timeout: 10000,
  },
  server: {
    fs: {
      strict: false,
    },
  },
});