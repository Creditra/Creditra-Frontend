import type { CreditLineStatus, SortField, SortDirection } from "../../types/creditLine";

export interface CreditLineFilterBarProps {
  statusFilter: CreditLineStatus | "all";
  sortField: SortField;
  sortDir: SortDirection;
  onStatusChange: (status: CreditLineStatus | "all") => void;
  onSortChange: (field: SortField) => void;
  onDirectionChange: () => void;
}

export function CreditLineFilterBar({
  statusFilter,
  sortField,
  sortDir,
  onStatusChange,
  onSortChange,
  onDirectionChange,
}: CreditLineFilterBarProps) {
  return (
    <div className="cl-filters">
      <div className="cl-filter-group">
        <label>Status</label>
        <select
          className="focus-ring"
          value={statusFilter}
          onChange={(event) => onStatusChange(event.target.value as CreditLineStatus | "all")}
        >
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
          <option value="Frozen">Frozen</option>
          <option value="Defaulted">Defaulted</option>
          <option value="Closed">Closed</option>
        </select>
      </div>
      <div className="cl-filter-group">
        <label>Sort By</label>
        <select
          className="focus-ring"
          value={sortField}
          onChange={(event) => onSortChange(event.target.value as SortField)}
        >
          <option value="updatedAt">Last Updated</option>
          <option value="status">Status</option>
          <option value="limit">Credit Limit</option>
          <option value="utilization">Utilization</option>
          <option value="apr">APR</option>
          <option value="riskScore">Risk Score</option>
        </select>
      </div>
      <button className="cl-sort-dir focus-ring" onClick={onDirectionChange}>
        {sortDir === "asc" ? "↑" : "↓"}
      </button>
    </div>
  );
}

export default CreditLineFilterBar;
