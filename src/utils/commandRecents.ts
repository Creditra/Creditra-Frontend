import { COMMAND_PALETTE_RECENTS_KEY } from '../constants/storageKeys';
import { readJson, writeJson } from './storage';

const DEFAULT_MAX_RECENTS = 5;

/**
 * Read the list of recently used command palette item IDs from localStorage.
 *
 * Returns an empty array if storage is unavailable or contains corrupt data.
 */
export function getRecentIds(): string[] {
  const raw = readJson<unknown>(COMMAND_PALETTE_RECENTS_KEY, []);
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const valid: string[] = [];

  for (const entry of raw) {
    if (typeof entry === 'string' && entry.length > 0 && !seen.has(entry)) {
      seen.add(entry);
      valid.push(entry);
    }
  }

  return valid;
}

/**
 * Record a command palette item ID as the most recently used.
 *
 * Moves `id` to the front, de-duplicates, caps the list at `max` entries,
 * and persists the result via safe storage helpers.
 */
export function recordRecent(id: string, max = DEFAULT_MAX_RECENTS): string[] {
  const current = getRecentIds();
  if (typeof id !== 'string' || id.length === 0) {
    return current;
  }

  const cap = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : DEFAULT_MAX_RECENTS;
  const next = [id, ...current.filter((item) => item !== id)].slice(0, cap);
  writeJson(COMMAND_PALETTE_RECENTS_KEY, next);
  return next;
}
