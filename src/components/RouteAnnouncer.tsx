import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

/**
 * Per-route document-head override. Pages can call `useRouteHead().setHead(...)`
 * to push a custom title / description that takes precedence over the static
 * route metadata used by `RouteAnnouncer`.
 */
export type RouteHead = {
  title?: string;
  description?: string;
};

type RouteHeadContextValue = {
  head: RouteHead | null;
  setHead: (next: RouteHead | null) => void;
};

/**
 * Default context value used when no `<RouteHeadProvider>` is mounted
 * above `RouteAnnouncer` in the tree (e.g., in unit tests).
 *
 * `setHead` is a no-op in the fallback so consumers can call it unconditionally.
 */
const noopHead: RouteHeadContextValue = {
  head: null,
  setHead: () => {},
};

const defaultRouteHeadContext = createContext<RouteHeadContextValue>(noopHead);

// Re-export under the documented name so `useRouteHead()` consumers and
// `RouteAnnouncer` can share the same context instance.
export const RouteHeadContext = defaultRouteHeadContext;

/**
 * Provider component. Mounted once near the application root (inside
 * `BrowserRouter` in `App.tsx`) so any descendant page can push a custom
 * document head via the `useRouteHead()` hook.
 */
export function RouteHeadProvider({ children }: { children: ReactNode }) {
  const [head, setHead] = useState<RouteHead | null>(null);
  const value = useMemo<RouteHeadContextValue>(
    () => ({ head, setHead }),
    [head],
  );
  return (
    <defaultRouteHeadContext.Provider value={value}>
      {children}
    </defaultRouteHeadContext.Provider>
  );
}

/**
 * Hook for pages to read and override the current route's document head.
 * Falls back to `{ head: null, setHead: noop }` when used outside a provider
 * (e.g. in isolated unit tests).
 */
export function useRouteHead(): RouteHeadContextValue {
  return useContext(defaultRouteHeadContext);
}

import { ROUTE_MANIFEST } from "../routes/manifest";

export type RouteMetadata = {
  path: string;
  pageName: string;
  description: string;
};

export const ROUTE_METADATA: RouteMetadata[] = ROUTE_MANIFEST.map((r) => ({
  path: r.path,
  pageName: r.pageName,
  description: r.description,
}));

export const NOT_FOUND_METADATA: Omit<RouteMetadata, "path"> = {
  pageName: "Not Found",
  description:
    "The requested Creditra page could not be found. Return to the dashboard or try another route.",
};

const titleFor = (pageName: string) => `Creditra · ${pageName}`;

const getRouteMetadata = (pathname: string) =>
  ROUTE_METADATA.find((route) =>
    matchPath({ path: route.path, end: true }, pathname),
  ) ?? NOT_FOUND_METADATA;

export function RouteAnnouncer() {
  const location = useLocation();
  const headCtx = useContext(RouteHeadContext);
  const override = headCtx?.head;
  const [announcement, setAnnouncement] = useState("");

  const metadata = getRouteMetadata(location.pathname);
  const title = override?.title ?? titleFor(metadata.pageName);
  useDocumentTitle(title, override?.description ?? metadata.description);

  useEffect(() => {
    setAnnouncement(`${metadata.pageName} page loaded`);
  }, [metadata.pageName]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
}
