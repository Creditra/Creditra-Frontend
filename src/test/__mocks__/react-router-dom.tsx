/**
 * react-router-dom stub for the test environment.
 *
 * Provides the minimum surface needed by suite tests when the real package
 * is unavailable or aliased away in vitest.config.ts.
 */

import { createElement, Fragment } from 'react';

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
  return createElement(
    'a',
    {
      href: to,
      ...props,
      onClick: (e: React.MouseEvent) => {
        if (typeof (props as any).onClick === 'function') (props as any).onClick(e);
        if (!e.defaultPrevented) {
          e.preventDefault();
          applyEntry(to);
        }
      },
    },
    children
  );
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
  const isActive = currentPathname === to;
  const cls = typeof className === 'function' ? className({ isActive }) : className;
  const content = typeof children === 'function' ? children({ isActive }) : children;
  return createElement(
    'a',
    {
      href: to,
      className: cls,
      ...(isActive ? { 'aria-current': 'page' } : {}),
      ...props,
      onClick: (e: React.MouseEvent) => {
        if (typeof (props as any).onClick === 'function') (props as any).onClick(e);
        if (!e.defaultPrevented) {
          e.preventDefault();
          applyEntry(to);
        }
      },
    },
    content
  );
}

export function Routes({ children }: { children: React.ReactNode }) {
  const childrenArray = Array.isArray(children) ? children : [children];
  const flattened = childrenArray.flat(Infinity);
  for (const child of flattened) {
    if (!child || typeof child !== 'object' || !('props' in child)) continue;
    const { path, element } = child.props as { path?: string; element?: React.ReactNode };
    if (!path || path === '*' || matchPath({ path, end: true }, currentPathname)) {
      return createElement(Fragment, null, element);
    }
  }
  return null;
}

export function Route(props: { path?: string; element?: React.ReactNode; [key: string]: unknown }) {
  return createElement(Fragment, null, props.element);
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
  pattern: { path: string; end?: boolean } | string,
  pathname: string
) {
  const path = typeof pattern === 'string' ? pattern : pattern.path;
  const end = typeof pattern === 'string' ? true : (pattern.end ?? true);
  if (path === '*') return { path, pathname, params: {} };
  if (end) {
    return path === pathname ? { path, pathname, params: {} } : null;
  }
  return pathname.startsWith(path) ? { path, pathname, params: {} } : null;
}

