import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import * as routerDom from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReducedMotionProvider } from "../context/ReducedMotionContext";
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
});
