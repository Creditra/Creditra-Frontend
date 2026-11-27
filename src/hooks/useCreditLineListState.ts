import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { compareCreditLines } from "../data/mockData";
import type { CreditLine, CreditLineStatus, SortDirection, SortField } from "../types/creditLine";

export const VALID_SORT_FIELDS = new Set<SortField>([
  "status",
  "limit",
  "utilization",
  "updatedAt",
  "apr",
  "riskScore",
]);
export const VALID_DIRECTIONS = new Set<SortDirection>(["asc", "desc"]);
export const VALID_STATUSES = new Set<CreditLineStatus>([
  "Active",
  "Suspended",
  "Defaulted",
  "Closed",
  "Frozen",
]);

export const DEFAULT_SORT_FIELD: SortField = "updatedAt";
export const DEFAULT_SORT_DIR: SortDirection = "desc";
export const DEFAULT_STATUS_FILTER: CreditLineStatus | "all" = "all";
export const DEFAULT_PAGE = 0;

export function parseSortField(raw: string | null): SortField {
  return raw && VALID_SORT_FIELDS.has(raw as SortField) ? (raw as SortField) : DEFAULT_SORT_FIELD;
}

export function parseSortDir(raw: string | null): SortDirection {
  return raw && VALID_DIRECTIONS.has(raw as SortDirection) ? (raw as SortDirection) : DEFAULT_SORT_DIR;
}

export function parseStatusFilter(raw: string | null): CreditLineStatus | "all" {
  if (!raw || raw === "all") return DEFAULT_STATUS_FILTER;
  return VALID_STATUSES.has(raw as CreditLineStatus)
    ? (raw as CreditLineStatus)
    : DEFAULT_STATUS_FILTER;
}

export function parsePageIndex(raw: string | null): number {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_PAGE;
}

const STATUS_SEVERITY: Record<CreditLineStatus, number> = {
  Defaulted: 4,
  Suspended: 3,
  Frozen: 2,
  Active: 1,
  Closed: 0,
};

export interface CreditLineListParams {
  sort?: SortField;
  dir?: SortDirection;
  status?: CreditLineStatus | "all";
  page?: number;
}

export function useCreditLineListState(lines: readonly CreditLine[] = []) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSortField = parseSortField(searchParams.get("sort"));
  const urlSortDir = parseSortDir(searchParams.get("dir"));
  const urlStatusFilter = parseStatusFilter(searchParams.get("status"));
  const urlPageIndex = parsePageIndex(searchParams.get("page"));

  const [localListState, setLocalListState] = useState(() => ({
    sort: urlSortField,
    dir: urlSortDir,
    status: urlStatusFilter,
    page: urlPageIndex,
  }));

  const searchStr = searchParams.toString();
  useEffect(() => {
    setLocalListState({
      sort: urlSortField,
      dir: urlSortDir,
      status: urlStatusFilter,
      page: urlPageIndex,
    });
  }, [searchStr, urlSortField, urlSortDir, urlStatusFilter, urlPageIndex]);

  const sortField = localListState.sort;
  const sortDir = localListState.dir;
  const statusFilter = localListState.status;
  const pageIndex = localListState.page;

  const setListParams = useCallback((updates: CreditLineListParams) => {
    const next = new URLSearchParams(searchParams);
    const newSort = updates.sort ?? sortField;
    const newDir = updates.dir ?? sortDir;
    const newStatus = updates.status ?? statusFilter;
    const newPage = updates.page ?? pageIndex;

    setLocalListState({ sort: newSort, dir: newDir, status: newStatus, page: newPage });

    if (newSort === DEFAULT_SORT_FIELD) next.delete("sort"); else next.set("sort", newSort);
    if (newDir === DEFAULT_SORT_DIR) next.delete("dir"); else next.set("dir", newDir);
    if (newStatus === DEFAULT_STATUS_FILTER) next.delete("status"); else next.set("status", newStatus);
    if (newPage === DEFAULT_PAGE) next.delete("page"); else next.set("page", String(newPage));

    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, sortField, sortDir, statusFilter, pageIndex]);

  const filteredAndSorted = useMemo(() => {
    const filtered = statusFilter === "all"
      ? lines
      : lines.filter((line) => line.status === statusFilter);

    return [...filtered].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case "status": {
          const aSev = STATUS_SEVERITY[a.status] ?? 0;
          const bSev = STATUS_SEVERITY[b.status] ?? 0;
          if (aSev !== bSev) return sortDir === "asc" ? aSev - bSev : bSev - aSev;
          return compareCreditLines(a, b);
        }
        case "limit": aVal = a.limit; bVal = b.limit; break;
        case "utilization": aVal = a.utilized / a.limit; bVal = b.utilized / b.limit; break;
        case "updatedAt": aVal = new Date(a.updatedAt).getTime(); bVal = new Date(b.updatedAt).getTime(); break;
        case "apr": aVal = a.apr; bVal = b.apr; break;
        case "riskScore": aVal = a.riskScore; bVal = b.riskScore; break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDir === "asc"
        ? aVal - (bVal as number)
        : (bVal as number) - aVal;
    });
  }, [lines, sortField, sortDir, statusFilter]);

  return {
    sortField,
    sortDir,
    statusFilter,
    pageIndex,
    sort: sortField,
    dir: sortDir,
    status: statusFilter,
    page: pageIndex,
    setListParams,
    filteredAndSorted,
  };
}

export default useCreditLineListState;
