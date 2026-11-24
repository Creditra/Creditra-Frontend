import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { NoActivity, NoLines } from "../components/illustrations";
import { LiveRegion } from "../components/LiveRegion";
import { TransactionHistorySkeleton } from "../components/TransactionHistorySkeleton";
import {
  CSV_EXPORT_EMPTY_REASON_ID,
  ExportActions,
} from "../components/transactions/ExportActions";
import { TransactionFilterBar } from "../components/transactions/TransactionFilterBar";
import { TransactionSummary } from "../components/transactions/TransactionSummary";
import { TransactionTable } from "../components/transactions/TransactionTable";
import { TX_TYPE_LABELS } from "../components/transactions/TransactionRow";
import { useCreditLines, useCreditTransactions } from "../hooks/useCreditLines";
import { DEFAULT_HISTORY_PAGE_SIZE } from "../utils/cursorPagination";
import {
  DEFAULT_VIRTUALIZE_THRESHOLD,
  useTransactionPagination,
} from "../hooks/useTransactionPagination";
import {
  useTransactionFilters,
} from "../hooks/useTransactionFilters";
import "./TransactionHistory.css";

/**
 * TransactionHistory Page Component
 *
 * Displays transaction history with filtering, pagination, export and summaries.
 */
export interface TransactionHistoryProps {
  /** Override items per page (defaults to 15; values > 50 bypass cursor cap for large virtualized views). */
  pageSize?: number;
  /** Row count threshold at which VirtualList activates windowing (defaults to 100). */
  virtualizeThreshold?: number;
}

export function TransactionHistory({
  pageSize = DEFAULT_HISTORY_PAGE_SIZE,
  virtualizeThreshold = DEFAULT_VIRTUALIZE_THRESHOLD,
}: TransactionHistoryProps = {}) {
  const { lines: creditLines, status, error, refetch } = useCreditLines();
  const { transactions } = useCreditTransactions();
  const filters = useTransactionFilters(transactions);
  const pagination = useTransactionPagination(
    filters.filteredTransactions,
    filters.filterKey,
    pageSize,
  );
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const isFirstRender = useRef(true);
  const isResettingAllFilters = useRef(false);
  const previousStates = useRef({
    selectedLine: filters.selectedLine,
    selectedType: filters.selectedType,
    selectedStatus: filters.selectedStatus,
    dateRange: filters.dateRange,
    presetRange: filters.presetRange,
    customStartDate: filters.customStartDate,
    customEndDate: filters.customEndDate,
    selectedAmountRange: filters.selectedAmountRange,
    isCustomAmountRangeActive: filters.isCustomAmountRangeActive,
    customAmountMin: filters.customAmountMin,
    customAmountMax: filters.customAmountMax,
    searchQuery: filters.searchQuery,
    currentPage: pagination.currentPage,
  });
  const hasLines = creditLines.length > 0;
  const hasTransactions = filters.allTransactions.length > 0;
  const resultCountText = filters.resultCountText;
  const totalPages = pagination.totalPages;
  const currentPage = pagination.currentPage;

  const clearFilters = () => {
    isResettingAllFilters.current = true;
    filters.clearFilters();
    pagination.resetPage();
    pagination.setExpandedTx(null);
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousStates.current = {
        selectedLine: filters.selectedLine,
        selectedType: filters.selectedType,
        selectedStatus: filters.selectedStatus,
        dateRange: filters.dateRange,
        presetRange: filters.presetRange,
        customStartDate: filters.customStartDate,
        customEndDate: filters.customEndDate,
        selectedAmountRange: filters.selectedAmountRange,
        isCustomAmountRangeActive: filters.isCustomAmountRangeActive,
        customAmountMin: filters.customAmountMin,
        customAmountMax: filters.customAmountMax,
        searchQuery: filters.searchQuery,
        currentPage,
      };
      return;
    }

    const previous = previousStates.current;
    const wasResettingAllFilters = isResettingAllFilters.current;
    isResettingAllFilters.current = false;
    let message = "";

    if (wasResettingAllFilters) {
      message = `Filters cleared. ${resultCountText}.`;
    } else if (currentPage !== previous.currentPage) {
      message = `Page ${currentPage} of ${totalPages} loaded. ${resultCountText}.`;
    } else if (filters.selectedType !== previous.selectedType) {
      const label =
        filters.selectedType === "all"
          ? "All"
          : TX_TYPE_LABELS[filters.selectedType];
      message = `Filtered by transaction type ${label}. ${resultCountText}.`;
    } else if (filters.selectedLine !== previous.selectedLine) {
      const label =
        filters.selectedLine === "all"
          ? "All"
          : creditLines.find((line) => line.id === filters.selectedLine)?.name ||
            filters.selectedLine;
      message = `Filtered by credit line ${label}. ${resultCountText}.`;
    } else if (filters.selectedStatus !== previous.selectedStatus) {
      const label =
        filters.selectedStatus === "all" ? "All" : filters.selectedStatus;
      message = `Filtered by status ${label}. ${resultCountText}.`;
    } else if (filters.selectedAmountRange !== previous.selectedAmountRange) {
      const rangeLabels: Record<string, string> = {
        all: "All",
        "under-100": "Under $100",
        "100-1k": "$100 to $1k",
        "1k-5k": "$1k to $5k",
        "5k-25k": "$5k to $25k",
        "25k-plus": "$25k and over",
      };
      const label =
        rangeLabels[filters.selectedAmountRange] || filters.selectedAmountRange;
      message = `Filtered by amount range ${label}. ${resultCountText}.`;
    } else if (
      filters.isCustomAmountRangeActive !==
        previous.isCustomAmountRangeActive ||
      filters.customAmountMin !== previous.customAmountMin ||
      filters.customAmountMax !== previous.customAmountMax
    ) {
      if (filters.isCustomAmountRangeActive) {
        const min = filters.customAmountMin
          ? `$${filters.customAmountMin}`
          : "any";
        const max = filters.customAmountMax
          ? `$${filters.customAmountMax}`
          : "any";
        message = `Custom amount range filter applied: ${min} to ${max}. ${resultCountText}.`;
      } else if (previous.isCustomAmountRangeActive) {
        message = `Custom amount range filter cleared. ${resultCountText}.`;
      }
    } else if (
      filters.dateRange !== previous.dateRange ||
      filters.presetRange !== previous.presetRange ||
      filters.customStartDate !== previous.customStartDate ||
      filters.customEndDate !== previous.customEndDate
    ) {
      if (filters.presetRange !== "custom") {
        const labels: Record<string, string> = {
          "this-week": "This Week",
          "this-month": "This Month",
          "all-time": "All Time",
        };
        message = `Filtered by date preset ${labels[filters.presetRange] || filters.presetRange}. ${resultCountText}.`;
      } else if (filters.dateRange !== "custom") {
        const labels: Record<string, string> = {
          today: "Today",
          "7d": "Last 7 days",
          "30d": "Last 30 days",
          "90d": "Last 90 days",
        };
        message = `Filtered by date preset ${labels[filters.dateRange] || filters.dateRange}. ${resultCountText}.`;
      } else if (filters.customStartDate || filters.customEndDate) {
        message = `Filtered by custom date range from ${filters.customStartDate || "any"} to ${filters.customEndDate || "any"}. ${resultCountText}.`;
      } else {
        message = `Date filter cleared. ${resultCountText}.`;
      }
    } else if (filters.searchQuery !== previous.searchQuery) {
      message = filters.searchQuery
        ? `Search query "${filters.searchQuery}" applied. ${resultCountText}.`
        : `Search query cleared. ${resultCountText}.`;
    }

    previousStates.current = {
      selectedLine: filters.selectedLine,
      selectedType: filters.selectedType,
      selectedStatus: filters.selectedStatus,
      dateRange: filters.dateRange,
      presetRange: filters.presetRange,
      customStartDate: filters.customStartDate,
      customEndDate: filters.customEndDate,
      selectedAmountRange: filters.selectedAmountRange,
      isCustomAmountRangeActive: filters.isCustomAmountRangeActive,
      customAmountMin: filters.customAmountMin,
      customAmountMax: filters.customAmountMax,
      searchQuery: filters.searchQuery,
      currentPage,
    };
    if (message) setLiveAnnouncement(message);
  }, [
    filters.selectedLine,
    filters.selectedType,
    filters.selectedStatus,
    filters.dateRange,
    filters.presetRange,
    filters.customStartDate,
    filters.customEndDate,
    filters.selectedAmountRange,
    filters.isCustomAmountRangeActive,
    filters.customAmountMin,
    filters.customAmountMax,
    filters.searchQuery,
    currentPage,
    resultCountText,
    totalPages,
    creditLines,
  ]);

  if (status === "loading") {
    return <TransactionHistorySkeleton rows={DEFAULT_HISTORY_PAGE_SIZE} />;
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
          <ExportActions
            transactions={filters.filteredTransactions}
            disabled={filters.filteredTransactions.length === 0}
          />
        </div>
      </div>
      <p id={CSV_EXPORT_EMPTY_REASON_ID} className="th-export-help">
        {filters.filteredTransactions.length === 0
          ? "Export CSV is unavailable because the current filters do not match any transactions."
          : ""}
      </p>

      <TransactionSummary
        creditLines={creditLines}
        filteredTransactions={filters.filteredTransactions}
        selectedLine={filters.selectedLine}
      />
      <TransactionFilterBar
        filters={filters}
        creditLines={creditLines}
        onFilterChange={pagination.resetPage}
      />
      <TransactionTable
        filteredTransactions={filters.filteredTransactions}
        hasActiveFilters={filters.hasActiveFilters}
        clearFilters={clearFilters}
        tableCaption={filters.tableCaption}
        virtualizeThreshold={virtualizeThreshold}
        pagination={pagination}
      />
      <LiveRegion message={liveAnnouncement} />
    </div>
  );
}
