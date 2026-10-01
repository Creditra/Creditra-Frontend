/**
 * react-router-dom stub for the test environment.
 *
 * Provides the minimum surface needed by suite tests when the real package
 * is unavailable or aliased away in vitest.config.ts.
 */

import { Children, createElement, Fragment, isValidElement } from 'react';

/*
 * Module-level "current location", set by MemoryRouter when it renders and
 * read back by useLocation/useSearchParams. Tests render synchronously and
 * read immediately after, so a shared variable is sufficient for this stub.
 */
let currentPathname = '/';
let currentSearch = '';
let currentHash = '';

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
}

export function BrowserRouter({ children }: { children: React.ReactNode }) {
  if (typeof window !== 'undefined' && window.location) {
    applyEntry(window.location.pathname + window.location.search + window.location.hash);
  }
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

function findMatchingRouteElement(children: React.ReactNode, pathname: string): React.ReactNode {
  let matchElement: React.ReactNode = null;
  let starElement: React.ReactNode = null;

  function traverse(nodes: React.ReactNode) {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        traverse((child.props as { children?: React.ReactNode }).children);
        return;
      }
      const { path, element } = (child.props || {}) as { path?: string; element?: React.ReactNode };
      if (!path) return;
      if (path === '*') {
        if (!starElement) starElement = element;
        return;
      }
      if (!matchElement && matchPath({ path, end: true }, pathname)) {
        matchElement = element;
      }
    });
  }

  traverse(children);
  return matchElement ?? starElement ?? null;
}

export function Routes({ children }: { children: React.ReactNode }) {
  const element = findMatchingRouteElement(children, currentPathname);
  return createElement(Fragment, null, element);
}

export function Route(_props: { path?: string; element?: React.ReactNode; [key: string]: unknown }) {
  return null;
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
}

export function useParams() {
  return {};
}

export function matchPath(
  pattern: string | { path: string; caseSensitive?: boolean; end?: boolean },
  pathname: string,
) {
  const patternObj = typeof pattern === 'string' ? { path: pattern, end: true } : pattern;
  const { path: patternPath, end = true, caseSensitive = false } = patternObj;

  if (patternPath === '*') {
    return {
      params: { '*': pathname },
      pathname,
      pathnameBase: pathname,
      pattern: patternObj,
    };
  }

  const pPath = caseSensitive ? patternPath : patternPath.toLowerCase();
  const aPath = caseSensitive ? pathname : pathname.toLowerCase();

  if (pPath === aPath) {
    return {
      params: {},
      pathname,
      pathnameBase: pathname,
      pattern: patternObj,
    };
  }

  if (!end && aPath.startsWith(pPath.endsWith('/') ? pPath : pPath + '/')) {
    return {
      params: {},
      pathname,
      pathnameBase: patternPath,
      pattern: patternObj,
    };
  }

  return null;
}

