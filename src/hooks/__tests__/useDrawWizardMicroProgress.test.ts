import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDrawWizardMicroProgress } from "../useDrawWizardMicroProgress";
import type { CreditLine } from "@/types/draw-credit.types";

const line: CreditLine = {
  id: "cl-001",
  name: "Business Line of Credit",
  limit: 50000,
  available: 35000,
  utilization: 30,
  riskBand: "Standard",
  termMonths: 24,
};

describe("useDrawWizardMicroProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns four step states", () => {
    const { result } = renderHook(() =>
      useDrawWizardMicroProgress({
        selectedCreditLine: null,
        amount: 0,
        confirmationAcknowledged: false,
        isOnConfirmStep: false,
      }),
    );

    expect(result.current.steps).toHaveLength(4);
    expect(result.current.debouncedAnnouncement).toBe("");
  });

  it("debounces live-region announcements when validity changes", () => {
    const { result, rerender } = renderHook(
      (props) => useDrawWizardMicroProgress(props),
      {
        initialProps: {
          selectedCreditLine: null as CreditLine | null,
          amount: 0,
          confirmationAcknowledged: false,
          isOnConfirmStep: false,
        },
      },
    );

    rerender({
      selectedCreditLine: line,
      amount: 0,
      confirmationAcknowledged: false,
      isOnConfirmStep: false,
    });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current.debouncedAnnouncement).toBe("");

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current.debouncedAnnouncement).toMatch(/Select line:/);
  });

  it("still announces after several rapid input changes land on the same tone (issue #587)", () => {
    // Regression test: diffing consecutive *renders* (instead of debounced
    // *inputs*) meant a change's announcement was a one-render blip that
    // got wiped out by the very next render — exactly what happens while
    // typing a multi-digit amount, since each keystroke re-renders before
    // the debounce timer can fire. See the comment in
    // useDrawWizardMicroProgress.ts for the full explanation.
    const { result, rerender } = renderHook(
      (props) => useDrawWizardMicroProgress(props),
      {
        initialProps: {
          selectedCreditLine: line as CreditLine | null,
          amount: 0,
          confirmationAcknowledged: false,
          isOnConfirmStep: false,
        },
      },
    );

    // First change: draw an amount that exceeds the $35,000 available limit.
    rerender({
      selectedCreditLine: line,
      amount: 99999,
      confirmationAcknowledged: false,
      isOnConfirmStep: false,
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.debouncedAnnouncement).toMatch(
      /exceeds available credit/i,
    );

    // Simulate typing "1000" one keystroke at a time, each well within the
    // 300ms debounce window of the last.
    for (const amount of [1, 10, 100, 1000]) {
      rerender({
        selectedCreditLine: line,
        amount,
        confirmationAcknowledged: false,
        isOnConfirmStep: false,
      });
      act(() => {
        vi.advanceTimersByTime(50);
      });
    }

    // Amounts 1, 10 and 100 all land on the same "success" tone as the
    // final 1000, so only the last keystroke's settle actually matters —
    // but every keystroke reset the input debounce, so nothing should have
    // fired yet.
    expect(result.current.debouncedAnnouncement).toMatch(
      /exceeds available credit/i,
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.debouncedAnnouncement).toMatch(
      /within available credit limits/i,
    );
  });
});
