import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { CopyToClipboard } from "../components/CopyToClipboard";
import { MOCK_CREDIT_LINES } from "../data/mockData";
import type {
  TransactionType,
  TransactionStatus,
  CreditLineStatus,
} from "../types/creditLine";
import { COLOR, fmt, fmtDate, fmtDateTime } from "../utils/tokens";
import "./TransactionHistory.css";

/**
 * TransactionHistory Page Component
 *
 * This component displays a comprehensive transaction history with advanced filtering capabilities.
 *
 * Features:
 * - Accessible filter chips for transaction type (All/Draw/Repay/Fee/Interest) using aria-pressed
 * - Accessible date range filter chips (7d/30d/90d/All) using aria-pressed
 * - Live result count announcements via aria-live="polite" (WCAG 2.1 AA - 4.1.2)
 * - Distinct empty states:
 *   - "No transactions yet" when no data exists
 *   - "No transactions match these filters" with clear-filters action for filtered results
 * - Real-time filtering by type, date range, credit line, status, and search query
 * - Pagination with 15 items per page
 * - Expandable transaction details
 * - CSV/PDF export functionality
 *
 * Accessibility:
 * - All filter chips use role="group" with aria-labelledby for proper grouping
 * - aria-pressed attribute tracks toggle state on filter buttons
 * - aria-live="polite" region announces filtered result counts
 * - aria-atomic="true" ensures full announcement of result count changes
 * - Keyboard navigation: Tab to focus, Space/Enter to toggle filters
 * - Distinct visual states for active filters using CSS selectors
 *
 * Empty State UX:
 * - Separate rendering paths for "no lines" vs "no transactions" vs "no filtered results"
 * - Clear filters button appears only when filters are active and return 0 results
 * - Icon and messaging distinguish between data absence and filter mismatch
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

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

// Date range filter presets: users can quickly view transactions from the last 7, 30, or 90 days
// or see all transactions. Each option includes the day count for efficient filtering.
const DATE_FILTER_OPTIONS = [
  { value: "7d", label: "7d", days: 7 },
  { value: "30d", label: "30d", days: 30 },
  { value: "90d", label: "90d", days: 90 },
  { value: "all", label: "All" },
] as const;

type TypeFilter = (typeof TYPE_FILTER_OPTIONS)[number]["value"];
type DateFilter = (typeof DATE_FILTER_OPTIONS)[number]["value"];

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

// ─── Components ────────────────────────────────────────────────────────────────

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
          className="tx-amount"
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
            className="tx-status-badge"
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
                      className="value"
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

// ─── Main Component ────────────────────────────────────────────────────────────

/**
 * Main TransactionHistory component that manages all filtering, pagination, and display logic.
 *
 * State Management:
 * - Filter states (type, date range, status, search) reset pagination to page 1
 * - expandedTx tracks which transaction detail is currently expanded
 * - showExportMenu toggles the export dropdown visibility
 */
export function TransactionHistory() {
  // ─── Filter and UI State ───
  const [selectedLine, setSelectedLine] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<TypeFilter>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

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

  /**
   * Apply all active filters to the transaction list.
   * This runs whenever any filter state changes, triggering re-pagination to page 1.
   *
   * Filters applied in order:
   * 1. Credit line (by lineId)
   * 2. Transaction type (Draw/Repay/Fee/Interest)
   * 3. Status (Completed/Pending/Failed)
   * 4. Full-text search (checks note, lineName, lineId, txHash)
   * 5. Date range (using cutoff time from 7d/30d/90d preset)
   *
   * Result count is announced via aria-live region for accessibility.
   */
  const filteredTransactions = useMemo(() => {
    const selectedDatePreset = DATE_FILTER_OPTIONS.find(
      (option) => option.value === dateRange,
    );
    const cutoffTime =
      selectedDatePreset && "days" in selectedDatePreset
      ? Date.now() - selectedDatePreset.days * 24 * 60 * 60 * 1000
      : null;

    return allTransactions.filter((tx) => {
      if (selectedLine !== "all" && tx.lineId !== selectedLine) return false;
      if (selectedType !== "all" && tx.type !== selectedType) return false;
      if (selectedStatus !== "all" && tx.status !== selectedStatus)
        return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesNote = tx.note?.toLowerCase().includes(query);
        const matchesLine = tx.lineName.toLowerCase().includes(query);
        const matchesId = tx.lineId.toLowerCase().includes(query);
        const matchesHash = tx.txHash?.toLowerCase().includes(query);
        if (!matchesNote && !matchesLine && !matchesId && !matchesHash)
          return false;
      }
      if (cutoffTime !== null) {
        const txTime = new Date(tx.date).getTime();
        if (Number.isNaN(txTime) || txTime < cutoffTime) return false;
      }
      return true;
    });
  }, [
    allTransactions,
    selectedLine,
    selectedType,
    selectedStatus,
    searchQuery,
    dateRange,
  ]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  // Group paginated transactions
  const paginatedGrouped = useMemo(() => {
    const groups: Record<string, TransactionWithLine[]> = {};
    paginatedTransactions.forEach((tx) => {
      const group = getDateGroup(tx.date);
      if (!groups[group]) groups[group] = [];
      groups[group].push(tx);
    });
    return groups;
  }, [paginatedTransactions]);

  // Summary statistics
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

  // Export functions
  const exportToCSV = () => {
    const headers = [
      "Date",
      "Type",
      "Amount",
      "Credit Line",
      "Credit Line ID",
      "Status",
      "Note",
      "Transaction Hash",
    ];
    const rows = filteredTransactions.map((tx) => [
      fmtDateTime(tx.date),
      TX_TYPE_LABELS[tx.type],
      tx.amount.toString(),
      tx.lineName,
      tx.lineId,
      tx.status,
      tx.note || "",
      tx.txHash || "",
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const exportToPDF = () => {
    // Simple PDF export using window.print
    window.print();
    setShowExportMenu(false);
  };

  const handleToggleExpand = (txId: string) => {
    setExpandedTx(expandedTx === txId ? null : txId);
  };

  const hasLines = MOCK_CREDIT_LINES.length > 0;
  const hasTransactions = allTransactions.length > 0;

  /**
   * Track if any filters are currently active.
   * Used to determine whether to show "Clear filters" button in no-results state.
   * Includes all filter types except the initial default states.
   */
  const hasActiveFilters =
    selectedLine !== "all" ||
    selectedType !== "all" ||
    selectedStatus !== "all" ||
    dateRange !== "all" ||
    searchQuery.trim().length > 0;

  /**
   * Result count text displayed in aria-live region.
   * Announces the number of filtered transactions to screen readers.
   * Uses proper pluralization for accessibility.
   */
  const resultCountText = `${filteredTransactions.length} ${filteredTransactions.length === 1 ? "transaction" : "transactions"} shown`;

  /**
   * Clear all active filters and return to initial state.
   * Called when user clicks "Clear filters" in the no-results empty state.
   * Also clears expanded transaction details and resets to page 1.
   */
  const clearFilters = () => {
    setSelectedLine("all");
    setSelectedType("all");
    setSelectedStatus("all");
    setDateRange("all");
    setSearchQuery("");
    setCurrentPage(1);
    setExpandedTx(null);
  };

  /**
   * Empty State Rendering
   *
   * Three distinct empty state scenarios:
   * 1. No credit lines: User hasn't created any credit lines yet
   * 2. No transactions: Credit lines exist but no transaction history
   * 3. No filtered results: Transactions exist but current filters match nothing
   *
   * Each state has distinct messaging, icons, and actions per WCAG 2.1 AA guidelines.
   */

  // Scenario 1: No credit lines at all
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
          <div className="empty-state-icon">📊</div>
          <h2>No credit lines yet</h2>
          <p>
            You need an active credit line to view transaction history. Start by
            requesting a credit evaluation.
          </p>
          <Link to="/open-credit" className="empty-state-btn">
            🚀 Request Credit Evaluation
          </Link>
        </div>
      </div>
    );
  }

  // Scenario 2: Credit lines exist but no transaction history yet
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
          <div className="empty-state-icon">📊</div>
          <h2>No transactions yet</h2>
          <p>
            Your draws, repayments, fees, and interest activity will appear here
            once your credit lines have activity.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-history-page">
      {/* Header */}
      <div className="th-header">
        <div>
          <h1>Transaction History</h1>
          <p className="subtitle">Track all your credit activity</p>
        </div>
        <div className="th-header-actions">
          <div className="export-dropdown">
            <button
              className="export-btn"
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              <span>📥</span> Export
            </button>
            {showExportMenu && (
              <div className="export-menu">
                <button onClick={exportToCSV}>📄 Export as CSV</button>
                <button onClick={exportToPDF}>📑 Export as PDF</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
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
            <span className="th-stat-value" style={{ color: COLOR.accent }}>
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
            <span className="th-stat-value" style={{ color: COLOR.success }}>
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
            <span className="th-stat-value" style={{ color: COLOR.warning }}>
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
              className="th-stat-value"
              style={{
                color: stats.currentDebt > 0 ? COLOR.danger : COLOR.success,
              }}
            >
              {fmt(Math.abs(stats.currentDebt))}
            </span>
          </div>
        </div>
      </div>

      {/*
       * Filter Section: Contains all filtering mechanisms
       *
       * Components:
       * 1. Credit Line dropdown (traditional select, less discoverable)
       * 2. Transaction Type chips (aria-pressed toggle group, WCAG 2.1 AA)
       * 3. Status dropdown (traditional select)
       * 4. Date Range chips (aria-pressed toggle group, WCAG 2.1 AA)
       * 5. Search input (full-text search)
       * 6. Result count display (aria-live="polite" for announcements)
       *
       * All filter changes reset pagination to page 1 to avoid confusion.
       */}
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

        {/*
         * Transaction Type Filter Chips
         * Implements accessible toggle button group (WCAG 2.1 AA)
         *
         * Accessibility features:
         * - role="group" with aria-labelledby links to visible label
         * - aria-pressed="true/false" indicates toggle state
         * - Keyboard: Tab to focus, Space/Enter to toggle
         * - Visual feedback: background color, border, and shadow on active state
         * - Screen readers announced changes via aria-live in result count
         */}
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

        {/*
         * Date Range Filter Chips
         * Implements accessible toggle button group with quick presets
         *
         * Accessibility features (same as Type chips):
         * - role="group" with aria-labelledby for semantic grouping
         * - aria-pressed="true/false" indicates selected preset
         * - Keyboard: Tab to focus, Space/Enter to toggle
         * - Visual distinction for active preset
         * - Changes trigger instant filter recalculation
         */}
        <div className="th-filter-group th-filter-group-wide">
          <span className="th-filter-label" id="transaction-date-filter-label">
            Date Range
          </span>
          <div
            className="th-chip-group"
            role="group"
            aria-labelledby="transaction-date-filter-label"
          >
            {DATE_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="th-filter-chip"
                aria-pressed={dateRange === option.value}
                onClick={() => {
                  setDateRange(option.value);
                  setCurrentPage(1);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="th-search-group">
          <label>Search</label>
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {/*
         * Result Count Announcement Region
         * Uses aria-live="polite" to announce filter changes to screen readers
         * aria-atomic="true" ensures the entire message is announced
         * Updates whenever filteredTransactions length changes
         */}
        <div
          className="th-filter-results"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {resultCountText}
        </div>
      </div>

      {/*
       * Transaction Table or No-Results State
       *
       * Scenario 3: No filtered results
       * Shown when transactions exist but current filter combination returns 0 results
       * Distinct from "No transactions yet" state with:
       * - "No transactions match these filters" heading
       * - Suggestions to modify filters
       * - "Clear filters" button to easily reset all filters
       */}
      <div className="th-table-container">
        {filteredTransactions.length === 0 ? (
          <div className="th-empty th-empty-no-results">
            <div className="th-empty-icon">🔍</div>
            <h3>No transactions match these filters</h3>
            <p>Try another transaction type, date range, or search term.</p>
            {hasActiveFilters && (
              <button
                type="button"
                className="th-clear-filters-btn"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <table className="th-table">
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="th-pagination">
                <button
                  className="th-page-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  ← Previous
                </button>
                <span className="th-page-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="th-page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
