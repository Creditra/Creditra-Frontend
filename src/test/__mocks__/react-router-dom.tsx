/**
 * react-router-dom stub for the test environment.
 *
 * Provides the minimum surface needed by suite tests when the real package
 * is unavailable or aliased away in vitest.config.ts.
 */

import { Children, createElement, Fragment, isValidElement } from 'react';

/*
 * Module-level "current location", set by MemoryRouter/BrowserRouter when they
 * render and read back by useLocation/useSearchParams. Tests render
 * synchronously and read immediately after, so a shared variable is
 * sufficient for this stub.
 */
let currentPathname = '/';
let currentSearch = '';
let currentHash = '';

/** Mirrors the module location into jsdom's URL so BrowserRouter re-renders (which re-apply window.location) stay in sync. */
function syncWindowHistory() {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    window.history.replaceState(
      window.history.state,
      '',
      currentPathname + currentSearch + currentHash,
    );
  } catch {
    // jsdom may reject exotic URLs; the module variables remain authoritative.
  }
}

function applyEntry(entry: string) {
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
  syncWindowHistory();
}

/** Renders children after applying the current jsdom URL as the initial route. */
export function BrowserRouter({ children }: { children: React.ReactNode }) {
  const { pathname, search, hash } = window.location;
  applyEntry(pathname + search + hash);
  return createElement(Fragment, null, children);
}

/** Parses initialEntries[0] into the current location, then renders children. */
export function MemoryRouter({
  children,
  initialEntries,
}: {
  children: React.ReactNode;
  initialEntries?: string[];
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
 * Supports exact paths and the `*` fallback. Real react-router route matching
 * is unavailable in this stub environment, so Route props are read directly
 * from the child elements and `element` is rendered for the first match
 * (falling back to `*`).
 */
export function Routes({ children }: { children: React.ReactNode }) {
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
    syncWindowHistory();
  };
  return [params, setSearchParams] as const;
}

export function __getMockSearch() {
  return currentSearch;
}

export function useNavigate() {
  return () => {};
}

export function useLocation() {
  return {
    pathname: currentPathname,
    search: currentSearch,
    hash: currentHash,
    state: null,
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
  syncWindowHistory();
}

export function useParams() {
  return {};
}

export { matchPath } from './matchPath';

