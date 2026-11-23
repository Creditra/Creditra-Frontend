export interface PathPattern {
  path: string;
  caseSensitive?: boolean;
  end?: boolean;
}

export interface PathMatch<ParamKey extends string = string> {
  params: Record<ParamKey, string | undefined>;
  pathname: string;
  pathnameBase: string;
  pattern: PathPattern;
}

/**
 * Pure matchPath implementation supporting static segments, :params, and end option.
 */
export function matchPath<ParamKey extends string = string>(
  pattern: PathPattern | string,
  pathname: string
): PathMatch<ParamKey> | null {
  const patternObj: PathPattern = typeof pattern === 'string' ? { path: pattern, end: true } : pattern;
  const { path, end = true, caseSensitive = false } = patternObj;

  const rawPatternSegments = path.split('/').filter(Boolean);
  const rawPathSegments = pathname.split('/').filter(Boolean);

  const patternSegments = (caseSensitive ? path : path.toLowerCase()).split('/').filter(Boolean);
  const pathSegments = (caseSensitive ? pathname : pathname.toLowerCase()).split('/').filter(Boolean);

  if (end) {
    if (patternSegments.length !== pathSegments.length) {
      return null;
    }
  } else {
    if (pathSegments.length < patternSegments.length) {
      return null;
    }
  }

  const params: Record<string, string | undefined> = {};

  for (let i = 0; i < patternSegments.length; i++) {
    const pSeg = patternSegments[i];
    const aSeg = pathSegments[i];

    if (pSeg.startsWith(':')) {
      const paramName = rawPatternSegments[i].slice(1);
      params[paramName] = rawPathSegments[i];
    } else if (pSeg !== aSeg) {
      return null;
    }
  }

  const matchedSegments = rawPathSegments.slice(0, patternSegments.length);
  const pathnameBase = '/' + matchedSegments.join('/');

  return {
    params: params as Record<ParamKey, string | undefined>,
    pathname,
    pathnameBase: pathnameBase === '//' ? '/' : pathnameBase,
    pattern: patternObj,
  };
}
