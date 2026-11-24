/**
 * Small, dependency-free CSV helpers.
 *
 * We keep export logic local to the app to avoid adding a third-party
 * CSV dependency for a narrow, security-sensitive use case.
 */

export type CsvCell = string | number | boolean | null | undefined;

const FORMULA_PREFIX_RE = /^[=+\-@]/;

/**
 * Escape one CSV field according to RFC 4180-style rules.
 *
 * Fields starting with spreadsheet formula characters (=, +, -, @) are
 * prefixed with a single quote to neutralize formula injection.
 * Fields containing commas, quotes, carriage returns, or newlines are
 * wrapped in double quotes. Embedded quotes are doubled.
 */
export function escapeCsvCell(value: CsvCell): string {
  const normalized = value == null ? "" : String(value);
  const safe = FORMULA_PREFIX_RE.test(normalized) ? `'${normalized}` : normalized;
  const escaped = safe.replace(/"/g, '""');

  return /[",\r\n]/.test(safe) ? `"${escaped}"` : escaped;
}

/**
 * Convert a header row and data rows into a CSV string.
 */
export function toCsv(
  headers: readonly CsvCell[],
  rows: ReadonlyArray<readonly CsvCell[]>,
): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
}

/**
 * Trigger a browser download for a UTF-8 CSV file.
 *
 * A BOM is prepended to improve spreadsheet compatibility for users who
 * open the file in Excel or similar tools.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}
