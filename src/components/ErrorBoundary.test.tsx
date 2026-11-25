/// <reference types="vitest" />
import { act, fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";
import { buildDiagnosticsBundle } from "../utils/diagnostics";

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
      screen.getByRole("button", { name: /try again/i }),
    ).toHaveAttribute("type", "button");
    expect(
      screen.getByRole("button", { name: /go back/i }),
    ).toHaveAttribute("type", "button");
    expect(
      screen.getByRole("link", { name: /dashboard/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toHaveAttribute(
      "type",
      "button",
    );
    expect(
      screen.getByRole("link", { name: /contact support/i }),
    ).toBeInTheDocument();
  });

  it("recovers after Try again when the child stops throwing", () => {
    let shouldThrow = true;
    const FlakyChild = () => {
      if (shouldThrow) {
        throw new Error("Transient error");
      }
      return <div>Recovered content</div>;
    };

    render(
      <BrowserRouter>
        <ErrorBoundary>
          <FlakyChild />
        </ErrorBoundary>
      </BrowserRouter>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(screen.getByText("Recovered content")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("clears the fallback on popstate navigation", () => {
    let shouldThrow = true;
    const FlakyChild = () => {
      if (shouldThrow) {
        throw new Error("Navigation error");
      }
      return <div>Recovered after back</div>;
    };

    render(
      <BrowserRouter>
        <ErrorBoundary>
          <FlakyChild />
        </ErrorBoundary>
      </BrowserRouter>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    shouldThrow = false;
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByText("Recovered after back")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("records render errors in the diagnostics buffer", () => {
    const before = buildDiagnosticsBundle().recentErrors.length;

    render(
      <BrowserRouter>
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      </BrowserRouter>,
    );

    const errors = buildDiagnosticsBundle().recentErrors;
    expect(errors.length).toBe(before + 1);
    expect(errors[errors.length - 1]).toContain("Test error");
  });
});
