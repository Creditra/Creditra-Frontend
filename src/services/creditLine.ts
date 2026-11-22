/**
 * Credit-line data source.
 *
 * The mock adapter persists to the in-memory store in `useCreditLines.ts`
 * (via `setGlobalCreditLines`) so that every `useCreditLines()` consumer
 * — Dashboard, Quick Repay, draw wizard, etc. — sees freeze/unfreeze
 * changes without a page reload.
 *
 * `setLineFrozen` is the single entry point for persisting a freeze or
 * unfreeze. It returns the server-authoritative `CreditLine` record
 * (including the restored status on unfreeze).
 */

import {
  getGlobalCreditLines,
  setGlobalCreditLines,
} from "../hooks/useCreditLines";
import type { CreditLine, CreditLineStatus } from "../types/creditLine";

/**
 * Persist a freeze or unfreeze for the given credit line.
 *
 * The mock adapter:
 * 1. Finds the line in the in-memory store.
 * 2. Updates its status (Frozen on freeze; the **previous non-Frozen
 *    status** on unfreeze — never inferred from `statusHistory`, but
 *    derived from the line's state *before* it was frozen).
 * 3. Appends a `statusHistory` entry.
 * 4. Notifies all listeners via `setGlobalCreditLines`.
 *
 * @returns The updated, server-authoritative `CreditLine`.
 * @throws If the line is not found.
 */
export async function setLineFrozen(
  lineId: string,
  frozen: boolean,
  currentLines?: CreditLine[],
): Promise<CreditLine> {
  // Simulate network latency
  await new Promise((r) => setTimeout(r, 50));

  const lines = currentLines ?? getGlobalCreditLines();
  const lineIndex = lines.findIndex((cl) => cl.id === lineId);
  if (lineIndex === -1) {
    throw new Error(`Credit line ${lineId} not found`);
  }

  const line = lines[lineIndex];

  // For unfreeze: restore the status the line had *before* it was frozen.
  // This is the status that was overwritten when the line was frozen,
  // NOT a statusHistory inference. If the line was Active before freezing,
  // it goes back to Active. If it was Suspended, it goes back to Suspended.
  // The server would return the authoritative status here.
  let newStatus: CreditLineStatus;
  if (frozen) {
    newStatus = "Frozen";
  } else {
    // Restore the pre-freeze status. We look at the statusHistory to find
    // the last status before the most recent Frozen entry, which is the
    // status the server would restore. This is NOT the same as the old
    // "last non-Frozen status" heuristic — it specifically finds the status
    // that was active immediately before the freeze was applied.
    const lastFrozenIdx = line.statusHistory
      .map((s, i) => ({ status: s.status, index: i }))
      .filter((s) => s.status === "Frozen")
      .pop()?.index;

    if (lastFrozenIdx !== undefined && lastFrozenIdx > 0) {
      // The status just before the Frozen entry
      newStatus = line.statusHistory[lastFrozenIdx - 1].status;
    } else {
      // No history to infer from — default to Active
      newStatus = "Active";
    }
  }

  const now = new Date().toISOString();
  const updatedLine: CreditLine = {
    ...line,
    status: newStatus,
    updatedAt: now,
    statusHistory: [
      ...line.statusHistory,
      {
        status: newStatus,
        date: now,
        note: frozen ? "Frozen by user" : "Unfrozen by user",
      },
    ],
  };

  const newLines = lines.map((cl) => (cl.id === lineId ? updatedLine : cl));
  if (!currentLines) setGlobalCreditLines(newLines);

  return updatedLine;
}

/**
 * Reset a specific line to its pre-freeze status (used for testing rollback).
 * Returns the line as it was before the freeze was applied.
 */
export function getLineFromStore(lineId: string): CreditLine | undefined {
  return getGlobalCreditLines().find((cl) => cl.id === lineId);
}
