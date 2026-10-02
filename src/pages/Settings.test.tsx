// src/pages/Settings.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import { Settings } from "./Settings";
import { ContrastProvider } from "../context/ContrastContext";
import { ReducedMotionProvider } from "../context/ReducedMotionContext";

describe("Settings Page (#1114)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-contrast");
    document.documentElement.removeAttribute("data-motion");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-contrast");
    document.documentElement.removeAttribute("data-motion");
  });

  const renderSettings = () =>
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <ContrastProvider>
          <ReducedMotionProvider>
            <Settings />
          </ReducedMotionProvider>
        </ContrastProvider>
      </MemoryRouter>
    );

  describe("Section labeling and accessibility hierarchy", () => {
    it("labels the accessibility section by its heading", () => {
      renderSettings();

      const a11yHeading = screen.getByRole("heading", { name: /^accessibility$/i });
      expect(a11yHeading).toHaveAttribute("id", "settings-a11y-heading");

      // Verify the containing section is labelled by this heading ID
      const section = a11yHeading.closest("section");
      expect(section).toBeInTheDocument();
      expect(section).toHaveAttribute("aria-labelledby", "settings-a11y-heading");
    });

    it("labels the notifications section by its heading", () => {
      renderSettings();

      const notifHeading = screen.getByRole("heading", { name: /^notifications$/i });
      expect(notifHeading).toHaveAttribute("id", "settings-notif-heading");

      const section = notifHeading.closest("section");
      expect(section).toBeInTheDocument();
      expect(section).toHaveAttribute("aria-labelledby", "settings-notif-heading");
    });
  });

  describe("High contrast toggle behavior", () => {
    it("toggles high contrast mode and sets data-contrast='high' on root element", () => {
      renderSettings();

      const hcSwitch = screen.getByRole("switch", { name: /high contrast/i });
      expect(hcSwitch).toHaveAttribute("aria-checked", "false");
      expect(document.documentElement).not.toHaveAttribute("data-contrast", "high");

      // Toggle ON
      fireEvent.click(hcSwitch);
      expect(hcSwitch).toHaveAttribute("aria-checked", "true");
      expect(document.documentElement.getAttribute("data-contrast")).toBe("high");

      // Toggle OFF
      fireEvent.click(hcSwitch);
      expect(hcSwitch).toHaveAttribute("aria-checked", "false");
      expect(document.documentElement).not.toHaveAttribute("data-contrast");
    });
  });

  describe("Reduced motion toggle behavior", () => {
    it("toggles reduced motion override and sets data-motion='reduced' on root element", () => {
      renderSettings();

      const rmSwitch = screen.getByRole("switch", { name: /reduced motion preview/i });
      expect(rmSwitch).toHaveAttribute("aria-checked", "false");
      expect(document.documentElement).not.toHaveAttribute("data-motion", "reduced");

      // Toggle ON
      fireEvent.click(rmSwitch);
      expect(rmSwitch).toHaveAttribute("aria-checked", "true");
      expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");

      // Toggle OFF
      fireEvent.click(rmSwitch);
      expect(rmSwitch).toHaveAttribute("aria-checked", "false");
      expect(document.documentElement).not.toHaveAttribute("data-motion", "reduced");
    });
  });

  describe("Notification navigation link targets", () => {
    it("renders valid links pointing to registered notification routes", () => {
      renderSettings();

      const categoryLink = screen.getByRole("link", { name: /category preferences/i });
      expect(categoryLink).toBeInTheDocument();
      expect(categoryLink).toHaveAttribute("href", "/settings/notifications");

      const channelsLink = screen.getByRole("link", { name: /delivery channels/i });
      expect(channelsLink).toBeInTheDocument();
      expect(channelsLink).toHaveAttribute("href", "/notification-preferences");
    });
  });
});
