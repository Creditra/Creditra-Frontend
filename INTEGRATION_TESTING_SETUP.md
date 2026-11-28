# Integration Testing Setup for SorobanCreditDataSource

## Summary

Added opt-in integration test suite that runs against a local `stellar/quickstart` sandbox with a deployed fixture contract. The integration tests verify that `SorobanCreditDataSource` correctly decodes real ScVal output, not just mocked `rpc.Server` objects.

## Files Changed

### New Files

1. **`tests/integration/sorobanCreditDataSource.int.test.ts`**
   - Integration test suite with 7 test cases covering:
     - i128 max/min boundary values (precision loss verification)
     - Empty borrower (not_found handling)
     - Missing line ID (not_found handling)
     - Timeout behavior
     - AbortController cancellation
     - Multiple lines (order and identity preservation)
   - Uses `describe.skipIf()` to skip when env vars are unset

2. **`vitest.integration.config.ts`**
   - Separate vitest config for integration tests
   - Uses `environment: "node"` (no jsdom)
   - Includes only `tests/integration/**/*.int.test.ts`
   - 30s timeout (vs 10s for unit tests)

3. **`scripts/deploy-fixture-contract.sh`**
   - Deploys minimal Soroban fixture contract to sandbox
   - Waits for RPC server readiness
   - Builds contract with `get_lines_by_borrower` and `get_line` methods
   - Exports `SOROBAN_RPC_URL`, `NETWORK_PASSPHRASE`, `CREDIT_CONTRACT_ID`
   - Graceful fallback to test fixture if build fails

### Modified Files

1. **`vitest.config.ts`**
   - Added `exclude: ["**/tests/integration/**"]` to test config
   - Ensures `npm test` does not run integration tests

2. **`package.json`**
   - Added `"test:integration": "vitest --config vitest.integration.config.ts --run"`
   - Keeps `test` unchanged (runs default tests only)

3. **`docs/TESTING.md`**
   - Added section 4.3 "Integration (Soroban contract decoding)"
   - Added section 7 "Soroban contract integration tests" with full setup instructions
   - Documents local sandbox setup, fixture deployment, and test coverage

## Acceptance Criteria

✅ **npm run test is unchanged and green without a sandbox**
- Integration tests are excluded via `exclude` pattern in `vitest.config.ts`
- Tests skip gracefully if env vars are unset

✅ **With a sandbox running, npm run test:integration passes locally**
- Clear local setup instructions in docs/TESTING.md
- Minimal fixture contract deploys via bash script
- Three-terminal workflow documented

✅ **Script and docs let a contributor reproduce the setup in a few commands**
- `docs/TESTING.md` section 7 has copy-paste setup
- `scripts/deploy-fixture-contract.sh` is self-contained
- Includes RPC readiness check and error handling

## Local Testing

```bash
# Terminal 1: start sandbox
docker run --rm -p 8000:8000 stellar/quickstart --local --enable-soroban-rpc

# Terminal 2: deploy fixture contract
bash scripts/deploy-fixture-contract.sh

# Terminal 3: run tests
npm run test:integration
```

The deploy script exports env vars, so tests will auto-discover the contract.

## Proposed CI Workflow Job

```yaml
integration-tests:
  runs-on: ubuntu-latest
  services:
    quickstart:
      image: stellar/quickstart:latest
      options: >-
        --env QUICKSTART_SOROBAN_RPC_PORT=8000
        --publish 8000:8000
      ports:
        - 8000:8000
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: npm
    - run: npm ci
    - name: Wait for Soroban RPC
      run: |
        for i in {1..30}; do
          curl -s http://localhost:8000/soroban/rpc -X POST \
            -H "Content-Type: application/json" \
            -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger","params":[]}' \
            && echo "RPC ready" && exit 0
          sleep 1
        done
        echo "RPC server failed to start"
        exit 1
    - run: bash scripts/deploy-fixture-contract.sh
    - run: npm run test:integration
      env:
        SOROBAN_RPC_URL: http://localhost:8000/soroban/rpc
        NETWORK_PASSPHRASE: Standalone Network ; February 2017
```

## Notes

- This PR includes only non-workflow files. The maintainer will apply the CI job separately.
- Integration tests are **opt-in** — they skip gracefully when the sandbox is not running.
- The default `npm test` suite remains unchanged and runs in CI as before.
- No build output, binaries, .vscode/, or workflow changes included.
