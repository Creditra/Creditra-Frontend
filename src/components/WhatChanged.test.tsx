import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { dashboardValuesStableKey } from "../constants/storageKeys";
import { WhatChanged } from "./WhatChanged";
import axe from "axe-core";

const walletIdentity = vi.hoisted(() => ({ current: "wallet-a" as string | null }));

vi.mock("../hooks/useWalletIdentityKey", () => ({
  useWalletIdentityKey: () => walletIdentity.current,
}));

describe("WhatChanged Component", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    walletIdentity.current = "wallet-a";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not render when there is no previous value", () => {
    walletIdentity.current = null;
    const { container } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("does not render when the current value is equal to the previous value", () => {
    localStorage.setItem(dashboardValuesStableKey("wallet-a"), JSON.stringify({ "total-limit": 10000 }));
    
    const { container } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the trigger and tooltip when the value has changed since last visit", () => {
    // Set a different value from the last visit
    localStorage.setItem(dashboardValuesStableKey("wallet-a"), JSON.stringify({ "total-limit": 8000 }));

    render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );

    // Should render the trigger (arrow indicating change)
    const trigger = screen.getByRole("button", { name: "Total Credit Limit changed from $8,000 to $10,000 (change +$2,000)" });
    expect(trigger).toBeInTheDocument();
    
    // Tooltip should be in the document (hidden by default via CSS class, but we can verify text)
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute("aria-hidden", "true");
    expect(tooltip).toHaveTextContent("Since last visit:");
    expect(tooltip).toHaveTextContent("Previous:$8,000");
    expect(tooltip).toHaveTextContent("Current:$10,000");
    expect(tooltip).toHaveTextContent("Change:+$2,000");
  });

  it("shows the tooltip on hover", () => {
    localStorage.setItem(dashboardValuesStableKey("wallet-a"), JSON.stringify({ "total-limit": 8000 }));

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
    localStorage.setItem(dashboardValuesStableKey("wallet-a"), JSON.stringify({ "total-limit": 8000 }));

    const { container } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );

    const trigger = screen.getByRole("button", { name: "Total Credit Limit changed from $8,000 to $10,000 (change +$2,000)" });
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
    localStorage.setItem(dashboardValuesStableKey("wallet-a"), JSON.stringify({ "risk-score": 85 }));

    render(
      <WhatChanged metricId="risk-score" currentValue={80} format="number" label="Risk Score" />
    );

    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(tooltip).toHaveTextContent("Previous:85");
    expect(tooltip).toHaveTextContent("Current:80");
    expect(tooltip).toHaveTextContent("Change:-5");
  });
  it("shows on keyboard focus, exposes the change details and hides on blur", () => {
    localStorage.setItem("creditra_dashboard_values_stable", JSON.stringify({ "total-limit": 8000 }));
    const { container } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );
    const trigger = screen.getByRole("button", {
      name: "Total Credit Limit changed from $8,000 to $10,000 (change +$2,000)",
    });
    const tooltip = container.querySelector(".what-changed-tooltip")!;
    expect(tooltip).not.toHaveClass("is-visible");
    expect(trigger).not.toHaveAttribute("aria-describedby");

    act(() => trigger.focus());
    expect(trigger).toHaveFocus();
    expect(tooltip).toHaveClass("is-visible");
    expect(tooltip).toHaveAttribute("aria-hidden", "false");
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
    expect(tooltip).toHaveTextContent("Previous:$8,000");
    expect(tooltip).toHaveTextContent("Current:$10,000");
    expect(tooltip).toHaveTextContent("Change:+$2,000");

    fireEvent.blur(trigger);
    expect(tooltip).not.toHaveClass("is-visible");
    expect(trigger).not.toHaveAttribute("aria-describedby");

    // A rapid re-focus must reopen the tooltip without a stale dismiss flag.
    fireEvent.focus(trigger);
    expect(tooltip).toHaveClass("is-visible");
  });

  it("Escape dismisses the tooltip without moving focus, including while hovered", () => {
    localStorage.setItem("creditra_dashboard_values_stable", JSON.stringify({ "total-limit": 8000 }));
    const { container } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );
    const trigger = screen.getByRole("button");
    const wrapper = container.querySelector(".what-changed-wrapper")!;
    const tooltip = container.querySelector(".what-changed-tooltip")!;
    fireEvent.mouseEnter(wrapper);
    act(() => trigger.focus());
    expect(tooltip).toHaveClass("is-visible");

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(tooltip).not.toHaveClass("is-visible");
    expect(tooltip).toHaveClass("is-dismissed");
    expect(tooltip).toHaveAttribute("aria-hidden", "true");
    expect(trigger).not.toHaveAttribute("aria-describedby");

    // While focus remains on the trigger, leaving hover cannot re-show it.
    fireEvent.mouseLeave(wrapper);
    expect(tooltip).not.toHaveClass("is-visible");

    // A fresh pointer enter deliberately re-opens the tooltip.
    fireEvent.mouseEnter(wrapper);
    expect(tooltip).toHaveClass("is-visible");
    expect(tooltip).not.toHaveClass("is-dismissed");
  });

  it("does not hide a focused tooltip when the mouse leaves the trigger", () => {
    localStorage.setItem("creditra_dashboard_values_stable", JSON.stringify({ "total-limit": 8000 }));
    const { container } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );
    const trigger = screen.getByRole("button");
    const wrapper = container.querySelector(".what-changed-wrapper")!;
    const tooltip = container.querySelector(".what-changed-tooltip")!;

    fireEvent.mouseEnter(wrapper);
    act(() => trigger.focus());
    fireEvent.mouseLeave(wrapper);
    expect(tooltip).toHaveClass("is-visible");

    fireEvent.blur(trigger);
    expect(tooltip).not.toHaveClass("is-visible");
  });

  it("has no axe-core violations in its accessible change tooltip", async () => {
    // axe schedules its work with real timers, unlike the long-press test.
    vi.useRealTimers();
    localStorage.setItem("creditra_dashboard_values_stable", JSON.stringify({ "total-limit": 8000 }));
    const { container } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" label="Total Credit Limit" />
    );
    act(() => screen.getByRole("button").focus());
    // jsdom has no Canvas implementation; contrast cannot be reliably
    // evaluated here. Keep every other axe rule enabled.
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations).toEqual([]);
  });


  it("does not show one wallet's values for another wallet", () => {
    localStorage.setItem(dashboardValuesStableKey("wallet-a"), JSON.stringify({ "total-limit": 8000 }));
    const { container, rerender } = render(
      <WhatChanged metricId="total-limit" currentValue={10000} format="currency" />
    );
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveTextContent("Previous:$8,000");

    walletIdentity.current = "wallet-b";
    rerender(<WhatChanged metricId="total-limit" currentValue={12000} format="currency" />);

    expect(container.firstChild).toBeNull();
  });

  it("does not throw when localStorage is unavailable", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() =>
      render(<WhatChanged metricId="total-limit" currentValue={10000} format="currency" />)
    ).not.toThrow();
  });
});
