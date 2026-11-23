import type { CreditLine } from "@/types/draw-credit.types";
import {
  canDraw,
  getDrawBlockedReason,
  type DrawBlockedReason,
} from "@/lib/credit-line-status";

/**
 * Why a credit line cannot currently be drawn from. The reason is surfaced
 * verbatim in the selector and in the submit-time guard.
 */
export type DrawIneligibilityReason = DrawBlockedReason | "no_available";

export type DrawEligibility =
  | { eligible: true }
  | { eligible: false; reason: DrawIneligibilityReason };

/** Human-readable label for each ineligibility reason. */
export const DRAW_INELIGIBILITY_REASON_LABELS: Record<
  DrawIneligibilityReason,
  string
> = {
  suspended: "Suspended",
  defaulted: "Defaulted",
  frozen: "Frozen",
  closed: "Closed",
  no_available: "No available credit",
};

/**
 * Single source of truth for whether a credit line may be drawn from.
 *
 * Lifecycle status takes precedence over available balance: a Suspended,
 * Defaulted, Frozen or Closed line is ineligible even if it still reports a
 * positive `available` balance. An Active line is always eligible when it has
 * something left to draw, otherwise it reports `no_available`.
 *
 * Unknown/legacy statuses (e.g. a persisted draft written before the status
 * field existed) fall back to the Active/availability rule.
 */
export function getDrawEligibility(line: CreditLine): DrawEligibility {
  if (!canDraw(line.status)) {
    const reason = getDrawBlockedReason(line.status);
    if (reason) return { eligible: false, reason };
  }

  return line.available > 0
    ? { eligible: true }
    : { eligible: false, reason: "no_available" };
}
