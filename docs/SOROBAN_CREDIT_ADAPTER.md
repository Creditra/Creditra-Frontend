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
- **Request Coalescing & Throttling**: Concurrent `listCreditLines` calls for the same borrower share a single in-flight RPC simulation (`AbortSignal` from one consumer rejects only that consumer unless all consumers abort). Successful list responses are cached for a configurable `minListIntervalMs` (default `1000` ms) so bursts cost a single RPC; errors are never cached and `options.force` bypasses the interval.

---

## 2. Configuration & Environment Variables

To point the application at Stellar Testnet and enable the on-chain Soroban adapter, set the following environment variables in `.env` (or pass them when launching the dev server):

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_CREDIT_DATA_SOURCE` | No | `mock` | Set to `mock` or `soroban` (case-insensitive; surrounding whitespace is ignored). Unset or empty values use `mock`; any other value fails during startup. |
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
- `get_transactions(line_id: String, cursor: Option<String>, limit: Option<u32>) -> ContractTransactionPage`: Returns a paginated slice of ledger transactions for a credit line. `cursor` is an opaque pagination cursor returned by a previous call (`None` starts from the beginning); `limit` caps the page size (`None` uses the contract default).

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
    pub updated_at: u64,         // Unix timestamp in seconds
    pub collateral: Option<String>,
    pub transactions: Option<Vec<ContractTransaction>>,
    pub status_history: Option<Vec<ContractStatusHistoryEntry>>,
}

pub struct ContractTransaction {
    pub id: String,
    pub r#type: Symbol,          // "Draw" | "Repay" | "Fee" | "Interest" | "StatusChange"
    pub amount: i128,            // Base units (10^7 stroops)
    pub date: u64,               // Unix timestamp in seconds (or ISO 8601 string)
    pub status: Symbol,          // "Completed" | "Pending" | "Failed"
    pub note: Option<String>,
    pub tx_hash: Option<String>,
}

pub struct ContractStatusHistoryEntry {
    pub status: Symbol,          // "Active" | "Suspended" | "Defaulted" | "Closed" | "Frozen"
    pub date: u64,               // Unix timestamp in seconds (or ISO 8601 string)
    pub note: Option<String>,
}

pub struct ContractTransactionPage {
    pub items: Vec<ContractTransaction>,
    pub next_cursor: Option<String>,
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

## 5. Write Flow (`SorobanWriteClient`)

Draw and repay mutations use `src/services/credit/sorobanWriteClient.ts` to execute real Soroban contract invocations when `VITE_CREDIT_DATA_SOURCE=soroban` is enabled, and fall back to a deterministic `MockSorobanWriteClient` when `VITE_CREDIT_DATA_SOURCE=mock` (the default for local dev and unit tests).

### Lifecycle (`submitContractCall`)
1. **Load Source Account**: Fetches the connected borrower's sequence number via `rpc.Server#getAccount(source)`.
2. **Build Invocation**: Constructs a `TransactionBuilder` with `Contract#call(method, ...args)`. Amounts are converted to 7-decimal `i128` stroops via `src/utils/money.ts` (`amountToStroops`) — never floating-point math.
3. **Simulate**: Runs `rpc.Server#simulateTransaction(tx)`. Simulation errors are surfaced as classified `SorobanWriteError('simulation_error', ...)` without prompting the wallet or submitting.
4. **Assemble**: Applies footprint, auth entries, and resource fees via `rpc.assembleTransaction(tx, simResponse).build()`.
5. **Wallet Signature**: Calls `signTransaction(walletType, xdr, networkPassphrase)` in `src/utils/wallet.ts` (Freighter `signTransaction`, Albedo `tx`, xBull `signXDR`, Rabet `sign`). User cancellation throws `user_rejected`, returning the UI to the review step with a non-terminal message and never submitting.
6. **Submit**: Sends the signed transaction via `rpc.Server#sendTransaction(signedTx)`.
7. **Poll**: Polls `rpc.Server#getTransaction(txHash)` while `NOT_FOUND` until:
   - `SUCCESS` — returns `{ txHash, status: 'SUCCESS' }`
   - `FAILED` — throws a terminal `SorobanWriteError('transaction_failed', ...)`
   - Timeout (`pollTimeoutMs`, default `30000` ms) — stops polling and throws a retryable `SorobanWriteError('timeout', ...)`

### Write Entrypoints
- `drawCredit(lineId, amount, options?)` -> invokes contract method `draw(line_id: String, amount: i128)`
- `repayCredit(lineId, amount, options?)` -> invokes contract method `repay(line_id: String, amount: i128)`

### Idempotency
Both `DrawCreditPage` and `RepayModal` attach a deterministic `idempotencyKey` (via `src/utils/idempotency.ts`) per draft session. Concurrent or repeated submissions with the same key return the in-flight or completed `{ txHash, status }` without double-sending.

---

## 6. Bundle Footprint

Bundle metrics recorded with `@stellar/stellar-sdk` split into manual chunk `stellar`:
- `stellar` chunk: ~661 kB (~138.5 kB gzipped)
- `vendor-core` chunk: **164.11 kB (53.60 kB gzipped) — 0 growth from baseline**
