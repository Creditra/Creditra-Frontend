import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("credit lines route", () => {
  const localStorageMock = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  beforeEach(() => {
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();

    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
  });

  afterEach(() => {
    window.history.pushState({}, "", "/");
    vi.unstubAllGlobals();
  });

  it("renders the Credit Lines page and marks the nav link active", () => {
    window.history.pushState({}, "", "/credit-lines");

    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Credit Lines" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /page not found/i }))
      .not.toBeInTheDocument();
    const creditLinesLinks = screen.getAllByRole("link", {
      name: "Credit Lines",
    });
    expect(creditLinesLinks).toHaveLength(1);
    expect(creditLinesLinks[0]).toHaveAttribute("aria-current", "page");
  });

  it("still renders NotFound for unknown routes", () => {
    window.history.pushState({}, "", "/does-not-exist");

    render(<App />);

    expect(
      screen.getByRole("heading", { name: /page not found/i }),
    ).toBeInTheDocument();
  });
});
