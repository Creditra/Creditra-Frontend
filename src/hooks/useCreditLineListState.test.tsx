import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";
import { useCreditLineListState, parsePageIndex, parseSortDir, parseSortField, parseStatusFilter } from "./useCreditLineListState";

function wrapper(initialEntries: string[]) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

describe("useCreditLineListState", () => {
  it("round trips URL list params", () => {
    const { result } = renderHook(() => useCreditLineListState([]), {
      wrapper: wrapper(["/credit-lines?status=Frozen&sort=apr&dir=asc&page=2"]),
    });

    expect(result.current.statusFilter).toBe("Frozen");
    expect(result.current.sortField).toBe("apr");
    expect(result.current.sortDir).toBe("asc");
    expect(result.current.pageIndex).toBe(2);

    act(() => result.current.setListParams({ status: "all", sort: "updatedAt", dir: "desc", page: 0 }));
  });

  it("falls back for invalid params", () => {
    expect(parseSortField("wat")).toBe("updatedAt");
    expect(parseSortDir("sideways")).toBe("desc");
    expect(parseStatusFilter("wat")).toBe("all");
    expect(parsePageIndex("-3")).toBe(0);
  });
});
