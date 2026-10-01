import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { Suspense, lazy } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom";
import { RouteLoadingFallback } from "./App";
import { RouteAnnouncer, RouteHeadProvider } from "./components/RouteAnnouncer";

describe("Lazy route loading screen-reader announcements (#1141)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.title = "";
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.title = "";
  });

  describe("RouteLoadingFallback component attributes", () => {
    it("exposes role='status' with an accessible loading label", () => {
      render(<RouteLoadingFallback />);

      const statusEl = screen.getByRole("status");
      expect(statusEl).toBeInTheDocument();
      expect(statusEl).toHaveAttribute("aria-label", "Loading page");
      expect(statusEl).toHaveAttribute("aria-live", "polite");
    });

    it("has aria-busy='true' while shown", () => {
      render(<RouteLoadingFallback />);

      const statusEl = screen.getByRole("status");
      expect(statusEl).toHaveAttribute("aria-busy", "true");
    });

    it("includes a visually hidden text element for screen readers", () => {
      render(<RouteLoadingFallback />);

      const hiddenLabel = screen.getByText("Loading page");
      expect(hiddenLabel).toBeInTheDocument();
      expect(hiddenLabel).toHaveClass("sr-only");
    });

    it("replaces inline styles with tokenized CSS classes", () => {
      const { container } = render(<RouteLoadingFallback />);

      const fallbackDiv = container.querySelector(".route-loading-fallback");
      expect(fallbackDiv).toBeInTheDocument();
      // Ensure no inline style attribute on container
      expect(fallbackDiv?.getAttribute("style")).toBeNull();

      // Check skeleton elements have proper tokenized classes and no inline styles
      const titleSkeleton = container.querySelector(".route-loading-fallback__title");
      const subtitleSkeleton = container.querySelector(".route-loading-fallback__subtitle");
      const cardSkeleton = container.querySelector(".route-loading-fallback__card");

      expect(titleSkeleton).toBeInTheDocument();
      expect(subtitleSkeleton).toBeInTheDocument();
      expect(cardSkeleton).toBeInTheDocument();

      expect(titleSkeleton?.getAttribute("style")).toBeNull();
      expect(subtitleSkeleton?.getAttribute("style")).toBeNull();
      expect(cardSkeleton?.getAttribute("style")).toBeNull();
    });
  });

  describe("Suspense and RouteAnnouncer coordination", () => {
    it("announces loading state during pending lazy import and announces final page once upon resolution", async () => {
      let resolveChunk!: (value: { default: React.ComponentType }) => void;
      const chunkPromise = new Promise<{ default: React.ComponentType }>((resolve) => {
        resolveChunk = resolve;
      });

      const DelayedPage = lazy(() => chunkPromise);

      render(
        <MemoryRouter initialEntries={["/delayed-test-route"]}>
          <RouteHeadProvider>
            <RouteAnnouncer />
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route path="/delayed-test-route" element={<DelayedPage />} />
              </Routes>
            </Suspense>
          </RouteHeadProvider>
        </MemoryRouter>
      );

      // 1. While loading: Fallback exposes role='status' with aria-busy='true' and accessible label
      const loadingFallback = screen.getByRole("status", { name: /loading page/i });
      expect(loadingFallback).toBeInTheDocument();
      expect(loadingFallback).toHaveAttribute("aria-busy", "true");
      expect(screen.getByText("Loading page")).toBeInTheDocument();

      // 2. Resolve the lazy chunk
      await act(async () => {
        resolveChunk({
          default: () => <h1>Delayed Content Loaded</h1>,
        });
      });

      // 3. Fallback unmounts after resolving
      await waitFor(() => {
        expect(screen.queryByRole("status", { name: /loading page/i })).not.toBeInTheDocument();
      });

      // 4. Page content is rendered
      expect(screen.getByRole("heading", { name: "Delayed Content Loaded" })).toBeInTheDocument();

      // 5. RouteAnnouncer polite announcement is present and does not duplicate
      const announcer = screen.getByRole("status");
      expect(announcer).toHaveClass("sr-only");
      expect(announcer).toHaveAttribute("aria-live", "polite");
      expect(announcer).toHaveTextContent(/page loaded/i);
    });
  });
});
