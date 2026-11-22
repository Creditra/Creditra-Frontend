import { useState, useEffect, useRef } from "react";
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
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (touchTimer.current) {
        clearTimeout(touchTimer.current);
      }
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
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
      const formatted = new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }).format(val);
      return `${formatted}%`;
    }
    return val.toString();
  };

  const formatDiff = (val: number) => {
    const formatted = formatVal(Math.abs(val));
    return isPositive ? `+${formatted}` : `-${formatted}`;
  };

  // Long-press handling for mobile devices
  const handleTouchStart = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    touchTimer.current = setTimeout(() => {
      setShowTooltip(true);
      touchTimer.current = null;
    }, 500);
  };

  const handleTouchEnd = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    // Keep visible briefly for better UX on tap/long-press
    hideTimer.current = setTimeout(() => {
      setShowTooltip(false);
      hideTimer.current = null;
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
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        tabIndex={0}
        className="what-changed-trigger"
        role="button"
        aria-label={`What changed for ${label || metricId}`}
        aria-describedby={tooltipId}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ color: iconColor }}
      >
        <span className="what-changed-arrow" aria-hidden="true">{arrowIcon}</span>
        <span className="what-changed-dot" style={{ backgroundColor: iconColor }} />
      </span>
      
      <span 
        id={tooltipId} 
        role="tooltip" 
        className={`what-changed-tooltip ${showTooltip ? "is-visible" : ""}`}
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
