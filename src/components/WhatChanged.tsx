import { useState, useEffect, useRef } from "react";
import { COLOR } from "../utils/tokens";
import {
  dashboardSessionActiveKey,
  dashboardValuesLastVisitKey,
  dashboardValuesStableKey,
} from "../constants/storageKeys";
import { useWalletIdentityKey } from "../hooks/useWalletIdentityKey";
import { readJson, readSessionJson, writeJson, writeSessionJson } from "../utils/storage";
import "./WhatChanged.css";

interface WhatChangedProps {
  metricId: string;
  currentValue: number;
  format: "currency" | "percent" | "number";
  label?: string;
}

function isDashboardValues(value: unknown): value is Record<string, number> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "number")
  );
}

/**
 * An inline tooltip component that detects if a metric has changed since the user's last visit.
 * Surfaces a tooltip on hover or long-press.
 */
export function WhatChanged({ metricId, currentValue, format, label }: WhatChangedProps) {
  const owner = useWalletIdentityKey();
  const [previous, setPrevious] = useState<{ owner: string; value: number } | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const touchTimer = useRef<any>(null);

  useEffect(() => {
    setPrevious(null);
    if (!owner) return;

    const stableKey = dashboardValuesStableKey(owner);
    const lastVisitKey = dashboardValuesLastVisitKey(owner);
    const sessionActiveKey = dashboardSessionActiveKey(owner);

    // Check if the session is already active
    const sessionActive = readSessionJson<boolean>(sessionActiveKey, false);
    const storedData = readJson<unknown>(stableKey, {});
    const lastVisitData = isDashboardValues(storedData) ? storedData : {};

    if (!sessionActive) {
      // First render of this session:
      // Save stable values from last visit to sessionStorage for reference during this session
      writeSessionJson(lastVisitKey, lastVisitData);
      
      // Save current values to localStorage for the next visit
      const newStableData = { ...lastVisitData, [metricId]: currentValue };
      writeJson(stableKey, newStableData);
      
      writeSessionJson(sessionActiveKey, true);
      
      if (metricId in lastVisitData) {
        setPrevious({ owner, value: lastVisitData[metricId] });
      }
    } else {
      // Session is active: read the last visit's value from sessionStorage
      const savedSessionData = readSessionJson<unknown>(lastVisitKey, {});
      const sessionData = isDashboardValues(savedSessionData) ? savedSessionData : {};
      if (metricId in sessionData) {
        setPrevious({ owner, value: sessionData[metricId] });
      }
      
      // Update the localStorage stable value so that the latest value is saved for the next visit
      const newStableData = { ...lastVisitData, [metricId]: currentValue };
      writeJson(stableKey, newStableData);
    }
  }, [owner, metricId, currentValue]);

  const prevValue = previous?.owner === owner ? previous.value : null;
  if (!owner || prevValue === null || prevValue === currentValue) {
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

  // Long-press handling for mobile devices
  const handleTouchStart = () => {
    touchTimer.current = setTimeout(() => {
      setShowTooltip(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
    }
    // Keep visible briefly for better UX on tap/long-press
    setTimeout(() => {
      setShowTooltip(false);
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
