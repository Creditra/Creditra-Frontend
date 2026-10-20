/** Maximum number of history records that may be requested in one page. */
export const MAX_HISTORY_PAGE_SIZE = 50;
export const DEFAULT_HISTORY_PAGE_SIZE = 15;

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

interface CursorPosition {
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
    const decoded = JSON.parse(atob(padded)) as Partial<CursorPosition>;
    if (typeof decoded.date !== "string" || typeof decoded.id !== "string") return null;
    return { date: decoded.date, id: decoded.id };
  } catch {
    return null;
  }
};

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
  const sorted = [...records].sort((a, b) => {
    const dateDifference = options.getDate(b).localeCompare(options.getDate(a));
    return dateDifference || options.getId(b).localeCompare(options.getId(a));
  });
  const position = options.cursor ? decodeCursor(options.cursor) : null;
  const start = position
    ? sorted.findIndex((record) => {
        const date = options.getDate(record);
        const id = options.getId(record);
        return date < position.date || (date === position.date && id < position.id);
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
        ? encodeCursor({ date: options.getDate(last), id: options.getId(last) })
        : null,
  };
}
