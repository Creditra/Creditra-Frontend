import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { WhatChanged } from "./WhatChanged";

describe("WhatChanged Component", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not render when there is no previous value", () => {
    const { container } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("does not render when the current value is equal to the previous value", () => {
    localStorage.setItem("creditra_dashboard_values_stable", JSON.stringify({ "total-limit": 10000 }));
    
    const { container } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the trigger and tooltip when the value has changed since last visit", () => {
    // Set a different value from the last visit
    localStorage.setItem("creditra_dashboard_values_stable", JSON.stringify({ "total-limit": 8000 }));

    render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );

    // Should render the trigger (arrow indicating change)
    const trigger = screen.getByLabelText("What changed for Total Credit Limit");
    expect(trigger).toBeInTheDocument();
    
    // Tooltip should be in the document (hidden by default via CSS class, but we can verify text)
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Since last visit:");
    expect(tooltip).toHaveTextContent("Previous:$8,000");
    expect(tooltip).toHaveTextContent("Current:$10,000");
    expect(tooltip).toHaveTextContent("Change:+$2,000");
  });

  it("shows the tooltip on hover", () => {
    localStorage.setItem("creditra_dashboard_values_stable", JSON.stringify({ "total-limit": 8000 }));

    const { container } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );

    const wrapper = container.querySelector(".what-changed-wrapper");
    const tooltip = container.querySelector(".what-changed-tooltip");

    expect(tooltip).not.toHaveClass("is-visible");

    // Mouse enter
    fireEvent.mouseEnter(wrapper!);
    expect(tooltip).toHaveClass("is-visible");

    // Mouse leave
    fireEvent.mouseLeave(wrapper!);
    expect(tooltip).not.toHaveClass("is-visible");
  });

  it("shows the tooltip on long-press for mobile devices", () => {
    localStorage.setItem("creditra_dashboard_values_stable", JSON.stringify({ "total-limit": 8000 }));

    const { container } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );

    const trigger = screen.getByLabelText("What changed for Total Credit Limit");
    const tooltip = container.querySelector(".what-changed-tooltip");

    expect(tooltip).not.toHaveClass("is-visible");

    // Start touch
    fireEvent.touchStart(trigger);
    
    // Advance timers by 500ms for long-press threshold
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(tooltip).toHaveClass("is-visible");

    // End touch
    fireEvent.touchEnd(trigger);
    
    // Should still be visible immediately after touchEnd (UX grace period)
    expect(tooltip).toHaveClass("is-visible");

    // Advance timer by 2000ms to hide
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(tooltip).not.toHaveClass("is-visible");
  });

  it("handles negative changes and custom formatting", () => {
    localStorage.setItem("creditra_dashboard_values_stable", JSON.stringify({ "risk-score": 85 }));

    render(
      <WhatChanged metricId="risk-score" currentValue={80} format="number" label="Risk Score" />
    );

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Previous:85");
    expect(tooltip).toHaveTextContent("Current:80");
    expect(tooltip).toHaveTextContent("Change:-5");
  });

  it("formats float percents with at most 2 fraction digits and trims trailing zeros", () => {
    localStorage.setItem(
      "creditra_dashboard_values_stable",
      JSON.stringify({ "apr-rate": 3.4500000001 })
    );

    render(
      <WhatChanged metricId="apr-rate" currentValue={12.345} format="percent" label="APR" />
    );

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Previous:3.45%");
    expect(tooltip).toHaveTextContent("Current:12.35%");
    expect(tooltip).toHaveTextContent("Change:+8.89%");
  });

  it("handles negative percent diffs and floating-point arithmetic imprecision", () => {
    localStorage.setItem(
      "creditra_dashboard_values_stable",
      JSON.stringify({ "util-rate": 0.1 + 0.2 })
    );

    render(
      <WhatChanged metricId="util-rate" currentValue={0.1} format="percent" label="Utilization" />
    );

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Previous:0.3%");
    expect(tooltip).toHaveTextContent("Current:0.1%");
    expect(tooltip).toHaveTextContent("Change:-0.2%");
  });

  it("does not show tooltip if touch ends before long-press fires", () => {
    localStorage.setItem("creditra_dashboard_values_stable", JSON.stringify({ "total-limit": 8000 }));

    const { container } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );

    const trigger = screen.getByLabelText("What changed for Total Credit Limit");
    const tooltip = container.querySelector(".what-changed-tooltip");

    fireEvent.touchStart(trigger);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.touchEnd(trigger);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(tooltip).not.toHaveClass("is-visible");
  });

  it("clears pending long-press and hide timers on unmount without warnings", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("creditra_dashboard_values_stable", JSON.stringify({ "total-limit": 8000 }));

    // Unmount during pending long-press timer
    const { unmount: unmountDuringTouch } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );
    const trigger1 = screen.getByLabelText("What changed for Total Credit Limit");
    fireEvent.touchStart(trigger1);
    expect(vi.getTimerCount()).toBe(1);

    unmountDuringTouch();
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.runAllTimers();
    });

    // Unmount during pending hide timer
    const { unmount: unmountDuringHide } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );
    const trigger2 = screen.getByLabelText("What changed for Total Credit Limit");
    fireEvent.touchStart(trigger2);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.touchEnd(trigger2);
    expect(vi.getTimerCount()).toBe(1);

    unmountDuringHide();
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.runAllTimers();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
