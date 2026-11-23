/**
 * RiskExplainerOverlay
 *
 * Centered modal overlay that explains the four Creditra risk bands in
 * detail.  This component is the third of three risk-explanation entry
 * points:
 *
 *   1. `RiskExplainerCard` - inline dismissable banner.
 *   2. `RiskBandsPanel`    - right-side slide-out panel.
 *   3. `RiskExplainerOverlay` - centered modal with detailed band info.
 *
 * Why a third variant?
 * ─────────────────────
 * The inline card is too small for full explanations and the side
 * panel dominates the viewport at rest.  The centered overlay is the
 * right shape for a single "tell me everything at once" use case,
 * mirroring the patterns we already use for `WhyApr` and
 * `InlineHelpOverlay`.
 *
 * Accessibility
 * ─────────────
 * - `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
 *   (WCAG 4.1.2 Name, Role, Value).
 * - Focus trap via `useFocusTrap` (WCAG 2.4.3 Focus Order + 2.1.2 No
 *   Keyboard Trap).
 * - Inert backdrop so screen-reader rotors don't reach the page
 *   chrome while the modal is open.
 * - Body scroll lock prevents the background from scrolling during a
 *   drag-scroll gesture on the modal content.
 * - Reduced-motion respected: we strip animations when
 *   `prefers-reduced-motion: reduce`.
 *
 * Visual treatment
 * ────────────────
 * - Listing from `Excellent` (5-10% APR) downward through `Recovery`
 *   (31%+).
 * - Each band has a left-border color so color-blind users can
 *   still scan between rows.  The text content carries the band
 *   name, APR range, and limit guidance so color is never the only
 *   signal (WCAG 1.4.1 Use of Color).
 */

import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useInertBackdrop } from "@/hooks/useInertBackdrop";
import { COLOR } from "@/utils/tokens";
import "./RiskExplainerOverlay.css";

export interface RiskBandInfo {
  name: string;
  /** Inclusive lower-bound score for the band (FICO-style 0-850). */
  minScore: number;
  description: string;
  aprRange: string;
  limitGuidance: string;
  /** Display accent (hex).  Always paired with text - never colour-only. */
  color: string;
}

/**
 * Canonical four-band definition.  Kept here (not pulled from
 * src/components/RiskBandsPanel) so each surface can optimise its
 * own layout without a shared module becoming a leaky abstraction.
 */
const RISK_BANDS: ReadonlyArray<RiskBandInfo> = [
  {
    name: "Excellent",
    minScore: 700,
    description:
      "Highest tier of creditworthiness with optimal terms. Strong repayment history and low utilisation keep rates at the floor of the market.",
    aprRange: "5% \u2013 10%",
    limitGuidance: "Maximum available limits",
    color: COLOR.success,
  },
  {
    name: "Good",
    minScore: 600,
    description:
      "Strong credit profile with competitive rates. Maintaining timely repayments can graduate you into the Excellent range within one cycle.",
    aprRange: "11% \u2013 20%",
    limitGuidance: "High to medium limits",
    color: COLOR.warning,
  },
  {
    name: "Caution",
    minScore: 500,
    description:
      "Moderate risk; terms may be more restrictive. Reducing utilisation and avoiding missed payments is the fastest path back into the Good band.",
    aprRange: "21% \u2013 30%",
    limitGuidance: "Limited initial limits",
    color: COLOR.danger,
  },
  {
    name: "Recovery",
    minScore: 0,
    description:
      "High risk; Creditra is focused on rebuilding credit history. Repayments on time are weighted heavily here - every clean cycle raises your score.",
    aprRange: "31%+",
    limitGuidance: "Minimum baseline limits",
    color: COLOR.danger,
  },
];

interface RiskExplainerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Ref to the button that opened the modal - required so focus can
   * be restored to the trigger on close (WCAG 2.4.3 Focus Order).
   */
  triggerRef?: RefObject<HTMLElement | null>;
}

const modalId = "risk-explainer-overlay";
const titleId = "risk-explainer-overlay-title";

export function RiskExplainerOverlay({
  isOpen,
  onClose,
  triggerRef,
}: RiskExplainerOverlayProps) {
  const dialogRef = useFocusTrap({
    isActive: isOpen,
    triggerRef,
    onEscape: onClose,
  });

  useBodyScrollLock({ isLocked: isOpen });
  useInertBackdrop({ isInert: isOpen, modalId });

  if (!isOpen) return null;

  return createPortal(
    <div
      id={modalId}
      className="risk-explainer-overlay__portal"
      aria-hidden="false"
    >
      <div
        className="risk-explainer-overlay__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef as RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="risk-explainer-overlay__dialog"
        data-testid="risk-explainer-overlay"
      >
        <header className="risk-explainer-overlay__header">
          <div>
            <p className="risk-explainer-overlay__eyebrow">Risk pricing</p>
            <h2 id={titleId} className="risk-explainer-overlay__title">
              How risk bands shape your APR
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="risk-explainer-overlay__close"
            aria-label="Close risk band explainer"
          >
            <span aria-hidden="true">{"\u2715"}</span>
          </button>
        </header>

        <div className="risk-explainer-overlay__lede">
          <p>
            Creditra prices your credit dynamically, using your on-chain
            repayment history, collateral volatility, and current
            utilisation to map you into one of four bands. Each band
            defines an APR range and an initial limit guidance.
          </p>
        </div>

        <ul
          className="risk-explainer-overlay__bands"
          aria-label="Creditra risk bands"
          data-testid="risk-explainer-overlay-bands"
        >
          {RISK_BANDS.map((band) => (
            <li
              key={band.name}
              className="risk-explainer-overlay__band"
              style={{ borderLeftColor: band.color }}
            >
              <header className="risk-explainer-overlay__band-header">
                <h3 className="risk-explainer-overlay__band-name">
                  {band.name}
                </h3>
                <span
                  className="risk-explainer-overlay__band-pill"
                  data-testid="risk-explainer-overlay-score"
                >
                  {band.minScore}+
                </span>
              </header>
              <p className="risk-explainer-overlay__band-description">
                {band.description}
              </p>
              <dl className="risk-explainer-overlay__band-stats">
                <div className="risk-explainer-overlay__stat">
                  <dt>APR range</dt>
                  <dd data-testid="risk-explainer-overlay-apr">
                    {band.aprRange}
                  </dd>
                </div>
                <div className="risk-explainer-overlay__stat">
                  <dt>Limit guidance</dt>
                  <dd>{band.limitGuidance}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        <footer className="risk-explainer-overlay__footer">
          <a
            href="/docs#risk-pricing"
            className="risk-explainer-overlay__docs-link"
            aria-label="Read the full risk pricing documentation"
          >
            Read the full risk-pricing docs
            <span aria-hidden="true">{"\u2192"}</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="risk-explainer-overlay__primary"
          >
            Got it
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
