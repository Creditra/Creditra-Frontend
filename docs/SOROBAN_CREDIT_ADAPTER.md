# Soroban Credit Data Adapter

This document explains how the Creditra frontend connects to and reads on-chain credit line state from Soroban smart contracts on the Stellar Testnet.

---

## 1. Overview

Creditra's credit lines live in a Soroban smart contract. The `SorobanCreditDataSource` adapter implements the `CreditDataSource` port to read credit lines and individual line details using read-only transaction simulations through Soroban RPC.

### Key Architectural Properties
- **Read-only**: All calls execute via `rpc.Server#simulateTransaction` against a throwaway account. No wallet signatures or transaction submissions are required for queries.
- **Lossless Precision**: Contract `i128` values (stroops / base units) are decoded with lossless BigInt arithmetic prior to scaling to standard currency units, preventing precision loss above `Number.MAX_SAFE_INTEGER`.
- **Deferred Bundle Loading**: `@stellar/stellar-sdk` is split into its own manual rollup chunk (`stellar`), ensuring `vendor-core` bundle size and first-paint performance remain unaffected.
- **Timeout & Abort Guarantees**: Every RPC simulation is bounded by a 15-second default timeout and strictly honours `AbortSignal` with guaranteed resource cleanup.

---

## 2. Configuration & Environment Variables

To point the application at Stellar Testnet and enable the on-chain Soroban adapter, set the following environment variables in `.env` (or pass them when launching the dev server):

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_CREDIT_DATA_SOURCE` | Yes | `mock` | Set to `soroban` to enable the on-chain adapter (`mock` uses local fixture data). |
| `VITE_SOROBAN_RPC_URL` | No | `https://soroban-testnet.stellar.org` | URL of the Soroban RPC node. |
| `VITE_NETWORK_PASSPHRASE` | No | `Test SDF Network ; September 2015` | Network passphrase for transaction simulation. |
| `VITE_CREDIT_CONTRACT_ID` | Yes (for live contract) | `CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE` | Address of the deployed Creditra credit line contract on testnet. |

### Running Locally with Testnet
```bash
# In .env or as inline environment variable
VITE_CREDIT_DATA_SOURCE=soroban npm run dev
```

---

## 3. Contract ABI & Interface Specification

The adapter invokes the following read-only contract entrypoints:

### Entrypoints
- `get_lines_by_borrower(borrower: Address) -> Vec<ContractCreditLine>`: Lists all active, suspended, or defaulted credit lines associated with the borrower's Stellar address.
- `get_line(id: String) -> Option<ContractCreditLine>`: Fetches a single credit line by ID; returns `None` if the line does not exist.

### Return Struct (`ContractCreditLine`)
```rust
pub struct ContractCreditLine {
    pub id: String,
    pub name: String,
    pub status: Symbol,          // "Active" | "Suspended" | "Defaulted" | "Closed" | "Frozen"
    pub limit: i128,             // Base units (10^7 stroops)
    pub utilized: i128,          // Base units (10^7 stroops)
    pub apr: u32,                // Basis points or percentage
    pub risk_score: u32,         // 0–850
    pub opened_at: u64,          // Unix timestamp in seconds
    pub updated_at: u64,          // Unix timestamp in seconds
    pub collateral: Option<String>,
}
```

---

## 4. Error Codes & Troubleshooting

When an RPC call fails, `SorobanCreditDataSource` categorizes the failure into a canonical `CreditDataError` with one of the following error codes:

| Error Code | Meaning | Typical Causes | Troubleshooting & Resolution |
|---|---|---|---|
| `network` | Transport failure or timeout | • RPC node offline or unreachable<br>• DNS resolution failure<br>• Request exceeded 15 s timeout | • Check internet connectivity.<br>• Verify `VITE_SOROBAN_RPC_URL` is healthy and responsive.<br>• Inspect browser network tab for blocked HTTP requests. |
| `not_found` | Credit line record not found | • `get_line(id)` returned `Option::None`<br>• The credit line ID has not been provisioned | • Check that the requested credit line ID exists on-chain for the borrower.<br>• Ensure testnet state has not been wiped or reset. |
| `unavailable` | Contract simulation failed | • Contract execution reverted/panicked<br>• Contract ID is not deployed on the target network<br>• Insufficient ledger state | • Verify `VITE_CREDIT_CONTRACT_ID` is correct for the active network.<br>• Inspect error details in `cause` for Soroban host error codes (e.g. `ContractError`). |
| `invalid_response` | Malformed or incompatible ScVal returned | • Contract struct missing required fields (`limit`, `status`, etc.)<br>• Field type mismatch (e.g. non-i128 limit)<br>• Unknown `status` variant | • Confirm contract ABI matches the struct specification.<br>• Ensure contract was compiled with compatible Soroban SDK version. |
| `aborted` | Operation was aborted | • Caller aborted via `AbortSignal`<br>• Component unmounted before simulation completed | • Normal lifecycle behavior when switching views or canceling requests. No action required. |

---

## 5. Bundle Footprint

Bundle metrics recorded with `@stellar/stellar-sdk` split into manual chunk `stellar`:
- `stellar` chunk: ~661 kB (~138.5 kB gzipped)
- `vendor-core` chunk: **164.11 kB (53.60 kB gzipped) — 0 growth from baseline**

---

## 6. Transaction history from Horizon operations

Credit line state comes from the contract, but a borrower's *history* is read from
Horizon: `src/services/credit/horizonHistorySource.ts` implements
`CreditDataSource.listTransactions` and is the history arm of
`SorobanCreditDataSource` (injectable as `historySource` for tests).

### Why operations and not the contract
`get_lines_by_borrower` returns current state only — embedded transactions are a
fixture convenience, not a ledger. A real borrower's draw/repay/fee events are
`invoke_host_function` operations on the borrower's account, which Horizon pages
with `paging_token`.

### Request shape
```
GET {horizonUrl}/accounts/{borrower}/operations
    ?order=desc&limit={pageLimit}&include_failed=true[&cursor={paging_token}]
```
- `horizonUrl` is `VITE_HORIZON_URL` (default `https://horizon-testnet.stellar.org`).
- `limit` is clamped to `1..MAX_HISTORY_PAGE_SIZE` (50) and defaults to
  `DEFAULT_HISTORY_PAGE_SIZE` (15).
- The **first** request of a sequence carries no `cursor` parameter at all.

### Function name → `Transaction.type`
The entrypoint symbol is read from the operation's `function` field (a bare symbol,
or `contract#symbol`, normalised to lower snake_case) and looked up in
`TRANSACTION_TYPE_BY_FUNCTION`:

| Contract entrypoint | `TransactionType` |
|---|---|
| `draw`, `draw_credit`, `draw_line`, `borrow` | `Draw` |
| `repay`, `repay_line`, `payment` | `Repay` |
| `charge_fee`, `fee`, `origin_fee` | `Fee` |
| `accrue_interest`, `interest`, `pay_interest` | `Interest` |
| `set_status`, `change_status`, `suspend`, `unfreeze`, `freeze`, `close`, `default_line` | `StatusChange` |

**This table needs maintainer confirmation against the deployed contract.** Only the
read entrypoints (`get_lines_by_borrower`, `get_line`) are exercised by the frontend
today, so no on-chain write symbol has been observed. Two rules keep a wrong guess
from becoming a silent data loss:

- A call on the credit contract whose symbol is **not** in the table is kept as
  `StatusChange` with `note: "Unmapped contract call: <symbol>"`, so the row appears
  in history instead of vanishing.
- `amount` is decoded from the arguments, never inferred from the type.

### Row mapping
| `Transaction` field | Source |
|---|---|
| `id` | operation `id` (also the dedupe key) |
| `type` | table above |
| `amount` | first `amount`-named / integer argument, i128 base units ÷ 10^7 |
| `date` | operation `created_at` |
| `status` | `transaction_successful ? 'Completed' : 'Failed'` |
| `txHash` | operation `transaction_hash` |
| `lineId` | `line_id` / `credit_line_id` / `id` argument, else the first non-strkey string |
| `note` | only for unmapped symbols |

Arguments are decoded from the base64 `ScVal` XDR Horizon stores (`parameters[].value`,
falling back to `parameters[].value_decoded` and then `arguments`), so i128 amounts keep
full precision through `BigInt` before the 7-decimal scale.

### Filtering, cursors and the page-fill rule
Contract filtering happens **after** the fetch, so a page of operations can contain few
credit rows. The adapter therefore keeps walking backwards (`order=desc`, next request
uses the last operation's `paging_token` as `cursor`) until it has `limit` matching rows,
Horizon returns a short page, or **five** upstream requests have been spent
(`MAX_UPSTREAM_REQUESTS_PER_CALL`).

- `nextCursor` is the `paging_token` of the last delivered row, or `null` when the page
  came back short (end of history).
- When the five-request cap is reached with rows still missing, the scan cursor is
  returned rather than `null` — reporting the end of history there would hide the rest of
  the ledger. The caller sees a short page plus a cursor and can keep going.
- Because `paging_token` is monotonic and the cursor is exclusive, an operation that
  lands between two page requests sorts *above* the cursor: it is not re-delivered and it
  cannot push an older row out of the next page. No duplicates, no gaps.
- Duplicate operation ids inside one batch are delivered once.

The cursor is opaque end to end. `useCreditTransactions` passes it through untouched and
reports `serverPaged: true`, so a view knows not to sort or re-paginate locally.
`TransactionHistory` keeps its existing per-page cursor stack and its filter-change reset
(`setCurrentPage(1)` + `setPageCursors([undefined])`), which is what guarantees "filter
change ⇒ first page ⇒ request without a `cursor` parameter". In ledger mode the view also
sends the selected credit line as `lineId`: narrowing the scan on the way in keeps a page
full, while filtering a fetched page down in the view can leave it empty.

### Failure handling
| Horizon reply | Adapter behaviour | Error code |
|---|---|---|
| `429` | one backoff retry (`retryDelayMs * 2^attempt`), then give up | `network` |
| `404` (unfunded account) | empty history, **not** an error | — |
| other non-2xx | request failed | `network` |
| body is not JSON, or `_embedded.records` is missing | unusable payload | `invalid_response` |
| record without `id` or `paging_token` | cannot be paged safely | `invalid_response` |
| timeout (`timeoutMs`, default 15 s) | request aborted | `network` |
| caller `AbortSignal` | request cancelled | `aborted` |

Failed operations are surfaced with `status: 'Failed'` and keep their `txHash`; they are
never dropped, because a reverted repayment is part of the borrower's audit trail.

### History cursor state
`src/data/mockData.ts` used to carry `resetHistoryCursors` / `getHistoryCursor` /
`setHistoryCursor`. Nothing ever imported them, and server cursors now live in hook and
page state (one per page, reset with the filters), so the helpers were deleted rather than
wired up. Filter-scoped cursor caching outside React state would be a second, untracked
source of truth for the same value.
