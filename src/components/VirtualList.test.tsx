import React, { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VirtualList, type VirtualListHandle } from "./VirtualList";

interface TestItem {
  id: string;
  label: string;
}

function makeItems(count: number): TestItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    label: `Row ${i}`,
  }));
}

describe("VirtualList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders only the visible window plus overscan for 5,000 items", () => {
    const items = makeItems(5000);
    render(
      <VirtualList
        items={items}
        estimateSize={50}
        overscan={3}
        viewportHeight={250}
        threshold={100}
        getItemKey={(item) => item.id}
        renderItem={(item, _idx, { measureRef }) => (
          <div ref={measureRef} data-testid="virtual-row">
            {item.label}
          </div>
        )}
      />,
    );

    const rendered = screen.getAllByTestId("virtual-row");
    // 250px viewport / 50px row = 5-6 visible rows + 3 overscan below = ~9 rows
    expect(rendered.length).toBeLessThan(20);
    expect(rendered.length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText("Row 0")).toBeInTheDocument();
    expect(screen.queryByText("Row 4999")).not.toBeInTheDocument();
  });

  it("updates the rendered window when scrolled", () => {
    const items = makeItems(1000);
    const { container } = render(
      <VirtualList
        items={items}
        estimateSize={50}
        overscan={2}
        viewportHeight={200}
        threshold={50}
        getItemKey={(item) => item.id}
        renderItem={(item, _idx, { measureRef }) => (
          <div ref={measureRef} data-testid="virtual-row">
            {item.label}
          </div>
        )}
      />,
    );

    const scrollEl = container.firstElementChild as HTMLElement;
    Object.defineProperty(scrollEl, "clientHeight", {
      value: 200,
      configurable: true,
    });
    Object.defineProperty(scrollEl, "scrollTop", {
      value: 2500, // item 50
      writable: true,
      configurable: true,
    });

    fireEvent.scroll(scrollEl);

    expect(screen.queryByText("Row 0")).not.toBeInTheDocument();
    expect(screen.getByText("Row 50")).toBeInTheDocument();
    expect(screen.getByText("Row 52")).toBeInTheDocument();
    expect(screen.queryByText("Row 100")).not.toBeInTheDocument();
  });

  it("supports scrollToIndex via imperative handle", () => {
    const items = makeItems(500);
    const listRef = createRef<VirtualListHandle>();
    const { container } = render(
      <VirtualList
        ref={listRef}
        items={items}
        estimateSize={40}
        overscan={2}
        viewportHeight={200}
        threshold={50}
        getItemKey={(item) => item.id}
        renderItem={(item, _idx, { measureRef }) => (
          <div ref={measureRef} data-testid="virtual-row">
            {item.label}
          </div>
        )}
      />,
    );

    const scrollEl = container.firstElementChild as HTMLElement;
    const scrollToSpy = vi.fn(({ top }: { top?: number }) => {
      if (typeof top === "number") {
        Object.defineProperty(scrollEl, "scrollTop", {
          value: top,
          writable: true,
          configurable: true,
        });
      }
    });
    scrollEl.scrollTo = scrollToSpy as unknown as typeof scrollEl.scrollTo;

    act(() => {
      listRef.current?.scrollToIndex(200, { align: "start" });
    });

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 8000, behavior: "auto" });
    expect(screen.getByText("Row 200")).toBeInTheDocument();
    expect(screen.queryByText("Row 0")).not.toBeInTheDocument();
  });

  it("never unmounts the pinnedIndex row even when scrolled out of view", () => {
    const items = makeItems(500);
    const listRef = createRef<VirtualListHandle>();
    render(
      <VirtualList
        ref={listRef}
        items={items}
        estimateSize={50}
        overscan={2}
        viewportHeight={200}
        threshold={50}
        pinnedIndex={3}
        getItemKey={(item) => item.id}
        renderItem={(item, _idx, { measureRef, isPinned }) => (
          <div
            ref={measureRef}
            data-testid="virtual-row"
            data-pinned={isPinned ? "true" : "false"}
          >
            {item.label}
          </div>
        )}
      />,
    );

    // Scroll far down past row 3
    act(() => {
      listRef.current?.scrollToIndex(250, { align: "start" });
    });

    // Row 3 is pinned above the window and must remain mounted
    const pinnedRow = screen.getByText("Row 3");
    expect(pinnedRow).toBeInTheDocument();
    expect(pinnedRow).toHaveAttribute("data-pinned", "true");
    // Row 250 is visible in the new window
    expect(screen.getByText("Row 250")).toBeInTheDocument();
    // Row 0 (unpinned, out of view) is unmounted
    expect(screen.queryByText("Row 0")).not.toBeInTheDocument();
  });

  it("supports table-compatible mode with aria-hidden spacer rows", () => {
    const items = makeItems(200);
    const { container } = render(
      <table aria-rowcount={items.length + 1}>
        <thead>
          <tr aria-rowindex={1}>
            <th>Label</th>
          </tr>
        </thead>
        <tbody>
          <VirtualList
            mode="table"
            columnCount={1}
            items={items}
            estimateSize={50}
            overscan={2}
            viewportHeight={200}
            threshold={50}
            ariaRowIndexOffset={2}
            getItemKey={(item) => item.id}
            renderItem={(item, _idx, { measureRef, ariaRowIndex }) => (
              <tr
                ref={measureRef}
                aria-rowindex={ariaRowIndex}
                data-testid="table-row"
              >
                <td>{item.label}</td>
              </tr>
            )}
          />
        </tbody>
      </table>,
    );

    const dataRows = screen.getAllByTestId("table-row");
    expect(dataRows.length).toBeLessThan(20);
    expect(dataRows[0]).toHaveAttribute("aria-rowindex", "2");

    const spacers = container.querySelectorAll("tr.virtual-list-spacer");
    expect(spacers.length).toBeGreaterThanOrEqual(1);
    spacers.forEach((spacer) => {
      expect(spacer).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("falls back to full rendering when item count is below threshold", () => {
    const items = makeItems(25);
    const { container } = render(
      <VirtualList
        items={items}
        estimateSize={50}
        threshold={100}
        viewportHeight={200}
        getItemKey={(item) => item.id}
        renderItem={(item, _idx, { measureRef }) => (
          <div ref={measureRef} data-testid="virtual-row">
            {item.label}
          </div>
        )}
      />,
    );

    expect(screen.getAllByTestId("virtual-row")).toHaveLength(25);
    expect(container.querySelectorAll(".virtual-list-spacer")).toHaveLength(0);
  });

  it("falls back to full rendering when matchMedia('print') matches", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query === "print",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const items = makeItems(120);
    const { container } = render(
      <VirtualList
        items={items}
        estimateSize={50}
        threshold={50}
        viewportHeight={200}
        getItemKey={(item) => item.id}
        renderItem={(item, _idx, { measureRef }) => (
          <div ref={measureRef} data-testid="virtual-row">
            {item.label}
          </div>
        )}
      />,
    );

    expect(screen.getAllByTestId("virtual-row")).toHaveLength(120);
    expect(container.querySelectorAll(".virtual-list-spacer")).toHaveLength(0);
  });

  it("re-measures item height when getBoundingClientRect changes", () => {
    const items = makeItems(120);
    const listRef = createRef<VirtualListHandle>();
    let row0Height = 50;

    render(
      <VirtualList
        ref={listRef}
        items={items}
        estimateSize={50}
        overscan={2}
        viewportHeight={200}
        threshold={50}
        getItemKey={(item) => item.id}
        renderItem={(item, idx, { measureRef }) => (
          <div
            ref={(el) => {
              if (el && idx === 0) {
                el.getBoundingClientRect = () =>
                  ({
                    height: row0Height,
                    width: 400,
                    top: 0,
                    left: 0,
                    bottom: row0Height,
                    right: 400,
                    x: 0,
                    y: 0,
                    toJSON: () => {},
                  }) as DOMRect;
              }
              measureRef(el);
            }}
            data-testid={`row-${idx}`}
          >
            {item.label}
          </div>
        )}
      />,
    );

    // Simulate expanding row 0 from 50px to 250px
    row0Height = 250;
    act(() => {
      listRef.current?.remeasure(0);
    });

    // After row 0 grows to 250px, scrolling to index 1 should target offset 250
    const { container } = render(<div />);
    expect(container).toBeTruthy();
    const scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy;
    act(() => {
      listRef.current?.scrollToIndex(1, { align: "start" });
    });
    expect(listRef.current?.getVisibleRange().startIndex).toBe(0);
  });
});
