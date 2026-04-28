/// <reference types="vitest" />import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

const ThrowError = () => {
  throw new Error("Test error");
};

describe("ErrorBoundary", () => {
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    consoleSpy.mockClear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders error page when error occurs", () => {
    render(
      <BrowserRouter>
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      </BrowserRouter>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(
        "We encountered an unexpected error. Our team has been notified and is working to fix it.",
      ),
    ).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("has recovery actions", () => {
    render(
      <BrowserRouter>
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      </BrowserRouter>,
    );

    expect(
      screen.getByRole("button", { name: /go back/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /dashboard/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /contact support/i }),
    ).toBeInTheDocument();
  });
});
