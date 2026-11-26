import { ROUTE_MANIFEST, type RouteManifestEntry } from '../routes/manifest';

type Score = [tier: number, primary: number, secondary: number];

function normalizePath(raw: string): string {
  const withoutQueryOrHash = raw.split(/[?#]/)[0] ?? '';
  return withoutQueryOrHash.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j++) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function maxAllowedDistance(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 1) return 0;
  if (maxLen <= 3) return 1;
  return Math.min(3, Math.floor(maxLen / 2));
}

function isBetterScore(candidate: Score, best: Score): boolean {
  for (let i = 0; i < candidate.length; i++) {
    if (candidate[i] !== best[i]) {
      return candidate[i] < best[i];
    }
  }
  return false;
}

function scoreEntry(cleanPath: string, targetPath: string): Score | null {
  const fullDist = editDistance(cleanPath, targetPath);
  if (fullDist <= maxAllowedDistance(cleanPath, targetPath)) {
    return [1, fullDist, Math.abs(cleanPath.length - targetPath.length)];
  }

  if (cleanPath.length >= 3 && targetPath.startsWith(cleanPath)) {
    return [2, targetPath.length - cleanPath.length, 0];
  }

  const cleanSegments = cleanPath.split('/');
  const targetSegments = targetPath.split('/');
  const cleanFirst = cleanSegments[0] ?? '';
  const targetFirst = targetSegments[0] ?? '';

  const segDist = editDistance(cleanFirst, targetFirst);
  if (
    segDist <= maxAllowedDistance(cleanFirst, targetFirst) ||
    (cleanFirst.length >= 3 && targetFirst.startsWith(cleanFirst))
  ) {
    return [3, segDist, targetSegments.length];
  }

  return null;
}

/**
 * Suggests the closest valid route from `manifest` for a mistyped `pathname`,
 * or `null` when no route is sufficiently close.
 */
export function suggestRoute(
  pathname: string,
  manifest: readonly RouteManifestEntry[] = ROUTE_MANIFEST,
): RouteManifestEntry | null {
  const cleanPath = normalizePath(pathname);
  if (!cleanPath) return null;

  let bestEntry: RouteManifestEntry | null = null;
  let bestScore: Score | null = null;

  for (const entry of manifest) {
    const targetPath = normalizePath(entry.path);
    if (!targetPath) continue;

    const score = scoreEntry(cleanPath, targetPath);
    if (score && (!bestScore || isBetterScore(score, bestScore))) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  return bestEntry;
}
