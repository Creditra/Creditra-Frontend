/**
 * TransactionStatus.patterns.test.tsx
 *
 * Focused accessibility tests for the pattern-fill enhancement added to
 * TransactionStatus as part of the FWC26 Stellar Wave campaign
 * (DrawCreditPage color-blind accessibility, issue #586 v7).
 *
 * What we verify
 * ──────────────
 * 1.  Pending — icon background carries BOTH the colour-tint class
 *     (dc-status-icon-bg--accent) AND the geometry-pattern class
 *     (dc-status-icon-bg--pattern-pending).
 * 2.  Success — icon background carries dc-status-icon-bg--success AND
 *     dc-status-icon-bg--pattern-success.
 * 3.  Error   — icon background carries dc-status-icon-bg--error AND
 *     dc-status-icon-bg--pattern-error.
 * 4.  The base dc-status-icon-bg class is always present so layout tokens
 *     apply regardless of status.
 * 5.  The three pattern classes are mutually exclusive (no crosstalk).
 * 6.  data-status attribute matches the transaction status string so
 *     integration tests and E2E selectors can target it without parsing
 *     class names.
 * 7.  Status role and aria-live are present for screen-reader announcement.
 * 8.  The status icon is aria-hidden so it doesn't double-announce.
 * 9.  Meaningful status text ("Draw Successful", "Draw Failed", "Processing")
 *     is rendered so the outcome is conveyed without color or pattern.
 *
 * WCAG coverage
 * ─────────────
 * SC 1.4.1 – Use of Color: pattern classes provide geometry cue beyond color.
 * SC 4.1.3 – Status Messages: role="status" + aria-live="polite".
 */

import { render, screen } from "@testing-library/react";
import { TransactionStatus } from "@/components/TransactionStatus";
import type { Transaction } from "@/types/draw-credit.types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE: Omit<Transaction, "status" | "message"> = {
  id: "TXN-TEST-001",
  creditLineId: "CL-001",
  amount: 1000,
  timestamp: new Date("2026-07-25T12:00:00Z"),
};

const pending: Transaction = { ...BASE, status: "pending" };
const success: Transaction = { ...BASE, status: "success" };
const error: Transaction = { ...BASE, status: "error", message: "Insufficient funds" };

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Returns the status icon-background element for the rendered component.
 * It is identified by the data-status attribute set in TransactionStatus.tsx.
 */
function getIconBg(status: Transaction["status"]): HTMLElement {
  const el = document.querySelector(`[data-status="${status}"]`) as HTMLElement | null;
  if (!el) throw new Error(`Icon-bg element with data-status="${status}" not found`);
  return el;
}

// ─── 1. Pending ──────────────────────────────────────────────────────────────

describe("TransactionStatus — pattern fills (WCAG 1.4.1)", () => {
  describe("pending status", () => {
    beforeEach(() => {
      render(<TransactionStatus transaction={pending} onNewDraw={() => {}} />);
    });

    it("1a. icon-bg carries the colour-tint class (dc-status-icon-bg--accent)", () => {
      expect(getIconBg("pending")).toHaveClass("dc-status-icon-bg--accent");
    });

    it("1b. icon-bg carries the geometry-pattern class (dc-status-icon-bg--pattern-pending)", () => {
      expect(getIconBg("pending")).toHaveClass("dc-status-icon-bg--pattern-pending");
    });

    it("1c. icon-bg carries the base layout class (dc-status-icon-bg)", () => {
      expect(getIconBg("pending")).toHaveClass("dc-status-icon-bg");
    });

    it("1d. does NOT carry the success or error pattern classes", () => {
      const el = getIconBg("pending");
      expect(el).not.toHaveClass("dc-status-icon-bg--pattern-success");
      expect(el).not.toHaveClass("dc-status-icon-bg--pattern-error");
    });
  });

  // ─── 2. Success ────────────────────────────────────────────────────────────

  describe("success status", () => {
    beforeEach(() => {
      render(<TransactionStatus transaction={success} onNewDraw={() => {}} />);
    });

    it("2a. icon-bg carries the colour-tint class (dc-status-icon-bg--success)", () => {
      expect(getIconBg("success")).toHaveClass("dc-status-icon-bg--success");
    });

    it("2b. icon-bg carries the geometry-pattern class (dc-status-icon-bg--pattern-success)", () => {
      expect(getIconBg("success")).toHaveClass("dc-status-icon-bg--pattern-success");
    });

    it("2c. icon-bg carries the base layout class (dc-status-icon-bg)", () => {
      expect(getIconBg("success")).toHaveClass("dc-status-icon-bg");
    });

    it("2d. does NOT carry the pending or error pattern classes", () => {
      const el = getIconBg("success");
      expect(el).not.toHaveClass("dc-status-icon-bg--pattern-pending");
      expect(el).not.toHaveClass("dc-status-icon-bg--pattern-error");
    });
  });

  // ─── 3. Error ──────────────────────────────────────────────────────────────

  describe("error status", () => {
    beforeEach(() => {
      render(<TransactionStatus transaction={error} onNewDraw={() => {}} />);
    });

    it("3a. icon-bg carries the colour-tint class (dc-status-icon-bg--error)", () => {
      expect(getIconBg("error")).toHaveClass("dc-status-icon-bg--error");
    });

    it("3b. icon-bg carries the geometry-pattern class (dc-status-icon-bg--pattern-error)", () => {
      expect(getIconBg("error")).toHaveClass("dc-status-icon-bg--pattern-error");
    });

    it("3c. icon-bg carries the base layout class (dc-status-icon-bg)", () => {
      expect(getIconBg("error")).toHaveClass("dc-status-icon-bg");
    });

    it("3d. does NOT carry the pending or success pattern classes", () => {
      const el = getIconBg("error");
      expect(el).not.toHaveClass("dc-status-icon-bg--pattern-pending");
      expect(el).not.toHaveClass("dc-status-icon-bg--pattern-success");
    });
  });

  // ─── 4. data-status attribute ──────────────────────────────────────────────

  describe("data-status attribute", () => {
    it("4a. pending transaction sets data-status='pending'", () => {
      render(<TransactionStatus transaction={pending} onNewDraw={() => {}} />);
      expect(document.querySelector("[data-status='pending']")).toBeInTheDocument();
    });

    it("4b. success transaction sets data-status='success'", () => {
      render(<TransactionStatus transaction={success} onNewDraw={() => {}} />);
      expect(document.querySelector("[data-status='success']")).toBeInTheDocument();
    });

    it("4c. error transaction sets data-status='error'", () => {
      render(<TransactionStatus transaction={error} onNewDraw={() => {}} />);
      expect(document.querySelector("[data-status='error']")).toBeInTheDocument();
    });
  });

  // ─── 5. Screen-reader / WCAG 4.1.3 status message ─────────────────────────

  describe("screen-reader accessibility (WCAG 4.1.3)", () => {
    it("5a. wrapper has role='status' for polite announcement", () => {
      render(<TransactionStatus transaction={success} onNewDraw={() => {}} />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("5b. wrapper has aria-live='polite'", () => {
      render(<TransactionStatus transaction={success} onNewDraw={() => {}} />);
      expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    });
  });

  // ─── 6. Meaningful text — outcome conveyed without color/pattern ───────────

  describe("text-based status identification (WCAG 1.4.1)", () => {
    it("6a. pending renders 'Processing' heading", () => {
      render(<TransactionStatus transaction={pending} onNewDraw={() => {}} />);
      expect(screen.getByRole("heading", { name: /processing/i })).toBeInTheDocument();
    });

    it("6b. success renders 'Draw Successful' heading", () => {
      render(<TransactionStatus transaction={success} onNewDraw={() => {}} />);
      expect(screen.getByRole("heading", { name: /draw successful/i })).toBeInTheDocument();
    });

    it("6c. error renders 'Draw Failed' heading", () => {
      render(<TransactionStatus transaction={error} onNewDraw={() => {}} />);
      expect(screen.getByRole("heading", { name: /draw failed/i })).toBeInTheDocument();
    });

    it("6d. error shows the transaction.message text", () => {
      render(<TransactionStatus transaction={error} onNewDraw={() => {}} />);
      expect(screen.getByText("Insufficient funds")).toBeInTheDocument();
    });

    it("6e. error without message falls back to generic copy", () => {
      const errorNoMsg: Transaction = { ...BASE, status: "error" };
      render(<TransactionStatus transaction={errorNoMsg} onNewDraw={() => {}} />);
      expect(screen.getByText(/an error occurred/i)).toBeInTheDocument();
    });
  });

  // ─── 7. Icon aria-hidden ───────────────────────────────────────────────────

  describe("icon aria-hidden (decorative icon)", () => {
    it("7a. the Lucide status icon is aria-hidden so it doesn't double-announce", () => {
      render(<TransactionStatus transaction={success} onNewDraw={() => {}} />);
      // The SVG icons rendered by Lucide are passed aria-hidden="true" via STATUS_CONFIG props.
      // Query all SVG elements with aria-hidden to confirm at least one exists.
      const hiddenIcons = document.querySelectorAll("svg[aria-hidden='true']");
      expect(hiddenIcons.length).toBeGreaterThan(0);
    });
  });
});
