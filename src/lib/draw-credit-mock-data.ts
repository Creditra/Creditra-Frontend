import {
  CreditLine,
  DrawPricingRiskBand,
} from "@/types/draw-credit.types";
import { getDrawAvailability } from "@/lib/credit-line-availability";

/**
 * Authoring shape for a wizard credit line. Excludes `available` on
 * purpose — availability is *derived* from the authoritative
 * `utilization` (issue #931), so it cannot be hand-authored out of sync.
 */
export interface CreditLineSpec {
  id: string;
  name: string;
  limit: number;
  utilization: number;
  riskBand: DrawPricingRiskBand;
  termMonths: number;
}

/**
 * Construct a wizard credit line with `available` derived from the
 * authoritative `utilization` via `getDrawAvailability`. Use this
 * factory (rather than an object literal) so the derived value is the
 * only `available` ever produced for real wizard data.
 */
export function createCreditLine(spec: CreditLineSpec): CreditLine {
  return {
    id: spec.id,
    name: spec.name,
    limit: spec.limit,
    utilization: spec.utilization,
    riskBand: spec.riskBand,
    termMonths: spec.termMonths,
    available: getDrawAvailability(spec.limit, spec.utilization),
  };
}

/**
 * Mock credit lines used by the draw-credit wizard while the backend
 * indexer is being built.
 *
 * Three intentionally distinct utilisation levels are included so the
 * wizard exercises the full validation matrix in
 * `src/utils/amountValidation.ts` without needing a network round-trip:
 *
 * - `cl-001` (30 %) — low utilisation; should produce `success` messages
 * - `cl-002` (55 %) — medium utilisation; near the recommended-reserve floor
 * - `cl-003` (84 %) — high utilisation; reserve warnings expected
 *
 * `available` values are derived from `utilization` by `createCreditLine`
 * and are asserted to stay in sync by
 * `src/lib/credit-line-availability.test.ts`. Replace this export with a
 * backend fetch in the same import position to swap mocks for real data.
 */
export const mockCreditLines: CreditLine[] = [
  createCreditLine({
    id: "cl-001",
    name: "Business Line of Credit",
    limit: 50000,
    utilization: 30,
    riskBand: "Standard",
    termMonths: 24,
  }),
  createCreditLine({
    id: "cl-002",
    name: "Equipment Finance",
    limit: 100000,
    utilization: 55,
    riskBand: "Prime",
    termMonths: 18,
  }),
  createCreditLine({
    id: "cl-003",
    name: "Working Capital",
    limit: 75000,
    utilization: 84,
    riskBand: "Watch",
    termMonths: 12,
  }),
];
