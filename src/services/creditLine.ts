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
import { applyTransition, getUnfrozenStatus } from "../lib/credit-line-status";
import type { CreditLine } from "../types/creditLine";

/**
 * Persist a freeze or unfreeze for the given credit line.
 *
 * The mock adapter:
 * 1. Finds the line in the in-memory store.
 * 2. Applies a guarded transition (Frozen on freeze; the status saved before
 *    the most recent freeze on unfreeze).
 * 3. Appends the transition engine's `statusHistory` entry.
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
  const now = new Date();
  const targetStatus = frozen ? "Frozen" : getUnfrozenStatus(line);
  const transition = applyTransition(line, targetStatus, {
    reason: frozen ? "Frozen by user" : "Unfrozen by user",
    now,
  });
  const updatedLine: CreditLine = {
    ...line,
    status: transition.status,
    updatedAt: transition.historyEntry.date,
    statusHistory: [...line.statusHistory, transition.historyEntry],
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
