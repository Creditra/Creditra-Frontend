import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { PrivacyModeProvider } from "../context/PrivacyContext";
import { PrivacyModeToggle } from "./PrivacyModeToggle";

describe("PrivacyModeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exposes its pressed state and toggles privacy mode", () => {
    render(
      <PrivacyModeProvider initialPrivacyMode={false}>
        <PrivacyModeToggle />
      </PrivacyModeProvider>,
    );

    const toggle = screen.getByRole("button", { name: "Privacy mode" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("title", "Privacy mode off — amounts are visible");

    act(() => toggle.click());

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAttribute("title", "Privacy mode on — amounts are hidden");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Privacy mode on — amounts are hidden",
    );
  });
});
