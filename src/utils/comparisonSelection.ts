/**
 * Comparison selection persistence for the two-line credit comparator.
 *
 * We persist only opaque IDs, never full account or credit-line payloads. The
 * selection is intentionally kept in sessionStorage instead of localStorage so
 * it survives a soft reload without becoming a long-lived account snapshot.
 *
 * Invariants:
 * - at most two IDs are stored
 * - invalid entries are discarded silently
 * - duplicates are collapsed deterministically
 * - malformed or stale payloads fall back to an empty selection
 */

export const COMPARISON_SELECTION_STORAGE_KEY = 'creditra_compare_selection';

const MAX_SELECTION_ITEMS = 2;
const MAX_ID_LENGTH = 128;
const VALID_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function isValidComparisonId(candidate: string): boolean {
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

    if (next.length >= MAX_SELECTION_ITEMS) {
      break;
    }
  }

  return next;
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
