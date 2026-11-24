/**
 * Pure TypeScript PDF statement generator for filtered transaction history.
 *
 * Generates a valid PDF 1.4 document with standard Type1 Helvetica fonts and
 * zero external dependencies. Amount formatting and accounting direction are
 * shared directly with `src/lib/transaction-csv.ts` so PDF and CSV exports
 * never disagree.
 */

import {
  DEFAULT_TRANSACTION_CSV_ASSET,
  formatTransactionCsvAmount,
  getTransactionCsvDecimals,
  getTransactionCsvDirection,
  type TransactionCsvRow,
} from "./transaction-csv";

export const TRANSACTION_PDF_VERSION = "v1";

export interface TransactionPdfFilters {
  line?: string;
  type?: string;
  status?: string;
  dateRange?: string;
  amountRange?: string;
  searchQuery?: string;
}

export interface TransactionPdfOptions {
  filters?: TransactionPdfFilters;
  generatedAt?: Date | string;
  asset?: string;
  decimals?: number;
  walletAddress?: string;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 36;
const MARGIN_RIGHT = 36;
const MARGIN_TOP = 756;
const MARGIN_BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const COL_DATE = { x: 36, maxChars: 16 };
const COL_LINE = { x: 124, maxChars: 20 };
const COL_TYPE = { x: 238, maxChars: 10 };
const COL_STATUS = { x: 296, maxChars: 11 };
const COL_AMOUNT = { x: 358, maxChars: 18 };
const COL_HASH = { x: 462, maxChars: 20 };

const NOTE_MAX_CHARS = 96;

/** Sanitize text to printable WinAnsi/ASCII and escape PDF literal string chars. */
function escapePdfText(input: string): string {
  const normalized = input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\r?\n/g, " ")
    .replace(/[^\x20-\x7E]/g, "?");

  return normalized
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function truncateText(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) return trimmed;
  if (maxChars <= 3) return trimmed.slice(0, maxChars);
  return `${trimmed.slice(0, maxChars - 3)}...`;
}

function wrapText(value: string, maxChars: number): string[] {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const words = cleaned.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      if (word.length <= maxChars) {
        current = word;
      } else {
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
      }
    } else if (current.length + 1 + word.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      if (word.length <= maxChars) {
        current = word;
      } else {
        for (let i = 0; i < word.length; i += maxChars) {
          const chunk = word.slice(i, i + maxChars);
          if (i + maxChars < word.length) {
            lines.push(chunk);
          } else {
            current = chunk;
          }
        }
      }
    }
  }

  if (current) lines.push(current);
  return lines;
}

function toUtcDateSegment(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatUtcTimestampShort(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return truncateText(value, COL_DATE.maxChars);
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function formatShortAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 14) return trimmed;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-6)}`;
}

function formatShortHash(txHash?: string): string {
  if (!txHash) return "-";
  const trimmed = txHash.trim();
  if (!trimmed) return "-";
  if (trimmed.length <= 16) return trimmed;
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`;
}

function buildFilterSummary(filters?: TransactionPdfFilters): string {
  if (!filters) return "None (All transactions)";
  const parts: string[] = [];
  if (filters.line && filters.line !== "all") {
    parts.push(`Line: ${filters.line}`);
  }
  if (filters.type && filters.type !== "all") {
    parts.push(`Type: ${filters.type}`);
  }
  if (filters.status && filters.status !== "all") {
    parts.push(`Status: ${filters.status}`);
  }
  if (filters.dateRange && filters.dateRange !== "all" && filters.dateRange !== "all-time") {
    parts.push(`Date: ${filters.dateRange}`);
  }
  if (filters.amountRange && filters.amountRange !== "all") {
    parts.push(`Amount: ${filters.amountRange}`);
  }
  if (filters.searchQuery && filters.searchQuery.trim()) {
    parts.push(`Search: "${filters.searchQuery.trim()}"`);
  }
  return parts.length > 0 ? parts.join(" | ") : "None (All transactions)";
}

/**
 * Build the versioned filename for a PDF statement export.
 * Mirrors `buildTransactionCsvFilename` using UTC dates.
 */
export function buildTransactionPdfFilename(
  rows: readonly TransactionCsvRow[],
): string {
  const dates = rows
    .map((row) => toUtcDateSegment(row.date))
    .filter((date): date is string => date !== null)
    .sort();

  const start = dates[0] ?? "all";
  const end = dates[dates.length - 1] ?? "all";

  return `creditra-transactions-${TRANSACTION_PDF_VERSION}-${start}-${end}.pdf`;
}

function drawText(
  ops: string[],
  text: string,
  x: number,
  y: number,
  font: "F1" | "F2",
  size: number,
): void {
  ops.push(`BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(text)}) Tj ET`);
}

function drawHorizontalRule(ops: string[], y: number): void {
  ops.push(`0.5 w ${MARGIN_LEFT} ${y} m ${MARGIN_LEFT + CONTENT_WIDTH} ${y} l S`);
}

function drawTableHeader(ops: string[], y: number): number {
  drawText(ops, "Date (UTC)", COL_DATE.x, y, "F2", 9);
  drawText(ops, "Credit Line", COL_LINE.x, y, "F2", 9);
  drawText(ops, "Type", COL_TYPE.x, y, "F2", 9);
  drawText(ops, "Status", COL_STATUS.x, y, "F2", 9);
  drawText(ops, "Amount", COL_AMOUNT.x, y, "F2", 9);
  drawText(ops, "Tx Hash", COL_HASH.x, y, "F2", 9);
  drawHorizontalRule(ops, y - 5);
  return y - 18;
}

/**
 * Assemble raw PDF 1.4 bytes from per-page content streams.
 */
function assemblePdf(pageStreams: string[]): Uint8Array {
  const objects: string[] = [];
  const pageObjNumbers: number[] = [];

  // Object 1: Catalog, Object 2: Pages, Object 3: Helvetica, Object 4: Helvetica-Bold
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(""); // Placeholder for Pages object
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  for (const stream of pageStreams) {
    const contentObjNum = objects.length + 1;
    const pageObjNum = objects.length + 2;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>`,
    );
    pageObjNumbers.push(pageObjNum);
  }

  const kidsRef = pageObjNumbers.map((n) => `${n} 0 R`).join(" ");
  objects[1] = `<< /Type /Pages /Kids [${kidsRef}] /Count ${pageObjNumbers.length} >>`;

  const chunks: string[] = ["%PDF-1.4\n"];
  const offsets: number[] = [0];
  let byteOffset = chunks[0].length;

  for (let i = 0; i < objects.length; i++) {
    offsets.push(byteOffset);
    const entry = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    chunks.push(entry);
    byteOffset += entry.length;
  }

  const xrefOffset = byteOffset;
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  for (let i = 1; i <= objects.length; i++) {
    chunks.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }

  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  const pdfString = chunks.join("");
  const bytes = new Uint8Array(pdfString.length);
  for (let i = 0; i < pdfString.length; i++) {
    bytes[i] = pdfString.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/**
 * Build a PDF statement Blob for the supplied filtered transaction rows.
 */
export function buildTransactionPdf(
  rows: readonly TransactionCsvRow[],
  options: TransactionPdfOptions = {},
): Blob {
  const asset = options.asset ?? DEFAULT_TRANSACTION_CSV_ASSET;
  const decimals = options.decimals ?? getTransactionCsvDecimals(asset);

  const generatedDate =
    options.generatedAt instanceof Date
      ? options.generatedAt
      : options.generatedAt
        ? new Date(options.generatedAt)
        : new Date();
  const generatedLabel = Number.isNaN(generatedDate.getTime())
    ? "Unknown"
    : generatedDate.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const dates = rows
    .map((row) => toUtcDateSegment(row.date))
    .filter((date): date is string => date !== null)
    .sort();
  const dateRangeLabel =
    dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : "No dates";

  const filterSummary = buildFilterSummary(options.filters);

  const pages: string[][] = [];
  let ops: string[] = [];
  let y = MARGIN_TOP;

  const startFirstPage = () => {
    ops = [];
    y = MARGIN_TOP;
    drawText(ops, "Creditra Transaction Statement", MARGIN_LEFT, y, "F2", 16);
    y -= 18;

    const metaParts = [
      `Generated: ${generatedLabel}`,
      `Date Range: ${dateRangeLabel}`,
      `Asset: ${asset}`,
    ];
    if (options.walletAddress) {
      metaParts.push(`Wallet: ${formatShortAddress(options.walletAddress)}`);
    }
    drawText(ops, metaParts.join(" | "), MARGIN_LEFT, y, "F1", 8.5);
    y -= 13;

    const filterLines = wrapText(`Filters: ${filterSummary}`, 105);
    for (const line of filterLines) {
      drawText(ops, line, MARGIN_LEFT, y, "F1", 8.5);
      y -= 12;
    }

    drawHorizontalRule(ops, y + 4);
    y -= 14;
    y = drawTableHeader(ops, y);
  };

  const startContinuationPage = () => {
    pages.push(ops);
    ops = [];
    y = MARGIN_TOP;
    drawText(ops, "Creditra Transaction Statement (continued)", MARGIN_LEFT, y, "F2", 12);
    y -= 18;
    y = drawTableHeader(ops, y);
  };

  startFirstPage();

  let totalDebits = 0;
  let totalCredits = 0;
  let netAmount = 0;

  if (rows.length === 0) {
    drawText(ops, "No transactions match the current filters.", MARGIN_LEFT, y, "F1", 10);
    y -= 18;
  } else {
    for (const row of rows) {
      const direction = getTransactionCsvDirection(row.type);
      const magnitude = Math.abs(Number.isFinite(row.amount) ? row.amount : 0);
      const signedMagnitude =
        direction === "debit" ? magnitude : direction === "credit" ? -magnitude : 0;

      if (direction === "debit") {
        totalDebits += magnitude;
      } else if (direction === "credit") {
        totalCredits += magnitude;
      }
      netAmount += signedMagnitude;

      const noteLines = row.note ? wrapText(`Note: ${row.note}`, NOTE_MAX_CHARS) : [];
      const rowHeight = 14 + noteLines.length * 11 + 4;

      if (y - rowHeight < MARGIN_BOTTOM) {
        startContinuationPage();
      }

      const formattedSigned = `${formatTransactionCsvAmount(signedMagnitude, decimals)} ${asset}`;

      drawText(ops, formatUtcTimestampShort(row.date), COL_DATE.x, y, "F1", 8.5);
      drawText(ops, truncateText(row.lineName, COL_LINE.maxChars), COL_LINE.x, y, "F1", 8.5);
      drawText(ops, truncateText(row.type, COL_TYPE.maxChars), COL_TYPE.x, y, "F1", 8.5);
      drawText(ops, truncateText(row.status, COL_STATUS.maxChars), COL_STATUS.x, y, "F1", 8.5);
      drawText(ops, truncateText(formattedSigned, COL_AMOUNT.maxChars), COL_AMOUNT.x, y, "F1", 8.5);
      drawText(ops, formatShortHash(row.txHash), COL_HASH.x, y, "F1", 8.5);
      y -= 13;

      for (const noteLine of noteLines) {
        drawText(ops, noteLine, COL_DATE.x + 10, y, "F1", 7.5);
        y -= 11;
      }

      y -= 4;
    }
  }

  // Totals footer
  if (y - 36 < MARGIN_BOTTOM) {
    startContinuationPage();
  }

  drawHorizontalRule(ops, y + 4);
  y -= 12;
  const totalsLine =
    `Total Rows: ${rows.length} | ` +
    `Total Debits: ${formatTransactionCsvAmount(totalDebits, decimals)} ${asset} | ` +
    `Total Credits: ${formatTransactionCsvAmount(totalCredits, decimals)} ${asset} | ` +
    `Net: ${formatTransactionCsvAmount(netAmount, decimals)} ${asset}`;
  drawText(ops, totalsLine, MARGIN_LEFT, y, "F2", 8.5);

  pages.push(ops);

  const totalPages = pages.length;
  const streams = pages.map((pageOps, index) => {
    drawText(
      pageOps,
      `Page ${index + 1} of ${totalPages}`,
      PAGE_WIDTH - MARGIN_RIGHT - 62,
      28,
      "F1",
      8,
    );
    return pageOps.join("\n");
  });

  const pdfBytes = assemblePdf(streams);
  return new Blob([pdfBytes], { type: "application/pdf" });
}

/**
 * Trigger a browser download for a generated PDF Blob.
 */
export function downloadPdf(filename: string, blob: Blob): void {
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
