/**
 * Comparison selection persistence and URL helpers for the credit comparator.
 *
 * We persist only opaque IDs, never full account or credit-line payloads. The
 * selection is intentionally kept in sessionStorage instead of localStorage so
 * it survives a soft reload without becoming a long-lived account snapshot.
 *
 * Invariants:
 * - at most MAX_COMPARE (4) IDs are stored or compared
 * - invalid entries are discarded silently
 * - duplicates are collapsed deterministically
 * - malformed or stale payloads fall back to an empty selection
 */

export const COMPARISON_SELECTION_STORAGE_KEY = 'creditra_compare_selection';

/** Maximum number of credit lines that can be selected or compared concurrently. */
export const MAX_COMPARE = 4;
export const MAX_SELECTION_ITEMS = MAX_COMPARE;

const MAX_ID_LENGTH = 128;
const VALID_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function isValidComparisonId(candidate: string): boolean {
  if (!candidate || candidate.length > MAX_ID_LENGTH) return false;
  return VALID_ID_PATTERN.test(candidate);
}

export function normalizeComparisonSelection(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const next: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') continue;

    const trimmed = entry.trim();
    if (!isValidComparisonId(trimmed)) continue;

    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(trimmed);

    if (next.length >= MAX_COMPARE) {
      break;
    }
  }

  return next;
}

/**
 * Defensively extracts and normalizes credit line IDs from URL search parameters.
 * Supports:
 *   - Shared comma-separated IDs: `?ids=a,b,c,d`
 *   - Legacy two-line params: `?a=id1&b=id2` (and optional c, d)
 *
 * Malformed IDs, extra items beyond MAX_COMPARE, and duplicates are safely dropped.
 */
export function parseComparisonIdsFromSearchParams(
  searchParams: URLSearchParams | string,
): string[] {
  const params =
    typeof searchParams === 'string'
      ? new URLSearchParams(
          searchParams.startsWith('?') ? searchParams.slice(1) : searchParams,
        )
      : searchParams;

  const idsParam = params.get('ids');
  let rawCandidates: string[] = [];

  if (idsParam) {
    rawCandidates = idsParam.split(',');
  } else {
    // Check legacy params: ?a=...&b=... (&c=...&d=...)
    for (const key of ['a', 'b', 'c', 'd']) {
      const val = params.get(key);
      if (val) rawCandidates.push(val);
    }
  }

  return normalizeComparisonSelection(rawCandidates);
}

/**
 * Builds the shareable comparison URL path for the given credit line IDs.
 */
export function buildComparisonUrl(ids: string[]): string {
  const normalized = normalizeComparisonSelection(ids);
  if (normalized.length === 0) return '/compare-credit-lines';
  return `/compare-credit-lines?ids=${normalized.join(',')}`;
}

export function loadComparisonSelection(): string[] {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return [];
    }

    const raw = window.sessionStorage.getItem(COMPARISON_SELECTION_STORAGE_KEY);
    if (raw === null) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    const ids = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { ids?: unknown })?.ids)
        ? (parsed as { ids: unknown[] }).ids
        : [];

    const normalized = normalizeComparisonSelection(ids);
    if (normalized.length !== ids.length) {
      saveComparisonSelection(normalized);
    }
    return normalized;
  } catch {
    try {
      window.sessionStorage.removeItem(COMPARISON_SELECTION_STORAGE_KEY);
    } catch {
      // Storage unavailable or quota exceeded; act as an empty selection.
    }
    return [];
  }
}

export function saveComparisonSelection(value: unknown): boolean {
  const normalized = normalizeComparisonSelection(value);

  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return false;
    }

    const payload = JSON.stringify({ version: 1, ids: normalized });
    window.sessionStorage.setItem(COMPARISON_SELECTION_STORAGE_KEY, payload);
    return true;
  } catch {
    return false;
  }
}
