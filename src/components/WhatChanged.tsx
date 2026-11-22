import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { COLOR } from "../utils/tokens";
import "./WhatChanged.css";

interface WhatChangedProps {
  metricId: string;
  currentValue: number;
  format: "currency" | "percent" | "number";
  label?: string;
}

/**
 * An inline tooltip component that detects if a metric has changed since the user's last visit.
 * Surfaces a tooltip on hover or long-press.
 */
export function WhatChanged({ metricId, currentValue, format, label }: WhatChangedProps) {
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = useRef(false);
  const hovered = useRef(false);

  useEffect(() => {
    return () => {
      if (touchTimer.current !== null) clearTimeout(touchTimer.current);
      if (touchHideTimer.current !== null) clearTimeout(touchHideTimer.current);
    };
  }, []);

  useEffect(() => {
    // Check if the session is already active
    const sessionActive = sessionStorage.getItem("creditra_dashboard_session_active");
    
    let lastVisitData: Record<string, number> = {};
    const localSaved = localStorage.getItem("creditra_dashboard_values_stable");
    if (localSaved) {
      try {
        lastVisitData = JSON.parse(localSaved);
      } catch (e) {
        console.error("Failed to parse stable dashboard values", e);
      }
    }

    if (!sessionActive) {
      // First render of this session:
      // Save stable values from last visit to sessionStorage for reference during this session
      sessionStorage.setItem("creditra_dashboard_values_last_visit", JSON.stringify(lastVisitData));
      
      // Save current values to localStorage for the next visit
      const newStableData = { ...lastVisitData, [metricId]: currentValue };
      localStorage.setItem("creditra_dashboard_values_stable", JSON.stringify(newStableData));
      
      sessionStorage.setItem("creditra_dashboard_session_active", "true");
      
      if (metricId in lastVisitData) {
        setPrevValue(lastVisitData[metricId]);
      }
    } else {
      // Session is active: read the last visit's value from sessionStorage
      const sessionSaved = sessionStorage.getItem("creditra_dashboard_values_last_visit");
      if (sessionSaved) {
        try {
          const sessionData = JSON.parse(sessionSaved);
          if (metricId in sessionData) {
            setPrevValue(sessionData[metricId]);
          }
        } catch (e) {
          console.error("Failed to parse session dashboard values", e);
        }
      }
      
      // Update the localStorage stable value so that the latest value is saved for the next visit
      const newStableData = { ...lastVisitData, [metricId]: currentValue };
      localStorage.setItem("creditra_dashboard_values_stable", JSON.stringify(newStableData));
    }
  }, [metricId, currentValue]);

  if (prevValue === null || prevValue === currentValue) {
    return null;
  }

  const diff = currentValue - prevValue;
  const isPositive = diff > 0;

  const formatVal = (val: number) => {
    if (format === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(val);
    }
    if (format === "percent") {
      return `${val}%`;
    }
    return val.toString();
  };

  const formatDiff = (val: number) => {
    const formatted = formatVal(Math.abs(val));
    return isPositive ? `+${formatted}` : `-${formatted}`;
  };

  const handleMouseEnter = () => {
    hovered.current = true;
    setDismissed(false);
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    hovered.current = false;
    // A pointer leaving must not hide a tooltip still held open by focus.
    if (!focused.current) setShowTooltip(false);
  };

  const handleFocus = () => {
    focused.current = true;
    setDismissed(false);
    setShowTooltip(true);
  };

  const handleBlur = () => {
    focused.current = false;
    if (!hovered.current) setShowTooltip(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Escape" && showTooltip) {
      // Keep keyboard focus on the trigger; suppress the focus-visible CSS
      // rule until another focus or hover interaction deliberately reopens it.
      setDismissed(true);
      setShowTooltip(false);
    }
  };

  // Retain mobile long-press and its two-second grace period.
  const handleTouchStart = () => {
    if (touchTimer.current !== null) clearTimeout(touchTimer.current);
    if (touchHideTimer.current !== null) clearTimeout(touchHideTimer.current);
    touchTimer.current = setTimeout(() => {
      touchTimer.current = null;
      setDismissed(false);
      setShowTooltip(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (touchTimer.current !== null) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
    if (touchHideTimer.current !== null) clearTimeout(touchHideTimer.current);
    touchHideTimer.current = setTimeout(() => {
      touchHideTimer.current = null;
      if (!focused.current && !hovered.current) setShowTooltip(false);
    }, 2000);
  };

  const tooltipId = `tooltip-what-changed-${metricId}`;

  // Decide indicator color:
  // For utilized, positive change is bad (red), negative change is good (green).
  // For limit, available, and risk score, positive change is good (green).
  let isGood = isPositive;
  if (metricId === "total-utilized") {
    isGood = !isPositive;
  }

  const iconColor = isGood ? COLOR.success : COLOR.danger;
  const arrowIcon = isPositive ? "▲" : "▼";

  return (
    <span 
      className="what-changed-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        tabIndex={0}
        className="what-changed-trigger"
        role="button"
        aria-label={`${label || metricId} changed from ${formatVal(prevValue)} to ${formatVal(currentValue)} (change ${formatDiff(diff)})`}
        aria-describedby={showTooltip ? tooltipId : undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ color: iconColor }}
      >
        <span className="what-changed-arrow" aria-hidden="true">{arrowIcon}</span>
        <span className="what-changed-dot" style={{ backgroundColor: iconColor }} />
      </span>
      
      <span 
        id={tooltipId} 
        role="tooltip" 
        className={`what-changed-tooltip ${showTooltip ? "is-visible" : ""} ${dismissed ? "is-dismissed" : ""}`}
        aria-hidden={!showTooltip}
        style={{ borderLeftColor: iconColor }}
      >
        <span className="tooltip-title">Since last visit:</span>
        <span className="tooltip-row">
          <span className="tooltip-label">Previous:</span>
          <span className="tooltip-value">{formatVal(prevValue)}</span>
        </span>
        <span className="tooltip-row">
          <span className="tooltip-label">Current:</span>
          <span className="tooltip-value">{formatVal(currentValue)}</span>
        </span>
        <span className="tooltip-row trend" style={{ color: iconColor }}>
          <span className="tooltip-label">Change:</span>
          <span className="tooltip-value">{formatDiff(diff)}</span>
        </span>
      </span>
    </span>
  );
}
