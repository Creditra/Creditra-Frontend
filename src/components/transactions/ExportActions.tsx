import { useNotifications } from "../../context/NotificationContext";
import {
  buildTransactionCsv,
  buildTransactionCsvFilename,
  DEFAULT_TRANSACTION_CSV_ASSET,
} from "../../lib/transaction-csv";
import { downloadCsv } from "../../utils/csv";
import type { CreditTransaction } from "../../hooks/useCreditLines";

export const CSV_EXPORT_EMPTY_REASON_ID = "csv-export-empty-reason";

interface ExportActionsProps {
  transactions: CreditTransaction[];
  disabled: boolean;
}

export function ExportActions({
  transactions,
  disabled,
}: ExportActionsProps) {
  const { addToast } = useNotifications();

  const handleExportCsv = () => {
    if (disabled) return;
    const csv = buildTransactionCsv(transactions, {
      asset: DEFAULT_TRANSACTION_CSV_ASSET,
    });
    const filename = buildTransactionCsvFilename(transactions);
    downloadCsv(filename, csv);
    addToast({
      type: "success",
      category: "transaction",
      title: "CSV export ready",
      message: `Your filtered transaction history was downloaded as ${filename}.`,
      saveToHistory: false,
    });
  };

  return (
      <div className="export-actions">
        <button
          type="button"
          className="export-btn"
          onClick={handleExportCsv}
          disabled={disabled}
          aria-describedby={
            disabled ? CSV_EXPORT_EMPTY_REASON_ID : undefined
          }
        >
          <span aria-hidden="true">📥</span>
          Export CSV
        </button>
        <button
          type="button"
          className="export-btn export-btn-secondary"
          onClick={() => window.print()}
        >
          <span aria-hidden="true">📑</span>
          Export PDF
        </button>
      </div>
  );
}
