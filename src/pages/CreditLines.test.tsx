import { render, screen, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CreditLines from './CreditLines';

// CL-2023-004 ("Emergency Reserve Line") is the only Defaulted entry in MOCK_CREDIT_LINES
const DEFAULTED_ID = "CL-2023-004";
const DEFAULTED_NAME = "Emergency Reserve Line";

// All non-defaulted IDs from mock data
const NON_DEFAULTED_IDS = [
  "CL-2024-001",
  "CL-2024-002",
  "CL-2023-003",
  "CL-2022-005",
  "CL-2025-006",
];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// CreditLines shows a loading skeleton for the first 500ms (see the
// useEffect/setTimeout in src/pages/CreditLines.tsx). Advance past it here
// so every existing test below keeps seeing the already-loaded state it
// expected before that skeleton was added, with no changes to the tests
// themselves.
function renderCreditLines() {
  const result = render(
    <MemoryRouter>
      <CreditLines />
    </MemoryRouter>,
  );
  act(() => {
    vi.advanceTimersByTime(500);
  });
  return result;
}

describe("CreditLines — Defaulted row visual treatment (issue #223)", () => {
  it("shows a loading skeleton on first paint and then renders the content", () => {
    vi.useFakeTimers();

    renderCreditLines();

    expect(
      screen.getByRole("status", { name: /loading credit lines/i }),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(
      screen.queryByRole("status", { name: /loading credit lines/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /credit lines/i })).toBeInTheDocument();

    vi.useRealTimers();
  });

  // ─── Card view ────────────────────────────────────────────────────────────

  describe("card view", () => {
    it("applies cl-row--defaulted class to the Defaulted card", () => {
      renderCreditLines();

      // The defaulted card carries aria-label — use it as a stable selector
      const defaultedCard = screen.getByLabelText(
        `Credit line ${DEFAULTED_ID} is defaulted`,
      );
      expect(defaultedCard).toHaveClass("cl-row--defaulted");
    });

    it("does NOT apply cl-row--defaulted class to non-defaulted cards", () => {
      renderCreditLines();

      // Find all cards that do NOT have the defaulted aria-label
      const allHeadings = screen.getAllByRole("heading", { level: 3 });

      allHeadings
        .filter((h) => h.textContent !== DEFAULTED_NAME)
        .forEach((heading) => {
          // Walk up to the card root (the div with cl-card)
          const card = heading.closest(".cl-card");
          expect(card).not.toHaveClass("cl-row--defaulted");
        });
    });

    it("sets aria-label on the Defaulted card", () => {
      renderCreditLines();

      const defaultedCard = screen.getByLabelText(
        `Credit line ${DEFAULTED_ID} is defaulted`,
      );
      expect(defaultedCard).toBeInTheDocument();
      expect(defaultedCard).toHaveAttribute(
        "aria-label",
        `Credit line ${DEFAULTED_ID} is defaulted`,
      );
    });

    it("does NOT set aria-label on non-defaulted cards", () => {
      renderCreditLines();

      const allHeadings = screen.getAllByRole("heading", { level: 3 });

      allHeadings
        .filter((h) => h.textContent !== DEFAULTED_NAME)
        .forEach((heading) => {
          const card = heading.closest(".cl-card");
          expect(card).not.toHaveAttribute("aria-label");
        });
    });
  });

  // ─── Status-filter sanity check ───────────────────────────────────────────

  describe("only Defaulted status gets the treatment", () => {
    it("exactly one card has cl-row--defaulted when all statuses are shown", () => {
      renderCreditLines();

      const defaultedCards = document.querySelectorAll(".cl-row--defaulted");
      expect(defaultedCards).toHaveLength(1);
    });

    it("cl-row--defaulted card contains the correct credit line name", () => {
      renderCreditLines();

      const defaultedCard = document.querySelector(".cl-row--defaulted");
      expect(defaultedCard).not.toBeNull();
      expect(
        within(defaultedCard as HTMLElement).getByRole("heading", { level: 3 }),
      ).toHaveTextContent(DEFAULTED_NAME);
    });
  });

  describe("APR history charts", () => {
    it("renders one APR history chart per credit line card", () => {
      renderCreditLines();

      const charts = screen.getAllByTestId("apr-history-chart");
      expect(charts).toHaveLength(MOCK_CREDIT_LINES.length);
    });

    it("labels each APR history section with the credit line name", () => {
      renderCreditLines();

      expect(
        screen.getByRole("region", {
          name: /apr history for primary business line/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("region", {
          name: /apr history for emergency reserve line/i,
        }),
      ).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("renders the EmptyState component when no lines match the filter", () => {
      renderCreditLines();

      const selects = screen.getAllByRole("combobox");
      // The first one is Status, the second is Sort By
      const statusSelect = selects[0];

      // Assuming there are no 'Closed' lines in mock data
      fireEvent.change(statusSelect, { target: { value: "Closed" } });

      // The EmptyState component uses role="status"
      const emptyState = screen.getByRole("status");
      expect(emptyState).toBeInTheDocument();
      
      // The heading should say "No matching credit lines"
      const heading = within(emptyState).getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("No matching credit lines");
      
      // CTA button should be "Clear Filters"
      const clearBtn = within(emptyState).getByRole("button", { name: "Clear Filters" });
      expect(clearBtn).toBeInTheDocument();
    });
  });
});
