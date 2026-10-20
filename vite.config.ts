import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
        },
      },
    },
    // Set chunk size warning limit to 800kb (allow larger chunks for vendor bundles)
    chunkSizeWarningLimit: 800,
  },
});
