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

All Stellar/Soroban settings are resolved by a single validated module, `src/config/creditNetwork.ts`. Horizon, Soroban RPC, wallet network checks and explorer links read that one configuration, so a mismatch fails loudly instead of silently pointing different subsystems at different networks. The supported variables are documented in `.env.example`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_STELLAR_NETWORK` | No | `TESTNET` | `TESTNET` or `PUBLIC`; drives every URL and passphrase default below. |
| `VITE_HORIZON_URL` | No | network default | Horizon base URL. Must be `https:` (plain `http:` is allowed only for localhost in development). |
| `VITE_SOROBAN_RPC_URL` | No | network default | Soroban RPC endpoint. |
| `VITE_STELLAR_NETWORK_PASSPHRASE` | No | network default | Must equal the passphrase for the selected network, otherwise `ConfigError` names this variable. |
| `VITE_CREDIT_CONTRACT_ID` | Only for `soroban` | none | Deployed Creditra contract address (`C...`, 56 chars). Optional for the `mock` data source. |
| `VITE_CREDIT_DATA_SOURCE` | No | `mock` | Set to `soroban` to enable the on-chain adapter. |

The legacy passphrase names `VITE_STELLAR_NETWORK_PASSTHRASE` and `VITE_NETWORK_PASSPHRASE` are **not** read. Setting either logs a console warning; use `VITE_STELLAR_NETWORK_PASSPHRASE` instead.

### Contract-id policy

- `mock` data source: no contract id is required; the value is optional.
- `soroban` data source: `VITE_CREDIT_CONTRACT_ID` is required. `SorobanCreditDataSource` throws a `ConfigError` at construction when neither the environment nor an explicit `contractId` option supplies one.

### Network defaults

| Network | Horizon | Soroban RPC | Passphrase | Explorer |
|---|---|---|---|---|
| `TESTNET` | `https://horizon-testnet.stellar.org` | `https://soroban-testnet.stellar.org` | `Test SDF Network ; September 2015` | `https://stellar.expert/explorer/testnet` |
| `PUBLIC` | `https://horizon.stellar.org` | `https://soroban.stellar.org` | `Public Global Stellar Network ; September 2015` | `https://stellar.expert/explorer/public` |

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
| `unavailable` | Contract simulation failed | • Contract execution reverted/panicked<br>• Contract ID is not deployed on the target network<br>• Insufficient ledger state | • Verify `VITE_CREDIT_CONTRACT_ID` is correct for the active network and that `VITE_STELLAR_NETWORK` matches the deploy.<br>• Inspect error details in `cause` for Soroban host error codes (e.g. `ContractError`). |
| `invalid_response` | Malformed or incompatible ScVal returned | • Contract struct missing required fields (`limit`, `status`, etc.)<br>• Field type mismatch (e.g. non-i128 limit)<br>• Unknown `status` variant | • Confirm contract ABI matches the struct specification.<br>• Ensure contract was compiled with compatible Soroban SDK version. |
| `aborted` | Operation was aborted | • Caller aborted via `AbortSignal`<br>• Component unmounted before simulation completed | • Normal lifecycle behavior when switching views or canceling requests. No action required. |

---

## 5. Bundle Footprint

Bundle metrics recorded with `@stellar/stellar-sdk` split into manual chunk `stellar`:
- `stellar` chunk: ~661 kB (~138.5 kB gzipped)
- `vendor-core` chunk: **164.11 kB (53.60 kB gzipped) — 0 growth from baseline**
