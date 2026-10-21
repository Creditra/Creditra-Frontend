import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import App from "./App";
import { compareCreditLines } from "./App.credit-lines-route";

interface CreditLine {
  id: number;
  name: string;
  creditLimit?: number | null;
}

describe("credit lines route", () => {
  const localStorageMock = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  beforeEach(() => {
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();

    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
  });

  afterEach(() => {
    window.history.pushState({}, "", "/");
    vi.unstubAllGlobals();
  });

  it("renders the Credit Lines page and marks the nav link active", () => {
    window.history.pushState({}, "", "/credit-lines");

    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Credit Lines" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /page not found/i }))
      .not.toBeInTheDocument();
    const creditLinesLinks = screen.getAllByRole("link", {
      name: "Credit Lines",
    });
    expect(creditLinesLinks).toHaveLength(1);
    expect(creditLinesLinks[0]).toHaveAttribute("aria-current", "page");
  });

  it("still renders NotFound for unknown routes", () => {
    window.history.pushState({}, "", "/does-not-exist");

    render(<App />);

    expect(
      screen.getByRole("heading", { name: /page not found/i }),
    ).toBeInTheDocument();
  });
});

describe("credit line comparator is deterministic", () => {
  const baseCreditLines: CreditLine[] = [
    { id: 1, name: "Credit Line A", creditLimit: 10000 },
    { id: 2, name: "Credit Line B", creditLimit: 20000 },
    { id: 3, name: "Credit Line C", creditLimit: 30000 },
  ];

  it("sorts credit lines by credit limit ascending", () => {
    const sorted = [...baseCreditLines].sort(compareCreditLines);
    expect(sorted.map((line) => line.id)).toEqual([1, 2, 3]);
  });

  it("sorts unsorted credit lines deterministically", () => {
    const unsorted: CreditLine[] = [
      { id: 3, name: "Credit Line C", creditLimit: 30000 },
      { id: 1, name: "Credit Line A", creditLimit: 10000 },
      { id: 2, name: "Credit Line B", creditLimit: 20000 },
    ];
    const sorted = [...unsorted].sort(compareCreditLines);
    expect(sorted.map((line) => line.id)).toEqual([1, 2, 3]);
  });

  it("is stable for duplicate credit limits", () => {
    const duplicateLimits: CreditLine[] = [
      { id: 1, name: "Credit Line A", creditLimit: 10000 },
      { id: 2, name: "Credit Line B", creditLimit: 10000 },
      { id: 3, name: "Credit Line C", creditLimit: 10000 },
    ];
    const sorted = [...duplicateLimits].sort(compareCreditLines);
    expect(sorted).toEqual(duplicateLimits);
  });

  it("handles null and undefined credit limits deterministically", () => {
    const withMissing: CreditLine[] = [
      { id: 1, name: "Credit Line A", creditLimit: 10000 },
      { id: 2, name: "Credit Line B", creditLimit: null },
      { id: 3, name: "Credit Line C", creditLimit: undefined },
    ];
    const sorted = [...withMissing].sort(compareCreditLines);
    // Missing values are treated as +Infinity, so they sort after finite limits.
    expect(sorted.map((line) => line.id)).toEqual([1, 2, 3]);
  });

  it("sorts boundary credit limits without error", () => {
    const boundaryLimits: CreditLine[] = [
      { id: 1, name: "Max", creditLimit: Number.MAX_SAFE_INTEGER },
      { id: 2, name: "Min", creditLimit: Number.MIN_SAFE_INTEGER },
    ];
    const sorted = [...boundaryLimits].sort(compareCreditLines);
    expect(sorted.map((line) => line.id)).toEqual([2, 1]);
  });

  it("does not mutate the original array", () => {
    const originalOrder = baseCreditLines.map((line) => line.id);
    [...baseCreditLines].sort(compareCreditLines);
    expect(baseCreditLines.map((line) => line.id)).toEqual(originalOrder);
  });
});
