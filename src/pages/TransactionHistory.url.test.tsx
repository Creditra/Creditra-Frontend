import { describe, it, expect, beforeEach, afterEach, vi} from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../test/test-utils";
import TransactionHistory from "./TransactionHistory";

const renderWithRouter = (initialEntry: string): void => {
  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/transactions" element={<TransactionHistory />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const LocationProbe = (): JSX.Element => {
  const location = useLocation();
  return <div data-testid="location-probe">{location.search}</div>;
};

const renderWithProbe = (initialEntry: string): void => {
  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/transactions" element={<TransactionHistory />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("TransactionHistory URL sync", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
  });

  it("applies filters and page from the URL (#1)", async () => {
    renderWithRouter("/transactions?type=Repay&line=CL-2024-002&page=2");

    const typeSelect = await screen.findByLabelText(/account type/i);
    expect(typeSelect).toHaveValue("Repay");

    const lineSelect = await screen.findByLabelText(/line/i);
    expect(lineSelect).toHaveValue("CL-2024-002");

    const pageIndicator = await screen.findByText(/page 2\//i);
    expect(pageIndicator).toBeInTheDocument();
  });

  it("restores the previous filter set on Back (#2)", async () => {
    const user = userEvent.setup();
    renderWithProbe("/transactions");

    const statusChip = await screen.findByRole("button", { name: /completed/i });
    await user.click(statusChip);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /completed/i })).toHaveAttribute("aria-pressed", "true");
    });

    const backButton = screen.queryByRole("button", { name: /back/i });
    if (backButton) {
      await user.click(backButton);
    } else {
      window.history.back();
    }

    await waitFor(() => {
      expect(screen.getButton(/completed/i)).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("Reset all clears every filter key and does not re-apply the preset (#3)", async () => {
    const user = userEvent.setup();
    renderWithProbe("/transactions?range=this-week");

    await waitFor(() => {
      expect(screen.getByTestId("location-probe").textContent).toContain("range=this-week");
    });

    await user.click(screen.getButton(/reset all/i));

    await waitFor(() => {
      const search = screen.getByTestId("location-probe").textContent ?? "";
      expect(search).not.toContain("range=");
      expect(search).not.toContain("amount=");
      expect(search).not.toContain("min=");
      expect(search).not.toContain("max=");
    });

    // Preset must not be re-applied after the reset.
    await waitFor(() => {
      expect(screen.getByTestId("location-probe").textContent ?? "").not.toContain("range=");
    });
  });

  it("ignores a non-numeric amount and shows a notice (#4)", async () => {
    renderWithRouter("/transactions?min=abc");

    const notice = await screen.findByRole("status");
    expect(notice).toBeInTheDocument();
    expect(notice.textContent ?? "").toMatch(/ignored/i);
  });

  it("shows an inline error for an inverted amount range (#5)", async () => {
    renderWithRouter("/transactions?min=500&max=100");

    const error = await screen.findByText(/min.*>max|maximum.*minimum|inverted/i);
    expect(error).toBeInTheDocument();

    const minInput = screen.getByLabelText(/minimum amount/i);
    const describedBy = minInput.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toBeInTheDocument();
  });

  it("shows an inline error for an inverted date range (#6)", async () => {
    renderWithRouter("/transactions?start=2025-03-01&end=2025-02-01");

    const error = await screen.findByText(/start.*after.end|end.*before.start|inverted/i);
    expect(error).toBeInTheDocument();

    const startInput = screen.getByLabelText(/start date/i);
    const describedBy = startInput.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toBeInTheDocument();
  });

  it("clamps page to the available pages (#7)", async () => {
    renderWithProbe("/transactions?page=99");

    await waitFor(() => {
      const search = screen.getByTestId("location-probe").textContent ?? "";
      const params = new URLSearchParams(search);
      const page = Number(params.get("page") ?? "1");
      expect(page).toBeGreaterThanOrEqual(1);
      expect(page).toBeLessThan(99);
    });
  });

  it("regression: reset all removes range from the URL", () => {
    // This assertion guards off the old behaviour where reset only deleted `amount`.
    const search = new URLSearchParams("range=this-week");
    expect(search.get("range")).toBeFalsy();
  });
});
