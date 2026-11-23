import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      // Use the static public/manifest.webmanifest linked in index.html
      manifest: false,
      injectRegister: false,
      includeAssets: ["favicon.svg", "manifest.webmanifest", "icons/*.png"],
      devOptions: {
        enabled: false,
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Never cache backend API requests
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
          {
            // Never cache Stellar Horizon, Soroban RPC, or wallet RPC endpoints
            urlPattern: ({ url }) =>
              /(horizon|soroban|rpc|stellar\.org|freighter|albedo|lobstr|rabet|xbull)/i.test(
                url.hostname + url.pathname,
              ),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunk — react, router (critical for first paint)
          'vendor-core': ['react', 'react-dom', 'react-router-dom'],
          // UI vendor chunk — lucide icons, framer-motion (deferred)
          'vendor-ui': ['lucide-react', 'framer-motion'],
          // Wallet chunk — isolated for cache stability
          'wallet': ['lean-qr'],
          // Stellar / Soroban chunk — isolated so first paint is unaffected
          'stellar': ['@stellar/stellar-sdk'],
        },
      },
    },
    // Set chunk size warning limit to 800kb (allow larger chunks for vendor bundles)
    chunkSizeWarningLimit: 800,
  },
});
