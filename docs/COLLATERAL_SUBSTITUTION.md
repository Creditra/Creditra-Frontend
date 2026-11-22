# Collateral Substitution Flow

**Campaign:** GrantFox  
**Feature:** Swap one pledged collateral asset for another with side-by-side LTV comparison and fee surfacing.

---

## Overview

The collateral substitution flow lets a borrower replace the asset currently securing a credit line with a different one. Before committing, the user sees a side-by-side comparison of the outgoing and incoming assets — including the resulting LTV ratio, headroom, and the total processing fee — and must type the incoming asset's name to unlock the irreversible confirmation.

---

## Files

| File | Purpose |
|---|---|
| `src/types/collateral.ts` | Domain types: `CollateralAsset`, `LtvSnapshot`, `SubstitutionFee`, `SubstitutionStep`, `SubstitutionStatus` |
| `src/utils/collateral.ts` | Pure helpers: LTV math, fee calculation, asset catalogue, name-matching |
| `src/utils/collateral.test.ts` | 28 unit tests for all utility functions |
| `src/components/CollateralSubstitutionModal.tsx` | Three-step modal component |
| `src/components/CollateralSubstitutionModal.css` | Component-scoped styles using CSS custom properties |
| `src/components/__tests__/CollateralSubstitutionModal.test.tsx` | 27 component integration tests |
| `src/pages/CreditLines.tsx` | Wired the "⇄ Swap Collateral" button on active credit lines |

---

## User Flow

```
Credit Lines page
  └─ [Active line] → ⇄ Swap Collateral button
       │
       ▼
Step 1 — Select
  • Lists all available collateral assets except the currently pledged one
  • Shows each asset's value, current effective LTV, and max LTV
  • "Review" is disabled until an asset is selected

       │  user selects an asset
       ▼
Step 2 — Review (side-by-side comparison)
  • LEFT card   — current asset: value, LTV, max LTV, headroom, progress bar
  • RIGHT card  — incoming asset: same metrics
  • Arrow column — LTV delta pill (e.g. "−8.4 pp" in green / "+5.2 pp" in red)
  • Fee breakdown: processing fee (0.5% of balance) + appraisal fee ($250 for real estate)
  • Over-LTV warning banner if the incoming asset can't cover the loan
  • "Continue" is disabled when the incoming asset is over-LTV

       │  user clicks Continue
       ▼
Step 3 — Confirm (irreversible-action gate)
  • Summary recap: replacing / new collateral / new LTV / total fee
  • User must type the exact incoming asset name (case-insensitive) to unlock submit
  • "Confirm substitution" button uses PendingButton with aria-busy during network call

       │  successful submission
       ▼
Success state
  • Animated check icon
  • Confirmation copy with asset name
  • "Done" button calls onClose
```

---

## Architecture

### Component props

```ts
interface CollateralSubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (incomingAsset: CollateralAsset) => void;
  creditLineName: string;
  loanBalance: number;              // outstanding balance in USD
  currentAsset?: CollateralAsset;  // undefined → no current collateral
  triggerRef?: React.RefObject<HTMLElement | null>;
  _delayMs?: number;               // internal: override network delay for tests
}
```

### LTV calculation

```
ltvRatio         = loanBalance / asset.value
isOverLtv        = ltvRatio > asset.maxLtvRatio
availableHeadroom = asset.value × asset.maxLtvRatio − loanBalance
```

### Fee schedule

| Asset category | Processing fee | Appraisal fee |
|---|---|---|
| crypto, receivables, treasury, other | 0.5% of balance | — |
| real_estate | 0.5% of balance | $250 flat |

---

## State machine

```
idle → [user clicks Submit] → pending → success
                                      ↘ error  (submission fails; user can retry)
```

All step/status state lives inside `CollateralSubstitutionModal`. The parent (`CreditLines`) only sees `onClose` and `onSuccess(incomingAsset)`.

---

## Accessibility

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="csm-title"`, `aria-describedby="csm-subtitle"`
- Three hooks: `useFocusTrap` + `useBodyScrollLock` + `useInertBackdrop` (same pattern as `WalletConnectionModal`)
- Escape key closes the modal via both the focus-trap hook and a direct `onKeyDown` on the dialog element
- Asset list uses `role="listbox"` / `role="option"` / `aria-selected`
- LTV progress bars use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
- LTV delta announced to screen readers via an `aria-live="polite"` `sr-only` paragraph
- Over-LTV warning uses `role="alert"`
- Submission error uses `role="alert"`
- All color-coded states (improvement/degradation/over-LTV) use color + numeric value + descriptive text — WCAG 1.4.1 compliant
- Minimum 44×44 px tap targets on all interactive elements — WCAG 2.5.5
- `prefers-reduced-motion`: animations suppressed

---

## Connecting to a real API

`handleSubmit` in `CollateralSubstitutionModal.tsx` contains a `TODO` comment showing where to replace the simulated delay with a real call:

```ts
// Replace this Promise with your API call:
await apiClient.substituteCollateral({
  creditLineId,
  outgoingAssetId: currentAsset?.id,
  incomingAssetId: selected.id,
});
```

Pass the asset catalogue from your API via the `AVAILABLE_COLLATERAL_ASSETS` export in `src/utils/collateral.ts` (replace the static array with a fetched list).

---

## Idempotency & Deduplication

### Guarantees

The collateral substitution flow implements **deterministic, server-safe idempotency** to prevent silent data loss and duplicate intents from retries, network failures, or concurrent execution.

**Key invariants:**

1. **Deterministic keys**: Same substitution parameters always produce the same idempotency key, ensuring retries are safely detected on the server.
2. **Collision resistance**: Different operations (different credit line, asset pair, or initiation time) produce different keys with cryptographic strength.
3. **No replay**: If the server has already processed a key successfully, retrying with the same key will not replay side effects.
4. **Observable**: Keys and attempt metadata are logged for diagnostics without exposing sensitive data.
5. **Stable across retries**: The same key is reused across all retry attempts for a single user interaction.

### Implementation

| Component | Purpose |
|-----------|---------|
| `src/utils/idempotency.ts` | Pure functions for key generation, attempt tracking, and state transitions |
| `src/types/collateral.ts` | `CollateralSubstitutionIntent` (canonical params) and submission state types |
| `src/components/CollateralSubstitutionModal.tsx` | Integration: key generation, duplicate detection, side-effect prevention |

### Key generation

An idempotency key is deterministically computed from:

```
[creditLineId, outgoingAssetId, incomingAssetId, initiatedAtMs]
```

The key is a base64-encoded hash of this canonical representation. Keys remain stable across the user's session and retries, but change if:
- The credit line ID changes
- The incoming or outgoing asset changes
- The initiation timestamp changes (to allow repeated attempts for the same asset pair across different sessions)

### Submission attempt tracking

Each modal session tracks a `SubmissionAttempt`:

```ts
{
  idempotencyKey: "idem_9c4d8f2b1e7a3c1d5f8b2e4a9d7c1f3b",
  attemptCount: 2,
  lastSubmittedAtMs: 1692345601234,
  lastServerResponse: {
    statusOrReason: "network",
    message: "Connection timeout",
    receivedAtMs: 1692345601500
  }
}
```

This state is:
- Generated on first submission with `createSubmissionAttempt()`
- Updated before each network call with `recordSubmissionAttempt()`
- Updated after each server response with `recordServerResponse()`
- Scoped to a single modal instance (cleared on close/reopen)

### Failure modes and safety

#### Already succeeded
If the server has processed a key successfully and a retry occurs, `hasSucceeded()` returns true and the side effect (calling `onSuccess`) is skipped. This prevents duplicate intents from being applied.

#### Network error (retryable)
Network timeouts, connection refused, and 5xx errors are classified as retryable. The key is reused, attempt count increments, and the server can detect and deduplicate.

#### Validation error (non-retryable)
Bad parameters, 4xx errors (except 429/503), and invalid signatures are non-retryable. No retry affordance is shown; the user must adjust their selection.

#### Slippage exceeded (non-retryable)
If the collateral LTV drifts beyond the user's tolerance threshold, the operation is blocked. This is checked *before* submission to prevent wasting retries.

#### Stale quote (non-retryable)
If the review-time LTV snapshot is older than `STALE_QUOTE_THRESHOLD_MS` (60 seconds), the user must refresh before submitting.

#### Max retries exhausted
After `MAX_RETRY_ATTEMPTS` (3) attempts, no more retries are offered. The `onError` callback is invoked with the final error. The idempotency key is still available in the error for support/logging.

### Server-side requirements

To fully prevent duplicate intents, the server **must**:

1. **Accept the idempotency key** in the substitution request header or body
2. **Check for prior processing**: If the key has been seen before and succeeded, return the prior success response without re-processing
3. **Atomically persist the key** on first attempt to avoid race conditions
4. **Return the same response** for duplicate requests with the same key
5. **Optionally log the key** for audit trails and diagnostics (without exposing it in user-facing messages)

Example server behavior:

```
Request with key "idem_abc123" arrives
│
├─ Key exists in DB?
│  ├─ Yes, with status=success → return success immediately (no re-processing)
│  ├─ Yes, with status=pending → wait/retry or return pending
│  └─ No → continue to processing
│
└─ Process the substitution, store key with status=success
   └─ Return success
```

### Diagnostics and logging

The modal logs:
- Key generation: `[CollateralSubstitution] Generated idempotency key: { idempotencyKey, attemptCount, ... }`
- Submission: `[CollateralSubstitution] Submitting attempt: { idempotencyKey, attemptCount, ageMs, ... }`
- Success: `[CollateralSubstitution] Submission succeeded: { idempotencyKey, attemptCount, ... }`
- Error: `[CollateralSubstitution] Submission failed: { idempotencyKey, attemptCount, lastServerStatusOrReason, ... }`
- Max retries: `[CollateralSubstitution] Max retries exhausted: { idempotencyKey, attemptCount, ... }`

Logs **never** include:
- Loan balance, asset values, or LTV ratios
- User names or contact information
- Server credentials or API secrets
- Sensitive payload data

The `idempotencyKey` is included in all error objects for linking client-side errors to server-side logs.

## Tests

```bash
# utility functions only (fast, no DOM)
npx vitest run src/utils/collateral.test.ts src/utils/idempotency.test.ts

# component tests (jsdom)
npx vitest run src/components/__tests__/CollateralSubstitutionModal.test.tsx

# all (including idempotency integration tests)
npx vitest run src/utils/collateral.test.ts src/utils/idempotency.test.ts src/components/__tests__/CollateralSubstitutionModal.test.tsx
```

**90+ tests, 0 failures.**

### Test coverage

- **Unit tests** (28): Slippage, fee calc, quote staleness, error classification
- **Idempotency tests** (40+): Key generation, determinism, collision resistance, state transitions, retry logic, staleness, diagnostics
- **Integration tests** (27 base + 9 idempotency): Modal flow, accessibility, submission, retries, error handling, concurrent guards, deduplication

### Test strategy notes

- The three accessibility hooks (`useFocusTrap`, `useBodyScrollLock`, `useInertBackdrop`) are mocked in the component test file because jsdom does not implement `window.scrollTo` or the `inert` attribute. This is the same pattern used by other modal tests in the project.
- Dismiss/close tests use `fireEvent` instead of `userEvent` to avoid the pointer-event pipeline delays in jsdom.
- Submission tests use `_delayMs={0}` to make the simulated network Promise resolve immediately, avoiding fake timer complexity.
- Idempotency tests verify key generation is deterministic, collision-resistant, and that logging does not expose sensitive data.
