import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScrollRestoration } from "../useScrollRestoration";
import { __setMockLocation } from "react-router-dom";

/**
 * Re-usable stub for `window.scrollY` (readonly in jsdom).
 */
let scrollY = 0;

/**
 * Stub for `window.scrollTo` — vitest/JSDOM does not implement it.
 */
let scrollToCalls: Array<{ top: number; behavior: string }> = [];

function setScrollY(y: number) {
  scrollY = y;
}

/**
 * Fake `requestAnimationFrame` that fires the callback synchronously,
 * matching the pattern used by other tests in this repo (see
 * `useScrollCollapse.test.ts`).
 */
function stubRAF() {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
}

/**
 * Clear sessionStorage between tests.
 */
function clearSessionStorage() {
  sessionStorage.clear();
}

describe("useScrollRestoration", () => {
  // ── Setup / teardown ───────────────────────────────────────────
  beforeEach(() => {
    scrollY = 0;
    scrollToCalls = [];
    clearSessionStorage();
    __setMockLocation("/");

    vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);

    window.scrollTo = vi.fn(
      (options?: ScrollToOptions | { top?: number; behavior?: string }) => {
        if (typeof options === "object" && options !== null) {
          scrollToCalls.push({
            top: (options as { top?: number }).top ?? 0,
            behavior: (options as { behavior?: string }).behavior ?? "auto",
          });
        }
      },
    ) as unknown as typeof window.scrollTo;

    stubRAF();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── Tests ──────────────────────────────────────────────────────

  it("does not scroll on initial mount when no saved position exists", () => {
    renderHook(() => useScrollRestoration(true));
    expect(scrollToCalls.length).toBe(0);
  });

  it("does not read from sessionStorage when disabled", () => {
    // Pre-populate sessionStorage with a saved position for "/"
    sessionStorage.setItem(
      "__scroll_positions",
      JSON.stringify([["/", 200]]),
    );

    renderHook(() => useScrollRestoration(false));
    // The hook reads sessionStorage only when `enabled`.
    expect(scrollToCalls.length).toBe(0);
  });

  it("saves scroll position of the previous route on navigation", () => {
    const { rerender } = renderHook(
      (_props: { pathname: string }) => useScrollRestoration(true),
      { initialProps: { pathname: "/" } },
    );

    // Now navigate to "/transactions" — simulate by setting mock location.
    setScrollY(150);
    __setMockLocation("/transactions");
    rerender({ pathname: "/transactions" });

    const stored = JSON.parse(
      sessionStorage.getItem("__scroll_positions") ?? "[]",
    ) as [string, number][];

    expect(stored).toContainEqual(["/", 150]);
  });

  it("restores saved scroll position when navigating back", () => {
    // Arrange: save position for "/transactions" in sessionStorage.
    sessionStorage.setItem(
      "__scroll_positions",
      JSON.stringify([["/transactions", 300]]),
    );

    __setMockLocation("/transactions");
    renderHook(() => useScrollRestoration(true));

    // The hook should have called window.scrollTo with the saved position.
    expect(scrollToCalls.length).toBeGreaterThanOrEqual(1);
    expect(scrollToCalls[scrollToCalls.length - 1]).toMatchObject({
      top: 300,
      behavior: "instant",
    });
  });

  it("does not restore scroll below MIN_SAVED_Y threshold", () => {
    sessionStorage.setItem(
      "__scroll_positions",
      JSON.stringify([["/", 3]]), // below threshold
    );

    renderHook(() => useScrollRestoration(true));
    expect(scrollToCalls.length).toBe(0);
  });

  it("updates saved position while scrolling on the same route", () => {
    __setMockLocation("/credit-lines");
    renderHook(() => useScrollRestoration(true));

    setScrollY(500);
    window.dispatchEvent(new Event("scroll"));

    // The scroll handler is rAF-throttled; rAF fires synchronously in tests.
    const stored = JSON.parse(
      sessionStorage.getItem("__scroll_positions") ?? "[]",
    ) as [string, number][];

    expect(stored).toContainEqual(["/credit-lines", 500]);
  });

  it("cleans up event listeners on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useScrollRestoration(true));
    unmount();

    // The cleanup effect calls removeEventListener for the scroll listener.
    // removeEventListener only receives the event name and handler reference
    // (the { passive: true } options object is only passed to addEventListener).
    expect(removeSpy).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
  });

  it("saves current scroll position on unmount", () => {
    __setMockLocation("/settings");
    const { unmount } = renderHook(() => useScrollRestoration(true));

    setScrollY(800);
    unmount();

    const stored = JSON.parse(
      sessionStorage.getItem("__scroll_positions") ?? "[]",
    ) as [string, number][];

    expect(stored).toContainEqual(["/settings", 800]);
  });

  it("saves scroll position for route with search params", () => {
    __setMockLocation("/transactions", "?page=2");
    renderHook(() => useScrollRestoration(true));

    setScrollY(250);
    window.dispatchEvent(new Event("scroll"));

    const stored = JSON.parse(
      sessionStorage.getItem("__scroll_positions") ?? "[]",
    ) as [string, number][];

    expect(stored).toContainEqual(["/transactions?page=2", 250]);
  });
});