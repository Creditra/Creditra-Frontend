/** Maximum number of history records that may be requested in one page. */
export const MAX_HISTORY_PAGE_SIZE = 50;
export const DEFAULT_HISTORY_PAGE_SIZE = 15;

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

interface CursorPosition {
  /** Epoch milliseconds timestamp */
  t: number;
  id: string;
}

/** Legacy cursor format for backward compatibility */
interface LegacyCursorPosition {
  date: string;
  id: string;
}

const encodeCursor = (position: CursorPosition): string =>
  btoa(JSON.stringify(position))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const decodeCursor = (cursor: string): CursorPosition | null => {
  try {
    const encoded = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded)) as Partial<CursorPosition> | Partial<LegacyCursorPosition>;
    
    // Handle new format { t: number, id: string }
    if (typeof decoded.t === "number" && typeof decoded.id === "string") {
      return { t: decoded.t, id: decoded.id };
    }
    
    // Handle legacy format { date: string, id: string }
    if (typeof decoded.date === "string" && typeof decoded.id === "string") {
      const parsed = Date.parse(decoded.date);
      if (isNaN(parsed)) return null;
      return { t: parsed, id: decoded.id };
    }
    
    return null;
  } catch {
    return null;
  }
};

/**
 * Exact comparator for history records.
 * Compares dates by epoch milliseconds (numerically) and ids by code unit.
 * Invalid dates sort last deterministically.
 * Returns -1 if a < b, 1 if a > b, 0 if equal.
 */
function compareHistoryKeys(
  aDate: string,
  aId: string,
  bDate: string,
  bId: string,
): number {
  const aTime = Date.parse(aDate);
  const bTime = Date.parse(bDate);
  
  // Invalid dates sort last
  const aValid = !isNaN(aTime);
  const bValid = !isNaN(bTime);
  
  if (!aValid && !bValid) {
    // Both invalid, compare ids
    return aId < bId ? -1 : aId > bId ? 1 : 0;
  }
  if (!aValid) return 1; // a sorts after b
  if (!bValid) return -1; // b sorts after a
  
  // Both valid, compare timestamps
  if (aTime !== bTime) {
    return aTime - bTime;
  }
  
  // Timestamps equal, compare ids
  return aId < bId ? -1 : aId > bId ? 1 : 0;
}

/**
 * Stable descending pagination for history records.
 * The cursor points at the last returned record, so later insertions cannot
 * cause an existing record to be skipped or returned twice.
 */
export function paginateByCursor<T>(
  records: readonly T[],
  options: {
    cursor?: string | null;
    pageSize?: number;
    getDate: (record: T) => string;
    getId: (record: T) => string;
  },
): CursorPage<T> {
  const pageSize = Math.min(
    MAX_HISTORY_PAGE_SIZE,
    Math.max(1, Math.floor(options.pageSize ?? DEFAULT_HISTORY_PAGE_SIZE)),
  );
  
  // Sort descending using exact comparator
  const sorted = [...records].sort((a, b) =>
    -compareHistoryKeys(
      options.getDate(a),
      options.getId(a),
      options.getDate(b),
      options.getId(b),
    ),
  );
  
  const position = options.cursor ? decodeCursor(options.cursor) : null;
  const start = position
    ? sorted.findIndex((record) => {
        const date = options.getDate(record);
        const id = options.getId(record);
        const recordTime = Date.parse(date);
        
        // Use same exact comparison for seek
        return (
          recordTime < position.t ||
          (recordTime === position.t && id < position.id)
        );
      })
    : 0;
    
  const safeStart = start < 0 ? sorted.length : start;
  const items = sorted.slice(safeStart, safeStart + pageSize);
  const last = items[items.length - 1];
  const hasNextPage = safeStart + items.length < sorted.length;

  return {
    items,
    hasNextPage,
    nextCursor:
      hasNextPage && last
        ? encodeCursor({
            t: Date.parse(options.getDate(last)),
            id: options.getId(last),
          })
        : null,
  };
}
