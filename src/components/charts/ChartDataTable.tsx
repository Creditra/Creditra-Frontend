import { useState } from 'react';
import './charts.css';

export interface ChartDataTableColumn {
  /** Column header text. */
  header: string;
}

export interface ChartDataTableRow {
  /** Stable React key for the row. */
  key: string;
  /** Ordered cell values matching `columns`. */
  cells: readonly string[];
}

export interface ChartDataTableProps {
  /** Accessible name for the `<table>` element. */
  ariaLabel: string;
  /** Optional `<caption>` text. */
  caption?: string;
  /** Optional CSS class for `<caption>` (e.g. `"sr-only"`). */
  captionClassName?: string;
  /** Column definitions. */
  columns: readonly ChartDataTableColumn[];
  /** Data rows. */
  rows: readonly ChartDataTableRow[];
  /**
   * When `true` (default), the table is visually hidden with `.sr-only`
   * while remaining available to screen readers.
   */
  visuallyHidden?: boolean;
  /**
   * When `true`, renders a toggle button allowing sighted users to reveal or
   * hide the underlying data table.
   */
  toggleable?: boolean;
  /** Render the first cell of each row as `<th scope="row">`. */
  firstCellAsRowHeader?: boolean;
}

/**
 * Accessible tabular fallback for SVG charts (WCAG 1.1.1).
 * Supports screen-reader-only (`sr-only`), visible, or user-toggleable modes.
 */
export function ChartDataTable({
  ariaLabel,
  caption,
  captionClassName,
  columns,
  rows,
  visuallyHidden = true,
  toggleable = false,
  firstCellAsRowHeader = false,
}: ChartDataTableProps) {
  const [expanded, setExpanded] = useState(!visuallyHidden);
  const isHidden = toggleable ? !expanded : visuallyHidden;

  return (
    <>
      {toggleable ? (
        <button
          type="button"
          className="chart-data-table__toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Hide data table' : 'Show data table'}
        </button>
      ) : null}

      <table
        className={isHidden ? 'sr-only' : undefined}
        aria-label={ariaLabel}
      >
        {caption ? (
          <caption className={captionClassName}>{caption}</caption>
        ) : null}
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.header} scope="col">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, idx) =>
                idx === 0 && firstCellAsRowHeader ? (
                  <th key={idx} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={idx}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
