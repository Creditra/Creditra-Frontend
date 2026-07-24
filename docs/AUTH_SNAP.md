# Auth Snapshot Tests

## Overview

`auth_snap.test.tsx` and `wallet.auth_snap.test.ts` provide comprehensive snapshot coverage for the wallet authentication surface in Creditra Frontend.

These tests verify that every state-changing entry point in the auth flow follows `require_auth` semantics — no side-effects occur without a valid, successful authentication. Any unexpected change to auth state shapes, error discriminators, or lifecycle transitions will cause CI to fail immediately.

## Why snapshots?

Traditional unit tests assert on individual fields:

```ts
expect(wallet.publicKey).toBe('GABC...');
expect(status).toBe('connected');
expect(error).toBeNull();
```

Snapshots capture the **entire state object** as a serialized artifact. If any field is silently added, removed, or renamed — even a field your test didn't explicitly check — the snapshot diff will surface it.

This is particularly valuable for discriminated unions like `WalletError` and `ConnectionStatus` where a typo in a discriminator string (`'conection_failed'` vs. `'connection_failed'`) would silently break error-handling logic at runtime.

## Files

### `src/context/auth_snap.test.tsx`

Covers the **React context lifecycle**:

- Initial states (disconnected, stored-but-not-remembered)
- Auto-reconnect states (reconnecting, connected, timed-out, error)
- User-initiated connect (freighter, albedo; with/without remember flag)
- Connect error variants (not_found, connection_failed, wrong_network, user_rejected)
- Disconnect (full auth reset)
- `forgetRememberedChoice` (partial reset: wallet stays connected, opt-in flag clears)
- Banner controls (`dismissReconnectBanner`)
- `retryReconnect` (re-run auto-reconnect)
- `stayConnected` (re-validate liveness; error on failure)

**Total: 27 tests, 27 snapshots.**

### `src/utils/wallet.auth_snap.test.ts`

Covers the **low-level wallet utility functions**:

- `isWalletInstalled` readiness checks (all wallet types; single/multiple/none)
- `connectWallet` error shapes (not_found, connection_failed, wrong_network)
- `connectWallet` success shapes (freighter, albedo, xbull, rabet)
- `saveWalletPreference` + `getStoredWallet` (with legacy key fallback)
- `disconnectWallet` cleanup (clears wallet + remember flag, preserves unrelated keys)
- `isWalletRemembered` / `setWalletRemembered` (flag read/write/remove)
- `recordRecentWallet` / `getRecentWalletOrder` (MRU list: dedupe, cap, sanitization)
- Edge cases (malformed data, unsupported wallet types, overflow safety)

**Total: 34 tests, 34 snapshots.**

## require_auth semantics

Every state-changing operation is tested to confirm **no side-effects without valid auth**:

| Function / operation | Auth requirement | Verified by |
| --- | --- | --- |
| `connect(type)` | Must succeed to change `status` or persist wallet | Error variant snapshots show `status='error'`, `wallet=null` |
| `connect(type, {remember: true})` | `setWalletRemembered(true)` only on success | "require_auth: remember flag is NOT persisted on connect failure" |
| `disconnect()` | None (destructive reset is always allowed) | Snapshot shows full cleanup (wallet, error, flags) |
| `forgetRememberedChoice()` | None (privacy control, not auth-gated) | Snapshot shows `isRemembered=false`, wallet unchanged |
| `retryReconnect()` | Requires stored wallet preference | Snapshot shows no-op when no stored wallet exists |
| `stayConnected()` | Requires currently connected wallet | Snapshot shows no-op when disconnected; error on failure |

## When to update snapshots

### Expected changes (safe to commit)

- You refactor a state field (e.g., rename `publicKey` → `address`) and want to confirm the new shape is correct across all lifecycle states.
- You add a new field to `WalletInfo` or `WalletContextType` and need to regenerate snapshots to include it.
- You fix a bug that changes the error shape (e.g., adding a missing `type` discriminator).

**How to update:**

```bash
npm test -- auth_snap -u
```

Review the diff in `__snapshots__/`. Commit if the changes match your intent.

### Unexpected failures (investigate before updating)

- A snapshot fails without you changing any code → either:
  1. Non-deterministic data leaked into the snapshot (timestamps, UUIDs, wallet addresses).
  2. A dependency change broke the auth contract.
- You added a new auth operation but forgot to add a corresponding snapshot test → add the test rather than blindly updating existing snapshots.

## Coverage requirements

Every new state-changing operation added to `WalletContext` or `wallet.ts` must have a corresponding snapshot test that:

1. Captures the **full state shape** after the operation completes.
2. Verifies **no side-effects on failure** (e.g., storage is not written, flags are not set).
3. Covers **each error variant** when applicable (e.g., each `WalletError.type` value).

## Integration with CI

Snapshot tests are part of the standard test suite and run on every commit:

```bash
npm test -- --run
```

Any snapshot mismatch will cause CI to fail. Developers must:

- Review the diff locally via `npm test -- auth_snap`.
- Confirm the change is intentional (not a regression).
- Commit the updated `.snap` files alongside the code change.

## Debugging snapshot failures

### "expected 5 to equal 4" (field count changed)

A new field was added or removed from the captured state. Re-run with `-u` to see the actual diff.

### "expected 'conected' to equal 'connected'" (typo in discriminator)

A discriminator string changed. This is usually a bug (unless you intentionally renamed the variant). Fix the typo rather than updating the snapshot.

### "Test timed out in 5000ms"

Fake timers are active and your test is using `waitFor` (which polls in real time). Replace `waitFor` with `act(() => { vi.runAllTimers(); })`.

## Maintenance notes

### Mocking wallet extensions

All tests mock `window.freighter`, `window.albedo`, etc. via Vitest spies. The mocks return deterministic fixture values so snapshots are stable across runs.

### Fake timers

All tests use `vi.useFakeTimers()` to control reconnect timeouts and session timers. This makes tests fast (no real 8-second delays) and deterministic.

### No real network calls

`connectWallet` is fully mocked; no actual wallet extensions are invoked. This keeps tests hermetic and runnable in CI without browser extensions installed.

## Related docs

- [`docs/TESTING.md`](./TESTING.md) — Full test pyramid and coverage policy
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — WalletContext lifecycle and state transitions
- [`src/context/WalletContext.tsx`](../src/context/WalletContext.tsx) — Implementation
- [`src/utils/wallet.ts`](../src/utils/wallet.ts) — Low-level auth utilities
