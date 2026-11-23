import { Link } from "react-router-dom";
import type { CreditLine } from "../../types/creditLine";
import { NoLines } from "../illustrations";
import { CreditLineCard } from "./CreditLineCard";

interface Props {
  filteredCount: number;
  totalCount: number;
  items: CreditLine[];
  pageIndex: number;
  pageCount: number;
  selectedLines: string[];
  statusFilter: string;
  onToggle: (id: string) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onSwapCollateral: Parameters<typeof CreditLineCard>[0]["onSwapCollateral"];
  onRepay: (id: string) => void;
  onFreeze: (id: string) => void;
  onUnfreeze: (id: string) => void;
  onSchedule: (id: string) => void;
  onDetails: Parameters<typeof CreditLineCard>[0]["onDetails"];
}

export function CreditLineList(props: Props) {
  if (props.filteredCount === 0) {
    if (props.totalCount > 0) {
      return (
        <div className="cl-empty" role="region" aria-label="No matching credit lines">
          <NoLines className="empty-state-illustration--muted" />
          <h2 className="cl-empty-title">No matching credit lines</h2>
          <p className="cl-empty-desc">Try changing the status filter to see your credit lines.</p>
          <button type="button" className="cl-primary-btn focus-ring" onClick={props.onClearFilters}>Clear Filters</button>
        </div>
      );
    }
    return (
      <div className="cl-empty" role="region" aria-label="No credit lines">
        <NoLines className="empty-state-illustration--muted" />
        <h2 className="cl-empty-title">Get started with Credit Lines</h2>
        <p className="cl-empty-desc">Credit lines give you access to flexible capital when you need it. Open your first line and unlock funding tailored to your business.</p>
        <ul className="cl-empty-features"><li>Flexible funding up to $500K</li><li>Competitive rates from 7.5% APR</li><li>Quick approval with digital collateral</li></ul>
        <Link to="/open-credit" className="cl-primary-btn focus-ring">Open Credit Line</Link>
      </div>
    );
  }

  return (
    <>
      {props.items.length > 0 ? (
        <div className="cl-grid" data-testid="cl-grid">
          {props.items.map((line) => (
            <CreditLineCard
              key={line.id}
              line={line}
              isSelected={props.selectedLines.includes(line.id)}
              onToggle={() => props.onToggle(line.id)}
              onSwapCollateral={props.onSwapCollateral}
              onRepay={() => props.onRepay(line.id)}
              onFreeze={props.onFreeze}
              onUnfreeze={props.onUnfreeze}
              onSchedule={() => props.onSchedule(line.id)}
              onDetails={props.onDetails}
            />
          ))}
        </div>
      ) : (
        <p role="status" style={{ color: "var(--muted)", margin: "1rem 0" }}>
          No current records on this page. Page positions are being held stable while live updates settle.
        </p>
      )}
      {props.pageCount > 1 && (
        <nav aria-label="Credit line pagination" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button type="button" className="cl-primary-btn focus-ring" onClick={() => props.onPageChange(Math.max(0, props.pageIndex - 1))} disabled={props.pageIndex === 0} style={{ opacity: props.pageIndex === 0 ? 0.5 : 1 }}>Previous</button>
          <span aria-live="polite">Page {props.pageIndex + 1} of {props.pageCount}</span>
          <button type="button" className="cl-primary-btn focus-ring" onClick={() => props.onPageChange(Math.min(props.pageCount - 1, props.pageIndex + 1))} disabled={props.pageIndex >= props.pageCount - 1} style={{ opacity: props.pageIndex >= props.pageCount - 1 ? 0.5 : 1 }}>Next</button>
        </nav>
      )}
    </>
  );
}
