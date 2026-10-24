import { afterEach, describe, expect, it } from "vitest";
import {
  TRANSACTION_CSV_HEADERS,
  buildTransactionCsv,
  buildTransactionCsvFilename,
  type TransactionCsvRow,
} from "./transaction-csv";

const DRAW_ROW: TransactionCsvRow = {
  type: "Draw",
  amount: 50000,
  date: "2025-02-18T10:30:00Z",
  note: "Equipment purchase",
  status: "Completed",
  txHash: "0xabc123def456",
  lineId: "CL-2024-001",
  lineName: "Primary Business Line",
};

const HEADER = TRANSACTION_CSV_HEADERS.join(",");

function firstDataLine(csv: string): string {
  return csv.split("\r\n")[1] ?? "";
}

describe("buildTransactionCsv", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("emits the exact schema header and a fixture row with no preamble", () => {
    const csv = buildTransactionCsv([DRAW_ROW], { asset: "USD" });

    expect(csv.split("\r\n")[0]).toBe(HEADER);
    expect(firstDataLine(csv)).toBe(
      "2025-02-18T10:30:00.000Z,Draw,debit,50000.00,50000.00,USD,Completed,CL-2024-001,Primary Business Line,Equipment purchase,0xabc123def456",
    );
  });

  it("is identical under TZ=Asia/Tokyo and TZ=UTC", () => {
    process.env.TZ = "Asia/Tokyo";
    const tokyo = buildTransactionCsv([DRAW_ROW], { asset: "USD" });

    process.env.TZ = "UTC";
    const utc = buildTransactionCsv([DRAW_ROW], { asset: "USD" });

    expect(tokyo).toBe(utc);
  });

  it("marks a repayment as a credit with a negative signed amount", () => {
    const line = firstDataLine(
      buildTransactionCsv(
        [
          {
            ...DRAW_ROW,
            type: "Repay",
            amount: 12500,
            note: "Monthly repayment",
          },
        ],
        { asset: "USD" },
      ),
    );

    expect(line).toContain(",Repay,credit,12500.00,-12500.00,");
  });

  it("marks a status change as direction=none with zero amounts", () => {
    const line = firstDataLine(
      buildTransactionCsv(
        [
          {
            ...DRAW_ROW,
            type: "StatusChange",
            amount: 0,
            note: "Line closed",
            txHash: undefined,
          },
        ],
        { asset: "USD" },
      ),
    );

    expect(line).toContain(",StatusChange,none,0.00,0.00,");
  });

  it("quotes notes containing commas and quotes", () => {
    const line = firstDataLine(
      buildTransactionCsv(
        [
          {
            ...DRAW_ROW,
            note: 'Paid, then asked for "review"',
          },
        ],
        { asset: "USD" },
      ),
    );

    expect(line).toContain('"Paid, then asked for ""review"""');
  });

  it("uses 7 decimals for on-chain assets and 2 for fiat assets", () => {
    const onChain = firstDataLine(
      buildTransactionCsv([{ ...DRAW_ROW, amount: 123.456789 }], {
        asset: "XLM",
      }),
    );
    const fiat = firstDataLine(
      buildTransactionCsv([{ ...DRAW_ROW, amount: 123.456789 }], {
        asset: "USD",
      }),
    );

    expect(onChain).toContain(",debit,123.4567890,123.4567890,XLM,");
    expect(fiat).toContain(",debit,123.46,123.46,USD,");
  });

  it("never leaks floating-point artefacts into the export", () => {
    const line = firstDataLine(
      buildTransactionCsv([{ ...DRAW_ROW, amount: 0.1 + 0.2 }], {
        asset: "USD",
      }),
    );

    expect(line).toContain(",debit,0.30,0.30,");
    expect(line).not.toContain("0.30000000000000004");
  });

  it("does not use the locale display timestamp from the transaction table", () => {
    const csv = buildTransactionCsv([DRAW_ROW], { asset: "USD" });

    expect(csv).toContain("2025-02-18T10:30:00.000Z");
    expect(csv).not.toContain("Feb 18, 2025, 10:30 AM");
  });
});

describe("buildTransactionCsvFilename", () => {
  it("uses the versioned schema name and UTC dates from the rows", () => {
    const filename = buildTransactionCsvFilename([
      { ...DRAW_ROW, date: "2025-02-18T23:30:00Z" },
      { ...DRAW_ROW, date: "2025-02-19T00:30:00Z" },
    ]);

    expect(filename).toBe(
      "creditra-transactions-v1-2025-02-18-2025-02-19.csv",
    );
  });

  it("keeps the filename date aligned with timestamp_utc across local midnight", () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "Asia/Tokyo";

    try {
      const row = { ...DRAW_ROW, date: "2025-02-18T23:30:00Z" };
      const csv = buildTransactionCsv([row], { asset: "USD" });
      const filename = buildTransactionCsvFilename([row]);

      const timestamp = firstDataLine(csv).split(",")[0];
      expect(timestamp.startsWith("2025-02-18")).toBe(true);
      expect(filename).toBe(
        "creditra-transactions-v1-2025-02-18-2025-02-18.csv",
      );
    } finally {
      process.env.TZ = originalTz;
    }
  });

  it("falls back to 'all' when there are no valid dates", () => {
    expect(buildTransactionCsvFilename([])).toBe(
      "creditra-transactions-v1-all-all.csv",
    );
  });
});
