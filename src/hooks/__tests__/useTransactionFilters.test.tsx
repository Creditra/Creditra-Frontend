import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { CreditTransaction } from "../useCreditLines";
import { useTransactionFilters } from "../useTransactionFilters";

const transactions: CreditTransaction[] = [
  {
    id: "draw-1",
    type: "Draw",
    amount: 50,
    date: "2025-02-01T12:00:00.000Z",
    status: "Completed",
    lineId: "line-1",
    lineName: "Primary",
    lineStatus: "Active",
  },
  {
    id: "draw-2",
    type: "Draw",
    amount: 250,
    date: "2025-02-02T12:00:00.000Z",
    status: "Pending",
    lineId: "line-1",
    lineName: "Primary",
    lineStatus: "Active",
  },
  {
    id: "repay-1",
    type: "Repay",
    amount: 50,
    date: "2025-02-03T12:00:00.000Z",
    status: "Completed",
    lineId: "line-2",
    lineName: "Reserve",
    lineStatus: "Active",
  },
];

function createWrapper(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

describe("useTransactionFilters", () => {
  it("initializes date and amount filters from URL parameters and syncs preset changes", async () => {
    const { result } = renderHook(
      () => ({
        filters: useTransactionFilters(transactions),
        location: useLocation(),
      }),
      { wrapper: createWrapper("/transactions?range=this-week&amount=100-1000") },
    );

    await waitFor(() => {
      expect(result.current.filters.presetRange).toBe("this-week");
      expect(result.current.filters.selectedAmountRange).toBe("100-1k");
    });

    act(() => result.current.filters.syncUrl("this-month"));
    await waitFor(() => {
      expect(result.current.location.search).toBe("?range=this-month");
    });
  });

  it("combines line, type, status, and amount filters", () => {
    const { result } = renderHook(() => useTransactionFilters(transactions), {
      wrapper: createWrapper("/transactions"),
    });

    act(() => {
      result.current.setSelectedLine("line-1");
      result.current.setSelectedType("Draw");
      result.current.setSelectedStatus("Completed");
      result.current.setSelectedAmountRange("under-100");
    });

    expect(result.current.filteredTransactions.map((tx) => tx.id)).toEqual([
      "draw-1",
    ]);
  });

  it("resets filter state and removes the amount URL parameter", async () => {
    const { result, rerender } = renderHook(
      () => ({
        filters: useTransactionFilters(transactions),
        location: useLocation(),
      }),
      { wrapper: createWrapper("/transactions?amount=100-1000") },
    );

    act(() => result.current.filters.clearFilters());
    rerender();

    await waitFor(() => {
      expect(result.current.location.search).toBe("");
      expect(result.current.filters.selectedAmountRange).toBe("all");
      expect(result.current.filters.selectedLine).toBe("all");
      expect(result.current.filters.filteredTransactions).toHaveLength(3);
    });
  });
});
