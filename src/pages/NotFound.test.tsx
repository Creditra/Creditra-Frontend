/// <reference types="vitest" />
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { NotFound } from "./NotFound";

function renderNotFound(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <NotFound />
    </MemoryRouter>
  );
}

function setHistoryLength(n: number) {
  Object.defineProperty(window.history, "length", { configurable: true, value: n });
}

describe("NotFound", () => {
  let originalLength: number;
  let originalGo: typeof window.history.go;

  beforeEach(() => {
    originalLength = window.history.length;
    originalGo = window.history.go.bind(window.history);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setHistoryLength(originalLength);
    window.history.go = originalGo;
  });

  it("renders a <main> landmark labelled by the h1", () => {
    renderNotFound();
    const main = screen.getByRole("main");
    const id = main.getAttribute("aria-labelledby");
    expect(document.getElementById(id!)).toHaveTextContent(/page not found/i);
  });

  it("renders heading and body copy", () => {
    renderNotFound();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/page not found/i);
    expect(screen.getByText(/doesn't exist or has been moved/i)).toBeInTheDocument();
  });

  it('shows "Go back" button when history is available', () => {
    setHistoryLength(3);
    renderNotFound();
    expect(screen.getByRole("button", { name: /go back/i })).toBeInTheDocument();
  });

  it('shows "Go to Dashboard" link when there is no history', () => {
    setHistoryLength(1);
    renderNotFound();
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toBeInTheDocument();
  });

  it("calls history.go(-1) on Go back click", () => {
    setHistoryLength(3);
    const goSpy = vi.fn();
    window.history.go = goSpy;
    renderNotFound();
    fireEvent.click(screen.getByRole("button", { name: /go back/i }));
    expect(goSpy).toHaveBeenCalledWith(-1);
  });

  it("Go to Dashboard link points to /", () => {
    setHistoryLength(1);
    renderNotFound();
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toHaveAttribute("href", "/");
  });

  it("SVG illustration is aria-hidden", () => {
    renderNotFound();
    expect(document.querySelector("svg.error-illustration")).toHaveAttribute("aria-hidden", "true");
  });

  it("matches snapshot with history", () => {
    setHistoryLength(3);
    expect(renderNotFound().asFragment()).toMatchSnapshot();
  });

  it("matches snapshot without history", () => {
    setHistoryLength(1);
    expect(renderNotFound().asFragment()).toMatchSnapshot();
  });

  it('renders a "Did you mean" suggestion link for a mistyped route before the back button', () => {
    setHistoryLength(3);
    renderNotFound(["/transaction"]);

    expect(screen.getByText(/did you mean/i)).toBeInTheDocument();
    const suggestionLink = screen.getByRole("link", {
      name: /go to transaction history \(\/transactions\)/i,
    });
    expect(suggestionLink).toHaveAttribute("href", "/transactions");

    const backButton = screen.getByRole("button", { name: /go back/i });
    expect(
      suggestionLink.compareDocumentPosition(backButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("suggests /settings when visiting /settngs", () => {
    renderNotFound(["/settngs"]);
    const suggestionLink = screen.getByRole("link", {
      name: /go to settings \(\/settings\)/i,
    });
    expect(suggestionLink).toHaveAttribute("href", "/settings");
  });

  it("renders no suggestion for an unrelated path", () => {
    renderNotFound(["/zzzz-qq"]);
    expect(screen.queryByText(/did you mean/i)).not.toBeInTheDocument();
  });
});