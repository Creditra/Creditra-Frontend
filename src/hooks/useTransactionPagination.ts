import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  DEFAULT_HISTORY_PAGE_SIZE,
  MAX_HISTORY_PAGE_SIZE,
  paginateByCursor,
} from "../utils/cursorPagination";
import { getCalendarGroup } from "../utils/dates";
import { now as clockNow } from "../lib/clock";
import type { CreditTransaction } from "./useCreditLines";
import type { VirtualListHandle } from "../components/VirtualList";

export const DEFAULT_VIRTUALIZE_THRESHOLD = 100;
export const ESTIMATED_ROW_HEIGHT = 64;
export const ESTIMATED_EXPANDED_ROW_HEIGHT = 260;

export function useTransactionPagination(
  transactions: CreditTransaction[],
  filterKey: string,
  pageSize = DEFAULT_HISTORY_PAGE_SIZE,
) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCursors, setPageCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const virtualListRef = useRef<VirtualListHandle>(null);
  const tableScrollContainerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  const totalPages = Math.ceil(transactions.length / pageSize);
  const previousFilterKey = useRef(filterKey);
  useEffect(() => {
    if (previousFilterKey.current === filterKey) return;
    previousFilterKey.current = filterKey;
    setCurrentPage(1);
    setPageCursors([undefined]);
    setExpandedTx(null);
  }, [filterKey]);

  const currentPageResult = useMemo(() => {
    if (pageSize > MAX_HISTORY_PAGE_SIZE) {
      const start = (currentPage - 1) * pageSize;
      const items = transactions.slice(start, start + pageSize);
      const hasNextPage = start + pageSize < transactions.length;
      return {
        items,
        nextCursor: hasNextPage ? String(start + pageSize) : null,
        hasNextPage,
      };
    }
    return paginateByCursor(transactions, {
      cursor: pageCursors[currentPage - 1],
      pageSize,
      getDate: (tx) => tx.date,
      getId: (tx) => tx.id,
    });
  }, [transactions, pageCursors, currentPage, pageSize]);

  const flatPageTransactions = useMemo(() => {
    const groups: Record<string, CreditTransaction[]> = {};
    currentPageResult.items.forEach((tx) => {
      const group = getCalendarGroup(tx.date, clockNow());
      if (!groups[group]) groups[group] = [];
      groups[group].push(tx);
    });
    return Object.values(groups).flat();
  }, [currentPageResult.items]);

  useEffect(() => {
    virtualListRef.current?.remeasure();
  }, [expandedTx]);

  useEffect(() => {
    if (focusedRowIndex !== null && focusedRowIndex >= flatPageTransactions.length) {
      setFocusedRowIndex(null);
    }
  }, [focusedRowIndex, flatPageTransactions.length]);

  const resetPage = useCallback(() => {
    setCurrentPage(1);
    setPageCursors([undefined]);
  }, []);

  const focusRowAt = useCallback((nextIndex: number) => {
    setFocusedRowIndex(nextIndex);
    virtualListRef.current?.scrollToIndex(nextIndex, { align: "auto" });
    const immediate = rowRefs.current.get(nextIndex);
    if (immediate) immediate.focus();
    else if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => rowRefs.current.get(nextIndex)?.focus());
    }
  }, []);

  const handleRowKeyDown = useCallback(
    (index: number, txId: string, event: KeyboardEvent<HTMLTableRowElement>) => {
      const count = flatPageTransactions.length;
      if (count === 0) return;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          focusRowAt(Math.min(count - 1, index + 1));
          break;
        case "ArrowUp":
          event.preventDefault();
          focusRowAt(Math.max(0, index - 1));
          break;
        case "Home":
          event.preventDefault();
          focusRowAt(0);
          break;
        case "End":
          event.preventDefault();
          focusRowAt(count - 1);
          break;
        case "PageDown":
          event.preventDefault();
          focusRowAt(Math.min(count - 1, index + 10));
          break;
        case "PageUp":
          event.preventDefault();
          focusRowAt(Math.max(0, index - 10));
          break;
        case "Enter":
        case " ":
          if (event.target === event.currentTarget) {
            event.preventDefault();
            setExpandedTx((previous) => (previous === txId ? null : txId));
          }
          break;
        default:
          break;
      }
    },
    [flatPageTransactions.length, focusRowAt],
  );

  const toggleExpand = useCallback((txId: string) => {
    setExpandedTx((previous) => (previous === txId ? null : txId));
  }, []);

  const goToPreviousPage = useCallback(() => {
    setCurrentPage((page) => Math.max(1, page - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    const nextCursor = currentPageResult.nextCursor;
    if (!nextCursor) return;
    setPageCursors((cursors) => [
      ...cursors.slice(0, currentPage),
      nextCursor,
    ]);
    setCurrentPage((page) => Math.min(totalPages, page + 1));
  }, [currentPageResult.nextCursor, currentPage, totalPages]);

  return {
    currentPage,
    setCurrentPage,
    currentPageResult,
    totalPages,
    flatPageTransactions,
    expandedTx,
    setExpandedTx,
    focusedRowIndex,
    setFocusedRowIndex,
    virtualListRef,
    tableScrollContainerRef,
    rowRefs,
    handleRowKeyDown,
    toggleExpand,
    resetPage,
    goToPreviousPage,
    goToNextPage,
  };
}
