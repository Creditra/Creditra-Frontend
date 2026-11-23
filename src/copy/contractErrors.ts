/**
 * User-facing copy for Soroban contract error codes emitted by the Creditra
 * credit contract.
 *
 * The `code` values mirror the `CreditLineError` enum in the contract. Keep
 * this table in sync with the contract ABI: an entry that drifts only degrades
 * copy quality (the code still surfaces as terminal), it never blocks a draw.
 *
 * `kind` decides whether the draw wizard offers a retry (`retryable`) or asks
 * the user to start over (`terminal`). Contract rejections are terminal by
 * default; only transient host conditions are retryable.
 */

import type { DrawErrorKind } from '../lib/draw-errors';

export interface ContractErrorCopy {
  /** Numeric code from the contract's `Error` enum. */
  code: number;
  /** Stable symbolic name, used in diagnostics and tests. */
  name: string;
  kind: DrawErrorKind;
  message: string;
}

const CONTRACT_ERRORS: ContractErrorCopy[] = [
  {
    code: 1,
    name: 'line_not_found',
    kind: 'terminal',
    message: "We couldn't find that credit line. Refresh the page and try again.",
  },
  {
    code: 2,
    name: 'line_not_active',
    kind: 'terminal',
    message: "This credit line isn't active, so it can't be drawn from.",
  },
  {
    code: 3,
    name: 'line_frozen',
    kind: 'terminal',
    message: 'This credit line is frozen. Resolve the freeze before drawing again.',
  },
  {
    code: 4,
    name: 'line_defaulted',
    kind: 'terminal',
    message: 'This credit line is in default and can no longer be drawn from.',
  },
  {
    code: 5,
    name: 'limit_exceeded',
    kind: 'terminal',
    message: 'That draw would exceed your credit limit. Lower the amount and try again.',
  },
  {
    code: 6,
    name: 'insufficient_availability',
    kind: 'terminal',
    message: 'The requested amount exceeds your available credit.',
  },
  {
    code: 7,
    name: 'insufficient_collateral',
    kind: 'terminal',
    message: "There isn't enough collateral to support this draw.",
  },
  {
    code: 8,
    name: 'invalid_amount',
    kind: 'terminal',
    message: 'Enter a draw amount greater than zero.',
  },
  {
    code: 9,
    name: 'invalid_apr',
    kind: 'terminal',
    message: "This credit line's interest rate is invalid. Contact support.",
  },
  {
    code: 10,
    name: 'unauthorized',
    kind: 'terminal',
    message: 'Only the owner of this credit line can draw from it.',
  },
  {
    code: 11,
    name: 'line_expired',
    kind: 'terminal',
    message: 'This credit line has expired and can no longer be drawn from.',
  },
  {
    code: 12,
    name: 'risk_score_too_low',
    kind: 'terminal',
    message: "Your current risk score doesn't qualify for this draw.",
  },
  {
    code: 13,
    name: 'attestation_required',
    kind: 'terminal',
    message: 'A valid attestation is required before you can draw.',
  },
  {
    code: 14,
    name: 'invalid_status_transition',
    kind: 'terminal',
    message: "This action isn't allowed for the credit line's current status.",
  },
  {
    code: 15,
    name: 'paused',
    kind: 'terminal',
    message: 'Drawing is temporarily paused. Try again later.',
  },
  {
    code: 16,
    name: 'budget_exhausted',
    kind: 'retryable',
    message: 'The network was too busy to process this draw. Please try again.',
  },
  {
    code: 17,
    name: 'storage_unavailable',
    kind: 'retryable',
    message: 'The network was temporarily unavailable. Please try again.',
  },
];

const CONTRACT_ERRORS_BY_CODE = new Map<number, ContractErrorCopy>(
  CONTRACT_ERRORS.map((entry) => [entry.code, entry]),
);

/** Look up user-facing copy for a contract error code. */
export function getContractErrorCopy(code: number): ContractErrorCopy | undefined {
  return CONTRACT_ERRORS_BY_CODE.get(code);
}

/** All known contract error entries (read-only view for tests and tooling). */
export function listContractErrors(): readonly ContractErrorCopy[] {
  return CONTRACT_ERRORS;
}

/**
 * Host (non-contract) Soroban error categories and how to treat them.
 *
 * Contract-level `Error(Contract, #N)` codes are handled by the table above.
 * Everything else is a host fault; some are worth a retry (resource limits)
 * and some are deterministic failures (bad Wasm, auth, malformed value).
 */
export const HOST_ERROR_KIND: Record<string, DrawErrorKind> = {
  auth: 'terminal',
  context: 'terminal',
  wasmvm: 'terminal',
  value: 'terminal',
  arithdomain: 'terminal',
  events: 'terminal',
  budget: 'retryable',
  storage: 'retryable',
};
