import React, {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
} from "react";
import {
  Link,
  useSearchParams,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { MoreHorizontal, Copy, ExternalLink } from "lucide-react";
import { CopyToClipboard } from "../components/CopyToClipboard";
import { Amount } from "../components/Amount";
import { type DatePreset } from "../components/DateRangeChips";
import {
  AmountRangeChips,
  type AmountRangePreset,
} from "../components/AmountRangeChips";
import { useDebounceValue } from "../hooks/useDebounceValue";
import { useLedgerWorker } from "../hooks/useLedgerWorker";
import { getExplorerBaseUrl } from "../utils/wallet";
import { getCreditNetworkConfig } from "../config/creditNetwork";
import { copyTextToClipboard } from "../utils/clipboard";
import { downloadCsv } from "../utils/csv";
import {
  DEFAULT_TRANSACTION_CSV_ASSET,
} from "../lib/transaction-csv";
import {
  queryTransactions,
  type LedgerTransaction,
  type TransactionQueryFilters,
  type TransactionQueryResult,
} from "../lib/transaction-query";
import { useNotifications } from "../context/NotificationContext";
import { useCreditLines, useCreditTransactions } from "../hooks/useCreditLines";
import {
  amountPresetFromUrl,
  type AmountFilter,
} from "../utils/transactionAmountFilter";
import type {
  TransactionStatus,
  TransactionType,
} from "../types/creditLine";
import {
  getCalendarGroup,
  relativeTime as formatCalendarRelative,
} from "../utils/dates";
import { now as clockNow, nowMs as clockNowMs } from "../lib/clock";
import { COLOR, fmt, fmtDateTime } from "../utils/tokens";
import "./TransactionHistory.css";
import { NoActivity, NoDataGraph, NoLines } from "../components/illustrations";
import { TransactionHistorySkeleton } from "../components/TransactionHistorySkeleton";
import { LiveRegion } from "../components/LiveRegion";
import { KbdHint } from "../components/KbdHint";
import {
  DEFAULT_HISTORY_PAGE_SIZE,
  MAX_HISTORY_PAGE_SIZE,
  paginateByCursor,
} from "../utils/cursorPagination";
import { VirtualList, type VirtualListHandle } from "../components/VirtualList";

/**
 * TransactionHistory Page Component
 *
 * This component displays a comprehensive transaction history with advanced filtering capabilities.
 *
 * Features:
 * - Accessible filter chips for transaction type (All/Draw/Repay/Fee/Interest) using aria-pressed
 * - Accessible date range filter chips (Today/7d/30d/90d/Custom) using aria-pressed
 * - Live result count announcements via aria-live="polite" (WCAG 2.1 AA - 4.1.2)
 * - Distinct empty states:
 *   - "No transactions yet" when no data exists
 *   - "No transactions match these filters" with clear-filters action for filtered results
 * - Real-time filtering by type, date range, credit line, status, and search query
 * - Pagination with 15 items per page
 * - Expandable transaction details
 * - CSV export for the currently filtered transaction set
 * - Accessible search combobox (see Search Combobox section below)
 *
 * Accessibility:
 * - All filter chips use role="group" with aria-labelledby for proper grouping
 * - aria-pressed attribute tracks toggle state on filter buttons
 * - aria-live="polite" region announces filtered result counts
 * - aria-atomic="true" ensures full announcement of result count changes
 * - Keyboard navigation: Tab to focus, Space/Enter to toggle filters
 * - Distinct visual states for active filters using CSS selectors
 * - Export button remains keyboard reachable with a 44 px target and disabled explanation
 *
 * Search Combobox (ARIA 1.2 combobox pattern, WCAG 2.1 AA SC 4.1.2):
 * - role="combobox" on the input signals a combined text entry + popup to AT
 * - aria-expanded reflects whether the suggestion listbox is currently open
 * - aria-controls references the role="listbox" element for direct AT navigation
 * - aria-autocomplete="list" — suggestions appear in a separate popup (not inline)
 * - aria-activedescendant points to the focused role="option" without moving DOM focus
 * - Keyboard: ArrowDown/Up to navigate, Enter to commit, Escape to dismiss, Tab to close
 * - Suggestions are debounced (250 ms) to avoid over-filtering on every keystroke;
 *   the raw input value drives the visible listbox while searchQuery (the debounced
 *   value) drives filteredTransactions.
 * - The clear (✕) button meets the 44 × 44 px touch target and announces "Clear search"
 * - prefers-reduced-motion: the listbox slide-in animation is disabled
 *
 * Empty State UX:
 * - Separate rendering paths for "no lines" vs "no transactions" vs "no filtered results"
 * - Clear filters button appears only when filters are active and return 0 results
 * - Icon and messaging distinguish between data absence and filter mismatch
 */

const TX_TYPE_LABELS: Record<TransactionType, string> = {
  Draw: "Draw",
  Repay: "Repayment",
  Fee: "Fee",
  Interest: "Interest",
  StatusChange: "Status Change",
};

const TX_TYPE_ICONS: Record<TransactionType, string> = {
  Draw: "↗",
  Repay: "↙",
  Fee: "📋",
  Interest: "📈",
  StatusChange: "🔄",
};

const TX_TYPE_COLORS: Record<TransactionType, string> = {
  Draw: COLOR.accent,
  Repay: COLOR.success,
  Fee: COLOR.muted,
  Interest: COLOR.warning,
  StatusChange: "#d29922",
};

const STATUS_COLORS: Record<TransactionStatus, { bg: string; color: string }> =
  {
    Completed: { bg: "rgba(63,185,80,0.15)", color: COLOR.success },
    Pending: { bg: "rgba(210,153,34,0.15)", color: COLOR.warning },
    Failed: { bg: "rgba(248,81,73,0.15)", color: COLOR.danger },
  };

/**
 * CSS pattern classes for each transaction status.
 *
 * These classes add a pure-CSS geometric pattern on top of the coloured
 * background so that the three statuses are distinguishable without
 * relying on colour alone (WCAG 2.1 SC 1.4.1 — Use of Color).
 *
 * The classes are defined in src/styles/patterns.css and are globally
 * available via index.css.
 */
const STATUS_PATTERNS: Record<TransactionStatus, string> = {
  Completed: "tx-status-pattern--completed",
  Pending: "tx-status-pattern--pending",
  Failed: "tx-status-pattern--failed",
};

const TYPE_FILTER_OPTIONS: Array<{
  value: "all" | Exclude<TransactionType, "StatusChange">;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "Draw", label: "Draw" },
  { value: "Repay", label: "Repay" },
  { value: "Fee", label: "Fee" },
  { value: "Interest", label: "Interest" },
];

type TypeFilter = (typeof TYPE_FILTER_OPTIONS)[number]["value"];
type RangePreset = "this-week" | "this-month" | "all-time" | "custom";

const RANGE_PRESET_OPTIONS: Array<{
  value: Exclude<RangePreset, "custom">;
  label: string;
}> = [
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "all-time", label: "All Time" },
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

const relativeTime = (iso: string): string => {
  // Issue #1189: delegate to the shared calendar-aware helper.
  // Handles future timestamps ("in 3m") and "just now" correctly.
  return formatCalendarRelative(iso, clockNow());
};

const getDateGroup = (iso: string): string => {
  // Issue #1189: local calendar boundaries, with 'Upcoming' + 'Unknown date'
  // for future-dated and unparseable rows.
  return getCalendarGroup(iso, clockNow());
};

function getExplorerUrl(txHash: string): string {
  let network = "PUBLIC";
  try {
    network = getCreditNetworkConfig().network;
  } catch {
    // ConfigError on bad env — fall back to PUBLIC
  }
  return `${getExplorerBaseUrl(network)}/${encodeURIComponent(txHash)}`;
}

function TransactionHashMenu({ txHash }: { txHash: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleCopy() {
    await copyTextToClipboard(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setOpen(false);
  }

  return (
    <div
      className="tx-hash-menu-wrapper"
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="tx-hash-truncated">
        {txHash.slice(0, 8)}...{txHash.slice(-6)}
      </span>
      <button
        ref={triggerRef}
        className="tx-hash-menu-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Transaction actions"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          className="tx-hash-menu"
          role="menu"
          aria-orientation="vertical"
          aria-label="Transaction hash actions"
        >
          <button
            role="menuitem"
            className="tx-hash-menu-item"
            onClick={handleCopy}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCopy(); }
            }}
          >
            <Copy className="w-4 h-4" aria-hidden="true" />
            {copied ? "Copied!" : "Copy transaction hash"}
          </button>
          <a
            role="menuitem"
            className="tx-hash-menu-item"
            href={getExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            View on explorer
          </a>
        </div>
      )}
      {copied && (
        <span role="status" aria-live="polite" className="sr-only">
          Copied
        </span>
      )}
    </div>
  );
}

function TransactionRow({
  tx,
  expanded,
  onToggle,
  ariaRowIndex,
  tabIndex,
  rowRef,
  onFocus,
  onKeyDown,
}: {
  tx: LedgerTransaction;
  expanded: boolean;
  onToggle: () => void;
  ariaRowIndex?: number;
  tabIndex?: number;
  rowRef?: (el: HTMLTableRowElement | null) => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTableRowElement>) => void;
}) {
  const isNegative = tx.type === "Repay" || tx.type === "Fee";

  return (
    <>
      <tr
        ref={rowRef}
        className={`tx-row ${expanded ? "expanded" : ""}`}
        aria-rowindex={ariaRowIndex}
        aria-expanded={expanded}
        tabIndex={tabIndex}
        onClick={onToggle}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
      >
        <td className="tx-date">
          <div className="tx-date-main">{relativeTime(tx.date)}</div>
          <div className="tx-date-sub">
            {new Date(tx.date).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </td>
        <td className="tx-type">
          <span
            className="tx-type-badge"
            style={{
              background: `${TX_TYPE_COLORS[tx.type]}15`,
              color: TX_TYPE_COLORS[tx.type],
            }}
          >
            <span className="tx-type-icon">{TX_TYPE_ICONS[tx.type]}</span>
            {TX_TYPE_LABELS[tx.type]}
          </span>
        </td>
        <td
          className="tx-amount num-tabular"
          style={{
            color: isNegative
              ? COLOR.success
              : tx.type === "Draw"
                ? COLOR.accent
                : COLOR.text,
          }}
        >
          {isNegative ? "-" : tx.type === "Draw" ? "+" : ""}
          {isNegative || tx.amount > 0 ? (
            <Amount value={tx.amount} format={fmt} maskedLabel="Transaction amount hidden for privacy" />
          ) : null}
        </td>
        <td className="tx-line">
          <span className="tx-line-name">{tx.lineName}</span>
          <span className="tx-line-id">{tx.lineId}</span>
        </td>
        <td className="tx-status">
          <span
            className={`tx-status-badge ${STATUS_PATTERNS[tx.status]}`}
            style={{
              background: STATUS_COLORS[tx.status].bg,
              color: STATUS_COLORS[tx.status].color,
            }}
          >
            {tx.status}
          </span>
        </td>
        <td className="tx-hash">
          {tx.txHash ? (
            <TransactionHashMenu txHash={tx.txHash} />
          ) : (
            <span className="tx-hash-muted">—</span>
          )}
        </td>
        <td className="tx-expand">
          <span className={`expand-icon ${expanded ? "rotated" : ""}`}>▾</span>
        </td>
      </tr>
      {expanded && (
        <tr className="tx-detail-row">
          <td colSpan={7}>
            <div className="tx-detail">
              <div className="tx-detail-section">
                <h4>Transaction Details</h4>
                <div className="tx-detail-grid">
                  <div className="tx-detail-item">
                    <span className="label">Transaction ID</span>
                    <span className="value">{tx.id}</span>
                  </div>
                  <div className="tx-detail-item">
                    <span className="label">Date & Time</span>
                    <span className="value">{fmtDateTime(tx.date)}</span>
                  </div>
                  <div className="tx-detail-item">
                    <span className="label">Type</span>
                    <span className="value">{TX_TYPE_LABELS[tx.type]}</span>
                  </div>
                  <div className="tx-detail-item">
                    <span className="label">Amount</span>
                    <span
                      className="value num-tabular"
                      style={{
                        color: isNegative ? COLOR.success : COLOR.accent,
                      }}
                    >
                      {isNegative ? "-" : "+"}
                      <Amount value={tx.amount} format={fmt} maskedLabel="Transaction amount hidden for privacy" />
                    </span>
                  </div>
                  <div className="tx-detail-item">
                    <span className="label">Status</span>
                    <span
                      className="value"
                      style={{ color: STATUS_COLORS[tx.status].color }}
                    >
                      {tx.status}
                    </span>
                  </div>
                  <div className="tx-detail-item">
                    <span className="label">Credit Line</span>
                    <span className="value">
                      {tx.lineName} ({tx.lineId})
                    </span>
                  </div>
                  {tx.note && (
                    <div className="tx-detail-item full-width">
                      <span className="label">Note</span>
                      <span className="value">{tx.note}</span>
                    </div>
                  )}
                  {tx.txHash && (
                    <div className="tx-detail-item full-width">
                      <span className="label">Transaction Hash</span>
                      <div className="value tx-detail-hash">
                        <a
                          href={getExplorerUrl(tx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tx-hash-full"
                        >
                          {tx.txHash}
                        </a>
                        <CopyToClipboard
                          value={tx.txHash}
                          ariaLabel={`Copy full transaction hash for ${tx.id}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Stable element ID that associates the export button with its helper text. */
const CSV_EXPORT_EMPTY_REASON_ID = "csv-export-empty-reason";

/**
 * Rows rendered per page of the transaction table.
 *
 * Module-level so the first-paint skeleton can reserve exactly one page of
 * rows (issue #854) — a shorter skeleton would let the table container grow on
 * reveal and push the rest of the page down.
 */
const ITEMS_PER_PAGE = DEFAULT_HISTORY_PAGE_SIZE;
const DEFAULT_VIRTUALIZE_THRESHOLD = 100;
const LEDGER_WORKER_THRESHOLD = 2_000;
const ESTIMATED_ROW_HEIGHT = 64;
const ESTIMATED_EXPANDED_ROW_HEIGHT = 260;
const EMPTY_TRANSACTION_ROWS: LedgerTransaction[] = [];

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export interface TransactionHistoryProps {
  /** Override items per page (defaults to 15; values > 50 bypass cursor cap for large virtualized views). */
  pageSize?: number;
  /** Row count threshold at which VirtualList activates windowing (defaults to 100). */
  virtualizeThreshold?: number;
}

export function TransactionHistory({
  pageSize = ITEMS_PER_PAGE,
  virtualizeThreshold = DEFAULT_VIRTUALIZE_THRESHOLD,
}: TransactionHistoryProps = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useNotifications();
  const { lines: creditLines, status, error, refetch } = useCreditLines();
  const { transactions } = useCreditTransactions({ sort: false });

  // ─── Filter and UI State ───
  const [selectedLine, setSelectedLine] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<TypeFilter>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const [dateRange, setDateRange] = useState<DatePreset>("custom");
  const [presetRange, setPresetRange] = useState<RangePreset>("custom");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedAmountRange, setSelectedAmountRange] =
    useState<AmountRangePreset>(
      () => amountPresetFromUrl(searchParams.get("amount")) ?? "all",
    );
  const [customAmountMin, setCustomAmountMin] = useState(() =>
    searchParams.get("amount") === "gt1000" ? "1000" : "",
  );
  const [customAmountMax, setCustomAmountMax] = useState("");
  const [isCustomAmountRangeActive, setIsCustomAmountRangeActive] =
    useState(() => searchParams.get("amount") === "gt1000");
  const amountFilter = useMemo<AmountFilter>(
    () =>
      isCustomAmountRangeActive
        ? {
            kind: "custom",
            min: customAmountMin.trim() ? Number(customAmountMin) : null,
            max: customAmountMax.trim() ? Number(customAmountMax) : null,
          }
        : selectedAmountRange === "all"
          ? { kind: "all" }
          : { kind: "preset", id: selectedAmountRange },
    [isCustomAmountRangeActive, customAmountMin, customAmountMax, selectedAmountRange],
  );
  const [searchQuery, setSearchQuery] = useState("");
  // ─── Combobox (accessible search with suggestions) ───────────────────────
  // `searchInputValue` drives what the user sees while typing; `searchQuery`
  // (the debounced value) drives the actual filter so we avoid re-filtering
  // on every keystroke.
  const [searchInputValue, setSearchInputValue] = useState("");
  const debouncedSearch = useDebounceValue(searchInputValue, 250);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const SEARCH_LISTBOX_ID = "tx-search-listbox";
  const SEARCH_INPUT_ID = "tx-search-input";

  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const virtualListRef = useRef<VirtualListHandle>(null);
  const tableScrollContainerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCursors, setPageCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const itemsPerPage = pageSize;

  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const isFirstRender = useRef(true);
  const isResettingAllFilters = useRef(false);
  const prevStates = useRef({
    selectedLine,
    selectedType,
    selectedStatus,
    dateRange,
    presetRange,
    customStartDate,
    customEndDate,
    selectedAmountRange,
    isCustomAmountRangeActive,
    customAmountMin,
    customAmountMax,
    searchQuery,
    currentPage,
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const rangeParam = params.get("range");

    if (
      rangeParam === "this-week" ||
      rangeParam === "this-month" ||
      rangeParam === "all-time"
    ) {
      setPresetRange(rangeParam);
      setDateRange("custom");
      return;
    }

    setPresetRange("custom");
    const customStart = params.get("start");
    const customEnd = params.get("end");
    if (customStart) {
      setCustomStartDate(customStart);
      setDateRange("custom");
    } else {
      setCustomStartDate("");
    }
    if (customEnd) {
      setCustomEndDate(customEnd);
      setDateRange("custom");
    } else {
      setCustomEndDate("");
    }
  }, [location.search]);

  // Sync the debounced input value into the filter state and reset page.
  // This is the only place `searchQuery` (which drives filteredTransactions)
  // is updated from user input, keeping keystroke and filter concerns separate.
  useEffect(() => {
    setSearchQuery(debouncedSearch);
    setCurrentPage(1);
  }, [debouncedSearch]);

  const filterKey = JSON.stringify([
    selectedLine,
    selectedType,
    selectedStatus,
    dateRange,
    presetRange,
    customStartDate,
    customEndDate,
    selectedAmountRange,
    isCustomAmountRangeActive,
    customAmountMin,
    customAmountMax,
    searchQuery,
  ]);
  const queryKey = JSON.stringify([filterKey, searchInputValue]);
  const queryFilters = useMemo<TransactionQueryFilters>(
    () => ({
      selectedLine,
      selectedType,
      selectedStatus,
      searchQuery,
      amountFilter,
      dateRange,
      presetRange,
      customStartDate,
      customEndDate,
    }),
    [
      amountFilter,
      customEndDate,
      customStartDate,
      dateRange,
      presetRange,
      searchQuery,
      selectedLine,
      selectedStatus,
      selectedType,
    ],
  );
  const shouldUseWorker = transactions.length > LEDGER_WORKER_THRESHOLD;
  const inlineQueryResult = useMemo<TransactionQueryResult | null>(() => {
    if (shouldUseWorker) return null;
    return queryTransactions(transactions, queryFilters, {
      nowMs: clockNowMs(),
      suggestionQuery: searchInputValue,
    });
  }, [queryFilters, searchInputValue, shouldUseWorker, transactions]);
  const {
    query: queryInWorker,
    exportCsv: exportLedgerCsv,
    cancelQueries,
    isQuerying,
    isExporting,
  } = useLedgerWorker();
  const [workerQueryState, setWorkerQueryState] = useState<{
    transactions: typeof transactions;
    filterKey: string;
    suggestionQuery: string;
    result: TransactionQueryResult;
  } | null>(null);
  const [workerQueryError, setWorkerQueryError] = useState<{
    transactions: typeof transactions;
    key: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!shouldUseWorker) {
      cancelQueries();
      setWorkerQueryState(null);
      setWorkerQueryError(null);
      return;
    }

    let isCurrent = true;
    void queryInWorker(transactions, queryFilters, {
      nowMs: clockNowMs(),
      suggestionQuery: searchInputValue,
    })
      .then((result) => {
        if (!isCurrent || !result) return;
        setWorkerQueryState({
          transactions,
          filterKey,
          suggestionQuery: searchInputValue,
          result,
        });
      })
      .catch((error: unknown) => {
        if (!isCurrent || isAbortError(error)) return;
        setWorkerQueryError({
          transactions,
          key: queryKey,
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      isCurrent = false;
    };
  }, [
    cancelQueries,
    filterKey,
    queryFilters,
    queryInWorker,
    queryKey,
    searchInputValue,
    shouldUseWorker,
    transactions,
  ]);

  const activeWorkerQuery =
    workerQueryState?.transactions === transactions &&
    workerQueryState.filterKey === filterKey
      ? workerQueryState
      : null;
  const queryResult = inlineQueryResult ?? activeWorkerQuery?.result ?? null;
  const suggestions =
    inlineQueryResult?.suggestions ??
    (activeWorkerQuery?.suggestionQuery === searchInputValue
      ? activeWorkerQuery.result.suggestions
      : []);
  const hasCurrentQueryError =
    workerQueryError?.transactions === transactions &&
    workerQueryError.key === queryKey;
  const isQueryPending =
    shouldUseWorker && !activeWorkerQuery && !hasCurrentQueryError;
  const isLedgerBusy = isQuerying || isExporting || isQueryPending;
  const filteredTransactions =
    queryResult?.filteredTransactions ?? EMPTY_TRANSACTION_ROWS;
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  const previousFilterKey = useRef(filterKey);
  useEffect(() => {
    if (previousFilterKey.current === filterKey) return;
    previousFilterKey.current = filterKey;
    setCurrentPage(1);
    setPageCursors([undefined]);
    setExpandedTx(null);
  }, [filterKey]);

  const currentPageResult = useMemo(() => {
    if (itemsPerPage > MAX_HISTORY_PAGE_SIZE) {
      const start = (currentPage - 1) * itemsPerPage;
      const items = filteredTransactions.slice(start, start + itemsPerPage);
      const hasNextPage = start + itemsPerPage < filteredTransactions.length;
      return {
        items,
        nextCursor: hasNextPage ? String(start + itemsPerPage) : null,
        hasNextPage,
      };
    }
    return paginateByCursor(filteredTransactions, {
      cursor: pageCursors[currentPage - 1],
      pageSize: itemsPerPage,
      getDate: (tx) => tx.date,
      getId: (tx) => tx.id,
    });
  }, [filteredTransactions, pageCursors, currentPage, itemsPerPage]);
  const paginatedTransactions = currentPageResult.items;

  const paginatedGrouped = useMemo(() => {
    const groups: Record<string, LedgerTransaction[]> = {};
    paginatedTransactions.forEach((tx) => {
      const group = getDateGroup(tx.date);
      if (!groups[group]) groups[group] = [];
      groups[group].push(tx);
    });
    // Issue #1189: fixed display order — Upcoming first, Unknown date last.
    return groups;
  }, [paginatedTransactions]);

  const flatPageTransactions = useMemo(
    () => Object.values(paginatedGrouped).flat(),
    [paginatedGrouped],
  );

  // Re-measure row heights whenever an expandable detail row opens or closes.
  useEffect(() => {
    virtualListRef.current?.remeasure();
  }, [expandedTx]);

  // Reset focused row index if the current page shrinks below it.
  useEffect(() => {
    if (
      focusedRowIndex !== null &&
      focusedRowIndex >= flatPageTransactions.length
    ) {
      setFocusedRowIndex(null);
    }
  }, [focusedRowIndex, flatPageTransactions.length]);

  const focusRowAt = useCallback((nextIndex: number) => {
    setFocusedRowIndex(nextIndex);
    virtualListRef.current?.scrollToIndex(nextIndex, { align: "auto" });
    const immediate = rowRefs.current.get(nextIndex);
    if (immediate) {
      immediate.focus();
    } else if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        rowRefs.current.get(nextIndex)?.focus();
      });
    }
  }, []);

  const handleRowKeyDown = useCallback(
    (index: number, txId: string, e: React.KeyboardEvent<HTMLTableRowElement>) => {
      const count = flatPageTransactions.length;
      if (count === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          focusRowAt(Math.min(count - 1, index + 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          focusRowAt(Math.max(0, index - 1));
          break;
        case "Home":
          e.preventDefault();
          focusRowAt(0);
          break;
        case "End":
          e.preventDefault();
          focusRowAt(count - 1);
          break;
        case "PageDown":
          e.preventDefault();
          focusRowAt(Math.min(count - 1, index + 10));
          break;
        case "PageUp":
          e.preventDefault();
          focusRowAt(Math.max(0, index - 10));
          break;
        case "Enter":
        case " ":
          if (e.target === e.currentTarget) {
            e.preventDefault();
            setExpandedTx((prev) => (prev === txId ? null : txId));
          }
          break;
        default:
          break;
      }
    },
    [flatPageTransactions.length, focusRowAt],
  );

  const stats = useMemo(() => {
    // Outstanding balance: authoritative sum of utilized from non-Closed lines.
    // This matches the per-line balances shown on /credit-lines and the Dashboard,
    // and correctly accounts for interest, fees and partial adjustments that a
    // simple draws-minus-repays flow calculation cannot capture.
    const outstandingBalance = creditLines.filter(
      (cl) => cl.status !== "Closed",
    ).reduce((s, cl) => s + cl.utilized, 0);

    // Flow cards are scoped to filteredTransactions so their values change when
    // filters (date range, line, type) are applied — making the scope explicit.
    const completedFiltered = filteredTransactions.filter(
      (tx) => tx.status === "Completed",
    );
    const totalDrawn = completedFiltered
      .filter((tx) => tx.type === "Draw")
      .reduce((s, tx) => s + tx.amount, 0);
    const totalRepaid = completedFiltered
      .filter((tx) => tx.type === "Repay")
      .reduce((s, tx) => s + tx.amount, 0);
    // Interest & fees: both Interest and Fee rows count against the borrower.
    const totalInterestAndFees = completedFiltered
      .filter((tx) => tx.type === "Interest" || tx.type === "Fee")
      .reduce((s, tx) => s + tx.amount, 0);

    // Reconciliation: ledger net (draws − repays − fees/interest) vs outstanding balance.
    // Only meaningful when a single credit line is selected.
    const ledgerNet = totalDrawn - totalRepaid - totalInterestAndFees;

    return {
      outstandingBalance,
      totalDrawn,
      totalRepaid,
      totalInterestAndFees,
      ledgerNet,
    };
  }, [creditLines, filteredTransactions]);

  const exportDisabled =
    filteredTransactions.length === 0 || isQueryPending || hasCurrentQueryError;
  const [csvExportError, setCsvExportError] = useState<string | null>(null);

  const handleExportCsv = async () => {
    if (exportDisabled || isExporting) return;

    setCsvExportError(null);
    try {
      const { csv, filename } = await exportLedgerCsv(filteredTransactions, {
        asset: DEFAULT_TRANSACTION_CSV_ASSET,
      });

      downloadCsv(filename, csv);

      addToast({
        type: "success",
        category: "transaction",
        title: "CSV export ready",
        message: `Your filtered transaction history was downloaded as ${filename}.`,
        saveToHistory: false,
      });
    } catch (error) {
      if (isAbortError(error)) return;
      setCsvExportError(
        `CSV export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const exportToPDF = () => {
    window.print();
  };

  const handleToggleExpand = (txId: string) => {
    setExpandedTx(expandedTx === txId ? null : txId);
  };

  /**
   * Commit a suggestion by value: populate the input and close the listbox.
   * Keyboard selection (Enter) and mouse click both call this.
   */
  const commitSuggestion = useCallback((value: string) => {
    setSearchInputValue(value);
    // Force immediate filter application rather than waiting for debounce.
    setSearchQuery(value);
    setIsSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    setCurrentPage(1);
    // Note: no explicit .focus() call here — for keyboard (Enter) the input already
    // has focus, and for mouse (onMouseDown + e.preventDefault()) focus stays on the
    // input too.  A programmatic focus() would re-trigger onFocus and reopen the list.
  }, []);

  /**
   * Close the suggestions dropdown without changing the committed query.
   * Called on Escape and when focus leaves the combobox container.
   */
  const dismissSuggestions = useCallback(() => {
    setIsSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
  }, []);

  /**
   * Keyboard handler attached to the combobox input.
   * Implements the ARIA combobox keyboard interaction model:
   *   ArrowDown — open list / move active option down
   *   ArrowUp   — move active option up
   *   Enter     — commit active option (or close if none)
   *   Escape    — dismiss list, keep typed value
   *   Tab       — dismiss list, let focus move naturally
   */
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const listOpen = isSuggestionsOpen && suggestions.length > 0;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (!listOpen) {
            if (suggestions.length > 0) setIsSuggestionsOpen(true);
            return;
          }
          setActiveSuggestionIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0,
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          if (!listOpen) return;
          setActiveSuggestionIndex((prev) =>
            prev <= 0 ? suggestions.length - 1 : prev - 1,
          );
          break;

        case "Enter":
          if (listOpen && activeSuggestionIndex >= 0) {
            e.preventDefault();
            commitSuggestion(suggestions[activeSuggestionIndex]);
          }
          break;

        case "Escape":
          if (listOpen) {
            e.preventDefault();
            dismissSuggestions();
          }
          break;

        case "Tab":
          dismissSuggestions();
          break;

        default:
          break;
      }
    },
    [
      isSuggestionsOpen,
      suggestions,
      activeSuggestionIndex,
      commitSuggestion,
      dismissSuggestions,
    ],
  );

  const hasLines = creditLines.length > 0;
  const hasTransactions = transactions.length > 0;

  const hasActiveFilters =
    selectedLine !== "all" ||
    selectedType !== "all" ||
    selectedStatus !== "all" ||
    selectedAmountRange !== "all" ||
    isCustomAmountRangeActive ||
    dateRange !== "custom" ||
    customStartDate.length > 0 ||
    customEndDate.length > 0 ||
    searchInputValue.trim().length > 0;

  const resultCountText = isQueryPending
    ? "Updating transaction results…"
    : hasCurrentQueryError
      ? "Transaction results could not be updated."
      : `${filteredTransactions.length} ${filteredTransactions.length === 1 ? "transaction" : "transactions"} shown`;

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevStates.current = {
        selectedLine,
        selectedType,
        selectedStatus,
        dateRange,
        presetRange,
        customStartDate,
        customEndDate,
        selectedAmountRange,
        isCustomAmountRangeActive,
        customAmountMin,
        customAmountMax,
        searchQuery,
        currentPage,
      };
      return;
    }

    const wasResettingAllFilters = isResettingAllFilters.current;
    isResettingAllFilters.current = false;

    let message = "";

    if (wasResettingAllFilters) {
      message = `Filters cleared. ${resultCountText}.`;
    } else if (currentPage !== prevStates.current.currentPage) {
      message = `Page ${currentPage} of ${totalPages} loaded. ${resultCountText}.`;
    } else if (selectedType !== prevStates.current.selectedType) {
      const typeLabel =
        selectedType === "all" ? "All" : TX_TYPE_LABELS[selectedType];
      message = `Filtered by transaction type ${typeLabel}. ${resultCountText}.`;
    } else if (selectedLine !== prevStates.current.selectedLine) {
      const lineLabel =
        selectedLine === "all"
          ? "All"
          : creditLines.find((cl) => cl.id === selectedLine)?.name ||
            selectedLine;
      message = `Filtered by credit line ${lineLabel}. ${resultCountText}.`;
    } else if (selectedStatus !== prevStates.current.selectedStatus) {
      message = `Filtered by status ${selectedStatus === "all" ? "All" : selectedStatus}. ${resultCountText}.`;
    } else if (selectedAmountRange !== prevStates.current.selectedAmountRange) {
      const rangeLabels: Record<string, string> = {
        all: "All",
        "under-100": "Under $100",
        "100-1k": "$100 to $1k",
        "1k-5k": "$1k to $5k",
        "5k-25k": "$5k to $25k",
        "25k-plus": "$25k and over",
      };
      const rangeLabel =
        rangeLabels[selectedAmountRange] || selectedAmountRange;
      message = `Filtered by amount range ${rangeLabel}. ${resultCountText}.`;
    } else if (
      isCustomAmountRangeActive !==
        prevStates.current.isCustomAmountRangeActive ||
      customAmountMin !== prevStates.current.customAmountMin ||
      customAmountMax !== prevStates.current.customAmountMax
    ) {
      if (isCustomAmountRangeActive) {
        const minVal = customAmountMin ? `$${customAmountMin}` : "any";
        const maxVal = customAmountMax ? `$${customAmountMax}` : "any";
        message = `Custom amount range filter applied: ${minVal} to ${maxVal}. ${resultCountText}.`;
      } else if (prevStates.current.isCustomAmountRangeActive) {
        message = `Custom amount range filter cleared. ${resultCountText}.`;
      }
    } else if (
      dateRange !== prevStates.current.dateRange ||
      presetRange !== prevStates.current.presetRange ||
      customStartDate !== prevStates.current.customStartDate ||
      customEndDate !== prevStates.current.customEndDate
    ) {
      if (presetRange !== "custom") {
        const presetLabels: Record<string, string> = {
          "this-week": "This Week",
          "this-month": "This Month",
          "all-time": "All Time",
        };
        message = `Filtered by date preset ${presetLabels[presetRange] || presetRange}. ${resultCountText}.`;
      } else if (dateRange !== "custom") {
        const dateLabels: Record<string, string> = {
          today: "Today",
          "7d": "Last 7 days",
          "30d": "Last 30 days",
          "90d": "Last 90 days",
        };
        message = `Filtered by date preset ${dateLabels[dateRange] || dateRange}. ${resultCountText}.`;
      } else if (customStartDate || customEndDate) {
        const startVal = customStartDate || "any";
        const endVal = customEndDate || "any";
        message = `Filtered by custom date range from ${startVal} to ${endVal}. ${resultCountText}.`;
      } else {
        message = `Date filter cleared. ${resultCountText}.`;
      }
    } else if (searchQuery !== prevStates.current.searchQuery) {
      if (searchQuery) {
        message = `Search query "${searchQuery}" applied. ${resultCountText}.`;
      } else {
        message = `Search query cleared. ${resultCountText}.`;
      }
    }

    prevStates.current = {
      selectedLine,
      selectedType,
      selectedStatus,
      dateRange,
      presetRange,
      customStartDate,
      customEndDate,
      selectedAmountRange,
      isCustomAmountRangeActive,
      customAmountMin,
      customAmountMax,
      searchQuery,
      currentPage,
    };

    if (message) {
      setLiveAnnouncement(message);
    }
  }, [
    selectedLine,
    selectedType,
    selectedStatus,
    dateRange,
    presetRange,
    customStartDate,
    customEndDate,
    selectedAmountRange,
    isCustomAmountRangeActive,
    customAmountMin,
    customAmountMax,
    searchQuery,
    currentPage,
    resultCountText,
    totalPages,
    hasActiveFilters,
  ]);

  /**
   * Accessible table caption (A11Y-004).
   *
   * Describes the table's current scope to screen-reader users.  The text is
   * visually hidden via `.sr-only` but fully announced when the user navigates
   * to the table.  It updates whenever the active filters change so the caption
   * always reflects what is actually shown.
   *
   * Composition:
   *   "Transaction history[, filtered by <type>][, <dateLabel>][, matching "<query>"]
   *    — <n> result(s)"
   */
  const tableCaption = useMemo(() => {
    const parts: string[] = [];

    if (selectedType !== "all") {
      parts.push(
        `filtered by ${TX_TYPE_LABELS[selectedType as TransactionType]}`,
      );
    }

    const dateLabels: Record<string, string> = {
      today: "today",
      "7d": "last 7 days",
      "30d": "last 30 days",
      "90d": "last 90 days",
    };
    if (dateRange !== "custom" && dateLabels[dateRange]) {
      parts.push(dateLabels[dateRange]);
    } else if (dateRange === "custom" && (customStartDate || customEndDate)) {
      const from = customStartDate || "any";
      const to = customEndDate || "any";
      parts.push(`from ${from} to ${to}`);
    }

    if (selectedStatus !== "all") {
      parts.push(`status: ${selectedStatus}`);
    }

    if (searchInputValue.trim()) {
      parts.push(`matching "${searchInputValue.trim()}"`);
    }

    const count = filteredTransactions.length;
    const suffix = `— ${count} ${count === 1 ? "result" : "results"}`;

    const scope = parts.length > 0 ? `, ${parts.join(", ")}` : "";
    return `Transaction history${scope} ${suffix}`;
  }, [
    selectedType,
    dateRange,
    customStartDate,
    customEndDate,
    selectedStatus,
    searchInputValue,
    filteredTransactions.length,
  ]);

  /**
   * Clear all active filters and return to initial state.
   * Called when user clicks "Clear filters" in the no-results empty state.
   * Also clears expanded transaction details and resets to page 1.
   */
  const syncUrl = (nextPreset: RangePreset, start = "", end = "") => {
    const params = new URLSearchParams(location.search);
    if (nextPreset === "custom") {
      if (start) {
        params.set("start", start);
      } else {
        params.delete("start");
      }
      if (end) {
        params.set("end", end);
      } else {
        params.delete("end");
      }
      if (params.get("range")) {
        params.delete("range");
      }
    } else {
      params.set("range", nextPreset);
      params.delete("start");
      params.delete("end");
    }

    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  };

  const clearFilters = () => {
    isResettingAllFilters.current = true;
    setSelectedLine("all");
    setSelectedType("all");
    setSelectedStatus("all");
    setDateRange("custom");
    setPresetRange("custom");
    setCustomStartDate("");
    setCustomEndDate("");
    setSelectedAmountRange("all");
    setCustomAmountMin("");
    setCustomAmountMax("");
    setIsCustomAmountRangeActive(false);
    setSearchQuery("");
    setSearchInputValue("");
    setIsSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    setCurrentPage(1);
    setExpandedTx(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("amount");
      return next;
    });
  };

  if (status === "loading") {
    /*
     * The skeleton mirrors this page's own DOM and class names, so its
     * geometry is driven by TransactionHistory.css rather than a parallel
     * stylesheet (issue #854).  `rows` is passed explicitly so the placeholder
     * table reserves a full page and the reveal does not resize the container.
     */
    return <TransactionHistorySkeleton rows={ITEMS_PER_PAGE} />;
  }

  if (status === "error") {
    return (
      <div className="transaction-history-page">
        <div role="alert" className="th-error-card">
          <p>{error?.message ?? "Unable to load transactions."}</p>
          <button type="button" onClick={() => void refetch().catch(() => undefined)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!hasLines || status === "idle") {
    return (
      <div className="transaction-history-page">
        <div className="th-header">
          <div>
            <h1>Transaction History</h1>
            <p className="subtitle">Track all your credit activity</p>
          </div>
        </div>
        <div className="empty-state">
          <NoLines className="empty-state-illustration--muted" />
          <h2>No credit lines yet</h2>
          <p>
            You need an active credit line to view transaction history. Start by
            requesting a credit evaluation.
          </p>
          <Link to="/open-credit" className="empty-state-btn">
            Request Credit Evaluation
          </Link>
        </div>
      </div>
    );
  }

  if (!hasTransactions) {
    return (
      <div className="transaction-history-page">
        <div className="th-header">
          <div>
            <h1>Transaction History</h1>
            <p className="subtitle">Track all your credit activity</p>
          </div>
        </div>
        <div className="empty-state">
          <NoActivity className="empty-state-illustration--muted" />
          <h2>No transactions yet</h2>
          <p>
            Your draws, repayments, fees, and interest activity will appear here
            once your credit lines have activity.
          </p>
          <Link to="/credit-lines" className="empty-state-btn">
            View Credit Lines
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-history-page">
      <div className="th-header">
        <div>
          <h1>Transaction History</h1>
          <p className="subtitle">Track all your credit activity</p>
        </div>
        <div className="th-header-actions">
          <div className="export-actions">
            <button
              type="button"
              className="export-btn"
              onClick={handleExportCsv}
              disabled={exportDisabled || isExporting}
              aria-busy={isExporting}
              aria-describedby={
                exportDisabled ? CSV_EXPORT_EMPTY_REASON_ID : undefined
              }
            >
              <span aria-hidden="true">📥</span>
              {isExporting ? "Preparing CSV…" : "Export CSV"}
            </button>
            <button
              type="button"
              className="export-btn export-btn-secondary"
              onClick={exportToPDF}
            >
              <span aria-hidden="true">📑</span>
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <p id={CSV_EXPORT_EMPTY_REASON_ID} className="th-export-help">
        {csvExportError
          ? <span role="alert">{csvExportError}</span>
          : isQueryPending
            ? "Export CSV is unavailable while transaction results are updating."
            : hasCurrentQueryError
              ? "Export CSV is unavailable because transaction results could not be updated."
              : filteredTransactions.length === 0
                ? "Export CSV is unavailable because the current filters do not match any transactions."
                : ""}
      </p>

      <div className="th-stats">
        {/* Outstanding balance — derived from authoritative line balances, not flow math */}
        <div className="th-stat-card">
          <span
            className="th-stat-icon"
            style={{ background: "rgba(248,81,73,0.12)", color: COLOR.danger }}
          >
            💳
          </span>
          <div className="th-stat-content">
            <span className="th-stat-label">Outstanding Balance</span>
            <span
              className="th-stat-value num-tabular"
              style={{
                color:
                  stats.outstandingBalance > 0 ? COLOR.danger : COLOR.success,
              }}
            >
              <Amount
                value={stats.outstandingBalance > 0 ? stats.outstandingBalance : 0}
                format={fmt}
                maskedLabel="Outstanding balance hidden for privacy"
              />
            </span>
          </div>
        </div>

        {/* Flow cards — scoped to the current filter selection */}
        <div className="th-stat-card">
          <span
            className="th-stat-icon"
            style={{ background: "rgba(88,166,255,0.12)", color: COLOR.accent }}
          >
            ↗
          </span>
          <div className="th-stat-content">
            <span className="th-stat-label">
              Total Drawn
              <span className="th-stat-scope"> in selected range</span>
            </span>
            <span
              className="th-stat-value num-tabular"
              style={{ color: COLOR.accent }}
            >
              <Amount value={stats.totalDrawn} format={fmt} maskedLabel="Total drawn hidden for privacy" />
            </span>
          </div>
        </div>
        <div className="th-stat-card">
          <span
            className="th-stat-icon"
            style={{ background: "rgba(63,185,80,0.12)", color: COLOR.success }}
          >
            ↙
          </span>
          <div className="th-stat-content">
            <span className="th-stat-label">
              Total Repaid
              <span className="th-stat-scope"> in selected range</span>
            </span>
            <span
              className="th-stat-value num-tabular"
              style={{ color: COLOR.success }}
            >
              <Amount value={stats.totalRepaid} format={fmt} maskedLabel="Total repaid hidden for privacy" />
            </span>
          </div>
        </div>
        <div className="th-stat-card">
          <span
            className="th-stat-icon"
            style={{
              background: "rgba(210,153,34,0.12)",
              color: COLOR.warning,
            }}
          >
            📈
          </span>
          <div className="th-stat-content">
            <span className="th-stat-label">
              Interest &amp; Fees
              <span className="th-stat-scope"> in selected range</span>
            </span>
            <span
              className="th-stat-value num-tabular"
              style={{ color: COLOR.warning }}
            >
              <Amount value={stats.totalInterestAndFees} format={fmt} maskedLabel="Interest and fees hidden for privacy" />
            </span>
          </div>
        </div>

        {/* Reconciliation hint — visible only when a single credit line is filtered */}
        {selectedLine !== "all" && (() => {
          const line = creditLines.find((cl) => cl.id === selectedLine);
          if (!line) return null;
          const diff = stats.ledgerNet - line.utilized;
          if (diff === 0) return null;
          const absDiff = Math.abs(diff);
          return (
            <div
              className="th-stat-card th-stat-card--reconciliation"
              title="The ledger net (draws − repays − fees/interest in the selected range) differs from the authoritative line balance. The gap is caused by transactions outside the selected date range, accrued interest, adjustments, or rounding."
            >
              <span
                className="th-stat-icon"
                style={{
                  background: "rgba(139,148,158,0.12)",
                  color: COLOR.muted,
                }}
              >
                ⚖
              </span>
              <div className="th-stat-content">
                <span className="th-stat-label">
                  Ledger net vs balance
                  <span className="th-stat-scope"> ⓘ</span>
                </span>
                <span
                  className="th-stat-value num-tabular"
                  style={{ color: COLOR.muted }}
                >
                  {diff > 0 ? "+" : "−"}
                  <Amount value={absDiff} format={fmt} maskedLabel="Balance difference hidden for privacy" />{" "}
                  <span style={{ fontSize: "0.75em" }}>difference</span>
                </span>
                <span className="th-stat-hint">
                  interest / fees / adjustments outside range
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="th-filters">
        <div className="th-filter-group">
          <label>Credit Line</label>
          <select
            value={selectedLine}
            onChange={(e) => {
              setSelectedLine(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Credit Lines</option>
            {creditLines.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}
              </option>
            ))}
          </select>
        </div>

        <div className="th-filter-group th-filter-group-wide">
          <span className="th-filter-label" id="transaction-type-filter-label">
            Type
          </span>
          <div
            className="th-chip-group"
            role="group"
            aria-labelledby="transaction-type-filter-label"
          >
            {TYPE_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="th-filter-chip"
                aria-pressed={selectedType === option.value}
                onClick={() => {
                  setSelectedType(option.value);
                  setCurrentPage(1);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="th-filter-group">
          <label>Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        <div className="th-filter-group th-filter-group-wide">
          <div className="th-subgroup">
            <span
              className="th-filter-label"
              id="transaction-range-filter-label"
            >
              Presets
            </span>
            <div
              className="th-chip-group"
              role="group"
              aria-labelledby="transaction-range-filter-label"
            >
              {RANGE_PRESET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="th-filter-chip"
                  aria-pressed={presetRange === option.value}
                  onClick={() => {
                    const nextPreset = option.value;
                    setPresetRange(nextPreset);
                    setDateRange("custom");
                    setCustomStartDate("");
                    setCustomEndDate("");
                    setCurrentPage(1);
                    syncUrl(nextPreset);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="th-subgroup">
            <span
              className="th-filter-label"
              id="transaction-date-filter-label"
            >
              Date Range
            </span>
            <div
              className="th-chip-group"
              role="group"
              aria-labelledby="transaction-date-filter-label"
            >
              {[
                { value: "today" as DatePreset, label: "Today" },
                { value: "7d" as DatePreset, label: "7d" },
                { value: "30d" as DatePreset, label: "30d" },
                { value: "90d" as DatePreset, label: "90d" },
                { value: "custom" as DatePreset, label: "Custom" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="th-filter-chip"
                  aria-pressed={
                    presetRange === "custom" && dateRange === option.value
                  }
                  onClick={() => {
                    setPresetRange("custom");
                    setDateRange(option.value);
                    setCurrentPage(1);
                    if (option.value === "custom") {
                      syncUrl("custom", customStartDate, customEndDate);
                    } else {
                      setCustomStartDate("");
                      setCustomEndDate("");
                      syncUrl("custom");
                    }
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {dateRange === "custom" && (
            <div className="date-range-custom-fields">
              <label className="date-range-custom-field">
                <span>Start date</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(event) => {
                    setDateRange("custom");
                    setPresetRange("custom");
                    setCustomStartDate(event.target.value);
                    setCurrentPage(1);
                    syncUrl("custom", event.target.value, customEndDate);
                  }}
                  max={customEndDate || undefined}
                />
              </label>
              <label className="date-range-custom-field">
                <span>End date</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(event) => {
                    setDateRange("custom");
                    setPresetRange("custom");
                    setCustomEndDate(event.target.value);
                    setCurrentPage(1);
                    syncUrl("custom", customStartDate, event.target.value);
                  }}
                  min={customStartDate || undefined}
                />
              </label>
            </div>
          )}
        </div>
        <div className="th-filter-group th-filter-group-wide">
          <AmountRangeChips
            selectedPreset={selectedAmountRange}
            customMin={customAmountMin}
            customMax={customAmountMax}
            isCustomActive={isCustomAmountRangeActive}
            onPresetChange={(preset) => {
              setSelectedAmountRange(preset);
              setCustomAmountMin("");
              setCustomAmountMax("");
              setIsCustomAmountRangeActive(false);
              setCurrentPage(1);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (preset === "all") next.delete("amount");
                else next.set("amount", preset);
                return next;
              });
            }}
            onCustomRangeApply={({ min, max }) => {
              setSelectedAmountRange("all");
              setCustomAmountMin(min === null ? "" : String(min));
              setCustomAmountMax(max === null ? "" : String(max));
              setIsCustomAmountRangeActive(true);
              setCurrentPage(1);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete("amount");
                return next;
              });
            }}
            onCustomRangeClear={() => {
              setSelectedAmountRange("all");
              setCustomAmountMin("");
              setCustomAmountMax("");
              setIsCustomAmountRangeActive(false);
              setCurrentPage(1);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete("amount");
                return next;
              });
            }}
          />
        </div>
        {/*
         * ─── Accessible Search Combobox ──────────────────────────────────────
         *
         * Implements the ARIA 1.2 "combobox" pattern (single-select list):
         *   - role="combobox" on the <input> signals a combined text entry +
         *     popup to assistive technology.
         *   - aria-expanded tracks whether the suggestion listbox is open.
         *   - aria-controls points to the listbox element so AT can navigate
         *     directly to options.
         *   - aria-autocomplete="list" indicates that completion suggestions
         *     appear in a separate element (the listbox) rather than inline.
         *   - aria-activedescendant carries the ID of the currently focused
         *     option so screen readers announce it without moving DOM focus
         *     away from the input.
         *
         * Keyboard model (WCAG 2.1 SC 2.1.1):
         *   ArrowDown / ArrowUp — move active suggestion
         *   Enter               — commit highlighted suggestion
         *   Escape              — dismiss listbox, keep current query
         *   Tab                 — dismiss listbox, advance focus naturally
         *
         * The outer div is given role="none" so the containing filter group
         * structure is preserved; `onBlur` uses `relatedTarget` to detect when
         * focus moves entirely outside the combobox widget.
         */}
        <div
          className="th-search-group"
          onBlur={(e) => {
            // Dismiss only if focus moves outside the entire combobox widget
            // (input + listbox). Using currentTarget captures the container.
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              dismissSuggestions();
            }
          }}
        >
          <div className="th-search-label-row">
            <label htmlFor={SEARCH_INPUT_ID} className="th-filter-label">
              Search
            </label>
            <div
              className="th-search-shortcuts"
              role="group"
              aria-label="Search keyboard shortcuts"
            >
              <KbdHint
                keys={["↑", "↓"]}
                label="Navigate"
                description="Use Arrow Up and Arrow Down to navigate search suggestions"
              />
              <KbdHint
                keys="Enter"
                label="Select"
                description="Press Enter to select the active search suggestion"
              />
              <KbdHint
                keys="Esc"
                label="Close"
                description="Press Escape to close search suggestions"
              />
            </div>
          </div>
          {/* combobox wrapper — positions the floating listbox */}
          <div className="th-search-combobox">
            <input
              ref={searchInputRef}
              id={SEARCH_INPUT_ID}
              type="text"
              role="combobox"
              aria-label="Search transactions"
              aria-expanded={isSuggestionsOpen && suggestions.length > 0}
              aria-controls={SEARCH_LISTBOX_ID}
              aria-autocomplete="list"
              aria-activedescendant={
                activeSuggestionIndex >= 0
                  ? `tx-suggestion-${activeSuggestionIndex}`
                  : undefined
              }
              placeholder="Search by note, line, ID, or hash…"
              value={searchInputValue}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                const val = e.target.value;
                setSearchInputValue(val);
                // Open the listbox whenever there is input; the suggestions
                // useMemo will compute the correct list on the next render.
                setIsSuggestionsOpen(val.trim().length > 0);
                setActiveSuggestionIndex(-1);
              }}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => {
                if (searchInputValue.trim() && suggestions.length > 0) {
                  setIsSuggestionsOpen(true);
                }
              }}
            />

            {/* Clear button — only visible when query is non-empty */}
            {searchInputValue && (
              <button
                type="button"
                className="th-search-clear"
                aria-label="Clear search"
                tabIndex={0}
                onClick={() => {
                  setSearchInputValue("");
                  setSearchQuery("");
                  setIsSuggestionsOpen(false);
                  setActiveSuggestionIndex(-1);
                  setCurrentPage(1);
                  searchInputRef.current?.focus();
                }}
              >
                ✕
              </button>
            )}

            {/*
             * Suggestion listbox
             *
             * Hidden when no query is typed or suggestions list is empty.
             * Always present in the DOM (display:none via CSS) so
             * aria-controls always resolves to a valid element.
             */}
            <ul
              ref={listboxRef}
              id={SEARCH_LISTBOX_ID}
              role="listbox"
              aria-label="Search suggestions"
              className={`th-search-listbox${isSuggestionsOpen && suggestions.length > 0 ? " th-search-listbox--open" : ""}`}
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion}
                  id={`tx-suggestion-${index}`}
                  role="option"
                  aria-selected={index === activeSuggestionIndex}
                  className={`th-search-option${index === activeSuggestionIndex ? " th-search-option--active" : ""}`}
                  // Use onMouseDown (not onClick) so the event fires before the
                  // input's onBlur, preventing premature listbox dismissal.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitSuggestion(suggestion);
                  }}
                >
                  <span className="th-search-option-icon" aria-hidden="true">
                    🔍
                  </span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className="th-filter-results"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-busy={isLedgerBusy}
        >
          {resultCountText}
        </div>
      </div>

      <div
        ref={tableScrollContainerRef}
        aria-busy={isLedgerBusy}
        className={`th-table-container${
          flatPageTransactions.length >= virtualizeThreshold
            ? " th-table-container--virtualized"
            : ""
        }`}
      >
        {isQueryPending ? (
          <div className="empty-state" role="status" aria-live="polite">
            <h2>Updating transaction results</h2>
            <p>Your current filters are being applied.</p>
          </div>
        ) : hasCurrentQueryError ? (
          <div className="empty-state" role="alert">
            <h2>Unable to update transaction results</h2>
            <p>{workerQueryError?.message ?? "The background task failed."}</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="empty-state" role="status" aria-live="polite">
            <NoDataGraph className="empty-state-illustration--muted" />
            <h2>No transactions found</h2>
            <p>
              We couldn't find any transactions matching your current filters.
              Try another transaction type, date range, or search term.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="empty-state-btn"
                onClick={clearFilters}
                aria-label="Reset all filters to view transaction history"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <table
              className="th-table"
              aria-rowcount={flatPageTransactions.length + 1}
            >
              <caption className="sr-only">{tableCaption}</caption>
              <thead>
                <tr aria-rowindex={1}>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Credit Line</th>
                  <th>Status</th>
                  <th>Hash</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <VirtualList
                  ref={virtualListRef}
                  mode="table"
                  columnCount={7}
                  items={flatPageTransactions}
                  estimateSize={(_idx, tx) =>
                    expandedTx === tx.id
                      ? ESTIMATED_EXPANDED_ROW_HEIGHT
                      : ESTIMATED_ROW_HEIGHT
                  }
                  overscan={5}
                  threshold={virtualizeThreshold}
                  scrollContainerRef={tableScrollContainerRef}
                  pinnedIndex={focusedRowIndex}
                  ariaRowIndexOffset={2}
                  getItemKey={(tx) => tx.id}
                  renderItem={(tx, index, { measureRef, ariaRowIndex }) => (
                    <TransactionRow
                      tx={tx}
                      expanded={expandedTx === tx.id}
                      onToggle={() => handleToggleExpand(tx.id)}
                      ariaRowIndex={ariaRowIndex}
                      tabIndex={
                        focusedRowIndex === index ||
                        (focusedRowIndex === null && index === 0)
                          ? 0
                          : -1
                      }
                      rowRef={(el) => {
                        if (el) {
                          rowRefs.current.set(index, el);
                        } else {
                          rowRefs.current.delete(index);
                        }
                        measureRef(el);
                      }}
                      onFocus={() => setFocusedRowIndex(index)}
                      onKeyDown={(e) => handleRowKeyDown(index, tx.id, e)}
                    />
                  )}
                />
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="th-pagination">
                <button
                  className="th-page-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className="th-page-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="th-page-btn"
                  onClick={() => {
                    if (!currentPageResult.nextCursor) return;
                    setPageCursors((cursors) => [
                      ...cursors.slice(0, currentPage),
                      currentPageResult.nextCursor as string,
                    ]);
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                  }}
                  disabled={
                    currentPage === totalPages || !currentPageResult.hasNextPage
                  }
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <LiveRegion message={liveAnnouncement} />
    </div>
  );
}
