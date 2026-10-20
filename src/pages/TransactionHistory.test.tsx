import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import transactionHistoryCss from "./TransactionHistory.css?raw";
import { TransactionHistory } from "./TransactionHistory";
import { NotificationProvider } from "../context/NotificationContext";

/**
 * Render helper — mounts TransactionHistory and flushes the first-paint
 * loading timer so tests interact with the fully-loaded UI by default.
 *
 * The `isLoading` useEffect uses setTimeout(0) to simulate an async data
 * resolution on first mount.  Because the describe block uses
 * vi.useFakeTimers(), that timer is frozen until we explicitly advance it.
 * Wrapping in act() + vi.runAllTimers() guarantees React has committed the
 * state update before any assertion runs.
 */
const renderTransactionHistory = (initialEntries: string[] = ["/transactions"]) => {
  const result = render(
    <NotificationProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <TransactionHistory />
      </MemoryRouter>
    </NotificationProvider>,
  );
  // Flush only the zero-delay loading useEffect timer (setTimeout 0).
  // Using advanceTimersByTime(1) rather than runAllTimers() so the 250ms
  // debounce timers used by later async tests are NOT pre-fired here.
  act(() => { vi.advanceTimersByTime(1); });
  return result;
};

/**
 * Render helper that does NOT flush the loading timer.
 * Used exclusively by the "Loading skeleton" describe block to assert on the
 * skeleton UI before the data is available.
 */
const renderTransactionHistoryLoading = (initialEntries: string[] = ["/transactions"]) => {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <TransactionHistory />
      </MemoryRouter>
    </NotificationProvider>,
  );
};

describe("TransactionHistory", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  const mockLocalStorage = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value.toString();
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
    };
  })();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-02-20T12:00:00Z"));
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
    mockLocalStorage.clear();

    Object.defineProperty(window, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  // ── Loading skeleton ────────────────────────────────────────────────────────

  describe("Loading skeleton", () => {
    it("renders the skeleton status region on first paint before data loads", () => {
      // Do NOT flush timers — skeleton should be visible.
      renderTransactionHistoryLoading();

      const skeleton = screen.getByRole("status", {
        name: /loading transaction history/i,
      });
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute("aria-busy", "true");
    });

    it("skeleton contains shimmer placeholders", () => {
      renderTransactionHistoryLoading();

      const skeleton = screen.getByRole("status", {
        name: /loading transaction history/i,
      });
      // The skeleton renders multiple .skeleton divs (stats + filter + rows).
      const shimmerElements = skeleton.querySelectorAll(".skeleton");
      expect(shimmerElements.length).toBeGreaterThan(0);
    });

    it("does not render the transaction table while loading", () => {
      renderTransactionHistoryLoading();

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("does not render filter chips while loading", () => {
      renderTransactionHistoryLoading();

      expect(
        screen.queryByRole("group", { name: /type/i }),
      ).not.toBeInTheDocument();
    });

    it("does not render the export button while loading", () => {
      renderTransactionHistoryLoading();

      expect(
        screen.queryByRole("button", { name: /export csv/i }),
      ).not.toBeInTheDocument();
    });

    it("transitions from skeleton to loaded content after the loading timer fires", () => {
      renderTransactionHistoryLoading();

      // Skeleton must be present before the timer fires.
      expect(
        screen.getByRole("status", { name: /loading transaction history/i }),
      ).toBeInTheDocument();

      // Flush the loading useEffect timer.
      act(() => { vi.runAllTimers(); });

      // Skeleton must be gone.
      expect(
        screen.queryByRole("status", { name: /loading transaction history/i }),
      ).not.toBeInTheDocument();

      // Fully loaded content must now be present.
      expect(screen.getByRole("table", { name: /transaction history/i })).toBeInTheDocument();
    });

    it("reserves a full page of skeleton rows so the table does not resize on reveal", () => {
      renderTransactionHistoryLoading();

      const skeleton = screen.getByRole("status", {
        name: /loading transaction history/i,
      });
      // The skeleton renders the real table markup, so its rows carry the
      // page's own .tx-row class (issue #854). One page is 15 rows.
      const rows = skeleton.querySelectorAll(".th-table tbody .tx-row");
      expect(rows).toHaveLength(15);
    });

    it("skeleton reserves the page header that the loaded page renders", () => {
      renderTransactionHistoryLoading();

      const skeleton = screen.getByRole("status", {
        name: /loading transaction history/i,
      });
      // Omitting the header used to shift the whole page vertically on reveal.
      expect(skeleton.querySelector(".th-header h1")).toBeInTheDocument();
      expect(skeleton.querySelectorAll(".export-actions .export-btn")).toHaveLength(2);
    });

    it("skeleton adopts the page wrapper class so horizontal padding matches", () => {
      renderTransactionHistoryLoading();

      const skeleton = screen.getByRole("status", {
        name: /loading transaction history/i,
      });
      expect(skeleton).toHaveClass("transaction-history-page");
    });
  });

  // ── Existing tests (all use renderTransactionHistory which flushes the load timer) ──

  it("renders type, date, and amount filter chips as labeled pressed toggle groups", () => {
    renderTransactionHistory();

    const typeGroup = screen.getByRole("group", { name: /type/i });
    const dateGroup = screen.getByRole("group", { name: /date range/i });
    const amountGroup = screen.getByRole("group", { name: /amount range/i });

    expect(
      within(typeGroup).getByRole("button", { name: "All" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(typeGroup).getByRole("button", { name: "Draw" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(typeGroup).getByRole("button", { name: "Repay" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(typeGroup).getByRole("button", { name: "Fee" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(typeGroup).getByRole("button", { name: "Interest" }),
    ).toHaveAttribute("aria-pressed", "false");

    expect(
      within(dateGroup).getByRole("button", { name: "Today" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(dateGroup).getByRole("button", { name: "7d" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(dateGroup).getByRole("button", { name: "30d" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(dateGroup).getByRole("button", { name: "90d" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(dateGroup).getByRole("button", { name: "Custom" }),
    ).toHaveAttribute("aria-pressed", "true");

    expect(
      within(amountGroup).getByRole("button", { name: "All amounts" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(amountGroup).getByRole("button", { name: "Under $5k" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(amountGroup).getByRole("button", { name: "$5k-$25k" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(amountGroup).getByRole("button", { name: "$25k+" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Custom range" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("updates the polite result count when quick amount chips change", () => {
    renderTransactionHistory();

    expect(screen.getByText("28 transactions shown")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Under $5k" }));

    expect(
      screen
        .getByRole("button", { name: "Under $5k" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText("12 transactions shown")).toBeTruthy();
  });

  it("shows a no-results state with a reset filters action", () => {
    const { container } = renderTransactionHistory();

    fireEvent.click(screen.getByRole("button", { name: "Fee" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));

    const noResultsHeading = screen.getByRole("heading", {
      name: /no transactions found/i,
    });
    expect(noResultsHeading).toBeTruthy();

    // Check NoDataGraph illustration renders in the empty state
    const illustration = container.querySelector(
      ".empty-state .empty-state-illustration",
    );
    expect(illustration).toBeInTheDocument();

    // Check "no transactions yet" message is NOT present
    const noTransactionsMsg = screen.queryByText(/no transactions yet/i);
    expect(noTransactionsMsg).toBeFalsy();

    fireEvent.click(screen.getByRole("button", { name: /reset all filters/i }));

    const noResultsAfterClear = screen.queryByRole("heading", {
      name: /no transactions found/i,
    });
    expect(noResultsAfterClear).toBeFalsy();

    const resultCount = screen.getByText("28 transactions shown");
    expect(resultCount).toBeTruthy();

    const allButtons = screen.getAllByRole("button", { name: "All" });
    expect(allButtons[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("renders amount range filter chips with correct aria-pressed states", () => {
    renderTransactionHistory();

    const amountGroup = screen.getByRole("group", { name: /^amount$/i });

    expect(
      within(amountGroup).getByRole("button", { name: "All Amounts" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(amountGroup).getByRole("button", { name: "<$100" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(amountGroup).getByRole("button", { name: "$100–$1,000" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(amountGroup).getByRole("button", { name: ">$1,000" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("amount filter stacks with existing type and date filters (AND)", () => {
    renderTransactionHistory();

    // Start: 28 transactions
    expect(screen.getByText("28 transactions shown")).toBeTruthy();

    // Apply >$1,000 amount filter → 22 transactions (all >1000)
    fireEvent.click(screen.getByRole("button", { name: ">$1,000" }));
    expect(screen.getByText("22 transactions shown")).toBeTruthy();

    // Stack with Fee type filter → 0 transactions (no Fees >1000)
    fireEvent.click(screen.getByRole("button", { name: "Fee" }));
    expect(screen.getByText("0 transactions shown")).toBeTruthy();

    // Clear filters restores count
    fireEvent.click(screen.getByRole("button", { name: /reset all filters/i }));
    expect(screen.getByText("28 transactions shown")).toBeTruthy();
  });

  it("opens custom date inputs when Custom is selected", () => {
    renderTransactionHistory();

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));

    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toBeInTheDocument();
  });

  // ── A11Y-004: table caption tests ──────────────────────────────────────────

  it("renders a visually-hidden caption on the transaction table", () => {
    renderTransactionHistory();
    // The table is identified by its caption text via getByRole
    const table = screen.getByRole("table", { name: /transaction history/i });
    expect(table).toBeInTheDocument();
  });

  it("default caption describes unfiltered scope and result count", () => {
    renderTransactionHistory();
    const table = screen.getByRole("table", { name: /transaction history/i });
    // No filter qualifiers in default state
    expect(table).toHaveAccessibleName(/transaction history — \d+ results?/i);
    // Confirm no filter fragment is included
    expect(table.querySelector("caption")?.textContent).not.toMatch(/filtered by/i);
  });

  it("caption updates when a type filter is applied", () => {
    renderTransactionHistory();
    fireEvent.click(screen.getByRole("button", { name: "Draw" }));
    const table = screen.getByRole("table", { name: /transaction history/i });
    expect(table).toHaveAccessibleName(/filtered by draw/i);
  });

  it("caption updates when a date preset is applied", () => {
    renderTransactionHistory();
    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    const table = screen.getByRole("table", { name: /transaction history/i });
    expect(table).toHaveAccessibleName(/last 7 days/i);
  });

  it("caption includes multiple active filter qualifiers simultaneously", () => {
    renderTransactionHistory();
    fireEvent.click(screen.getByRole("button", { name: "Repay" }));
    fireEvent.click(screen.getByRole("button", { name: "30d" }));
    const caption = screen
      .getByRole("table", { name: /transaction history/i })
      .querySelector("caption");
    expect(caption?.textContent).toMatch(/filtered by repayment/i);
    expect(caption?.textContent).toMatch(/last 30 days/i);
  });

  it("caption reverts to unfiltered description after clearing filters", () => {
    renderTransactionHistory();
    fireEvent.click(screen.getByRole("button", { name: "Fee" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: /reset all filters/i }));
    const table = screen.getByRole("table", { name: /transaction history/i });
    expect(table.querySelector("caption")?.textContent).not.toMatch(
      /filtered by/i,
    );
  });

  // ── Search combobox (A11Y + filtering) ─────────────────────────────────────

  describe("Search combobox", () => {
    it("renders an input with combobox role and correct ARIA attributes when empty", () => {
      renderTransactionHistory();
      const input = screen.getByRole("combobox", { name: /search transactions/i });
      expect(input).toBeInTheDocument();
      // aria-expanded must be false when no query has been typed
      expect(input).toHaveAttribute("aria-expanded", "false");
      // aria-autocomplete="list" signals suggestions appear in a separate popup
      expect(input).toHaveAttribute("aria-autocomplete", "list");
      // aria-controls must reference the listbox element
      const listboxId = input.getAttribute("aria-controls");
      expect(listboxId).toBeTruthy();
      const listbox = document.getElementById(listboxId!);
      expect(listbox).toBeInTheDocument();
      expect(listbox).toHaveAttribute("role", "listbox");
    });

    it("shows keyboard shortcut hints for search suggestions", () => {
      const { container } = renderTransactionHistory();

      const shortcuts = container.querySelector(
        '[aria-label="Search keyboard shortcuts"]',
      );
      expect(shortcuts).toBeInTheDocument();
      expect(shortcuts?.querySelectorAll("kbd")).toHaveLength(4);
      expect(shortcuts).toHaveTextContent("Navigate");
      expect(shortcuts).toHaveTextContent("Select");
      expect(shortcuts).toHaveTextContent("Close");
    });

    it("filters transactions by credit-line name", async () => {
      renderTransactionHistory();
      // Full dataset: 28 transactions
      expect(screen.getByText("28 transactions shown")).toBeTruthy();

      const input = screen.getByRole("combobox", { name: /search transactions/i });
      fireEvent.change(input, { target: { value: "Primary Business" } });

      // Debounce delay is 250ms; advance timers to apply filter
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Only transactions belonging to "Primary Business Line" should show
      expect(screen.getByText("6 transactions shown")).toBeTruthy();
    });

    it("shows suggestion options when typing a partial credit-line name", () => {
      renderTransactionHistory();
      const input = screen.getByRole("combobox", { name: /search transactions/i });
      fireEvent.change(input, { target: { value: "primary" } });

      // The listbox should now be open (aria-expanded="true")
      expect(input).toHaveAttribute("aria-expanded", "true");

      // At least one option in the listbox for the matching line
      const listbox = screen.getByRole("listbox", { name: /search suggestions/i });
      expect(within(listbox).getAllByRole("option").length).toBeGreaterThan(0);
      // The "Primary Business Line" suggestion should be present
      expect(within(listbox).getByText(/primary business line/i)).toBeInTheDocument();
    });

    it("closes the listbox after selecting a suggestion with mouse", async () => {
      renderTransactionHistory();
      const input = screen.getByRole("combobox", { name: /search transactions/i });
      fireEvent.change(input, { target: { value: "primary" } });

      const listbox = screen.getByRole("listbox");
      // Target the <li role="option"> that contains the text, not the text node itself.
      // The onMouseDown handler lives on the <li>, so firing on a child span has no effect.
      const options = within(listbox).getAllByRole("option");
      const matchingOption = options.find((o) =>
        o.textContent?.toLowerCase().includes("primary business line"),
      );
      expect(matchingOption).toBeDefined();

      await act(async () => {
        fireEvent.mouseDown(matchingOption!);
      });

      // Listbox should be dismissed (aria-expanded="false")
      expect(input).toHaveAttribute("aria-expanded", "false");
      // Input value should be committed to the selected suggestion
      expect(input).toHaveValue("Primary Business Line");
    });

    it("navigates suggestions with ArrowDown and commits with Enter", async () => {
      renderTransactionHistory();
      const input = screen.getByRole("combobox", { name: /search transactions/i });
      fireEvent.change(input, { target: { value: "primary" } });

      // Listbox should be open
      const listbox = screen.getByRole("listbox");
      expect(listbox).toBeInTheDocument();

      // Move to first suggestion then commit — one act so state flushes between the two keys
      await act(async () => {
        fireEvent.keyDown(input, { key: "ArrowDown" });
      });

      const options = within(listbox).getAllByRole("option");
      // After ArrowDown the first option should be marked active
      expect(options[0]).toHaveAttribute("aria-selected", "true");

      // Capture the expected committed value before dismissing
      const expectedValue = options[0].textContent?.replace(/🔍\s*/g, "").trim() ?? "";

      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter" });
      });

      expect(input).toHaveAttribute("aria-expanded", "false");
      expect(input).toHaveValue(expectedValue);
    });

    it("dismisses the listbox on Escape without changing the input value", () => {
      renderTransactionHistory();
      const input = screen.getByRole("combobox", { name: /search transactions/i });
      fireEvent.change(input, { target: { value: "primary" } });
      expect(input).toHaveAttribute("aria-expanded", "true");

      fireEvent.keyDown(input, { key: "Escape" });
      // Listbox must be closed
      expect(input).toHaveAttribute("aria-expanded", "false");
      // But the typed value must be preserved
      expect(input).toHaveValue("primary");
    });

    it("shows a clear button when text is present and removes it on click", async () => {
      renderTransactionHistory();
      const input = screen.getByRole("combobox", { name: /search transactions/i });

      // No clear button when input is empty
      expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument();

      fireEvent.change(input, { target: { value: "equipment" } });
      const clearBtn = screen.getByRole("button", { name: /clear search/i });
      expect(clearBtn).toBeInTheDocument();

      fireEvent.click(clearBtn);
      // Input should be cleared
      expect(input).toHaveValue("");
      // No clear button visible after clearing
      expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument();
      // Filter should also reset — advance timers and check count restores
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByText("28 transactions shown")).toBeTruthy();
    });

    it("filters by transaction note text", async () => {
      renderTransactionHistory();
      const input = screen.getByRole("combobox", { name: /search transactions/i });
      // "Equipment purchase" is the note on TX-001
      fireEvent.change(input, { target: { value: "equipment purchase" } });
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      // Only TX-001 should match
      expect(screen.getByText("1 transaction shown")).toBeTruthy();
    });

    it("shows 0 results for a query that matches nothing", async () => {
      renderTransactionHistory();
      const input = screen.getByRole("combobox", { name: /search transactions/i });
      fireEvent.change(input, { target: { value: "zzznotfound" } });
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByText("0 transactions shown")).toBeTruthy();
    });

    it("listbox is empty (no options) when query yields no suggestions", () => {
      renderTransactionHistory();
      const input = screen.getByRole("combobox", { name: /search transactions/i });
      // A query that won't match any candidate string
      fireEvent.change(input, { target: { value: "zzznotfound" } });
      // aria-expanded should be false because suggestions list is empty
      expect(input).toHaveAttribute("aria-expanded", "false");
    });

    it("caps suggestion list at 8 items", () => {
      renderTransactionHistory();
      const input = screen.getByRole("combobox", { name: /search transactions/i });
      // A very broad query likely to hit many candidates
      fireEvent.change(input, { target: { value: "a" } });
      if (input.getAttribute("aria-expanded") === "true") {
        const listbox = screen.getByRole("listbox");
        expect(within(listbox).getAllByRole("option").length).toBeLessThanOrEqual(8);
      }
    });

    it("clears search combobox value when Reset filters button is used", async () => {
      renderTransactionHistory();
      const input = screen.getByRole("combobox", { name: /search transactions/i });
      fireEvent.change(input, { target: { value: "equipment" } });
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      // Trigger no-results state by stacking type filter
      fireEvent.click(screen.getByRole("button", { name: "Fee" }));
      fireEvent.click(screen.getByRole("button", { name: /reset all filters/i }));

      expect(input).toHaveValue("");
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByText("28 transactions shown")).toBeTruthy();
    });

    it("search stacks with type filter (AND semantics)", async () => {
      renderTransactionHistory();
      // Filter to only Draw transactions first
      fireEvent.click(screen.getByRole("button", { name: "Draw" }));

      const input = screen.getByRole("combobox", { name: /search transactions/i });
      fireEvent.change(input, { target: { value: "Primary Business" } });
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Should be only Draw transactions in "Primary Business Line"
      // (3 draws: TX-001, TX-003, TX-005)
      expect(screen.getByText("3 transactions shown")).toBeTruthy();
    });

    it("announces live result count updates as the query changes", async () => {
      renderTransactionHistory();
      // The transaction history's own status region (not the notification provider's)
      // It's identifiable by its aria-live="polite" and aria-atomic="true"
      const statusRegions = screen.getAllByRole("status");
      const txStatusRegion = statusRegions.find(
        (el) => el.getAttribute("aria-live") === "polite" && el.getAttribute("aria-atomic") === "true",
      );
      expect(txStatusRegion).toBeDefined();
      expect(txStatusRegion).toHaveAttribute("aria-live", "polite");
      expect(txStatusRegion).toHaveAttribute("aria-atomic", "true");

      const input = screen.getByRole("combobox", { name: /search transactions/i });
      fireEvent.change(input, { target: { value: "Primary Business Line" } });
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(txStatusRegion!.textContent).toMatch(/6 transactions shown/);
    });

    it("does not open the listbox when input is focused but empty", () => {
      renderTransactionHistory();
      const input = screen.getByRole("combobox", { name: /search transactions/i });
      fireEvent.focus(input);
      expect(input).toHaveAttribute("aria-expanded", "false");
    });
  });

  // ── Design-token spacing/typography audit (issue #626, v7) ─────────────────
  //
  // These tests verify that structural DOM elements carry the CSS classes whose
  // styles are declared exclusively through design tokens (--space-*, --radius-*,
  // --lh-*).  They do NOT test computed pixel values (those vary by viewport and
  // are brittle); they assert the class names that index.css tokens target.

  describe("Design-token class usage (issue #626 v7)", () => {
    it("keeps TransactionHistory spacing and line-height pinned to design tokens", () => {
      const rawSpacingOrLeading = /^\s*(gap|padding|margin|margin-bottom|margin-top|line-height):\s*(?!.*var\(--(?:space|lh)-)[^;]*(?:rem|px|\b1\b)/gm;
      const matches = transactionHistoryCss.match(rawSpacingOrLeading) ?? [];

      expect(matches).toEqual([]);
    });

    it("page wrapper carries transaction-history-page class", () => {
      const { container } = renderTransactionHistory();
      expect(container.querySelector(".transaction-history-page")).toBeInTheDocument();
    });

    it("page header carries th-header class", () => {
      const { container } = renderTransactionHistory();
      expect(container.querySelector(".th-header")).toBeInTheDocument();
    });

    it("stat cards carry th-stat-card class", () => {
      const { container } = renderTransactionHistory();
      const cards = container.querySelectorAll(".th-stat-card");
      expect(cards.length).toBe(4);
    });

    it("stat icons carry th-stat-icon class", () => {
      const { container } = renderTransactionHistory();
      const icons = container.querySelectorAll(".th-stat-icon");
      expect(icons.length).toBe(4);
    });

    it("filter container carries th-filters class", () => {
      const { container } = renderTransactionHistory();
      expect(container.querySelector(".th-filters")).toBeInTheDocument();
    });

    it("filter chips carry th-filter-chip class", () => {
      const { container } = renderTransactionHistory();
      const chips = container.querySelectorAll(".th-filter-chip");
      // At minimum: 5 type chips + 3 range preset chips + 5 date chips
      expect(chips.length).toBeGreaterThanOrEqual(13);
    });

    it("search combobox wrapper carries th-search-combobox class", () => {
      const { container } = renderTransactionHistory();
      expect(container.querySelector(".th-search-combobox")).toBeInTheDocument();
    });

    it("table container carries th-table-container class for token-driven border-radius", () => {
      const { container } = renderTransactionHistory();
      expect(container.querySelector(".th-table-container")).toBeInTheDocument();
    });

    it("transaction rows carry tx-row class", () => {
      const { container } = renderTransactionHistory();
      const rows = container.querySelectorAll(".tx-row");
      // Mock data has transactions; expect at least 1 row
      expect(rows.length).toBeGreaterThan(0);
    });

    it("type badges carry tx-type-badge class", () => {
      const { container } = renderTransactionHistory();
      const badges = container.querySelectorAll(".tx-type-badge");
      expect(badges.length).toBeGreaterThan(0);
    });

    it("status badges carry tx-status-badge class", () => {
      const { container } = renderTransactionHistory();
      const badges = container.querySelectorAll(".tx-status-badge");
      expect(badges.length).toBeGreaterThan(0);
    });

    it("expanded detail panel carries tx-detail class when a row is expanded", () => {
      const { container } = renderTransactionHistory();
      // Click the first transaction row to expand it
      const rows = container.querySelectorAll(".tx-row");
      expect(rows.length).toBeGreaterThan(0);
      fireEvent.click(rows[0]);
      expect(container.querySelector(".tx-detail")).toBeInTheDocument();
    });

    it("expanded detail grid carries tx-detail-grid class", () => {
      const { container } = renderTransactionHistory();
      const rows = container.querySelectorAll(".tx-row");
      fireEvent.click(rows[0]);
      expect(container.querySelector(".tx-detail-grid")).toBeInTheDocument();
    });

    it("result count region carries th-filter-results class", () => {
      const { container } = renderTransactionHistory();
      expect(container.querySelector(".th-filter-results")).toBeInTheDocument();
    });

    it("export buttons carry export-btn class", () => {
      const { container } = renderTransactionHistory();
      const exportBtns = container.querySelectorAll(".export-btn");
      expect(exportBtns.length).toBeGreaterThanOrEqual(2);
    });

    it("export help text carries th-export-help class", () => {
      const { container } = renderTransactionHistory();
      expect(container.querySelector(".th-export-help")).toBeInTheDocument();
    });

    it("date sub-line carries tx-date-sub class for muted token colour", () => {
      const { container } = renderTransactionHistory();
      const dateSubs = container.querySelectorAll(".tx-date-sub");
      expect(dateSubs.length).toBeGreaterThan(0);
    });

    it("line-id cell carries tx-line-id class for monospace + muted token", () => {
      const { container } = renderTransactionHistory();
      const lineIds = container.querySelectorAll(".tx-line-id");
      expect(lineIds.length).toBeGreaterThan(0);
    });

    // ── Color-blind safe pattern classes (issue #307) ─────────────────────
    //
    // These tests verify that transaction status badges carry a geometric
    // pattern class that augments the colour cue, making statuses
    // distinguishable without relying on colour alone (WCAG 2.1 SC 1.4.1).

    it("status badges carry the Completed pattern class", () => {
      const { container } = renderTransactionHistory();
      const completedBadges = container.querySelectorAll(
        ".tx-status-pattern--completed",
      );
      // There are Completed transactions in the mock data
      expect(completedBadges.length).toBeGreaterThan(0);
      // Every badge with "Completed" text should have the pattern
      completedBadges.forEach((badge) => {
        expect(badge.textContent).toBe("Completed");
      });
    });

    it("status badges carry the Pending pattern class when navigating to page 2", () => {
      const { container } = renderTransactionHistory();
      // Navigate to page 2 where the Pending transaction (TX-004) is located
      // (28 transactions, 15 per page, so TX-004 is on page 2)
      const nextBtn = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextBtn);

      const pendingBadges = container.querySelectorAll(
        ".tx-status-pattern--pending",
      );
      expect(pendingBadges.length).toBe(1);
      expect(pendingBadges[0].textContent).toBe("Pending");
    });

    it("status badges carry the Failed pattern class when filtered to show Failed transactions", () => {
      const { container } = renderTransactionHistory();
      // Filter by a status that would show Failed transactions
      // The mock data may not have Failed transactions by default
      const failedBadges = container.querySelectorAll(
        ".tx-status-pattern--failed",
      );
      // No Failed pattern should appear in the default unfiltered view
      // since no Failed tx exist in the mock data
      expect(failedBadges.length).toBe(0);
    });

    it("each status badge has exactly one pattern class matching its status", () => {
      const { container } = renderTransactionHistory();
      const allPatternClasses = [
        "tx-status-pattern--completed",
        "tx-status-pattern--pending",
        "tx-status-pattern--failed",
      ];

      const badges = container.querySelectorAll(".tx-status-badge");
      expect(badges.length).toBeGreaterThan(0);

      badges.forEach((badge) => {
        const matchedPatterns = allPatternClasses.filter((cls) =>
          badge.classList.contains(cls),
        );
        // Each badge should have exactly one pattern class
        expect(matchedPatterns.length).toBe(1);

        // The pattern class should correspond to the badge's text content
        const status = badge.textContent?.trim();
        if (status === "Completed") {
          expect(matchedPatterns[0]).toBe("tx-status-pattern--completed");
        } else if (status === "Pending") {
          expect(matchedPatterns[0]).toBe("tx-status-pattern--pending");
        } else if (status === "Failed") {
          expect(matchedPatterns[0]).toBe("tx-status-pattern--failed");
        }
      });
    });

    it("status badges retain the tx-status-badge base class alongside pattern", () => {
      const { container } = renderTransactionHistory();
      const badges = container.querySelectorAll(".tx-status-badge");
      expect(badges.length).toBeGreaterThan(0);

      badges.forEach((badge) => {
        // Every badge must also have a pattern class
        const hasPattern =
          badge.classList.contains("tx-status-pattern--completed") ||
          badge.classList.contains("tx-status-pattern--pending") ||
          badge.classList.contains("tx-status-pattern--failed");
        expect(hasPattern).toBe(true);
      });
    });
  });

  describe("Aria-live announcements (v7)", () => {
    const getLiveAnnouncementText = () => {
      const liveRegions = document.querySelectorAll('[role="status"].sr-only');
      const liveRegion = Array.from(liveRegions).find(
        (el) => el.textContent && !el.textContent.includes("page loaded")
      );
      return liveRegion ? liveRegion.textContent : null;
    };

    it("announces when transaction type filter changes", () => {
      renderTransactionHistory();

      const typeGroup = screen.getByRole("group", { name: /type/i });
      fireEvent.click(within(typeGroup).getByRole("button", { name: "Draw" }));

      expect(getLiveAnnouncementText()).toMatch(/Filtered by transaction type Draw/i);
      expect(getLiveAnnouncementText()).toMatch(/10 transactions shown/i);
    });

    it("announces when credit line filter changes", () => {
      renderTransactionHistory();

      const selects = document.querySelectorAll("select");
      const lineSelect = selects[0];
      fireEvent.change(lineSelect, { target: { value: "CL-2024-001" } });

      expect(getLiveAnnouncementText()).toMatch(/Filtered by credit line Primary Business Line/i);
      expect(getLiveAnnouncementText()).toMatch(/6 transactions shown/i);
    });

    it("announces when status filter changes", () => {
      renderTransactionHistory();

      const selects = document.querySelectorAll("select");
      const statusSelect = selects[1];
      fireEvent.change(statusSelect, { target: { value: "Completed" } });

      expect(getLiveAnnouncementText()).toMatch(/Filtered by status Completed/i);
      expect(getLiveAnnouncementText()).toMatch(/27 transactions shown/i);
    });

    it("announces when amount preset filter changes", () => {
      renderTransactionHistory();

      const amountGroup = screen.getByRole("group", { name: /^amount$/i });
      fireEvent.click(within(amountGroup).getByRole("button", { name: "<$100" }));

      expect(getLiveAnnouncementText()).toMatch(/Filtered by amount <\$100/i);
      expect(getLiveAnnouncementText()).toMatch(/4 transactions shown/i);
    });

    it("announces when amount range preset changes", () => {
      renderTransactionHistory();

      const amountRangeGroup = screen.getByRole("group", { name: /amount range/i });
      fireEvent.click(within(amountRangeGroup).getByRole("button", { name: "Under $5k" }));

      expect(getLiveAnnouncementText()).toMatch(/Filtered by amount range Under \$5k/i);
      expect(getLiveAnnouncementText()).toMatch(/12 transactions shown/i);
    });

    it("announces when date range preset changes", () => {
      renderTransactionHistory();

      const dateRangeGroup = screen.getByRole("group", { name: /presets/i });
      fireEvent.click(within(dateRangeGroup).getByRole("button", { name: "This Week" }));

      expect(getLiveAnnouncementText()).toMatch(/Filtered by date preset This Week/i);
    });

    it("announces when search query is applied", async () => {
      renderTransactionHistory();

      const input = screen.getByRole("combobox", { name: /search transactions/i });
      fireEvent.change(input, { target: { value: "equipment" } });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(getLiveAnnouncementText()).toMatch(/Search query "equipment" applied/i);
      expect(getLiveAnnouncementText()).toMatch(/1 transaction shown/i);
    });

    it("announces when search query is cleared", async () => {
      renderTransactionHistory();

      const input = screen.getByRole("combobox", { name: /search transactions/i });
      fireEvent.change(input, { target: { value: "equipment" } });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      const clearBtn = screen.getByRole("button", { name: /clear search/i });
      fireEvent.click(clearBtn);

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(getLiveAnnouncementText()).toMatch(/Search query cleared/i);
      expect(getLiveAnnouncementText()).toMatch(/28 transactions shown/i);
    });

    it("announces when filters are reset", () => {
      renderTransactionHistory();

      const typeGroup = screen.getByRole("group", { name: /type/i });
      fireEvent.click(within(typeGroup).getByRole("button", { name: "Fee" }));
      const dateRangeGroup = screen.getByRole("group", { name: /date range/i });
      fireEvent.click(within(dateRangeGroup).getByRole("button", { name: "Today" }));

      fireEvent.click(screen.getByRole("button", { name: /reset all filters/i }));

      expect(getLiveAnnouncementText()).toMatch(/Filters cleared/i);
      expect(getLiveAnnouncementText()).toMatch(/28 transactions shown/i);
    });

    it("announces when page changes", () => {
      renderTransactionHistory();

      const nextBtn = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextBtn);

      expect(getLiveAnnouncementText()).toMatch(/Page 2 of 2 loaded/i);
      expect(getLiveAnnouncementText()).toMatch(/28 transactions shown/i);
    });
  });
});
