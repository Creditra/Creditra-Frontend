import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Storage key for the scroll-position map kept in sessionStorage.
 * Using sessionStorage so scroll positions survive soft navigations
 * (including browser back/forward) but are discarded when the tab is
 * closed, avoiding stale positions on a fresh visit.
 */
const STORAGE_KEY = "__scroll_positions";

/**
 * Minimum route visits before restoring — avoids restoring to the top
 * of a page the user never actually scrolled on.
 */
const MIN_SAVED_Y = 4;

/**
 * Read the saved positions map from sessionStorage.
 */
function readPositions(): Map<string, number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw) as [string, number][]);
  } catch {
    return new Map();
  }
}

/**
 * Write the positions map back to sessionStorage.
 */
function writePositions(map: Map<string, number>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...map]));
  } catch {
    // sessionStorage may be full or unavailable; silently fail.
  }
}

/**
 * Build a stable route key from the current location.
 *
 * We use `pathname + search` so filtered/paginated views (e.g.
 * `/transactions?page=2`) get their own scroll positions. The hash is
 * excluded because hash-anchor scrolling is handled natively by the
 * browser and should not compete with this hook.
 */
function routeKey(pathname: string, search: string): string {
  return pathname + search;
}

/**
 * useScrollRestoration
 *
 * Saves and restores the vertical scroll position (`window.scrollY`)
 * when navigating between routes in a client-side-rendered SPA.
 *
 * --- How it works -------------------------------------------------------
 *
 * 1. On mount (and every location change), the hook saves the *previous*
 *    route's scrollY into a sessionStorage-backed map.
 * 2. It then checks whether the *current* route has a saved scroll
 *    position.  If yes, it calls `window.scrollTo(0, savedY)` on the
 *    next animation frame so the DOM has had a chance to lay out.
 * 3. While the user is on a page, scroll events are captured (rAF-
 *    throttled) so the saved position stays up to date.
 * 4. SessionStorage is written whenever the map changes, so back/forward
 *    navigation works even after a full page refresh.
 *
 * --- Edge cases ---------------------------------------------------------
 *
 * - **Hash-only changes** (`#section1` → `#section2` on the same path):
 *   Because the hash is excluded from the route key, this is *not*
 *   treated as a route change and the native hash-scroll takes over.
 *
 * - **Same-path navigations via search** (`?page=1` → `?page=2`):
 *   Each search combination gets its own entry, so filter/pagination
 *   changes preserve their respective scroll positions.
 *
 * - **Reduced motion**: Scroll restoration is always instant (no CSS
 *   transition involved), so the `prefers-reduced-motion` media query
 *   is irrelevant — restore is not an animation.
 *
 * - **Disabled mode**: When `enabled=false` the cache is cleared and no
 *   scroll positions are recorded or restored, effectively allowing the
 *   browser's default behaviour.
 *
 * --- Usage --------------------------------------------------------------
 *
 * Place this hook once at the top of your app tree (e.g. inside
 * `<BrowserRouter>` in `App.tsx`).  Do **not** mount it per-page, as
 * that would cause the cache to be scoped to individual page components
 * and lose the previous-page position.
 *
 * ```tsx
 * function App() {
 *   useScrollRestoration();
 *   return <Routes>…</Routes>;
 * }
 * ```
 *
 * @param enabled - Set to `false` to disable scroll restoration
 *                  (defaults to `true`).
 */
export function useScrollRestoration(enabled = true): void {
  const location = useLocation();

  /**
   * We keep the positions map in a ref so that writing to it does not
   * cause a re-render.  The map is persisted to sessionStorage after
   * every modification.
   */
  const positionsRef = useRef<Map<string, number>>(new Map());

  /**
   * The key of the route we are currently *leaving*.  `null` on the
   * very first render.
   */
  const prevKeyRef = useRef<string | null>(null);

  // ── Initialise map from sessionStorage once ──────────────────────
  if (positionsRef.current.size === 0 && enabled) {
    positionsRef.current = readPositions();
  }

  // ── Track user scroll while on page ──────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const currentKey = routeKey(location.pathname, location.search);
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          const y = window.scrollY;
          if (y >= MIN_SAVED_Y) {
            positionsRef.current.set(currentKey, y);
            writePositions(positionsRef.current);
          }
        });
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [location.pathname, location.search, enabled]);

  // ── Save previous + restore current on navigation ────────────────
  useEffect(() => {
    if (!enabled) return;

    const currentKey = routeKey(location.pathname, location.search);

    // 1. Save the previous route's scroll antes de cambiarlo.
    const prevKey = prevKeyRef.current;
    if (prevKey !== null) {
      positionsRef.current.set(prevKey, window.scrollY);
      writePositions(positionsRef.current);
    }

    // 2. Restore the current route's scroll (if one was saved).
    const savedY = positionsRef.current.get(currentKey);
    if (savedY !== undefined && savedY >= MIN_SAVED_Y) {
      // Use rAF so the DOM has time to render before we scroll.
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedY, behavior: "instant" });
      });
    }

    prevKeyRef.current = currentKey;
  }, [location.pathname, location.search, enabled]);

  // ── Cleanup on unmount: save current position ────────────────────
  useEffect(() => {
    if (!enabled) return;
    return () => {
      const currentKey = routeKey(location.pathname, location.search);
      const y = window.scrollY;
      if (y >= MIN_SAVED_Y) {
        positionsRef.current.set(currentKey, y);
        writePositions(positionsRef.current);
      }
    };
  }, [enabled, location.pathname, location.search]);
}