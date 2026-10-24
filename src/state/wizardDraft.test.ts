import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DRAFT_KEY,
  MAX_AGE_MS,
  clearDraft,
  loadDraft,
  saveDraft,
} from "./wizardDraft";

const OWNER_A = "freighter:GAAA111:TESTNET";
const OWNER_B = "freighter:GBBB222:TESTNET";
const NOW = new Date("2025-02-20T12:00:00Z");

function readRawDraft(): string | null {
  return localStorage.getItem(DRAFT_KEY);
}

describe("wizardDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when no draft exists", () => {
    expect(loadDraft(OWNER_A)).toBeNull();
  });

  it("saves and restores a valid draft for the same owner", () => {
    saveDraft({ step: "amount", lineId: "cl_1", amountCents: 125000 }, OWNER_A);

    expect(loadDraft(OWNER_A)).toEqual({
      v: 1,
      owner: OWNER_A,
      savedAt: NOW.getTime(),
      step: "amount",
      lineId: "cl_1",
      amountCents: 125000,
    });
  });

  it("allows an anonymous (null-owner) draft for a disconnected session", () => {
    saveDraft({ step: "select", lineId: null, amountCents: 0 }, null);

    expect(loadDraft(null)?.step).toBe("select");
    expect(loadDraft(null)?.owner).toBeNull();
  });

  it("discards and clears a draft from a different wallet identity", () => {
    saveDraft({ step: "amount", lineId: "cl_1", amountCents: 1000 }, OWNER_A);

    expect(loadDraft(OWNER_B)).toBeNull();
    expect(readRawDraft()).toBeNull();
  });

  it("discards and clears a draft older than 30 minutes", () => {
    saveDraft({ step: "amount", lineId: "cl_1", amountCents: 1000 }, OWNER_A);

    vi.setSystemTime(new Date(NOW.getTime() + MAX_AGE_MS + 1));

    expect(loadDraft(OWNER_A)).toBeNull();
    expect(readRawDraft()).toBeNull();
  });

  it("keeps a draft that is exactly 30 minutes old", () => {
    saveDraft({ step: "amount", lineId: "cl_1", amountCents: 1000 }, OWNER_A);

    vi.setSystemTime(new Date(NOW.getTime() + MAX_AGE_MS));

    expect(loadDraft(OWNER_A)?.lineId).toBe("cl_1");
  });

  it("discards malformed JSON without throwing", () => {
    localStorage.setItem(DRAFT_KEY, "invalid_json");

    expect(() => loadDraft(OWNER_A)).not.toThrow();
    expect(loadDraft(OWNER_A)).toBeNull();
    expect(readRawDraft()).toBeNull();
  });

  it.each([
    ["wrong version", { v: 2, owner: OWNER_A, savedAt: NOW.getTime(), step: "amount", lineId: "cl_1", amountCents: 100 }],
    ["status step", { v: 1, owner: OWNER_A, savedAt: NOW.getTime(), step: "status", lineId: "cl_1", amountCents: 100 }],
    ["confirm step", { v: 1, owner: OWNER_A, savedAt: NOW.getTime(), step: "confirm", lineId: "cl_1", amountCents: 100 }],
    ["negative amount", { v: 1, owner: OWNER_A, savedAt: NOW.getTime(), step: "amount", lineId: "cl_1", amountCents: -1 }],
    ["fractional amount", { v: 1, owner: OWNER_A, savedAt: NOW.getTime(), step: "amount", lineId: "cl_1", amountCents: 1.5 }],
    ["missing line id", { v: 1, owner: OWNER_A, savedAt: NOW.getTime(), step: "amount", lineId: null, amountCents: 100 }],
    ["bad owner", { v: 1, owner: 42, savedAt: NOW.getTime(), step: "amount", lineId: "cl_1", amountCents: 100 }],
    ["bad savedAt", { v: 1, owner: OWNER_A, savedAt: "yesterday", step: "amount", lineId: "cl_1", amountCents: 100 }],
  ])("discards a draft with %s", (_label, stored) => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(stored));

    expect(loadDraft(OWNER_A)).toBeNull();
    expect(readRawDraft()).toBeNull();
  });

  it("accepts an ISO-8601 savedAt and still enforces expiry", () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        v: 1,
        owner: OWNER_A,
        savedAt: NOW.toISOString(),
        step: "amount",
        lineId: "cl_1",
        amountCents: 100,
      }),
    );

    expect(loadDraft(OWNER_A)?.savedAt).toBe(NOW.getTime());

    vi.setSystemTime(new Date(NOW.getTime() + MAX_AGE_MS + 1));
    expect(loadDraft(OWNER_A)).toBeNull();
  });

  it("discards a legacy draft containing a full selectedCreditLine object", () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        step: "confirm",
        amount: 100,
        selectedCreditLine: {
          id: "cl_1",
          name: "Line 1",
          limit: 1000,
          available: 900,
          utilization: 10,
          riskBand: "Prime",
          termMonths: 12,
        },
      }),
    );

    expect(loadDraft(null)).toBeNull();
    expect(readRawDraft()).toBeNull();
  });

  it("clears the draft explicitly", () => {
    saveDraft({ step: "amount", lineId: "cl_1", amountCents: 1000 }, OWNER_A);
    clearDraft();

    expect(loadDraft(OWNER_A)).toBeNull();
    expect(readRawDraft()).toBeNull();
  });
});
