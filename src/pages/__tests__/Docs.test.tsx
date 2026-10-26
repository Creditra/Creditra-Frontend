import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import Docs from "../Docs";
import { RiskExplainerCard } from "../../components/RiskExplainerCard";

const activeSection = vi.hoisted(() => ({ current: null as string | null }));

vi.mock("../../hooks/useActiveSection", () => ({
  useActiveSection: () => activeSection.current,
}));

function mockMatchMedia(matching: (query: string) => boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matching(query),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function renderDocs(entry = "/docs") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Docs />
    </MemoryRouter>,
  );
}

let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
  activeSection.current = null;
  scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView as unknown as Element["scrollIntoView"];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Docs page", () => {
  it("renders an 'On this page' navigation with 8 links", () => {
    renderDocs();
    const nav = screen.getByRole("navigation", { name: "On this page" });
    expect(within(nav).getAllByRole("link")).toHaveLength(8);
  });

  it("gives every section a unique slug matched by a TOC link", () => {
    const { container } = renderDocs();
    const ids = Array.from(container.querySelectorAll("section")).map((s) => s.id);
    expect(ids).toHaveLength(8);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
    expect(new Set(ids).size).toBe(8);

    const nav = screen.getByRole("navigation", { name: "On this page" });
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(ids.map((id) => `#${id}`));
  });

  it("scrolls to and focuses the hash target on arrival", () => {
    const { container } = renderDocs("/docs#risk-pricing");
    const section = container.querySelector("#risk-pricing")!;
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(section);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    const heading = within(section as HTMLElement).getByRole("heading", { name: "Risk pricing" });
    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("ignores unknown hashes without scrolling or erroring", () => {
    const getById = vi.spyOn(document, "getElementById");
    expect(() => renderDocs("/docs#unknown")).not.toThrow();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(getById).not.toHaveBeenCalledWith("unknown");
  });

  it("scrolls instantly when reduced motion is active", () => {
    mockMatchMedia((q) => q.includes("prefers-reduced-motion"));
    renderDocs("/docs#risk-pricing");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "start" });
  });

  it("marks the TOC link of the active section with aria-current", () => {
    const { rerender } = renderDocs();
    const nav = screen.getByRole("navigation", { name: "On this page" });
    expect(within(nav).queryAllByRole("link").filter((a) => a.hasAttribute("aria-current"))).toHaveLength(0);

    activeSection.current = "transactions";
    rerender(
      <MemoryRouter initialEntries={["/docs"]}>
        <Docs />
      </MemoryRouter>,
    );
    const current = within(nav).getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute("href", "#transactions");
  });

  it("puts the TOC inside a <details> disclosure on narrow viewports", () => {
    mockMatchMedia((q) => q.includes("max-width"));
    renderDocs();
    const nav = screen.getByRole("navigation", { name: "On this page", hidden: true });
    expect(nav.closest("details")).not.toBeNull();
  });

  it("does not use a <details> disclosure on wide viewports", () => {
    renderDocs();
    const nav = screen.getByRole("navigation", { name: "On this page" });
    expect(nav.closest("details")).toBeNull();
  });
});

describe("RiskExplainerCard docs link", () => {
  it("navigates client-side to /docs#risk-pricing", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <RiskExplainerCard />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Learn more about risk pricing" });
    expect(link).toHaveAttribute("href", "/docs#risk-pricing");
    // A router link cancels the full document navigation and updates the
    // router location instead.
    expect(fireEvent.click(link)).toBe(false);
    // The stub's useLocation reads module-level state, so it can be read directly.
    const { pathname, hash } = useLocation();
    expect(pathname).toBe("/docs");
    expect(hash).toBe("#risk-pricing");
  });
});
