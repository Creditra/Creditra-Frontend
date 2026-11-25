import { describe, expect, it } from "vitest";
import {
  buildTransactionPdf,
  buildTransactionPdfFilename,
} from "./transaction-pdf";
import type { TransactionCsvRow } from "./transaction-csv";

async function readBlobAsString(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
}

function extractPdfTextObjects(pdfText: string): string[] {
  const matches: string[] = [];
  const regex = /\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(pdfText)) !== null) {
    matches.push(
      match[1]
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\"),
    );
  }
  return matches;
}

const sampleRows: TransactionCsvRow[] = [
  {
    type: "Draw",
    amount: 1250.5,
    date: "2025-02-10T14:30:00Z",
    status: "Completed",
    lineId: "line-1",
    lineName: "Working Capital",
    note: "Invoice batch #42",
    txHash: "0x1234567890abcdef1234567890abcdef",
  },
  {
    type: "Repay",
    amount: 500,
    date: "2025-02-15T09:15:00Z",
    status: "Completed",
    lineId: "line-1",
    lineName: "Working Capital",
    txHash: "0xabcdef1234567890abcdef1234567890",
  },
];

describe("transaction-pdf", () => {
  it("builds a versioned UTC filename matching the CSV convention", () => {
    expect(buildTransactionPdfFilename(sampleRows)).toBe(
      "creditra-transactions-v1-2025-02-10-2025-02-15.pdf",
    );
    expect(buildTransactionPdfFilename([])).toBe(
      "creditra-transactions-v1-all-all.pdf",
    );
  });

  it("handles empty input and produces valid PDF bytes starting with %PDF-", async () => {
    const blob = buildTransactionPdf([], {
      generatedAt: "2025-02-20T12:00:00Z",
      asset: "USD",
    });

    expect(blob.type).toBe("application/pdf");
    const pdfText = await readBlobAsString(blob);
    expect(pdfText.startsWith("%PDF-")).toBe(true);
    expect(pdfText).toContain("%%EOF");

    const texts = extractPdfTextObjects(pdfText);
    expect(texts).toContain("Creditra Transaction Statement");
    expect(texts).toContain("No transactions match the current filters.");
    expect(texts.some((t) => t.includes("Total Rows: 0"))).toBe(true);
  });

  it("renders negative signed amounts for Repay rows and reconciles totals", async () => {
    const blob = buildTransactionPdf(sampleRows, {
      generatedAt: "2025-02-20T12:00:00Z",
      asset: "USD",
    });

    const pdfText = await readBlobAsString(blob);
    expect(pdfText.startsWith("%PDF-")).toBe(true);

    const texts = extractPdfTextObjects(pdfText);
    expect(texts).toContain("1250.50 USD");
    expect(texts).toContain("-500.00 USD");
    expect(
      texts.some(
        (t) =>
          t.includes("Total Rows: 2") &&
          t.includes("Total Debits: 1250.50 USD") &&
          t.includes("Total Credits: 500.00 USD") &&
          t.includes("Net: 750.50 USD"),
      ),
    ).toBe(true);
  });

  it("includes header filter summary and shortened wallet address", async () => {
    const blob = buildTransactionPdf(sampleRows, {
      generatedAt: "2025-02-20T12:00:00Z",
      asset: "USDC",
      walletAddress: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      filters: {
        line: "Working Capital",
        type: "Draw",
        status: "Completed",
        dateRange: "30d",
        searchQuery: "Invoice",
      },
    });

    const pdfText = await readBlobAsString(blob);
    const texts = extractPdfTextObjects(pdfText);

    expect(texts.some((t) => t.includes("Wallet: GAAZI4...KOCCWN7"))).toBe(true);
    expect(texts.some((t) => t.includes("Line: Working Capital"))).toBe(true);
    expect(texts.some((t) => t.includes("Type: Draw"))).toBe(true);
    expect(texts.some((t) => t.includes('Search: "Invoice"'))).toBe(true);
  });

  it("wraps long notes across multiple lines without dropping text", async () => {
    const longNote =
      "Quarterly settlement memo for enterprise treasury reconciliation across multiple regional accounts and settlement windows (Q1-2025).";
    const blob = buildTransactionPdf(
      [
        {
          ...sampleRows[0],
          note: longNote,
        },
      ],
      { generatedAt: "2025-02-20T12:00:00Z" },
    );

    const pdfText = await readBlobAsString(blob);
    const texts = extractPdfTextObjects(pdfText);
    const noteLines = texts.filter(
      (t) => t.startsWith("Note:") || t.includes("(Q1-2025)."),
    );
    expect(noteLines.length).toBeGreaterThanOrEqual(2);
    expect(texts.join(" ")).toContain("(Q1-2025).");
  });

  it("paginates across multiple pages with repeated table headers", async () => {
    const manyRows: TransactionCsvRow[] = Array.from({ length: 60 }, (_, i) => ({
      type: i % 2 === 0 ? "Draw" : "Repay",
      amount: 100 + i,
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
      status: "Completed",
      lineId: `line-${i % 3}`,
      lineName: `Credit Line ${i % 3}`,
      txHash: `0x${String(i).padStart(16, "0")}`,
    }));

    const blob = buildTransactionPdf(manyRows, {
      generatedAt: "2025-02-20T12:00:00Z",
    });

    const pdfText = await readBlobAsString(blob);
    expect(pdfText.startsWith("%PDF-")).toBe(true);

    const texts = extractPdfTextObjects(pdfText);
    const page1Footer = texts.find((t) => /^Page 1 of (\d+)$/.test(t));
    expect(page1Footer).toBeDefined();
    const totalPages = Number(page1Footer!.match(/of (\d+)$/)![1]);
    expect(totalPages).toBeGreaterThan(1);

    // Table header "Date (UTC)" should be repeated once per page
    const headerCount = texts.filter((t) => t === "Date (UTC)").length;
    expect(headerCount).toBe(totalPages);
    expect(texts).toContain(`Page ${totalPages} of ${totalPages}`);
  });
});
