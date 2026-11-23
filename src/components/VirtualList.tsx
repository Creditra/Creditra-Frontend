import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

export interface VirtualItemMeta {
  /** Zero-based index of the item in the full list. */
  index: number;
  /**
   * Callback ref to attach to the rendered item element so VirtualList can
   * measure its actual height via ResizeObserver / getBoundingClientRect.
   */
  measureRef: (element: HTMLElement | null) => void;
  /** Whether this item is currently pinned (e.g. focused) outside the visible window. */
  isPinned: boolean;
  /** 1-based ARIA row index (accounting for ariaRowIndexOffset). */
  ariaRowIndex: number;
}

export interface ScrollToIndexOptions {
  align?: "auto" | "start" | "center" | "end";
  behavior?: ScrollBehavior;
}

export interface VirtualListHandle {
  /** Scroll the list so the item at `index` is visible. */
  scrollToIndex: (index: number, options?: ScrollToIndexOptions) => void;
  /** Re-measure a specific item index (or all currently mounted items if omitted). */
  remeasure: (index?: number) => void;
  /** Return the current rendered window range (inclusive). */
  getVisibleRange: () => { startIndex: number; endIndex: number };
}

export interface VirtualListProps<T> {
  /** Full array of items to render. */
  items: readonly T[];
  /** Fixed or per-item estimated height in pixels before measurement. */
  estimateSize: number | ((index: number, item: T) => number);
  /** Number of extra items to render above and below the visible viewport. */
  overscan?: number;
  /**
   * Minimum item count required to activate windowing.
   * Below this threshold (or when printing), all items render without spacers.
   */
  threshold?: number;
  /** Stable unique key for each item. */
  getItemKey: (item: T, index: number) => string | number;
  /** Render callback for each visible (or pinned) item. */
  renderItem: (item: T, index: number, meta: VirtualItemMeta) => React.ReactNode;
  /**
   * Rendering mode:
   * - `"list"`: renders a scrollable container with `<div>` spacers.
   * - `"table"`: renders directly inside a `<tbody>` using `aria-hidden` spacer `<tr>`s.
   */
  mode?: "list" | "table";
  /** Column count for spacer `<td colSpan>` in `"table"` mode. */
  columnCount?: number;
  /**
   * Optional external scroll container ref.
   * In `"list"` mode, defaults to the component's own container `<div>`.
   * In `"table"` mode, defaults to `window` if omitted.
   */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  /** Fallback viewport height in pixels when container height cannot be measured (e.g. jsdom). */
  viewportHeight?: number;
  /**
   * Index of an item that must stay mounted even when scrolled out of the visible
   * window (for example, the currently keyboard-focused row).
   */
  pinnedIndex?: number | null;
  /** 1-based offset for `ariaRowIndex` (default `1`; use `2` in tables with a header row). */
  ariaRowIndexOffset?: number;
  /** Optional className for the `"list"` mode wrapper. */
  className?: string;
  /** Optional inline styles for the `"list"` mode wrapper. */
  style?: React.CSSProperties;
}

const DEFAULT_OVERSCAN = 5;
const DEFAULT_THRESHOLD = 100;
const DEFAULT_VIEWPORT_HEIGHT = 600;

/**
 * Binary search the largest index `i` in `offsets` (length `n + 1`) such that
 * `offsets[i] <= target`. Clamped to `[0, n - 1]`.
 */
function findIndexForOffset(offsets: Float64Array, count: number, target: number): number {
  if (count <= 0) return 0;
  if (target <= 0) return 0;
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const mid = (low + high + 1) >>> 1;
    if (offsets[mid] <= target) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

function useIsPrinting(): boolean {
  const [isPrinting, setIsPrinting] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("print").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    let mql: MediaQueryList | null = null;
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsPrinting(e.matches);
    };

    if (typeof window.matchMedia === "function") {
      mql = window.matchMedia("print");
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", handleMediaChange);
      }
    }

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      if (mql && typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", handleMediaChange);
      }
    };
  }, []);

  return isPrinting;
}

function VirtualListInner<T>(
  props: VirtualListProps<T>,
  ref: React.ForwardedRef<VirtualListHandle>,
) {
  const {
    items,
    estimateSize,
    overscan = DEFAULT_OVERSCAN,
    threshold = DEFAULT_THRESHOLD,
    getItemKey,
    renderItem,
    mode = "list",
    columnCount = 1,
    scrollContainerRef,
    viewportHeight: fallbackViewportHeight = DEFAULT_VIEWPORT_HEIGHT,
    pinnedIndex = null,
    ariaRowIndexOffset = 1,
    className,
    style,
  } = props;

  const isPrinting = useIsPrinting();
  const isVirtualized = !isPrinting && items.length >= threshold;

  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const measuredHeightsRef = useRef<Map<string | number, number>>(new Map());
  const mountedElementsRef = useRef<Map<number, { key: string | number; el: HTMLElement }>>(
    new Map(),
  );
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const elementToKeyRef = useRef<WeakMap<Element, string | number>>(new WeakMap());

  const [measureVersion, setMeasureVersion] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [viewportSize, setViewportSize] = useState(fallbackViewportHeight);

  const getScrollElement = useCallback((): HTMLElement | null => {
    if (scrollContainerRef) {
      return scrollContainerRef.current;
    }
    if (mode === "list") {
      return internalContainerRef.current;
    }
    return null;
  }, [mode, scrollContainerRef]);

  const recordHeight = useCallback((key: string | number, height: number) => {
    if (!(height > 0)) return;
    const prev = measuredHeightsRef.current.get(key);
    if (prev === undefined || Math.abs(prev - height) > 0.5) {
      measuredHeightsRef.current.set(key, height);
      setMeasureVersion((v) => v + 1);
    }
  }, []);

  // Set up a shared ResizeObserver for dynamic row height changes (e.g. expanded details).
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const key = elementToKeyRef.current.get(entry.target);
        if (key === undefined) continue;
        const rectHeight = entry.target.getBoundingClientRect().height;
        const height = rectHeight > 0 ? rectHeight : entry.contentRect.height;
        if (height > 0) {
          const prev = measuredHeightsRef.current.get(key);
          if (prev === undefined || Math.abs(prev - height) > 0.5) {
            measuredHeightsRef.current.set(key, height);
            changed = true;
          }
        }
      }
      if (changed) {
        setMeasureVersion((v) => v + 1);
      }
    });
    resizeObserverRef.current = observer;
    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
    };
  }, []);

  // Compute prefix-sum offsets for all items.
  const { offsets, totalHeight } = useMemo(() => {
    const count = items.length;
    const arr = new Float64Array(count + 1);
    let running = 0;
    for (let i = 0; i < count; i++) {
      arr[i] = running;
      const key = getItemKey(items[i], i);
      const measured = measuredHeightsRef.current.get(key);
      const size =
        measured !== undefined
          ? measured
          : typeof estimateSize === "function"
            ? estimateSize(i, items[i])
            : estimateSize;
      running += Math.max(1, size);
    }
    arr[count] = running;
    return { offsets: arr, totalHeight: running };
    // measureVersion intentionally triggers recalculation when measured heights change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, estimateSize, getItemKey, measureVersion]);

  // Listen to scroll and resize events on the scroll container (or window).
  useEffect(() => {
    if (!isVirtualized) return;

    const scrollEl = getScrollElement();

    const readScrollMetrics = () => {
      if (scrollEl) {
        setScrollOffset(scrollEl.scrollTop);
        const h = scrollEl.clientHeight;
        setViewportSize(h > 0 ? h : fallbackViewportHeight);
      } else if (typeof window !== "undefined") {
        setScrollOffset(window.scrollY || 0);
        const h = window.innerHeight;
        setViewportSize(h > 0 ? h : fallbackViewportHeight);
      }
    };

    readScrollMetrics();

    if (scrollEl) {
      scrollEl.addEventListener("scroll", readScrollMetrics, { passive: true });
      let containerObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined") {
        containerObserver = new ResizeObserver(readScrollMetrics);
        containerObserver.observe(scrollEl);
      }
      return () => {
        scrollEl.removeEventListener("scroll", readScrollMetrics);
        containerObserver?.disconnect();
      };
    }

    if (typeof window !== "undefined") {
      window.addEventListener("scroll", readScrollMetrics, { passive: true });
      window.addEventListener("resize", readScrollMetrics, { passive: true });
      return () => {
        window.removeEventListener("scroll", readScrollMetrics);
        window.removeEventListener("resize", readScrollMetrics);
      };
    }
  }, [isVirtualized, getScrollElement, fallbackViewportHeight]);

  // Calculate visible window [startIndex, endIndex].
  const { startIndex, endIndex } = useMemo(() => {
    const count = items.length;
    if (count === 0) return { startIndex: 0, endIndex: -1 };
    if (!isVirtualized) return { startIndex: 0, endIndex: count - 1 };

    const rawStart = findIndexForOffset(offsets, count, scrollOffset);
    const rawEnd = findIndexForOffset(offsets, count, scrollOffset + viewportSize);

    return {
      startIndex: Math.max(0, rawStart - overscan),
      endIndex: Math.min(count - 1, rawEnd + overscan),
    };
  }, [items.length, isVirtualized, offsets, scrollOffset, viewportSize, overscan]);

  const scrollToIndex = useCallback(
    (index: number, options: ScrollToIndexOptions = {}) => {
      if (items.length === 0) return;
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      const { align = "auto", behavior = "auto" } = options;

      const itemTop = offsets[clamped];
      const itemBottom = offsets[clamped + 1];
      const itemHeight = itemBottom - itemTop;

      const scrollEl = getScrollElement();
      const currentTop = scrollEl ? scrollEl.scrollTop : window.scrollY || 0;
      const viewHeight = scrollEl
        ? scrollEl.clientHeight || fallbackViewportHeight
        : window.innerHeight || fallbackViewportHeight;

      let targetTop = currentTop;

      if (align === "start") {
        targetTop = itemTop;
      } else if (align === "end") {
        targetTop = Math.max(0, itemBottom - viewHeight);
      } else if (align === "center") {
        targetTop = Math.max(0, itemTop - (viewHeight - itemHeight) / 2);
      } else {
        // "auto": minimal scroll to bring item into view
        if (itemTop < currentTop) {
          targetTop = itemTop;
        } else if (itemBottom > currentTop + viewHeight) {
          targetTop = Math.max(0, itemBottom - viewHeight);
        }
      }

      if (scrollEl) {
        if (typeof scrollEl.scrollTo === "function") {
          scrollEl.scrollTo({ top: targetTop, behavior });
        } else {
          scrollEl.scrollTop = targetTop;
        }
        setScrollOffset(targetTop);
      } else if (typeof window !== "undefined") {
        if (typeof window.scrollTo === "function") {
          window.scrollTo({ top: targetTop, behavior });
        }
        setScrollOffset(targetTop);
      }
    },
    [items.length, offsets, getScrollElement, fallbackViewportHeight],
  );

  const remeasure = useCallback(
    (index?: number) => {
      if (index !== undefined) {
        const entry = mountedElementsRef.current.get(index);
        if (entry) {
          const rect = entry.el.getBoundingClientRect();
          if (rect.height > 0) {
            recordHeight(entry.key, rect.height);
          }
        }
        return;
      }
      let changed = false;
      mountedElementsRef.current.forEach(({ key, el }) => {
        const rect = el.getBoundingClientRect();
        if (rect.height > 0) {
          const prev = measuredHeightsRef.current.get(key);
          if (prev === undefined || Math.abs(prev - rect.height) > 0.5) {
            measuredHeightsRef.current.set(key, rect.height);
            changed = true;
          }
        }
      });
      if (changed) {
        setMeasureVersion((v) => v + 1);
      }
    },
    [recordHeight],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex,
      remeasure,
      getVisibleRange: () => ({ startIndex, endIndex }),
    }),
    [scrollToIndex, remeasure, startIndex, endIndex],
  );

  const createMeasureRef = useCallback(
    (index: number, key: string | number) => (el: HTMLElement | null) => {
      const existing = mountedElementsRef.current.get(index);
      if (existing && existing.el !== el) {
        resizeObserverRef.current?.unobserve(existing.el);
        mountedElementsRef.current.delete(index);
      }
      if (!el) return;

      mountedElementsRef.current.set(index, { key, el });
      elementToKeyRef.current.set(el, key);
      resizeObserverRef.current?.observe(el);

      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        recordHeight(key, rect.height);
      }
    },
    [recordHeight],
  );

  const renderSpacer = (height: number, spacerKey: string) => {
    if (height <= 0) return null;
    if (mode === "table") {
      return (
        <tr
          key={spacerKey}
          aria-hidden="true"
          className="virtual-list-spacer"
          data-virtual-spacer={spacerKey}
        >
          <td
            colSpan={columnCount}
            style={{ height: `${height}px`, padding: 0, border: 0 }}
          />
        </tr>
      );
    }
    return (
      <div
        key={spacerKey}
        aria-hidden="true"
        className="virtual-list-spacer"
        data-virtual-spacer={spacerKey}
        style={{ height: `${height}px` }}
      />
    );
  };

  const renderItemAt = (index: number, isPinned: boolean) => {
    const item = items[index];
    const key = getItemKey(item, index);
    return (
      <React.Fragment key={key}>
        {renderItem(item, index, {
          index,
          measureRef: createMeasureRef(index, key),
          isPinned,
          ariaRowIndex: index + ariaRowIndexOffset,
        })}
      </React.Fragment>
    );
  };

  const content = (() => {
    if (items.length === 0) return null;

    if (!isVirtualized) {
      return items.map((_, index) => renderItemAt(index, pinnedIndex === index));
    }

    const validPinned =
      pinnedIndex !== null && pinnedIndex >= 0 && pinnedIndex < items.length
        ? pinnedIndex
        : null;

    const nodes: React.ReactNode[] = [];

    // Top spacer (split if pinnedIndex is above the visible window)
    if (validPinned !== null && validPinned < startIndex) {
      nodes.push(renderSpacer(offsets[validPinned], "spacer-top-before-pinned"));
      nodes.push(renderItemAt(validPinned, true));
      nodes.push(
        renderSpacer(offsets[startIndex] - offsets[validPinned + 1], "spacer-top-after-pinned"),
      );
    } else {
      nodes.push(renderSpacer(offsets[startIndex], "spacer-top"));
    }

    // Visible window
    for (let i = startIndex; i <= endIndex; i++) {
      nodes.push(renderItemAt(i, validPinned === i));
    }

    // Bottom spacer (split if pinnedIndex is below the visible window)
    if (validPinned !== null && validPinned > endIndex) {
      nodes.push(
        renderSpacer(offsets[validPinned] - offsets[endIndex + 1], "spacer-bottom-before-pinned"),
      );
      nodes.push(renderItemAt(validPinned, true));
      nodes.push(
        renderSpacer(totalHeight - offsets[validPinned + 1], "spacer-bottom-after-pinned"),
      );
    } else {
      nodes.push(renderSpacer(totalHeight - offsets[endIndex + 1], "spacer-bottom"));
    }

    return nodes;
  })();

  if (mode === "table") {
    return <>{content}</>;
  }

  return (
    <div
      ref={internalContainerRef}
      className={className}
      style={{ overflowY: "auto", ...style }}
    >
      {content}
    </div>
  );
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.Ref<VirtualListHandle> },
) => React.ReactElement | null;
