import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextAccrualChip } from "./NextAccrualChip";
import { formatAbsolute, parseLocalDate } from "../utils/dates";

describe("NextAccrualChip", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("formats aria-label and title with en-US by default", () => {
    const target = "2025-02-15T12:00:00Z";
    const expected = formatAbsolute(new Date(target), "en-US");

    render(<NextAccrualChip target={target} />);

    const chip = screen.getByRole("status");
    expect(chip).toHaveAttribute("title", expected);
    expect(chip).toHaveAttribute(
      "aria-label",
      `Next interest accrual on ${expected}`,
    );
  });

  it("formats aria-label and title with de-DE when locale prop is provided", () => {
    const target = "2025-02-15T12:00:00Z";
    const expected = formatAbsolute(new Date(target), "de-DE");

    render(<NextAccrualChip target={target} locale="de-DE" />);

    const chip = screen.getByRole("status");
    expect(chip).toHaveAttribute("title", expected);
    expect(chip).toHaveAttribute(
      "aria-label",
      `Next interest accrual on ${expected}`,
    );
  });

  it("reads the active locale from localStorage when no locale prop is passed", () => {
    window.localStorage.setItem("locale", "de-DE");
    const target = "2025-02-15T12:00:00Z";
    const expected = formatAbsolute(new Date(target), "de-DE");

    render(<NextAccrualChip target={target} />);

    const chip = screen.getByRole("status");
    expect(chip).toHaveAttribute("title", expected);
    expect(chip).toHaveAttribute(
      "aria-label",
      `Next interest accrual on ${expected}`,
    );
  });

  it("parses date-only ISO values as local dates to avoid off-by-one shifts", () => {
    const target = "2025-02-15";
    const localDate = parseLocalDate(target);
    expect(localDate).not.toBeNull();
    expect(localDate?.getFullYear()).toBe(2025);
    expect(localDate?.getMonth()).toBe(1);
    expect(localDate?.getDate()).toBe(15);

    const expected = formatAbsolute(localDate!, "en-US");
    render(<NextAccrualChip target={target} locale="en-US" />);

    const chip = screen.getByRole("status");
    expect(chip).toHaveAttribute("title", expected);
    expect(chip).toHaveAttribute(
      "aria-label",
      `Next interest accrual on ${expected}`,
    );
    expect(expected).toContain("15");
  });

  it("renders nothing when target is empty", () => {
    const { container } = render(<NextAccrualChip target="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when target is an invalid date", () => {
    const { container } = render(<NextAccrualChip target="not-a-date" />);
    expect(container.firstChild).toBeNull();
  });
});
