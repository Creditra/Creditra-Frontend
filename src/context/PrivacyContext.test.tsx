import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  PrivacyModeProvider,
  PRIVACY_MODE_STORAGE_KEY,
  usePrivacyMode,
} from "./PrivacyContext";

function Probe() {
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();
  return (
    <button type="button" aria-pressed={privacyMode} onClick={togglePrivacyMode}>
      {privacyMode ? "on" : "off"}
    </button>
  );
}

describe("PrivacyModeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-privacy-mode");
  });

  it("defaults to off and toggles the html attribute and storage", () => {
    render(
      <PrivacyModeProvider>
        <Probe />
      </PrivacyModeProvider>,
    );

    const toggle = screen.getByRole("button");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.hasAttribute("data-privacy-mode")).toBe(false);

    act(() => toggle.click());

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.getAttribute("data-privacy-mode")).toBe("on");
    expect(JSON.parse(localStorage.getItem(PRIVACY_MODE_STORAGE_KEY) ?? "null")).toBe(true);
  });

  it("restores a persisted preference on mount", () => {
    localStorage.setItem(PRIVACY_MODE_STORAGE_KEY, "true");

    render(
      <PrivacyModeProvider>
        <Probe />
      </PrivacyModeProvider>,
    );

    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("uses initialPrivacyMode when provided", () => {
    localStorage.setItem(PRIVACY_MODE_STORAGE_KEY, "false");

    render(
      <PrivacyModeProvider initialPrivacyMode>
        <Probe />
      </PrivacyModeProvider>,
    );

    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("returns a safe default outside a provider", () => {
    render(<Probe />);

    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });
});
