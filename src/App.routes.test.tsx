import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import App, { APP_ROUTES, REGISTERED_PATHS } from "./App";
import { COMMAND_PALETTE_DEFAULT_ITEMS } from "./components/CommandPalette";
import { BOTTOM_NAV_ITEMS } from "./components/BottomNav";

describe("App Route Smoke Tests (#1115)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/");
  });

  describe("Registered routes render without 404 (NotFound)", () => {
    it.each(APP_ROUTES)(
      "renders non-NotFound page for registered route $path ($name)",
      async (route) => {
        render(
          <App
            Router={({ children }) => (
              <MemoryRouter initialEntries={[route.path]}>
                {children}
              </MemoryRouter>
            )}
          />
        );

        // Header banner and main wrapper should be rendered
        expect(screen.getByRole("banner")).toBeInTheDocument();
        expect(screen.getByRole("main")).toBeInTheDocument();

        // The page must NOT render NotFound ("Page not found")
        expect(
          screen.queryByRole("heading", { name: /page not found/i })
        ).not.toBeInTheDocument();
      }
    );
  });

  describe("CommandPalette navigation targets", () => {
    const navItems = COMMAND_PALETTE_DEFAULT_ITEMS.filter(
      (item) => typeof item.action === "string"
    );

    it("has at least one navigation command item", () => {
      expect(navItems.length).toBeGreaterThan(0);
    });

    it.each(navItems)(
      "has registered route for CommandPalette target $label ($action)",
      (item) => {
        expect(REGISTERED_PATHS).toContain(item.action);
      }
    );
  });

  describe("BottomNav navigation targets", () => {
    it("has navigation items configured", () => {
      expect(BOTTOM_NAV_ITEMS.length).toBeGreaterThan(0);
    });

    it.each(BOTTOM_NAV_ITEMS)(
      "has registered route for BottomNav target $label ($to)",
      (item) => {
        expect(REGISTERED_PATHS).toContain(item.to);
      }
    );
  });

  describe("Unknown route handling", () => {
    it("renders NotFound page for unregistered path", async () => {
      render(
        <App
          Router={({ children }) => (
            <MemoryRouter initialEntries={["/unregistered-path-that-does-not-exist"]}>
              {children}
            </MemoryRouter>
          )}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /page not found/i })
        ).toBeInTheDocument();
      });
      expect(
        screen.getByText(/the page you're looking for doesn't exist/i)
      ).toBeInTheDocument();
    });
  });
});
