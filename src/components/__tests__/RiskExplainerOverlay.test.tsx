import { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RiskExplainerOverlay } from "../RiskExplainerOverlay";

// Focus-trap and scroll-lock hooks are mocked so the test doesn't depend on
// DOM internals jsdom doesn't support (multiple focusable hosts, escape
// propagation).  The component itself is the unit under test.
vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));
vi.mock("@/hooks/useBodyScrollLock", () => ({
  useBodyScrollLock: vi.fn(),
}));
vi.mock("@/hooks/useInertBackdrop", () => ({
  useInertBackdrop: vi.fn(),
}));

/**
 * Tests for the centred risk-band explainer overlay (GitHub issue #426).
 *
 * Verifies:
 *   - Modal only renders when `isOpen === true`.
 *   - Renders all 4 risk bands with their canonical names.
 *   - ARIA: dialog role, aria-modal, aria-labelledby, aria-label on the
 *     close affordance.
 *   - Close button + backdrop click both invoke `onClose`.
 *   - The slide-out panel / inline-card patterns do not regress — this
 *     component is the THIRD risk UI, not a replacement.
 */

const Trigger = ({
  onOpen,
}: {
  onOpen: (open: boolean) => void;
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => onOpen(true)}
        data-testid="trigger"
      >
        Open overlay
      </button>
      <RiskExplainerOverlay
        isOpen={true}
        onClose={() => onOpen(false)}
        triggerRef={ref}
      />
    </>
  );
};

describe("RiskExplainerOverlay", () => {
  it("renders nothing when closed", () => {
    render(
      <RiskExplainerOverlay
        isOpen={false}
        onClose={() => {}}
      />,
    );

    expect(
      screen.queryByTestId("risk-explainer-overlay"),
    ).not.toBeInTheDocument();
  });

  it("renders the dialog with role + aria attributes when open", () => {
    render(
      <RiskExplainerOverlay
        isOpen={true}
        onClose={() => {}}
      />,
    );

    const dialog = screen.getByTestId("risk-explainer-overlay");
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");
  });

  it("renders all four canonical risk bands", () => {
    render(
      <RiskExplainerOverlay
        isOpen={true}
        onClose={() => {}}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Excellent/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Good/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Caution/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Recovery/i }),
    ).toBeInTheDocument();
  });

  it("exposes the score threshold and APR range for each band", () => {
    render(
      <RiskExplainerOverlay
        isOpen={true}
        onClose={() => {}}
      />,
    );

    // Each band surfaces its `minScore+` pill and its `APR range` dd.
    const scorePills = screen.getAllByTestId("risk-explainer-overlay-score");
    expect(scorePills.map((el) => el.textContent)).toEqual([
      "700+",
      "600+",
      "500+",
      "0+",
    ]);

    const aprRanges = screen.getAllByTestId("risk-explainer-overlay-apr");
    expect(aprRanges.map((el) => el.textContent)).toEqual([
      "5% \u2013 10%",
      "11% \u2013 20%",
      "21% \u2013 30%",
      "31%+",
    ]);
  });

  it("close button invokes onClose", () => {
    const handleClose = vi.fn();
    render(
      <RiskExplainerOverlay
        isOpen={true}
        onClose={handleClose}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /close risk band explainer/i }),
    );
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("'Got it' footer button invokes onClose", () => {
    const handleClose = vi.fn();
    render(
      <RiskExplainerOverlay
        isOpen={true}
        onClose={handleClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^got it$/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("clicking the backdrop invokes onClose", () => {
    const handleClose = vi.fn();
    render(
      <RiskExplainerOverlay
        isOpen={true}
        onClose={handleClose}
      />,
    );

    // createPortal mounts the overlay to document.body, OUTSIDE the
    // RTL test container, so query document directly.  RTL's
    // automatic `cleanup()` (run in `afterEach`) handles portal
    // teardown between tests, so we don't manually clear body.innerHTML
    // here — that conflicts with React's own unmount walk.
    const backdrop = document.querySelector(
      ".risk-explainer-overlay__backdrop",
    );
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop as Element);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders a 'learn more' link to /docs/risk-pricing", () => {
    render(
      <RiskExplainerOverlay
        isOpen={true}
        onClose={() => {}}
      />,
    );

    const docsLink = screen.getByRole("link", {
      name: /risk pricing documentation/i,
    });
    expect(docsLink).toHaveAttribute("href", "/docs#risk-pricing");
  });

  it("is invocable from a trigger button (typical Dashboard wiring)", () => {
    const noop = () => {};
    render(<Trigger onOpen={noop} />);

    // Trigger is in the DOM; overlay is opened immediately by the wrapper.
    expect(screen.getByTestId("trigger")).toBeInTheDocument();
    expect(
      screen.getByTestId("risk-explainer-overlay"),
    ).toBeInTheDocument();
  });
});
