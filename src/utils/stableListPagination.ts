export interface StablePage<T> {
  items: T[];
  pageIndex: number;
  pageCount: number;
  totalSlots: number;
}

/**
 * Reconcile a live list with the order captured for the current pagination
 * session. Existing ids deliberately keep their slot even when they
 * temporarily disappear; collapsing those slots would shift page boundaries
 * and can duplicate or skip records for a user who has already paged forward.
 * Newly observed ids are appended in the caller's current deterministic order.
 */
export function reconcileStableOrder<T>(
  previousOrder: readonly string[],
  records: readonly T[],
  getId: (record: T) => string,
): string[] {
  const next = [...new Set(previousOrder)];
  const seen = new Set(next);

  for (const record of records) {
    const id = getId(record);
    if (!seen.has(id)) {
      seen.add(id);
      next.push(id);
    }
  }

  return next;
}

/** Start a new pagination session from a freshly sorted / filtered list. */
export function createStableOrder<T>(
  records: readonly T[],
  getId: (record: T) => string,
): string[] {
  return reconcileStableOrder([], records, getId);
}

/**
 * Resolve one page from stable id slots while reading the latest record data.
 * Missing records remain empty slots for this session so later pages never
 * move backward. If a record with the same id returns, it occupies its
 * original slot again.
 */
export function getStablePage<T>(
  records: readonly T[],
  order: readonly string[],
  options: {
    pageIndex: number;
    pageSize: number;
    getId: (record: T) => string;
  },
): StablePage<T> {
  const pageSize = Math.max(1, Math.floor(options.pageSize));
  const pageCount = Math.ceil(order.length / pageSize);
  const maxPageIndex = Math.max(0, pageCount - 1);
  const pageIndex = Math.min(maxPageIndex, Math.max(0, Math.floor(options.pageIndex)));
  const start = pageIndex * pageSize;
  const slotIds = order.slice(start, start + pageSize);

  // First record wins for duplicate ids so malformed live payloads are
  // deterministic and cannot render the same logical credit line twice.
  const byId = new Map<string, T>();
  for (const record of records) {
    const id = options.getId(record);
    if (!byId.has(id)) byId.set(id, record);
  }

  return {
    items: slotIds.flatMap((id) => {
      const record = byId.get(id);
      return record ? [record] : [];
    }),
    pageIndex,
    pageCount,
    totalSlots: order.length,
  };
}
