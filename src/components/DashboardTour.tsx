
import { useEffect, useRef, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './DashboardTour.css';

type Step = 'riskGauge' | 'summaryCards' | 'requestEvaluation' | 'notificationBell';

interface CalloutStyle extends CSSProperties {
  '--callout-top'?: string;
  '--callout-left'?: string;
  '--callout-transform'?: string;
  '--arrow-top'?: string;
  '--arrow-left'?: string;
}

const STEPS: { id: Step; label: string; hint: string }[] = [
  {
    id: 'riskGauge',
    label: 'Risk Score',
    hint: 'Your composite risk score across all credit lines, updated in real time. Higher scores unlock better rates.',
  },
  {
    id: 'summaryCards',
    label: 'Credit Summary',
    hint: 'An at-a-glance view of your total limit, utilisation, and available credit across every open line.',
  },
  {
    id: 'requestEvaluation',
    label: 'Request Evaluation',
    hint: 'No credit lines yet? Tap here to start a new evaluation based on your on-chain activity.',
  },
  {
    id: 'notificationBell',
    label: 'Notifications',
    hint: 'Payment reminders, utilisation warnings, and line-status alerts all land here.',
  },
];

const LS_DASHBOARD_TOUR = 'dashboard_tour_completed';
const LS_ONBOARDING = 'onboarding_completed';

export function DashboardTour() {
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [tourActive, setTourActive] = useState(false);

  // Mutable cache that always reads the current value without relying on
  // a stale closure (useCallback deps are stable setter fn refs).
  const lastKnownRectsRef = useRef<Record<Step, DOMRect | null>>({
    riskGauge: null,
    summaryCards: null,
    requestEvaluation: null,
    notificationBell: null,
  });

  const skipRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const containerRef = useFocusTrap({ isActive: tourActive });
  const dismissedRef = useRef(false);

  const currentStep = STEPS[stepIndex];

  /**
   * Reads the live bounding rect for `id`. Falls back to the cached value
   * when the DOM element is temporarily absent (e.g. during a React
   * re-render that briefly removes conditional content).
   */
  const snapshot = useCallback((id: Step): DOMRect | null => {
    const el = document.querySelector<HTMLElement>(`[data-tour-target="${id}"]`);
    if (!el) return lastKnownRectsRef.current[id] ?? null;
    const r = el.getBoundingClientRect();
    // Only cache when the rect has non-zero geometry (jsdom returns
    // all-zeros for elements not yet laid out).
    if (r.width > 0 || r.height > 0 || r.x !== 0 || r.y !== 0) {
      lastKnownRectsRef.current[id] = r;
      return r;
    }
    return lastKnownRectsRef.current[id] ?? r;
  }, []);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    try {
      localStorage.setItem(LS_DASHBOARD_TOUR, 'true');
    } catch {
      /* quota or private mode — swallow */
    }
    setTourActive(false);
    setHighlightRect(null);
  }, []);

  /**
   * Measure all targets synchronously on mount and push into the cache,
   * then render the first step's dialog immediately.
   */
  useEffect(() => {
    const onboardingDone = localStorage.getItem(LS_ONBOARDING) === 'true';
    const tourDone = localStorage.getItem(LS_DASHBOARD_TOUR) === 'true';
    if (!onboardingDone || tourDone) return;

    const ids: Step[] = ['riskGauge', 'summaryCards', 'requestEvaluation', 'notificationBell'];
    ids.forEach(id => {
      const el = document.querySelector<HTMLElement>(`[data-tour-target="${id}"]`);
      if (el) lastKnownRectsRef.current[id] = el.getBoundingClientRect();
    });

    const firstRect = lastKnownRectsRef.current.riskGauge
      ?? lastKnownRectsRef.current.summaryCards
      ?? lastKnownRectsRef.current.requestEvaluation
      ?? lastKnownRectsRef.current.notificationBell
      ?? null;
    if (firstRect) {
      setHighlightRect(firstRect);
    }
    setTourActive(true);
  }, []);

  /**
   * Update highlight + target rects whenever the step changes.
   * We do this synchronously to avoid a "flash of empty" between step
   * transitions. A ResizeObserver keeps the cached rects fresh.
   */
  useEffect(() => {
    if (!tourActive) return;

    // Synchronous DOM read — no rAF needed
    const rect = snapshot(currentStep.id);
    if (rect) {
      setHighlightRect(rect);
    }
  }, [tourActive, stepIndex, currentStep.id, snapshot]);

  /**
   * Observe each target DOM node for size/layout changes.
   * Falls back gracefully without ResizeObserver.
   */
  useEffect(() => {
    if (!tourActive) return;

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (dismissedRef.current) return;
        const rect = snapshot(currentStep.id);
        if (rect) {
          lastKnownRectsRef.current[currentStep.id] = rect;
          setHighlightRect(rect);
        }
      });
      const toc = document.querySelector(`[data-tour-target="${currentStep.id}"]`);
      if (toc) ro.observe(toc);
    }

    const onScroll = () => {
      if (dismissedRef.current) return;
      const rect = snapshot(currentStep.id);
      if (rect) {
        lastKnownRectsRef.current[currentStep.id] = rect;
        setHighlightRect(rect);
      }
    };

    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      ro?.disconnect();
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [tourActive, stepIndex, currentStep.id, snapshot]);

  /**
   * Focus the appropriate action button when the dialog first opens or
   * when the step changes.
   */
  useEffect(() => {
    if (!tourActive) return;
    const t = setTimeout(() => {
      (stepIndex === STEPS.length - 1 ? nextRef : skipRef)?.current?.focus();
    }, 60);
    return () => clearTimeout(t);
  }, [tourActive, stepIndex]);

  /**
   * Dismiss on Escape key.
   */
  useEffect(() => {
    if (!tourActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [tourActive, dismiss]);

  if (!tourActive || !highlightRect) return null;

  const isLast = stepIndex === STEPS.length - 1;

  const hlTop = highlightRect.top;
  const hlLeft = highlightRect.left;
  const hlWidth = highlightRect.width;
  const hlHeight = highlightRect.height;

  let calloutStyle: CalloutStyle = {};
  let arrowStyle: CSSProperties = {};
  const GAP = 14;

  if (currentStep.id === 'riskGauge' || currentStep.id === 'requestEvaluation') {
    const right = window.innerWidth - highlightRect.right;
    const fitsRight = right > 320;
    calloutStyle = fitsRight
      ? { top: `${highlightRect.top + highlightRect.height / 2}px`, left: `${highlightRect.right + GAP}px`, transform: 'translateY(-50%)' }
      : { top: `${highlightRect.bottom + GAP}px`, left: `${highlightRect.left}px` };
    arrowStyle = fitsRight
      ? { top: '50%', left: '-6px', transform: 'translateY(-50%) rotate(45deg)' }
      : { top: '-6px', left: `${Math.min(highlightRect.width / 2 - 8, 300 - 16)}px`, transform: 'rotate(45deg)' };
  } else if (currentStep.id === 'summaryCards') {
    const below = window.innerHeight - highlightRect.bottom;
    const fitsBelow = below > 220;
    calloutStyle = fitsBelow
      ? { top: `${highlightRect.bottom + GAP}px`, left: `${highlightRect.left}px` }
      : { bottom: `${window.innerHeight - highlightRect.top + GAP}px`, left: `${highlightRect.left}px` };
    arrowStyle = fitsBelow
      ? { top: '-6px', left: `${Math.min(highlightRect.width / 2 - 8, 300 - 16)}px`, transform: 'rotate(45deg)' }
      : { bottom: '-6px', left: `${Math.min(highlightRect.width / 2 - 8, 300 - 16)}px`, transform: 'rotate(45deg)' };
  } else if (currentStep.id === 'notificationBell') {
    const fitsRight = window.innerWidth - highlightRect.right > 320;
    calloutStyle = fitsRight
      ? { bottom: `${window.innerHeight - highlightRect.top + GAP}px`, right: `${window.innerWidth - highlightRect.right}px` }
      : { bottom: `${window.innerHeight - highlightRect.top + GAP}px`, left: `${highlightRect.left}px` };
    arrowStyle = fitsRight
      ? { bottom: '-6px', right: '16px', transform: 'rotate(45deg)' }
      : { bottom: '-6px', left: `${Math.min(highlightRect.width / 2 - 8, 300 - 16)}px`, transform: 'rotate(45deg)' };
  }

  return (
    <div
      className="dt-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Dashboard tour step ${stepIndex + 1} of ${STEPS.length}: ${currentStep.label}`}
    >
      <div
        className="dt-highlight-ring"
        style={{ top: `${hlTop}px`, left: `${hlLeft}px`, width: `${hlWidth}px`, height: `${hlHeight}px` }}
      />

      <div
        ref={containerRef}
        className="dt-callout"
        style={calloutStyle}
        aria-describedby={`dt-hint-${currentStep.id}`}
      >
        <div className="dt-callout-arrow" style={arrowStyle} />
        <div className="dt-callout-inner">
          <p className="dt-step-label">{currentStep.label}</p>
          <p className="dt-callout-text" id={`dt-hint-${currentStep.id}`}>
            {currentStep.hint}
          </p>
          <div className="dt-footer">
            <span className="dt-step-counter">
              {stepIndex + 1} / {STEPS.length}
            </span>
            <div className="dt-actions">
              <button
                ref={skipRef}
                type="button"
                className="dt-skip-btn"
                onClick={dismiss}
                aria-label="Skip dashboard tour"
              >
                Skip
              </button>
              <button
                ref={nextRef}
                type="button"
                className="dt-next-btn"
                onClick={() => {
                  dismissedRef.current = false;
                  if (stepIndex < STEPS.length - 1) {
                    setStepIndex(i => i + 1);
                  } else {
                    try {
                      localStorage.setItem(LS_DASHBOARD_TOUR, 'true');
                    } catch {
                      /* swallow */
                    }
                    setTourActive(false);
                    setHighlightRect(null);
                  }
                }}
                aria-label={isLast ? 'Finish dashboard tour' : 'Go to next step'}
              >
                {isLast ? 'Got it' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
