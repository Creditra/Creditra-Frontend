/**
 * RepaymentVisualizer route page.
 *
 * Wraps the `RepaymentVisualizer` component with polite `aria-live` announcements
 * for loading-to-ready state transitions, so screen readers are informed when
 * the repayment plan visualization becomes available.
 *
 * The canonical chart implementation lives in
 * `src/components/RepaymentVisualizer.tsx`. This module provides the
 * route-level adapter with enhanced accessibility.
 *
 * ## SR announcements
 *
 * - **Loading started**: "Loading repayment plan visualizer."
 * - **Ready**: "Repayment plan visualizer is ready."
 *
 * These announcements use `politeness="polite"` so they do not interrupt the
 * user's current screen-reader task.
 */

import { useState, useEffect, useRef } from "react";
import {
  RepaymentVisualizer,
  RepaymentVisualizerSkeleton,
} from "@/components/RepaymentVisualizer";
import type {
  RepaymentVisualizerProps,
  ScheduleRow,
} from "@/components/RepaymentVisualizer";
import { LiveRegion } from "@/components/LiveRegion";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/**
 * Derives the SR announcement text from a loading-state transition.
 * Pure module-level function — no closure dependencies.
 */
function deriveAnnouncement(prev: boolean | undefined, next: boolean | undefined): string {
  const wasLoading = prev !== false;
  const isLoading = next !== false;
  if (isLoading && !wasLoading) return "Loading repayment plan visualizer.";
  if (!isLoading && wasLoading) return "Repayment plan visualizer is ready.";
  return "";
}

/**
 * Page-level wrapper around `RepaymentVisualizer` that adds loading-state
 * screen-reader announcements via a polite `aria-live` region.
 *
 * When the `loading` prop transitions from a truthy value to `false`, a
 * "ready" message is announced to assistive technology. When it transitions
 * from `false` to truthy (e.g. refetching), a "loading" message is announced.
 */
export default function RepaymentVisualizerPage(props: RepaymentVisualizerProps) {
  const [pageAnnouncement, setPageAnnouncement] = useState("");
  const prevLoadingRef = useRef<boolean | undefined>(props.loading);

  useEffect(() => {
    const announcement = deriveAnnouncement(prevLoadingRef.current, props.loading);
    prevLoadingRef.current = props.loading;
    if (announcement) {
      setPageAnnouncement(announcement);
    }
  }, [props.loading]);

  return (
    <>
      <LiveRegion message={pageAnnouncement} politeness="polite" />
      <ErrorBoundary>
        <RepaymentVisualizer {...props} />
      </ErrorBoundary>
    </>
  );
}

// Re-export the base component, skeleton, and types for backward compatibility
// so existing imports (e.g. `import { RepaymentVisualizer } from "@/pages/RepaymentVisualizer"`)
// continue to work unchanged.
export { RepaymentVisualizer, RepaymentVisualizerSkeleton };
export type { RepaymentVisualizerProps, ScheduleRow };
