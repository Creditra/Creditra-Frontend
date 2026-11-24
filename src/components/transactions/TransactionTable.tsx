import { NoDataGraph } from "../illustrations";
import { VirtualList } from "../VirtualList";
import type { CreditTransaction } from "../../hooks/useCreditLines";
import type { useTransactionPagination } from "../../hooks/useTransactionPagination";
import { TransactionRow } from "./TransactionRow";
import {
  ESTIMATED_EXPANDED_ROW_HEIGHT,
  ESTIMATED_ROW_HEIGHT,
} from "../../hooks/useTransactionPagination";

interface TransactionTableProps {
  filteredTransactions: CreditTransaction[];
  hasActiveFilters: boolean;
  clearFilters: () => void;
  tableCaption: string;
  virtualizeThreshold: number;
  pagination: ReturnType<typeof useTransactionPagination>;
}

export function TransactionTable({
  filteredTransactions,
  hasActiveFilters,
  clearFilters,
  tableCaption,
  virtualizeThreshold,
  pagination,
}: TransactionTableProps) {
  const {
    currentPage,
    currentPageResult,
    totalPages,
    flatPageTransactions,
    expandedTx,
    focusedRowIndex,
    setFocusedRowIndex,
    virtualListRef,
    tableScrollContainerRef,
    rowRefs,
    handleRowKeyDown,
    toggleExpand,
    goToPreviousPage,
    goToNextPage,
  } = pagination;

  return (
    <div
      ref={tableScrollContainerRef}
      className={`th-table-container${
        flatPageTransactions.length >= virtualizeThreshold
          ? " th-table-container--virtualized"
          : ""
      }`}
    >
      {filteredTransactions.length === 0 ? (
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
                estimateSize={(_index, tx) =>
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
                    onToggle={() => toggleExpand(tx.id)}
                    ariaRowIndex={ariaRowIndex}
                    tabIndex={
                      focusedRowIndex === index ||
                      (focusedRowIndex === null && index === 0)
                        ? 0
                        : -1
                    }
                    rowRef={(element) => {
                      if (element) rowRefs.current.set(index, element);
                      else rowRefs.current.delete(index);
                      measureRef(element);
                    }}
                    onFocus={() => setFocusedRowIndex(index)}
                    onKeyDown={(event) => handleRowKeyDown(index, tx.id, event)}
                  />
                )}
              />
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="th-pagination">
              <button
                className="th-page-btn"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="th-page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="th-page-btn"
                onClick={goToNextPage}
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
  );
}
