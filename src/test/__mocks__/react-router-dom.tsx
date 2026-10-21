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

export function Routes({ children }: { children: React.ReactNode }) {
  return createElement(Fragment, null, children);
}

export function Route(_props: Record<string, unknown>) {
  return null;
}

export function Navigate(_props: Record<string, unknown>) {
  return null;
}

export function useSearchParams() {
  const params = new URLSearchParams(currentSearch);
  return [params, (_: URLSearchParams) => {}] as const;
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

/**
 * Minimal `matchPath` implementation.
 *
 * The real react-router-dom resolves patterns such as
 * `/dutch-auctions/:auctionId`; the announcer uses it to map a pathname to
 * its route metadata, so the stub needs the same behaviour for the route
 * patterns to be testable.
 */
export type MatchPathOptions = {
  path: string;
  end?: boolean;
  caseSensitive?: boolean;
};

export type MatchPathResult = {
  params: Record<string, string>;
  path: string;
  pathname: string;
};

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function matchPath(
  pattern: string | MatchPathOptions,
  pathname: string,
): MatchPathResult | null {
  const options: MatchPathOptions =
    typeof pattern === 'string' ? { path: pattern } : pattern;
  const end = options.end !== false;
  const caseSensitive = options.caseSensitive === true;

  const paramNames: string[] = [];
  const source = options.path
    .split('/')
    .filter((segment, index) => index === 0 || segment !== '')
    .map((segment) => {
      if (segment.startsWith(':')) {
        const optional = segment.endsWith('?');
        paramNames.push(optional ? segment.slice(1, -1) : segment.slice(1));
        return optional ? '(?:([^\\/]+))?' : '([^\\/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');

  const regex = new RegExp(
    `^${source}${end ? '\\/?$' : '(?:\\/.*)?$'}`,
    caseSensitive ? '' : 'i',
  );
  const match = regex.exec(pathname);
  if (!match) return null;

  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    const value = match[index + 1];
    if (value !== undefined) params[name] = decodeParam(value);
  });

  return { params, path: options.path, pathname: match[0] };
}

