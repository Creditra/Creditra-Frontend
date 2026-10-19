/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Preserve the router stub for legacy tests; this route needs URL-aware routing.
      {
        find: "react-router-dom",
        replacement: path.resolve(__dirname, "./src/test/__mocks__/react-router-dom.tsx"),
        customResolver(source, importer) {
          if (
            importer &&
            /[\\/]src[\\/]pages[\\/](?:__tests__[\\/])?RepaySuccess(?:\.test)?\.tsx$/.test(importer)
          ) {
            return path.resolve(__dirname, "./node_modules/react-router-dom/dist/index.js");
          }
          return source;
        },
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
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