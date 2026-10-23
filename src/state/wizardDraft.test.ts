import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveDraft, loadDraft, clearDraft, WizardDraftState } from "./wizardDraft";

describe("wizardDraft", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const mockState: WizardDraftState = {
    step: "amount",
    amount: 100,
    selectedCreditLine: {
      id: "cl_1",
      name: "Line 1",
      limit: 1000,
      available: 1000,
      utilization: 0,
      riskBand: "Prime",
      termMonths: 12
    }
  };

  it("should return null if no draft exists", () => {
    expect(loadDraft()).toBeNull();
  });

  it("should save and load a draft", () => {
    saveDraft(mockState);
    const loaded = loadDraft();
    expect(loaded).toEqual(mockState);
  });

  it("should clear the draft", () => {
    saveDraft(mockState);
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  it("should handle corrupted localStorage gracefully", () => {
    localStorage.setItem("grantfox_draw_wizard_draft", "invalid_json");
    // spy on console.error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(loadDraft()).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
