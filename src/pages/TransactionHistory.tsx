import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Link, useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { CopyToClipboard } from "../components/CopyToClipboard";
import { DateRangeChips, type DatePreset } from "../components/DateRangeChips";
import { AmountRangeChips, type AmountRangePreset } from "../components/AmountRangeChips";
import { useDebounceValue } from "../hooks/useDebounceValue";
import { toCsv, downloadCsv } from "../utils/csv";
import { useNotifications } from "../context/NotificationContext";
import { MOCK_CREDIT_LINES } from "../data/mockData";
import type {
  CreditLineStatus,
  TransactionStatus,
  TransactionType,
} from "../types/creditLine";
import { startOfDay, startOfMonth, startOfWeek } from "../utils/dates";
import { COLOR, fmt, fmtDate, fmtDateTime } from "../utils/tokens";
import "./TransactionHistory.css";
import { NoActivity, NoDataGraph, NoLines } from "../components/illustrations";
import { TransactionHistorySkeleton } from "../components/TransactionHistorySkeleton";
import { LiveRegion } from "../components/LiveRegion";
import { KbdHint } from "../components/KbdHint";

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

interface TransactionWithLine {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  note?: string;
  status: TransactionStatus;
  txHash?: string;
  lineId: string;
  lineName: string;
  lineStatus: CreditLineStatus;
}

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

const RANGE_PRESET_OPTIONS: Array<{ value: Exclude<RangePreset, "custom">; label: string }> = [
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "all-time", label: "All Time" },
];

const AMOUNT_RANGE_PRESET_BOUNDS: Record<
  Exclude<AmountRangePreset, "all">,
  { min?: number; max?: number }
> = {
  "under-5k": { max: 5000 },
  "5k-25k": { min: 5000, max: 25000 },
  "25k-plus": { min: 25000 },
};

const AMOUNT_FILTER_OPTIONS: Array<{
  value: "all" | "lt100" | "100-1000" | "gt1000";
  label: string;
}> = [
    { value: "all", label: "All Amounts" },
    { value: "lt100", label: "<$100" },
    { value: "100-1000", label: "$100–$1,000" },
    { value: "gt1000", label: ">$1,000" },
  ];

type AmountFilter = (typeof AMOUNT_FILTER_OPTIONS)[number]["value"];

// ─── Helper Functions ─────────────────────────────────────────────────────────

const relativeTime = (iso: string): string => {
  const now = new Date();
  const txDate = new Date(iso);
  const diffMs = now.getTime() - txDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffDays === 0) {
    if (diffHrs === 0) {
      if (diffMins < 1) return "Just now";
      return `${diffMins}m ago`;
    }
    return `${diffHrs}h ago`;
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return fmtDate(iso);
};

const getDateGroup = (iso: string): string => {
  const now = new Date();
  const txDate = new Date(iso);
  const diffMs = now.getTime() - txDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  return "Older";
};

function getExportFilename(transactions: TransactionWithLine[]): string {
  const validDates = transactions
    .map((tx) => new Date(tx.date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const formatDateForFilename = (date: Date) => date.toISOString().slice(0, 10);
  const start = validDates[0] ? formatDateForFilename(validDates[0]) : "all";
  const end = validDates[validDates.length - 1]
    ? formatDateForFilename(validDates[validDates.length - 1])
    : "all";

  return `creditra-transactions-${start}-${end}.csv`;
}

function buildTransactionCsv(transactions: TransactionWithLine[]): string {
  const headers = [
    "Date",
    "Type",
    "Amount",
    "Credit Line",
    "Credit Line ID",
    "Status",
    "Note",
    "Transaction Hash",
  ] as const;

  const rows = transactions.map(
    (tx) =>
      [
        fmtDateTime(tx.date),
        TX_TYPE_LABELS[tx.type],
        tx.amount,
        tx.lineName,
        tx.lineId,
        tx.status,
        tx.note ?? "",
        tx.txHash ?? "",
      ] as const,
  );

  return toCsv(headers, rows);
}

function TransactionRow({
  tx,
  expanded,
  onToggle,
}: {
  tx: TransactionWithLine;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isNegative = tx.type === "Repay" || tx.type === "Fee";

  return (
    <>
      <tr className={`tx-row ${expanded ? "expanded" : ""}`} onClick={onToggle}>
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
          {isNegative ? fmt(tx.amount) : tx.amount > 0 ? fmt(tx.amount) : ""}
        </td>
        <td className="tx-line">
          <span className="tx-line-name">{tx.lineName}</span>
          <span className="tx-line-id">{tx.lineId}</span>
        </td>
        <td className="tx-status">
          <span
            className={`tx-status-badge ${STATUS_PATTERNS[tx.status]}`}
            data-status={tx.status}
            aria-label={`Transaction status: ${tx.status}`}
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
            <div className="tx-hash-actions">
              <a
                href={`https://stellar.expert/tx/${tx.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-hash-link"
                onClick={(e) => e.stopPropagation()}
              >
                {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
              </a>
              <CopyToClipboard
                value={tx.txHash}
                ariaLabel={`Copy transaction hash for ${tx.id}`}
                stopPropagation
              />
            </div>
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
                      {fmt(tx.amount)}
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
                          href={`https://stellar.expert/tx/${tx.txHash}`}
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
const ITEMS_PER_PAGE = 15;

export function TransactionHistory() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useNotifications();

  /**
   * First-paint loading guard.
   *
   * `isLoading` starts as `true` and is cleared to `false` in a
   * zero-delay `useEffect` (runs after the first committed render).
   * This gives the browser one frame to paint the skeleton before the
   * full component tree is committed, preventing a flash of unstyled
   * content on initial navigation.
   *
   * In a real application this flag would be wired to an async data
   * fetch; here it simulates that pattern against the static mock data.
   */
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate async data resolution on first mount.
    // Replace with the real data-fetch completion signal when the API is wired up.
    const id = setTimeout(() => setIsLoading(false), 0);
    return () => clearTimeout(id);
  }, []);

  // ─── Filter and UI State ───
  const [selectedLine, setSelectedLine] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<TypeFilter>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAmount, setSelectedAmount] = useState<AmountFilter>(() => {
    const url = searchParams.get("amount");
    if (url === "lt100" || url === "100-1000" || url === "gt1000") return url;
    return "all";
  });
  const [dateRange, setDateRange] = useState<DatePreset>("custom");
  const [presetRange, setPresetRange] = useState<RangePreset>("custom");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedAmountRange, setSelectedAmountRange] =
    useState<AmountRangePreset>("all");
  const [customAmountMin, setCustomAmountMin] = useState("");
  const [customAmountMax, setCustomAmountMax] = useState("");
  const [isCustomAmountRangeActive, setIsCustomAmountRangeActive] =
    useState(false);
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = ITEMS_PER_PAGE;

  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const isFirstRender = useRef(true);
  const isResettingAllFilters = useRef(false);
  const prevStates = useRef({
    selectedLine,
    selectedType,
    selectedStatus,
    selectedAmount,
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

    if (rangeParam === "this-week" || rangeParam === "this-month" || rangeParam === "all-time") {
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

  // Get all transactions from all credit lines
  const allTransactions = useMemo(() => {
    const txs: TransactionWithLine[] = [];
    MOCK_CREDIT_LINES.forEach((cl) => {
      cl.transactions.forEach((tx) => {
        txs.push({
          ...tx,
          lineId: cl.id,
          lineName: cl.name,
          lineStatus: cl.status,
        });
      });
    });
    return txs.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, []);

  // Sync the debounced input value into the filter state and reset page.
  // This is the only place `searchQuery` (which drives filteredTransactions)
  // is updated from user input, keeping keystroke and filter concerns separate.
  useEffect(() => {
    setSearchQuery(debouncedSearch);
    setCurrentPage(1);
  }, [debouncedSearch]);



  /**
   * Build a deduplicated list of suggestion strings from the full transaction
   * set that contain the current raw input value.  Suggestions surface
   * credit-line names, line IDs, and notes — matching the same fields that
   * the filter already searches.  Capped at 8 items for a manageable list.
   *
   * Computed from `searchInputValue` (not the debounced value) so that
   * the dropdown tracks the live keystroke, while filtering is debounced.
   */
  const suggestions = useMemo<string[]>(() => {
    const q = searchInputValue.trim().toLowerCase();
    if (!q) return [];

    const seen = new Set<string>();
    const results: string[] = [];

    for (const tx of allTransactions) {
      if (results.length >= 8) break;

      const candidates: (string | undefined)[] = [
        tx.lineName,
        tx.lineId,
        tx.note,
      ];

      for (const c of candidates) {
        if (!c) continue;
        const lower = c.toLowerCase();
        if (lower.includes(q) && !seen.has(c)) {
          seen.add(c);
          results.push(c);
          if (results.length >= 8) break;
        }
      }
    }

    return results;
  }, [searchInputValue, allTransactions]);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      const txTime = new Date(tx.date).getTime();
      if (Number.isNaN(txTime)) return false;

      if (selectedLine !== "all" && tx.lineId !== selectedLine) return false;
      if (selectedType !== "all" && tx.type !== selectedType) return false;
      if (selectedStatus !== "all" && tx.status !== selectedStatus)
        return false;
      if (selectedAmount === "lt100" && tx.amount >= 100) return false;
      if (selectedAmount === "100-1000" && (tx.amount < 100 || tx.amount > 1000))
        return false;
      if (selectedAmount === "gt1000" && tx.amount <= 1000) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesNote = tx.note?.toLowerCase().includes(query);
        const matchesLine = tx.lineName.toLowerCase().includes(query);
        const matchesId = tx.lineId.toLowerCase().includes(query);
        const matchesHash = tx.txHash?.toLowerCase().includes(query);
        if (!matchesNote && !matchesLine && !matchesId && !matchesHash)
          return false;
      }

      const transactionAmount = Math.abs(tx.amount);
      if (isCustomAmountRangeActive) {
        const minAmount =
          customAmountMin.trim().length > 0 ? Number(customAmountMin) : null;
        const maxAmount =
          customAmountMax.trim().length > 0 ? Number(customAmountMax) : null;

        if (minAmount !== null && transactionAmount < minAmount) return false;
        if (maxAmount !== null && transactionAmount > maxAmount) return false;
      } else if (selectedAmountRange !== "all") {
        const bounds = AMOUNT_RANGE_PRESET_BOUNDS[selectedAmountRange];

        if (bounds.min !== undefined && transactionAmount < bounds.min)
          return false;
        if (bounds.max !== undefined && transactionAmount > bounds.max)
          return false;
      }

      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).getTime();

      if (dateRange === "today" && txTime < startOfToday) return false;
      if (dateRange === "7d" && txTime < Date.now() - 7 * 24 * 60 * 60 * 1000) {
        return false;
      }
      if (
        dateRange === "30d" &&
        txTime < Date.now() - 30 * 24 * 60 * 60 * 1000
      ) {
        return false;
      }
      if (
        dateRange === "90d" &&
        txTime < Date.now() - 90 * 24 * 60 * 60 * 1000
      ) {
        return false;
      }

      if (presetRange === "this-week") {
        const weekStart = startOfWeek(now).getTime();
        if (txTime < weekStart) return false;
      } else if (presetRange === "this-month") {
        const monthStart = startOfMonth(now).getTime();
        if (txTime < monthStart) return false;
      } else if (presetRange === "all-time") {
        // No lower bound; keep all historical transactions.
      } else if (presetRange === "custom" && dateRange === "custom") {
        if (customStartDate) {
          const start = new Date(`${customStartDate}T00:00:00`).getTime();
          if (txTime < start) return false;
        }

        if (customEndDate) {
          const end = new Date(`${customEndDate}T23:59:59.999`).getTime();
          if (txTime > end) return false;
        }
      }

      return true;
    });
  }, [
    allTransactions,
    selectedLine,
    selectedType,
    selectedStatus,
    selectedAmount,
    searchQuery,
    selectedAmountRange,
    isCustomAmountRangeActive,
    customAmountMin,
    customAmountMax,
    dateRange,
    presetRange,
    customStartDate,
    customEndDate,
  ]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  const paginatedGrouped = useMemo(() => {
    const groups: Record<string, TransactionWithLine[]> = {};
    paginatedTransactions.forEach((tx) => {
      const group = getDateGroup(tx.date);
      if (!groups[group]) groups[group] = [];
      groups[group].push(tx);
    });
    return groups;
  }, [paginatedTransactions]);

  const stats = useMemo(() => {
    const completedTxs = allTransactions.filter(
      (tx) => tx.status === "Completed",
    );
    const totalDrawn = completedTxs
      .filter((tx) => tx.type === "Draw")
      .reduce((s, tx) => s + tx.amount, 0);
    const totalRepaid = completedTxs
      .filter((tx) => tx.type === "Repay")
      .reduce((s, tx) => s + tx.amount, 0);
    const totalInterest = completedTxs
      .filter((tx) => tx.type === "Interest")
      .reduce((s, tx) => s + tx.amount, 0);
    const currentDebt = totalDrawn - totalRepaid;
    return { totalDrawn, totalRepaid, totalInterest, currentDebt };
  }, [allTransactions]);

  const exportDisabled = filteredTransactions.length === 0;

  const handleExportCsv = () => {
    if (exportDisabled) return;

    const csv = buildTransactionCsv(filteredTransactions);
    const filename = getExportFilename(filteredTransactions);

    downloadCsv(filename, csv);

    addToast({
      type: "success",
      category: "transaction",
      title: "CSV export ready",
      message: `Your filtered transaction history was downloaded as ${filename}.`,
      saveToHistory: false,
    });
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
    [isSuggestionsOpen, suggestions, activeSuggestionIndex, commitSuggestion, dismissSuggestions],
  );

  const hasLines = MOCK_CREDIT_LINES.length > 0;
  const hasTransactions = allTransactions.length > 0;

  const hasActiveFilters =
    selectedLine !== "all" ||
    selectedType !== "all" ||
    selectedStatus !== "all" ||
    selectedAmount !== "all" ||
    dateRange !== "custom" ||
    customStartDate.length > 0 ||
    customEndDate.length > 0 ||
    searchInputValue.trim().length > 0;

  const resultCountText = `${filteredTransactions.length} ${filteredTransactions.length === 1 ? "transaction" : "transactions"} shown`;

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevStates.current = {
        selectedLine,
        selectedType,
        selectedStatus,
        selectedAmount,
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
      const typeLabel = selectedType === "all" ? "All" : TX_TYPE_LABELS[selectedType];
      message = `Filtered by transaction type ${typeLabel}. ${resultCountText}.`;
    } else if (selectedLine !== prevStates.current.selectedLine) {
      const lineLabel =
        selectedLine === "all"
          ? "All"
          : MOCK_CREDIT_LINES.find((cl) => cl.id === selectedLine)?.name || selectedLine;
      message = `Filtered by credit line ${lineLabel}. ${resultCountText}.`;
    } else if (selectedStatus !== prevStates.current.selectedStatus) {
      message = `Filtered by status ${selectedStatus === "all" ? "All" : selectedStatus}. ${resultCountText}.`;
    } else if (selectedAmount !== prevStates.current.selectedAmount) {
      const amountLabel =
        selectedAmount === "all"
          ? "All"
          : AMOUNT_FILTER_OPTIONS.find((o) => o.value === selectedAmount)?.label || selectedAmount;
      message = `Filtered by amount ${amountLabel}. ${resultCountText}.`;
    } else if (selectedAmountRange !== prevStates.current.selectedAmountRange) {
      const rangeLabels: Record<string, string> = {
        all: "All",
        "under-5k": "Under $5k",
        "5k-25k": "$5k to $25k",
        "25k-plus": "Over $25k",
      };
      const rangeLabel = rangeLabels[selectedAmountRange] || selectedAmountRange;
      message = `Filtered by amount range ${rangeLabel}. ${resultCountText}.`;
    } else if (
      isCustomAmountRangeActive !== prevStates.current.isCustomAmountRangeActive ||
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
      selectedAmount,
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
    selectedAmount,
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
      parts.push(`filtered by ${TX_TYPE_LABELS[selectedType as TransactionType]}`);
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
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" }, { replace: true });
  };

  const clearFilters = () => {
    isResettingAllFilters.current = true;
    setSelectedLine("all");
    setSelectedType("all");
    setSelectedStatus("all");
    setSelectedAmount("all");
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

  if (isLoading) {
    /*
     * The skeleton mirrors this page's own DOM and class names, so its
     * geometry is driven by TransactionHistory.css rather than a parallel
     * stylesheet (issue #854).  `rows` is passed explicitly so the placeholder
     * table reserves a full page and the reveal does not resize the container.
     */
    return <TransactionHistorySkeleton rows={ITEMS_PER_PAGE} />;
  }

  if (!hasLines) {
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
              disabled={exportDisabled}
              aria-describedby={
                exportDisabled ? CSV_EXPORT_EMPTY_REASON_ID : undefined
              }
            >
              <span aria-hidden="true">📥</span>
              Export CSV
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
        {exportDisabled
          ? "Export CSV is unavailable because the current filters do not match any transactions."
          : ""}
      </p>

      <div className="th-stats">
        <div className="th-stat-card">
          <span
            className="th-stat-icon"
            style={{ background: "rgba(88,166,255,0.12)", color: COLOR.accent }}
          >
            ↗
          </span>
          <div className="th-stat-content">
            <span className="th-stat-label">Total Drawn</span>
            <span className="th-stat-value num-tabular" style={{ color: COLOR.accent }}>
              {fmt(stats.totalDrawn)}
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
            <span className="th-stat-label">Total Repaid</span>
            <span className="th-stat-value num-tabular" style={{ color: COLOR.success }}>
              {fmt(stats.totalRepaid)}
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
            <span className="th-stat-label">Total Interest</span>
            <span className="th-stat-value num-tabular" style={{ color: COLOR.warning }}>
              {fmt(stats.totalInterest)}
            </span>
          </div>
        </div>
        <div className="th-stat-card">
          <span
            className="th-stat-icon"
            style={{ background: "rgba(248,81,73,0.12)", color: COLOR.danger }}
          >
            💳
          </span>
          <div className="th-stat-content">
            <span className="th-stat-label">Current Debt</span>
            <span
              className="th-stat-value num-tabular"
              style={{
                color: stats.currentDebt > 0 ? COLOR.danger : COLOR.success,
              }}
            >
              {fmt(Math.abs(stats.currentDebt))}
            </span>
          </div>
        </div>
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
            {MOCK_CREDIT_LINES.map((cl) => (
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
        {/*
         * Amount Range Filter Chips
         * Implements accessible toggle button group for amount-range filtering
         *
         * Filters by absolute transaction amount:
         * - <$100: amounts under 100
         * - $100–$1,000: amounts between 100 and 1,000 inclusive
         * - >$1,000: amounts over 1,000
         *
         * URL state is synced via ?amount=lt100 | ?amount=100-1000 | ?amount=gt1000.
         * Uses same aria-pressed toggle pattern as Type and Date chips.
         */}
        <div className="th-filter-group th-filter-group-wide">
          <span className="th-filter-label" id="amount-filter-label">
            Amount
          </span>
          <div
            className="th-chip-group"
            role="group"
            aria-labelledby="amount-filter-label"
          >
            {AMOUNT_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="th-filter-chip"
                aria-pressed={selectedAmount === option.value}
                onClick={() => {
                  setSelectedAmount(option.value);
                  setCurrentPage(1);
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    if (option.value === "all") {
                      next.delete("amount");
                    } else {
                      next.set("amount", option.value);
                    }
                    return next;
                  });
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
            <span className="th-filter-label" id="transaction-range-filter-label">
              Presets
            </span>
            <div className="th-chip-group" role="group" aria-labelledby="transaction-range-filter-label">
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
            <span className="th-filter-label" id="transaction-date-filter-label">
              Date Range
            </span>
            <div className="th-chip-group" role="group" aria-labelledby="transaction-date-filter-label">
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
                  aria-pressed={presetRange === "custom" && dateRange === option.value}
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
            }}
            onCustomRangeApply={({ min, max }) => {
              setSelectedAmountRange("all");
              setCustomAmountMin(min === null ? "" : String(min));
              setCustomAmountMax(max === null ? "" : String(max));
              setIsCustomAmountRangeActive(true);
              setCurrentPage(1);
            }}
            onCustomRangeClear={() => {
              setSelectedAmountRange("all");
              setCustomAmountMin("");
              setCustomAmountMax("");
              setIsCustomAmountRangeActive(false);
              setCurrentPage(1);
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
        >
          {resultCountText}
        </div>
      </div>

      <div className="th-table-container">
        {filteredTransactions.length === 0 ? (
          <div
            className="empty-state"
            role="status"
            aria-live="polite"
          >
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
            <table className="th-table">
              <caption className="sr-only">{tableCaption}</caption>
              <thead>
                <tr>
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
                {Object.entries(paginatedGrouped).map(([_group, txs], idx) => (
                  <React.Fragment key={`group-${idx}`}>
                    {txs.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        tx={tx}
                        expanded={expandedTx === tx.id}
                        onToggle={() => handleToggleExpand(tx.id)}
                      />
                    ))}
                  </React.Fragment>
                ))}
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
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
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