import { afterEach, describe, expect, it, vi } from "vitest";

const ACCOUNT_KEY = "G" + "A".repeat(55);
const CONTRACT_KEY = "C" + "B".repeat(55);

async function loadDiagnostics() {
  vi.resetModules();
  return import("./diagnostics");
}

describe("diagnostics", () => {
  afterEach(() => {
    vi.doUnmock("../config/creditNetwork");
    vi.doUnmock("../services/credit/config");
  });

  it("builds a bundle with version, network, data source and timestamp", async () => {
    const { buildDiagnosticsBundle } = await loadDiagnostics();
    const bundle = buildDiagnosticsBundle();

    expect(bundle.appVersion).toBeTruthy();
    expect(bundle.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(["TESTNET", "PUBLIC", "unknown"]).toContain(bundle.network);
    expect(["mock", "soroban", "unknown"]).toContain(bundle.dataSource);
    expect(Array.isArray(bundle.recentErrors)).toBe(true);
  });

  it("keeps only the most recent 20 errors", async () => {
    const { buildDiagnosticsBundle, recordDiagnosticError } =
      await loadDiagnostics();

    for (let i = 0; i < 25; i += 1) {
      recordDiagnosticError(`error ${i}`);
    }

    const bundle = buildDiagnosticsBundle();
    expect(bundle.recentErrors).toHaveLength(20);
    expect(bundle.recentErrors[0]).toBe("error 5");
    expect(bundle.recentErrors[19]).toBe("error 24");
  });

  it("truncates long messages to 200 characters", async () => {
    const { buildDiagnosticsBundle, recordDiagnosticError } =
      await loadDiagnostics();

    recordDiagnosticError("x".repeat(500));

    expect(buildDiagnosticsBundle().recentErrors[0]).toHaveLength(200);
  });

  it("ignores empty messages", async () => {
    const { buildDiagnosticsBundle, recordDiagnosticError } =
      await loadDiagnostics();

    recordDiagnosticError("");
    recordDiagnosticError("   ");
    recordDiagnosticError(undefined);

    expect(buildDiagnosticsBundle().recentErrors).toHaveLength(0);
  });

  it("masks Stellar account and contract keys in error strings", async () => {
    const { buildDiagnosticsBundle, recordDiagnosticError } =
      await loadDiagnostics();

    recordDiagnosticError(`wallet ${ACCOUNT_KEY} failed`);
    recordDiagnosticError(`contract ${CONTRACT_KEY} failed`);

    const bundle = buildDiagnosticsBundle();
    const serialised = JSON.stringify(bundle);

    expect(serialised).not.toContain(ACCOUNT_KEY);
    expect(serialised).not.toContain(CONTRACT_KEY);
    expect(bundle.recentErrors[0]).toContain("[REDACTED]");
    expect(bundle.recentErrors[1]).toContain("[REDACTED]");
  });

  it("falls back to unknown when the network config cannot be read", async () => {
    vi.resetModules();
    vi.doMock("../config/creditNetwork", () => ({
      getCreditNetworkConfig: () => {
        throw new Error("invalid config");
      },
    }));

    const { buildDiagnosticsBundle } = await import("./diagnostics");
    expect(buildDiagnosticsBundle().network).toBe("unknown");
  });

  it("falls back to unknown when the data source cannot be read", async () => {
    vi.resetModules();
    vi.doMock("../services/credit/config", () => ({
      getCreditDataSourceType: () => {
        throw new Error("invalid data source");
      },
    }));

    const { buildDiagnosticsBundle } = await import("./diagnostics");
    expect(buildDiagnosticsBundle().dataSource).toBe("unknown");
  });
});
