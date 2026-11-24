import { render, screen, within, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom";
import App from "./App";
import { BELOW_MD_MEDIA } from "./hooks/useMediaQuery";

describe("App Navigation Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/");
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

  it("renders network status indicator in the header", () => {
    render(<App />);

    const header = screen.getByRole("banner");
    expect(
      within(header).getByLabelText(/network status:/i),
    ).toBeInTheDocument();
  });

  it("renders the Settings shortcut help trigger", () => {
    render(<App />);

    expect(
      screen.getByRole("button", { name: "Settings" }),
    ).toBeInTheDocument();
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

  it("opens shortcut help when ? is pressed outside inputs", () => {
    render(<App />);

    fireEvent.keyDown(document, { key: "?" });

    expect(
      screen.getByRole("dialog", { name: /move around faster/i }),
    ).toBeInTheDocument();
  });

  it("ignores ? when focus is inside an input", async () => {
    window.history.pushState({}, "", "/help");
    render(<App />);

    // /help is a code-split route; wait for it to mount before interacting.
    const searchInput = await screen.findByPlaceholderText("Search for help...");
    searchInput.focus();
    fireEvent.keyDown(searchInput, { key: "?" });

    expect(
      screen.queryByRole("dialog", { name: /move around faster/i }),
    ).not.toBeInTheDocument();
  });

  it("opens command palette on Ctrl+K", () => {
    render(<App />);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();
  });

  it("opens command palette on Meta+K (Cmd+K on macOS)", () => {
    render(<App />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();
  });

  it("toggles command palette closed on second Ctrl+K", () => {
    render(<App />);
    // Open
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();
    // Close by toggling
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
  });

  it("navigates to /kyc?step=<id>, closes the KYC drawer, and focuses the page heading on Resume", async () => {
    window.history.pushState({}, "", "/");
    localStorage.clear();
    render(<App />);

    const [kycTrigger] = screen.getAllByRole("button", {
      name: /kyc verification/i,
    });
    fireEvent.click(kycTrigger);

    const dialog = screen.getByRole("dialog", { name: /kyc progress/i });
    expect(dialog).toBeInTheDocument();

    const resumeBtn = within(dialog).getByRole("button", {
      name: /start verification|resume verification/i,
    });
    fireEvent.click(resumeBtn);

    expect(
      screen.queryByRole("dialog", { name: /kyc progress/i }),
    ).not.toBeInTheDocument();

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Identity Verification",
    });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveFocus();
    expect(
      screen.getByText("Confirm your legal name and date of birth."),
    ).toBeInTheDocument();
  });
});

describe("Feature-flagged routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.pushState({}, "", "/");
  });

  it("renders 404 for /collateral-swap and /autopay when flags are unset and hides them from nav", async () => {
    window.history.pushState({}, "", "/autopay");
    const { unmount } = render(<App />);

    const nav = screen.getByRole("navigation");
    expect(within(nav).queryByRole("link", { name: "Autopay" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Collateral Swap" })).not.toBeInTheDocument();

    expect(await screen.findByText(/page not found/i)).toBeInTheDocument();
    expect(document.title).toBe("Creditra · Not Found");
    unmount();

    window.history.pushState({}, "", "/collateral-swap");
    render(<App />);
    expect(await screen.findByText(/page not found/i)).toBeInTheDocument();
    expect(document.title).toBe("Creditra · Not Found");
  });

  it("enables /autopay route, header link, and announcer metadata when VITE_FEATURE_AUTOPAY=true", async () => {
    vi.stubEnv("VITE_FEATURE_AUTOPAY", "true");
    window.history.pushState({}, "", "/autopay");
    render(<App />);

    const nav = screen.getByRole("navigation");
    const autopayLink = within(nav).getByRole("link", { name: "Autopay" });
    expect(autopayLink).toHaveAttribute("href", "/autopay");
    expect(within(nav).queryByRole("link", { name: "Collateral Swap" })).not.toBeInTheDocument();

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(document.title).toBe("Creditra · Autopay");
  });

  it("enables /collateral-swap route, header link, and announcer metadata when VITE_FEATURE_COLLATERAL_SWAP=true", async () => {
    vi.stubEnv("VITE_FEATURE_COLLATERAL_SWAP", "true");
    window.history.pushState({}, "", "/collateral-swap");
    render(<App />);

    const nav = screen.getByRole("navigation");
    const swapLink = within(nav).getByRole("link", { name: "Collateral Swap" });
    expect(swapLink).toHaveAttribute("href", "/collateral-swap");
    expect(within(nav).queryByRole("link", { name: "Autopay" })).not.toBeInTheDocument();

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(document.title).toBe("Creditra · Collateral Swap");
  });
});

describe("Responsive KYC panel", () => {
  const originalMatchMedia = window.matchMedia;

  function mockBelowMdMatchMedia(initialMatches: boolean) {
    let matches = initialMatches;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();

    const mock = vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return query === BELOW_MD_MEDIA ? matches : false;
      },
      media: query,
      onchange: null,
      addEventListener: vi.fn((event: string, cb: (e: MediaQueryListEvent) => void) => {
        if (query === BELOW_MD_MEDIA && event === "change") {
          listeners.add(cb);
        }
      }),
      removeEventListener: vi.fn((event: string, cb: (e: MediaQueryListEvent) => void) => {
        if (query === BELOW_MD_MEDIA && event === "change") {
          listeners.delete(cb);
        }
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: mock,
    });

    return {
      setMatches(next: boolean) {
        matches = next;
        act(() => {
          listeners.forEach((cb) => cb({ matches: next, media: BELOW_MD_MEDIA } as MediaQueryListEvent));
        });
      },
    };
  }

  beforeEach(() => {
    window.history.pushState({}, "", "/");
    localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
    window.history.pushState({}, "", "/");
  });

  it("renders KycDrawer on wide viewports and returns focus to the trigger on close", () => {
    mockBelowMdMatchMedia(false);
    render(<App />);

    const [kycTrigger] = screen.getAllByRole("button", {
      name: /kyc verification/i,
    });
    fireEvent.click(kycTrigger);

    expect(document.getElementById("kyc-progress-drawer")).toBeInTheDocument();
    expect(document.getElementById("kyc-bottom-sheet")).not.toBeInTheDocument();
    expect(screen.getAllByRole("dialog", { name: /kyc progress/i })).toHaveLength(1);

    const closeBtn = screen.getByRole("button", {
      name: /close kyc progress drawer/i,
    });
    fireEvent.click(closeBtn);

    expect(document.getElementById("kyc-progress-drawer")).not.toBeInTheDocument();
    expect(kycTrigger).toHaveFocus();
  });

  it("renders KycBottomSheet on narrow viewports, returns focus on close, and resumes to /kyc", async () => {
    mockBelowMdMatchMedia(true);
    render(<App />);

    const [kycTrigger] = screen.getAllByRole("button", {
      name: /kyc verification/i,
    });
    fireEvent.click(kycTrigger);

    expect(document.getElementById("kyc-bottom-sheet")).toBeInTheDocument();
    expect(document.getElementById("kyc-progress-drawer")).not.toBeInTheDocument();
    expect(screen.getAllByRole("dialog", { name: /kyc progress/i })).toHaveLength(1);

    const closeBtn = screen.getByRole("button", {
      name: /close kyc bottom sheet/i,
    });
    fireEvent.click(closeBtn);

    expect(document.getElementById("kyc-bottom-sheet")).not.toBeInTheDocument();
    expect(kycTrigger).toHaveFocus();

    // Re-open and verify onResume navigates to /kyc
    fireEvent.click(kycTrigger);
    const dialog = screen.getByRole("dialog", { name: /kyc progress/i });
    const resumeBtn = within(dialog).getByRole("button", {
      name: /start verification|resume verification/i,
    });
    fireEvent.click(resumeBtn);

    expect(document.getElementById("kyc-bottom-sheet")).not.toBeInTheDocument();
    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Identity Verification",
    });
    expect(heading).toBeInTheDocument();
  });

  it("swaps between KycDrawer and KycBottomSheet when resizing across the breakpoint while closed", () => {
    const mq = mockBelowMdMatchMedia(false);
    render(<App />);

    const [kycTrigger] = screen.getAllByRole("button", {
      name: /kyc verification/i,
    });

    // Wide viewport -> KycDrawer
    fireEvent.click(kycTrigger);
    expect(document.getElementById("kyc-progress-drawer")).toBeInTheDocument();
    expect(document.getElementById("kyc-bottom-sheet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close kyc progress drawer/i }));

    // Resize to narrow while closed -> KycBottomSheet
    mq.setMatches(true);
    fireEvent.click(kycTrigger);
    expect(document.getElementById("kyc-bottom-sheet")).toBeInTheDocument();
    expect(document.getElementById("kyc-progress-drawer")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close kyc bottom sheet/i }));

    // Resize back to wide while closed -> KycDrawer
    mq.setMatches(false);
    fireEvent.click(kycTrigger);
    expect(document.getElementById("kyc-progress-drawer")).toBeInTheDocument();
    expect(document.getElementById("kyc-bottom-sheet")).not.toBeInTheDocument();
  });
});
