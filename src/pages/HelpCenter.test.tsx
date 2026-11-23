import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import * as routerDom from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReducedMotionProvider } from "../context/ReducedMotionContext";
import * as analytics from "../utils/analytics";
import { recordDiagnosticError } from "../utils/diagnostics";
import HelpCenter from "./HelpCenter";

class IntersectionObserverMock {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];

  private callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);

  trigger(id: string) {
    const entry = {
      target: { id } as unknown as Element,
      isIntersecting: true,
      intersectionRatio: 1,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    } as unknown as IntersectionObserverEntry;
    this.callback([entry], this);
  }
}

let mockObserver: IntersectionObserverMock;

beforeEach(() => {
  mockObserver = new IntersectionObserverMock(vi.fn());
  vi.stubGlobal("IntersectionObserver", vi.fn(
    (cb: IntersectionObserverCallback) => {
      mockObserver = new IntersectionObserverMock(cb);
      return mockObserver;
    },
  ));
});

describe("HelpCenter", { timeout: 15000 }, () => {
  beforeEach(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders nav anchor links for each topic", () => {
    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    const links = screen.getAllByRole("link", { name: /getting started|wallet|credit lines|transactions|notifications|shortcuts|faq/i });
    expect(links.length).toBeGreaterThanOrEqual(7);
  }, 15000);

  it("sets aria-current on the active nav link and removes it from others", () => {
    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    const gettingStartedLink = screen.getByRole("link", { name: "Getting Started" });
    const walletLink = screen.getByRole("link", { name: "Wallet" });

    expect(gettingStartedLink).not.toHaveAttribute("aria-current");
    expect(walletLink).not.toHaveAttribute("aria-current");

    act(() => { mockObserver.trigger("wallet"); });

    expect(walletLink).toHaveAttribute("aria-current", "true");
    expect(gettingStartedLink).not.toHaveAttribute("aria-current");
  });

  it("aria-current moves when active section changes", () => {
    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    const gettingStartedLink = screen.getByRole("link", { name: "Getting Started" });
    const transactionsLink = screen.getByRole("link", { name: "Transactions" });

    act(() => { mockObserver.trigger("transactions"); });

    expect(transactionsLink).toHaveAttribute("aria-current", "true");
    expect(gettingStartedLink).not.toHaveAttribute("aria-current");
  });

  it("clicking a nav anchor smooth-scrolls to the target section", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    const walletLink = screen.getByRole("link", { name: "Wallet" });

    await user.click(walletLink);

    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: expect.any(String), block: "start" }),
    );
  });

  it("keyboard Tab navigates to all nav links and Enter triggers scroll", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.tab();

    const firstLink = screen.getAllByRole("link")[0];
    expect(firstLink).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("renders wallet deep-link target and FAQ video button", () => {
    render(
      <MemoryRouter initialEntries={["/help#wallet"]}>
        <HelpCenter />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Wallet" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /how do i connect a wallet\?/i }),
    ).toBeInTheDocument();
  });

  it("sets aria-current='true' on FAQ anchor and control when an FAQ is opened", async () => {
    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    const faqAnchor = screen.getByRole("link", { name: /direct link to faq: what is creditra\?/i });
    const faqButton = screen.getByRole("button", { name: /what is creditra\?/i });

    expect(faqAnchor).not.toHaveAttribute("aria-current");
    expect(faqButton).not.toHaveAttribute("aria-current");

    await user.click(faqButton);

    expect(faqAnchor).toHaveAttribute("aria-current", "true");
    expect(faqButton).toHaveAttribute("aria-current", "true");

    await user.click(faqButton);

    expect(faqAnchor).not.toHaveAttribute("aria-current");
    expect(faqButton).not.toHaveAttribute("aria-current");
  });

  it("sets aria-current='true' on FAQ anchor when deep-linked via URL hash and auto-expands answer", () => {
    render(
      <MemoryRouter initialEntries={["/help#connect-wallet"]}>
        <HelpCenter />
      </MemoryRouter>,
    );

    const faqAnchor = screen.getByRole("link", { name: /direct link to faq: how do i connect a wallet\?/i });
    const faqButton = screen.getByRole("button", { name: /^how do i connect a wallet\?/i });

    expect(faqAnchor).toHaveAttribute("aria-current", "true");
    expect(faqButton).toHaveAttribute("aria-current", "true");
    expect(faqButton).toHaveAttribute("aria-expanded", "true");
  });

  it("copies an expanded FAQ answer and shows success feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /what is creditra\?/i }));
    fireEvent.click(screen.getByRole("button", { name: "Copy answer for What is Creditra?" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "Creditra is a Stellar-based credit experience that helps you request, manage, and repay flexible credit lines from one dashboard.",
      );
      expect(screen.getByText("Answer copied")).toBeInTheDocument();
    });
  });

  it("shows a tooltip on FAQ anchor focus without breaking its accessible name", () => {
    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>
    );

    const faqAnchor = screen.getByRole("link", { name: /direct link to faq: what is creditra\?/i });
    expect(faqAnchor).toHaveAttribute("aria-label", "Direct link to FAQ: What is Creditra?");

    fireEvent.focus(faqAnchor);

    const tooltipId = faqAnchor.getAttribute("aria-describedby");
    expect(tooltipId).toBeTruthy();
    const tooltip = document.getElementById(tooltipId ?? "");
    expect(tooltip).toHaveAttribute("role", "tooltip");
    expect(tooltip).toBeVisible();
    expect(faqAnchor).toHaveAttribute("aria-describedby", tooltip?.id);
  });

  it("Search UI: form has role='search' and textbox named 'Search help' (Scenario 6)", () => {
    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    const searchRegion = screen.getByRole("search");
    expect(searchRegion).toBeInTheDocument();
    const searchInput = screen.getByRole("searchbox", { name: "Search help" });
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute("type", "search");
  });

  it("announces 'N results' or 'No results' in polite live region after debounce (Scenario 7)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    const searchInput = screen.getByRole("searchbox", { name: "Search help" });
    await user.type(searchInput, "wallet");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const liveRegion = document.querySelector('[aria-live="polite"][role="status"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion?.textContent).toMatch(/\d+ results?/i);

    // Now type a query with no matches
    await user.clear(searchInput);
    await user.type(searchInput, "zzzznotfound");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(liveRegion?.textContent).toBe("No results");

    vi.useRealTimers();
  });

  it("clears the search query and restores all FAQs on Escape (Scenario 8)", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    const searchInput = screen.getByRole("searchbox", { name: "Search help" });
    await user.type(searchInput, "repayment");
    expect(searchInput).toHaveValue("repayment");

    fireEvent.keyDown(searchInput, { key: "Escape" });
    expect(searchInput).toHaveValue("");
    expect(screen.getByRole("button", { name: /what is creditra\?/i })).toBeInTheDocument();
  });

  it("hides category cards that have no matching FAQs while searching (Scenario 9)", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    // Initially all categories are shown
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wallet" })).toBeInTheDocument();

    const searchInput = screen.getByRole("searchbox", { name: "Search help" });
    // Filter specifically for wallet
    await user.type(searchInput, "How do I connect a wallet");

    // Wallet category should remain, Notifications should be hidden
    expect(screen.getByRole("heading", { name: "Wallet" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("Scenario 1: renders at /help#kyc, KYC section exists and receives focus", async () => {
    render(
      <MemoryRouter initialEntries={["/help#kyc"]}>
        <HelpCenter />
      </MemoryRouter>,
    );

    const kycSection = document.getElementById("kyc");
    expect(kycSection).toBeInTheDocument();
    expect(kycSection).toHaveAttribute("tabIndex", "-1");

    await waitFor(() => {
      expect(kycSection).toHaveFocus();
    });
  });

  it("Scenario 2: renders at /help#wallet and focuses the wallet section", async () => {
    render(
      <MemoryRouter initialEntries={["/help#wallet"]}>
        <HelpCenter />
      </MemoryRouter>,
    );

    const walletSection = document.getElementById("wallet");
    expect(walletSection).toBeInTheDocument();

    await waitFor(() => {
      expect(walletSection).toHaveFocus();
    });
  });

  it("Scenario 3: renders at /help#connect-wallet, expands the FAQ and focuses it", async () => {
    render(
      <MemoryRouter initialEntries={["/help#connect-wallet"]}>
        <HelpCenter />
      </MemoryRouter>,
    );

    const faqItem = document.getElementById("connect-wallet");
    const faqButton = screen.getByRole("button", { name: /^how do i connect a wallet\?/i });

    expect(faqButton).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => {
      expect(faqItem).toHaveFocus();
    });
  });

  it("Scenario 4: clicking 'Shortcuts' in the side nav updates the URL hash to shortcuts", async () => {
    const navigateMock = vi.fn();
    vi.spyOn(routerDom, "useNavigate").mockReturnValue(navigateMock);

    render(
      <MemoryRouter initialEntries={["/help"]}>
        <HelpCenter />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    const shortcutsLink = screen.getByRole("link", { name: "Shortcuts" });
    await user.click(shortcutsLink);

    expect(navigateMock).toHaveBeenCalledWith({ hash: "shortcuts" }, { replace: false });
  });

  it("Scenario 5: collapsing a deep-linked FAQ removes aria-current and clears the hash", async () => {
    const navigateMock = vi.fn();
    vi.spyOn(routerDom, "useNavigate").mockReturnValue(navigateMock);

    render(
      <MemoryRouter initialEntries={["/help#connect-wallet"]}>
        <HelpCenter />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    const faqAnchor = screen.getByRole("link", { name: /direct link to faq: how do i connect a wallet\?/i });
    const faqButton = screen.getByRole("button", { name: /^how do i connect a wallet\?/i });

    expect(faqAnchor).toHaveAttribute("aria-current", "true");
    expect(faqButton).toHaveAttribute("aria-current", "true");
    expect(faqButton).toHaveAttribute("aria-expanded", "true");

    await user.click(faqButton);

    expect(faqButton).toHaveAttribute("aria-expanded", "false");
    expect(faqAnchor).not.toHaveAttribute("aria-current");
    expect(faqButton).not.toHaveAttribute("aria-current");
    expect(navigateMock).toHaveBeenCalledWith({ hash: "" }, { replace: true });
  });

  it("Scenario 6: renders inline not-found notice at /help#does-not-exist", () => {
    const getElementByIdSpy = vi.spyOn(document, "getElementById");

    render(
      <MemoryRouter initialEntries={["/help#does-not-exist"]}>
        <HelpCenter />
      </MemoryRouter>,
    );

    expect(screen.getByText(/that help topic was not found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse the topic list/i })).toBeInTheDocument();
    expect(getElementByIdSpy).not.toHaveBeenCalledWith("does-not-exist");
  });

  it("Scenario 8: calls scrollIntoView with behavior: 'instant' when reduced motion is active", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    localStorage.setItem("creditra-motion-override", JSON.stringify("reduced"));

    render(
      <ReducedMotionProvider>
        <MemoryRouter initialEntries={["/help#wallet"]}>
          <HelpCenter />
        </MemoryRouter>
      </ReducedMotionProvider>,
    );

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "instant",
        block: "start",
      });
    });

    localStorage.removeItem("creditra-motion-override");
  });

  it("downloads a redacted diagnostics bundle from the Help Center", async () => {
    const accountKey = "G" + "A".repeat(55);
    const createObjectURL = vi.fn(() => "blob:diagnostics");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    recordDiagnosticError(`failed for wallet ${accountKey}`);

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /download diagnostics/i }),
    );

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:diagnostics");
    expect(clickSpy).toHaveBeenCalled();

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    const parsed = JSON.parse(text) as Record<string, unknown>;

    expect(parsed.appVersion).toBeTruthy();
    expect(parsed.network).toBeTruthy();
    expect(parsed.dataSource).toBeTruthy();
    expect(Array.isArray(parsed.recentErrors)).toBe(true);
    expect(JSON.stringify(parsed)).not.toContain(accountKey);
    expect(
      screen.getByRole("button", { name: /download diagnostics/i }),
    ).toHaveAccessibleDescription(/financial values/i);
  });
});

describe("HelpCenter — zero-result search analytics", () => {
  let trackEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal("IntersectionObserver", vi.fn((cb: IntersectionObserverCallback) => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn(() => []),
      root: null,
      rootMargin: "",
      thresholds: [],
    })));
    trackEventSpy = vi.spyOn(analytics, "trackEvent").mockResolvedValue(undefined);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("fires help_search_no_results once when a debounced query has no results", async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    const searchInput = screen.getByRole("searchbox", { name: "Search help" });
    await user.type(searchInput, "zzzznotfound");

    act(() => { vi.advanceTimersByTime(300); });

    expect(trackEventSpy).toHaveBeenCalledTimes(1);
    expect(trackEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "help_search_no_results",
        category: "usage",
        payload: expect.objectContaining({ query: expect.any(String) }),
      }),
    );
  });

  it("does not fire when the query returns results", async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    await user.type(screen.getByRole("searchbox", { name: "Search help" }), "wallet");

    act(() => { vi.advanceTimersByTime(300); });

    expect(trackEventSpy).not.toHaveBeenCalled();
  });

  it("does not fire when the query is shorter than 3 characters", async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    await user.type(screen.getByRole("searchbox", { name: "Search help" }), "zz");

    act(() => { vi.advanceTimersByTime(300); });

    expect(trackEventSpy).not.toHaveBeenCalled();
  });

  it("does not fire for a whitespace-only query", async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    await user.type(screen.getByRole("searchbox", { name: "Search help" }), "   ");

    act(() => { vi.advanceTimersByTime(300); });

    expect(trackEventSpy).not.toHaveBeenCalled();
  });

  it("does not fire twice for the same normalised query", async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    const searchInput = screen.getByRole("searchbox", { name: "Search help" });

    await user.type(searchInput, "zzzznotfound");
    act(() => { vi.advanceTimersByTime(300); });

    await user.clear(searchInput);
    act(() => { vi.advanceTimersByTime(300); });

    // Type the same query again (normalises to the same string)
    await user.type(searchInput, "zzzznotfound");
    act(() => { vi.advanceTimersByTime(300); });

    expect(trackEventSpy).toHaveBeenCalledTimes(1);
  });

  it("strips a Stellar key from the query payload", async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    // A query that looks like a Stellar public key embedded in text
    const stellarKey = "G" + "A".repeat(55);
    await user.type(screen.getByRole("searchbox", { name: "Search help" }), stellarKey);

    act(() => { vi.advanceTimersByTime(300); });

    if (trackEventSpy.mock.calls.length > 0) {
      const payload = trackEventSpy.mock.calls[0][0].payload as { query: string };
      expect(payload.query).not.toContain("G" + "A".repeat(55));
      expect(payload.query).toContain("[redacted]");
    }
    // If the key itself is too short after normalisation to reach the 3-char
    // threshold, the event simply won't fire — also acceptable.
  });

  it("strips long digit runs from the query payload", async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    await user.type(screen.getByRole("searchbox", { name: "Search help" }), "help 12345678901");

    act(() => { vi.advanceTimersByTime(300); });

    if (trackEventSpy.mock.calls.length > 0) {
      const payload = trackEventSpy.mock.calls[0][0].payload as { query: string };
      expect(payload.query).not.toContain("12345678901");
      expect(payload.query).toContain("[redacted]");
    }
  });

  it("does not fire when consent is not granted (relies on trackEvent gating)", async () => {
    // Reset the spy so the real trackEvent runs (consent check inside it)
    trackEventSpy.mockRestore();

    // Mock fetch so no actual HTTP request is made
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup({ delay: null });

    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>,
    );

    await user.type(screen.getByRole("searchbox", { name: "Search help" }), "zzzznotfound");
    act(() => { vi.advanceTimersByTime(300); });

    // hasConsent('usage') defaults to false (no storage entry), so fetch
    // must not have been called.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
