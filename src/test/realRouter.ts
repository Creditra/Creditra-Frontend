/**
 * Real `react-router-dom`, for suites that need real routing semantics.
 *
 * `vitest.config.ts` aliases the bare `react-router-dom` specifier to the stub
 * in `src/test/__mocks__/react-router-dom.tsx`, so neither `vi.unmock` nor
 * `vi.importActual` can reach the real package — the alias is applied by the
 * resolver before either of them runs.  Importing through a relative path
 * (which never matches the alias key) sidesteps that.
 *
 * Usage in a suite that must exercise real routing (see `TransactionHistory`):
 *
 * ```ts
 * // Replaces the aliased stub for this file's whole module graph, so the
 * // component under test gets the same router instance as the builder below.
 * vi.mock("react-router-dom", async () => await import("../test/realRouter"));
 * ```
 *
 * Removing the global alias for the whole repository is tracked separately
 * (issue #1205 out-of-scope note); this keeps the opt-in per suite.
 */
export * from "../../node_modules/react-router-dom/dist/index.js";
