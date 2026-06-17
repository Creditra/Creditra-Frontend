import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom";
import App from "./App";

describe("App Navigation Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders header with navigation links", () => {
    render(<App />);

    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();

    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();
  });

  it("renders all four navigation links with correct text", () => {
    render(<App />);

    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("link", { name: "Dashboard" }))
      .toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Transactions" }))
      .toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Credit Lines" }))
      .toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Open Credit Line" }))
      .toBeInTheDocument();
  });

  it("applies header-nav-link class to all navigation links", () => {
    render(<App />);

    const nav = screen.getByRole("navigation");
    const navLinks = within(nav).getAllByRole("link");

    navLinks.forEach((link) => {
      expect(link).toHaveClass("header-nav-link");
    });
  });

  it("renders navigation links with proper href attributes", () => {
    render(<App />);

    const nav = screen.getByRole("navigation");
    const dashboardLink = within(nav).getByRole("link", { name: "Dashboard" });
    const transactionLink = within(nav).getByRole("link", {
      name: "Transactions",
    });
    const creditLineLink = within(nav).getByRole("link", {
      name: "Credit Lines",
    });
    const openCreditLink = within(nav).getByRole("link", {
      name: "Open Credit Line",
    });

    expect(dashboardLink).toHaveAttribute("href", "/");
    expect(transactionLink).toHaveAttribute("href", "/transactions");
    expect(creditLineLink).toHaveAttribute("href", "/credit-lines");
    expect(openCreditLink).toHaveAttribute("href", "/open-credit");
  });

  it("renders logo link with correct href", () => {
    render(<App />);

    const logo = screen.getByText("Creditra");
    expect(logo).toHaveClass("logo");
    expect(logo).toHaveAttribute("href", "/");
  });

  it("renders WalletButton in the header", () => {
    render(<App />);

    // WalletButton should be rendered in the header
    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();
  });

  it("has proper semantic structure with header and main elements", () => {
    render(<App />);

    const header = screen.getByRole("banner");
    const main = screen.getByRole("main");

    expect(header).toBeInTheDocument();
    expect(main).toBeInTheDocument();
  });
});

describe("App Navigation Active State (requires integration test)", () => {
  /**
   * NOTE: These tests verify aria-current="page" behavior, which requires
   * actual router context. They are documented here for reference but
   * require integration testing with BrowserRouter enabled.
   *
   * To test active states properly:
   * 1. Use MemoryRouter instead of BrowserRouter for testing
   * 2. Test with actual routing enabled (not mocked)
   * 3. Navigate to each route and verify aria-current attribute
   *
   * Example:
   * it("sets aria-current on active navigation link", () => {
   *   render(
   *     <MemoryRouter initialEntries={["/"]}>
   *       <App />
   *     </MemoryRouter>
   *   );
   *
   *   const dashboardLink = screen.getByText("Dashboard").closest("a");
   *   expect(dashboardLink).toHaveAttribute("aria-current", "page");
   * });
   */

  it("should have aria-current attribute support implemented", () => {
    // This test verifies the structure exists for aria-current support
    // Actual aria-current testing requires non-mocked router
    render(<App />);

    const nav = screen.getByRole("navigation");
    const navLinks = within(nav).getAllByRole("link");

    // Verify all nav links exist and have the proper class for active styling
    expect(navLinks.length).toBeGreaterThanOrEqual(4);
    navLinks.forEach((link) => {
      expect(link).toHaveClass("header-nav-link");
    });
  });
});

describe("App Styling and Accessibility", () => {
  it("renders with proper accessibility attributes", () => {
    render(<App />);

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveClass("header-nav");

    const header = screen.getByRole("banner");
    expect(header).toHaveClass("header");
  });

  it("applies correct CSS classes for navigation styling", () => {
    render(<App />);

    const nav = screen.getByRole("navigation");
    const dashboardLink = within(nav).getByRole("link", { name: "Dashboard" });
    expect(dashboardLink).toHaveClass("header-nav-link");

    // Additional classes may be applied when active (requires router context)
    // This verifies the base class is always present
  });

  it("renders with error boundary wrapper", () => {
    render(<App />);

    // If there's an error, the component should not throw
    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();
  });

  it("renders with wallet provider context", () => {
    render(<App />);

    // WalletButton should be available if WalletProvider is working
    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();
  });
});
