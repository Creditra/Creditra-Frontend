import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { PropsWithChildren } from "react";
import { MOCK_CREDIT_LINES } from "../data/mockData";
import {
  parsePageIndex,
  parseSortDir,
  parseSortField,
  parseStatusFilter,
  useCreditLineListState,
} from "./useCreditLineListState";

function wrapper({ children }: PropsWithChildren) {
  return <MemoryRouter initialEntries={["/credit-lines?status=Suspended&sort=apr&dir=asc&page=0"]}>{children}</MemoryRouter>;
}

describe("useCreditLineListState", () => {
  it("round-trips URL list parameters", () => {
    const { result } = renderHook(() => useCreditLineListState(MOCK_CREDIT_LINES), { wrapper });
    expect(result.current.statusFilter).toBe("Suspended");
    expect(result.current.sortField).toBe("apr");
    expect(result.current.sortDir).toBe("asc");
    expect(result.current.pageIndex).toBe(0);

    act(() => result.current.setListParams({ status: "Active", sort: "limit", dir: "desc", page: 2 }));
  });

  it("falls back to defaults for invalid params", () => {
    expect(parseSortField("bogus")).toBe("updatedAt");
    expect(parseSortDir("sideways")).toBe("desc");
    expect(parseStatusFilter("Liquidated")).toBe("all");
    expect(parseStatusFilter(null)).toBe("all");
    expect(parsePageIndex("-2")).toBe(0);
    expect(parsePageIndex("bogus")).toBe(0);
  });

  it("derives a filtered and sorted list", () => {
    const suspendedWrapper = ({ children }: PropsWithChildren) => (
      <MemoryRouter initialEntries={["/credit-lines?status=Suspended&sort=apr&dir=asc"]}>{children}</MemoryRouter>
    );
    const { result } = renderHook(() => useCreditLineListState(MOCK_CREDIT_LINES), { wrapper: suspendedWrapper });
    expect(result.current.filteredAndSorted.every((line) => line.status === "Suspended")).toBe(true);
  });
});
