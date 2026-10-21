import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import {
  NOT_FOUND_METADATA,
  ROUTE_METADATA,
  RouteAnnouncer,
} from "./RouteAnnouncer";
import { ROUTE_MANIFEST } from "../routes/manifest";

const renderRouteAnnouncer = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RouteAnnouncer />
    </MemoryRouter>,
  );

const getDescriptionMeta = () =>
  document.querySelector<HTMLMetaElement>('meta[name="description"]');

describe("RouteAnnouncer", () => {
  afterEach(() => {
    cleanup();
    document.title = "";
    getDescriptionMeta()?.remove();
  });

  it.each(ROUTE_MANIFEST)(
    "sets title, meta description, and polite announcement for manifest route $path",
    async (route) => {
      renderRouteAnnouncer(route.path);

      await waitFor(() => {
        expect(document.title).toBe(`Creditra · ${route.pageName}`);
      });
      expect(getDescriptionMeta()).toHaveAttribute("content", route.description);
      expect(screen.getByRole("status")).toHaveTextContent(
        `${route.pageName} page loaded`,
      );
      expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
      expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true");
    },
  );

  it("ensures /settings, /profile, /docs, /linked-accounts are not announced as Not Found", async () => {
    const specialRoutes = ["/settings", "/profile", "/docs", "/linked-accounts"];
    for (const path of specialRoutes) {
      const { unmount } = renderRouteAnnouncer(path);
      await waitFor(() => {
        expect(document.title).not.toBe("Creditra · Not Found");
      });
      expect(screen.getByRole("status")).not.toHaveTextContent("Not Found page loaded");
      unmount();
    }
  });

  it("uses Not Found metadata for unknown routes", async () => {
    renderRouteAnnouncer("/missing-route");

    await waitFor(() => {
      expect(document.title).toBe(`Creditra · ${NOT_FOUND_METADATA.pageName}`);
    });
    expect(getDescriptionMeta()).toHaveAttribute(
      "content",
      NOT_FOUND_METADATA.description,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Not Found page loaded");
  });

  it("announces client-side route changes politely", async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/"]}>
        <RouteAnnouncer />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Dashboard page loaded");
    });

    // Simulate navigation by re-rendering with new location
    rerender(
      <MemoryRouter initialEntries={["/transactions"]}>
        <RouteAnnouncer />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(document.title).toBe("Creditra · Transaction History");
    });
    expect(getDescriptionMeta()).toHaveAttribute(
      "content",
      "Search, filter, and export your Creditra deposits, draws, repayments, and fees.",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Transaction History page loaded",
    );
  });

  it("keeps configured route titles and descriptions unique", () => {
    const titles = ROUTE_METADATA.map((route) => route.pageName);
    const descriptions = ROUTE_METADATA.map((route) => route.description);

    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
});
