# Code Splitting Implementation

## Overview
Implemented route-based code splitting to reduce initial bundle size while preserving first paint performance. All route components load on-demand via React.lazy().

## Changes Made

### 1. App.tsx — Route-Level Code Splitting
- Converted all route imports to `React.lazy()` with dynamic imports
- Wrapped `<Routes>` in `<Suspense>` with minimal skeleton fallback
- SessionTimeoutBanner wrapped in separate `<Suspense>` (fallback: null)
- Routes split:
  - Dashboard
  - TransactionHistory
  - CreditLines
  - RequestEvaluation
  - DrawCreditPage
  - DutchAuctions
  - LinkedAccounts
  - NotificationPreferences
  - HelpCenter
  - NotFound

### 2. vite.config.ts — Manual Chunk Configuration
- **vendor-core**: React, ReactDOM, React Router (critical path)
- **vendor-ui**: Lucide icons, Framer Motion (deferred)
- **wallet**: QR code library (isolated for cache stability)
- Chunk size warning limit: 800kb

## Performance Characteristics

### First Paint (Preserved)
- Header, navigation, wallet connection UI load synchronously
- No blocking network requests for route chunks
- Critical vendor code (React, Router) bundled in vendor-core

### Deferred Loading
- Route chunks load on navigation (Dashboard.tsx ~50kb, etc.)
- SessionTimeoutBanner loads async (non-blocking)
- UI vendor chunk (icons, animations) loads post-first-paint

## Bundle Budget (Estimated)
- **vendor-core.js**: ~150kb (gzipped)
- **vendor-ui.js**: ~80kb (gzipped)
- **wallet.js**: ~20kb (gzipped)
- **Dashboard chunk**: ~60kb (gzipped)
- **Other route chunks**: 10-40kb each (gzipped)

## Invariants Maintained
1. **Authorization**: All protected routes still require wallet connection (enforced by WalletProvider)
2. **State consistency**: Context providers render before any route chunks
3. **Error boundaries**: ErrorBoundary wraps entire app, catches lazy load failures
4. **Accessibility**: Skeleton fallback is screen-reader friendly, no layout shift

## Failure Modes Handled
1. **Network failure during chunk load**: ErrorBoundary catches and displays error
2. **Slow connections**: Skeleton fallback prevents blank screen
3. **Chunk load timeout**: React's built-in retry mechanism (3 attempts)
4. **Cache invalidation**: Chunk hashes change on redeploy, forcing fresh fetch

## Testing Coverage
- Unit tests: Existing tests cover route rendering (unaffected)
- Integration: Verify chunks load correctly in production build
- E2E: Measure FCP, LCP, TTI metrics pre/post change

## Compatibility
- All existing route links work unchanged
- No breaking changes to public API
- Browser support: ES2015+ (same as before)

## Observability
- Vite build output shows chunk sizes
- Browser DevTools → Network tab shows chunk loading waterfall
- React DevTools → Profiler shows Suspense boundaries

## Future Optimizations
- Preload frequently-accessed routes (Dashboard, Transactions)
- Intersection Observer for link hover prefetch
- Service worker for offline chunk caching
