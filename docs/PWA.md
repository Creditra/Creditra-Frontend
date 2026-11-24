# Progressive Web App (PWA) Support

Creditra ships with a web app manifest, installable icons, and a Workbox-powered service worker (via `vite-plugin-pwa`) so the application shell can be installed and loaded offline while keeping all financial, wallet, and RPC traffic strictly network-only.

## Architecture

### Web App Manifest & Icons
- **Manifest:** `public/manifest.webmanifest` (linked in `index.html` alongside `<meta name="theme-color" content="#0d1117" />` and `apple-touch-icon`).
- **Colors:** `background_color` and `theme_color` use `#0d1117`, matching `--bg` in `src/styles/tokens.css`.
- **Icons:** `public/icons/` provides regular (`any`) and `maskable` 192x192 and 512x512 PNG icons plus a 180x180 `apple-touch-icon.png`.

### Service Worker & Caching Policy (`vite.config.ts`)
- **Registration mode:** `registerType: "prompt"` — a new deployment waits until the user accepts the update prompt, preventing unexpected mid-session reloads.
- **Precaching:** Built static assets (`js`, `css`, `html`, `ico`, `png`, `svg`, `webmanifest`, `woff2`) are precached so the app shell loads offline.
- **Navigation fallback:** SPA routes fall back to `/index.html`, with `navigateFallbackDenylist: [/^\/api\//]` so API paths are never rewritten to the app shell.
- **Network-only runtime rules:** Requests to `/api/*`, Stellar Horizon, Soroban RPC, and wallet endpoints use `NetworkOnly` and are **never** served from the service worker cache.
- **Hosting (`vercel.json`):** The rewrite rule `/((?!.*\.).*)` only rewrites extensionless paths, so `/sw.js`, `/workbox-*.js`, `/manifest.webmanifest`, and `/icons/*.png` are served directly as static files.

### User-Controlled Update Prompt (`src/components/UpdatePrompt.tsx`)
- Mounted in `src/main.tsx` alongside `<App />`.
- Uses `useRegisterSW` from `virtual:pwa-register/react`.
- Displays a floating banner (`New version available`) reusing the `OfflineBanner` styling tokens with **Reload** (calls `updateServiceWorker(true)`) and **Dismiss** actions.

### Development & Testing
- **Dev server:** `devOptions.enabled` is `false` so the service worker does not interfere with HMR during `npm run dev`.
- **Vitest:** `vitest.config.ts` omits `VitePWA` and aliases `virtual:pwa-register/react` to `src/test/__mocks__/pwa-register-react.ts`, keeping the test suite isolated from service worker registration.

## Manual Verification
1. Build and preview locally:
   ```bash
   npm run build && npm run preview
   ```
2. Open Chrome DevTools → **Application** tab:
   - **Manifest:** Verify `Creditra — Adaptive Credit`, `standalone` display, and all icons load with no warnings.
   - **Service Workers:** Verify `sw.js` is registered and activated.
   - Toggle **Offline** and reload the page — the app shell loads and `OfflineBanner` appears.
   - Verify any API, Horizon, or Soroban RPC calls are not served from the service worker cache.
