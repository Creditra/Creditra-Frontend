import type { CreditLine } from "@/types/draw-credit.types";

/**
 * Why a credit line cannot currently be drawn from. The reason is surfaced
 * verbatim in the selector and in the submit-time guard.
 */
export type DrawIneligibilityReason =
  | "suspended"
  | "defaulted"
  | "frozen"
  | "closed"
  | "no_available";

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
  switch (line.status) {
    case "Suspended":
      return { eligible: false, reason: "suspended" };
    case "Defaulted":
      return { eligible: false, reason: "defaulted" };
    case "Frozen":
      return { eligible: false, reason: "frozen" };
    case "Closed":
      return { eligible: false, reason: "closed" };
    case "Active":
    default:
      return line.available > 0
        ? { eligible: true }
        : { eligible: false, reason: "no_available" };
  }
}
