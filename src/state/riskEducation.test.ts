import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RISK_ACK_KEY,
  DEFAULT_RISK_BANNER_DISMISSED_KEY,
  GRANTFOX_RISK_EDUCATION_ACK_KEY,
} from "../constants/storageKeys";
import {
  acknowledgeRiskEducation,
  dismissRiskBanner,
  getRiskEducationState,
  needsRiskEducationNudge,
  RISK_EDUCATION_DISMISS_SNOOZE_MS,
  RISK_EDUCATION_VERSION,
  setRiskEducationState,
  shouldShowRiskBanner,
} from "./riskEducation";

const OWNER_A = "stellar:GAAA111:TESTNET";
const OWNER_B = "stellar:GBBB222:TESTNET";
const NOW = new Date("2025-06-15T12:00:00Z");

describe("riskEducation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns empty state for an empty owner without writing", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    expect(getRiskEducationState("")).toEqual({});
    setRiskEducationState("", { acknowledgedVersion: RISK_EDUCATION_VERSION });
    acknowledgeRiskEducation("", RISK_EDUCATION_VERSION);
    dismissRiskBanner("");

    expect(shouldShowRiskBanner("", RISK_EDUCATION_VERSION)).toBe(true);
    expect(needsRiskEducationNudge("", RISK_EDUCATION_VERSION)).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("persists state and acknowledges the current content version", () => {
    setRiskEducationState(OWNER_A, { dismissedAt: NOW.toISOString() });
    expect(getRiskEducationState(OWNER_A)).toEqual({ dismissedAt: NOW.toISOString() });

    acknowledgeRiskEducation(OWNER_A, RISK_EDUCATION_VERSION);

    expect(getRiskEducationState(OWNER_A)).toEqual({
      dismissedAt: NOW.toISOString(),
      acknowledgedVersion: RISK_EDUCATION_VERSION,
    });
    expect(needsRiskEducationNudge(OWNER_A, RISK_EDUCATION_VERSION)).toBe(false);
    expect(shouldShowRiskBanner(OWNER_A, RISK_EDUCATION_VERSION)).toBe(false);
  });

  it("requires acknowledgement again when the stored version is older", () => {
    setRiskEducationState(OWNER_A, {
      acknowledgedVersion: RISK_EDUCATION_VERSION - 1,
    });

    expect(needsRiskEducationNudge(OWNER_A, RISK_EDUCATION_VERSION)).toBe(true);
    expect(shouldShowRiskBanner(OWNER_A, RISK_EDUCATION_VERSION)).toBe(true);
  });

  it("hides the banner through the snooze period and shows it at exactly seven days", () => {
    dismissRiskBanner(OWNER_A);

    expect(getRiskEducationState(OWNER_A).dismissedAt).toBe(NOW.toISOString());
    expect(shouldShowRiskBanner(OWNER_A, RISK_EDUCATION_VERSION, NOW.getTime())).toBe(false);
    expect(
      shouldShowRiskBanner(
        OWNER_A,
        RISK_EDUCATION_VERSION,
        NOW.getTime() + RISK_EDUCATION_DISMISS_SNOOZE_MS - 1,
      ),
    ).toBe(false);
    expect(
      shouldShowRiskBanner(
        OWNER_A,
        RISK_EDUCATION_VERSION,
        NOW.getTime() + RISK_EDUCATION_DISMISS_SNOOZE_MS,
      ),
    ).toBe(true);
  });

  it("keeps acknowledgements isolated by wallet", () => {
    acknowledgeRiskEducation(OWNER_A, RISK_EDUCATION_VERSION);

    expect(needsRiskEducationNudge(OWNER_A, RISK_EDUCATION_VERSION)).toBe(false);
    expect(needsRiskEducationNudge(OWNER_B, RISK_EDUCATION_VERSION)).toBe(true);
    expect(getRiskEducationState(OWNER_B)).toEqual({});
  });

  it("migrates legacy flags once as a dismissal and removes them", () => {
    localStorage.setItem(DEFAULT_RISK_ACK_KEY, "true");
    localStorage.setItem(GRANTFOX_RISK_EDUCATION_ACK_KEY, "true");
    localStorage.setItem(DEFAULT_RISK_BANNER_DISMISSED_KEY, "true");

    const migrated = getRiskEducationState(OWNER_A);

    expect(migrated).toEqual({ dismissedAt: NOW.toISOString() });
    expect(migrated).not.toHaveProperty("acknowledgedVersion");
    expect(localStorage.getItem(DEFAULT_RISK_ACK_KEY)).toBeNull();
    expect(localStorage.getItem(GRANTFOX_RISK_EDUCATION_ACK_KEY)).toBeNull();
    expect(localStorage.getItem(DEFAULT_RISK_BANNER_DISMISSED_KEY)).toBeNull();
    expect(getRiskEducationState(OWNER_A)).toEqual(migrated);
    expect(getRiskEducationState(OWNER_B)).toEqual({});
  });

  it("returns empty state for corrupt stored JSON", () => {
    localStorage.setItem(`creditra.risk_education.${OWNER_A}.v1`, "{invalid");

    expect(getRiskEducationState(OWNER_A)).toEqual({});
  });

  it("handles localStorage read and write failures without throwing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(getRiskEducationState(OWNER_A)).toEqual({});
    expect(shouldShowRiskBanner(OWNER_A, RISK_EDUCATION_VERSION)).toBe(true);
    expect(needsRiskEducationNudge(OWNER_A, RISK_EDUCATION_VERSION)).toBe(true);
    expect(() => setRiskEducationState(OWNER_A, { acknowledgedVersion: 1 })).not.toThrow();
    expect(() => acknowledgeRiskEducation(OWNER_A, RISK_EDUCATION_VERSION)).not.toThrow();
    expect(() => dismissRiskBanner(OWNER_A)).not.toThrow();
  });
});
