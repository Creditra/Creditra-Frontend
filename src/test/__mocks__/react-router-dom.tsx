/**
 * react-router-dom stub for the test environment.
 *
 * Provides the minimum surface needed by suite tests when the real package
 * is unavailable or aliased away in vitest.config.ts.
 */

import {
  Children,
  createElement,
  Fragment,
  isValidElement,
  useSyncExternalStore,
} from 'react';

/*
 * Module-level "current location", set by MemoryRouter when it renders and
 * read back by useLocation/useSearchParams. Tests render synchronously and
 * read immediately after, so a shared variable is sufficient for this stub.
 */
let currentPathname = '/';
let currentSearch = '';
let currentHash = '';
let currentState: unknown = null;
let locationVersion = 0;

function bumpLocation() {
  locationVersion += 1;
}

/** A router entry: a path string or a partial location object (as in react-router's MemoryRouter initialEntries). */
type Entry =
  | string
  | {
      pathname?: string;
      search?: string;
      hash?: string;
      state?: unknown;
    };

function applyEntry(entry: Entry) {
  if (typeof entry !== 'string') {
    currentPathname = entry.pathname ?? '/';
    const search = entry.search ?? '';
    currentSearch = search
      ? search.startsWith('?')
        ? search
        : `?${search}`
      : '';
    const hash = entry.hash ?? '';
    currentHash = hash
      ? hash.startsWith('#')
        ? hash
        : `#${hash}`
      : '';
    currentState = entry.state ?? null;
    bumpLocation();
    return;
  }
  const hashIndex = entry.indexOf('#');
  if (hashIndex >= 0) {
    currentHash = entry.slice(hashIndex);
    entry = entry.slice(0, hashIndex);
  } else {
    currentHash = '';
  }
  const qIndex = entry.indexOf('?');
  currentPathname = qIndex >= 0 ? entry.slice(0, qIndex) : entry;
  currentSearch = qIndex >= 0 ? entry.slice(qIndex) : '';
  currentState = null;
  bumpLocation();
}

/*
 * Subscription support so `Routes` re-renders when `useNavigate` (or a
 * `setSearchParams` call) mutates the shared location — module variables
 * alone would not trigger React updates.
 */
const locationListeners = new Set<() => void>();

function notifyLocationChange() {
  bumpLocation();
  for (const listener of locationListeners) listener();
}

function subscribeToLocation(listener: () => void) {
  locationListeners.add(listener);
  return () => {
    locationListeners.delete(listener);
  };
}

function getLocationSnapshot() {
  return locationVersion;
}

export function BrowserRouter({ children }: { children: React.ReactNode }) {
  return createElement(Fragment, null, children);
}

/** Parses initialEntries[0] into the current location, then renders children. */
export function MemoryRouter({
  children,
  initialEntries,
}: {
  children: React.ReactNode;
  initialEntries?: Array<Entry>;
}) {
  applyEntry(initialEntries?.[0] ?? '/');
  return createElement(Fragment, null, children);
}

export function Link({
  to,
  children,
  ...props
}: {
  to: string;
  children: React.ReactNode;
  [key: string]: unknown;
}) {
  return createElement('a', { href: to, ...props }, children);
}

export function NavLink({
  to,
  children,
  className,
  end: _end,
  ...props
}: {
  to: string;
  children: React.ReactNode | ((args: { isActive: boolean }) => React.ReactNode);
  className?: string | ((args: { isActive: boolean }) => string);
  end?: boolean;
  [key: string]: unknown;
}) {
  const isActive = false;
  const cls = typeof className === 'function' ? className({ isActive }) : className;
  const content = typeof children === 'function' ? children({ isActive }) : children;
  return createElement('a', { href: to, className: cls, ...props }, content);
}

/**
 * Matches child `<Route>` elements against the current mock location.
 *
 * Supports exact paths and the `*` fallback — enough for suite tests, which
 * render `<Routes><Route path="/repay/success" element={…} />` etc. Real
 * react-router route matching is unavailable in this stub environment, so
 * Route props are read directly from the child elements and `element` is
 * rendered for the first match (falling back to `*`).
 */
export function Routes({ children }: { children: React.ReactNode }) {
  useSyncExternalStore(
    subscribeToLocation,
    getLocationSnapshot,
    getLocationSnapshot,
  );
  const current = currentPathname.replace(/\/+$/, '') || '/';
  let fallback: React.ReactNode = null;
  let matched: React.ReactNode = null;

  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    const props = child.props as { path?: string; element?: React.ReactNode };
    const path = props.path;
    if (path === undefined) continue;
    if (path === '*') {
      if (fallback === null) fallback = props.element;
      continue;
    }
    const normalized = path.replace(/\/+$/, '') || '/';
    if (normalized === current) {
      matched = props.element;
      break;
    }
  }

  const element = matched ?? fallback;
  return element !== null && element !== undefined
    ? createElement(Fragment, null, element)
    : null;
}

/** Rendered only when `Routes` selects a Route that inlines children. */
export function Route({ element, children }: Record<string, unknown>) {
  if (element !== undefined && element !== null) return null;
  return createElement(Fragment, null, children as React.ReactNode);
}

export function Navigate(_props: Record<string, unknown>) {
  return null;
}

export function useSearchParams() {
  const params = new URLSearchParams(currentSearch);
  const setSearchParams = (
    next: URLSearchParams | string | Record<string, string>,
    _opts?: { replace?: boolean }
  ) => {
    if (next instanceof URLSearchParams) {
      const s = next.toString();
      currentSearch = s ? `?${s}` : '';
    } else if (typeof next === 'string') {
      currentSearch = next ? (next.startsWith('?') ? next : `?${next}`) : '';
    } else if (next && typeof next === 'object') {
      const sp = new URLSearchParams(next);
      const s = sp.toString();
      currentSearch = s ? `?${s}` : '';
    }
    notifyLocationChange();
  };
  return [params, setSearchParams] as const;
}

export function __getMockSearch() {
  return currentSearch;
}

/**
 * Returns a navigate function that updates the shared mock location (path,
 * search and router state) and notifies `Routes` so it re-renders. Numeric
 * deltas (history back/forward) are ignored — no history stack is kept.
 */
export function useNavigate() {
  return (to: string | number, opts?: { state?: unknown }) => {
    if (typeof to !== 'string') return;
    applyEntry(to);
    currentState = opts?.state ?? null;
    notifyLocationChange();
  };
}

export function useLocation() {
  return {
    pathname: currentPathname,
    search: currentSearch,
    hash: currentHash,
    state: currentState,
  };
}

/**
 * Test helper — sets the mock location to the given pathname + search.
 *
 * Call this between renders in a test to simulate client-side navigation.
 *
 * @example
 * ```ts
 * import { __setMockLocation } from 'react-router-dom';
 *
 * __setMockLocation('/transactions');
 * rerender({ pathname: '/transactions' });
 * ```
 */
export function __setMockLocation(pathname: string, search = '') {
  currentPathname = pathname;
  currentSearch = search;
  currentState = null;
  bumpLocation();
}

export function useParams() {
  return {};
}

export { matchPath } from './matchPath';

