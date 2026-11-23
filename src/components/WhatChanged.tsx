import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { COLOR } from "../utils/tokens";
import { DASHBOARD_VALUES_STABLE_KEY } from "../constants/storageKeys";
import { readVersioned, writeVersioned } from "../utils/storage";
import {
  dashboardSessionActiveKey,
  dashboardValuesLastVisitKey,
  dashboardValuesStableKey,
} from "../constants/storageKeys";
import { useWalletIdentityKey } from "../hooks/useWalletIdentityKey";
import { readJson, readSessionJson, writeJson, writeSessionJson } from "../utils/storage";
import "./WhatChanged.css";

const DASHBOARD_VALUES_SCHEMA_VERSION = 1;

function isMetricRecord(data: unknown): data is Record<string, number> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  return Object.values(data as Record<string, unknown>).every(
    (v) => typeof v === "number" && Number.isFinite(v),
  );
}

function migrateDashboardValues(
  raw: unknown,
  fromVersion: number,
): Record<string, number> | undefined {
  if (fromVersion === 0 && isMetricRecord(raw)) {
    return raw;
  }
  return undefined;
}

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
    setPrevious(null);
    if (!owner) return;

    const stableKey = dashboardValuesStableKey(owner);
    const lastVisitKey = dashboardValuesLastVisitKey(owner);
    const sessionActiveKey = dashboardSessionActiveKey(owner);

    // Check if the session is already active
    const sessionActive = readSessionJson<boolean>(sessionActiveKey, false);
    const storedData = readJson<unknown>(stableKey, {});
    const lastVisitData = isDashboardValues(storedData) ? storedData : {};
    const lastVisitData = readVersioned<Record<string, number>>(
      DASHBOARD_VALUES_STABLE_KEY,
      {
        version: DASHBOARD_VALUES_SCHEMA_VERSION,
        fallback: {},
        migrate: migrateDashboardValues,
        validate: isMetricRecord,
      },
    );

    if (!sessionActive) {
      // First render of this session:
      // Save stable values from last visit to sessionStorage for reference during this session
      writeSessionJson(lastVisitKey, lastVisitData);
      
      // Save current values to localStorage for the next visit
      const newStableData = { ...lastVisitData, [metricId]: currentValue };
      writeVersioned(DASHBOARD_VALUES_STABLE_KEY, newStableData, {
        version: DASHBOARD_VALUES_SCHEMA_VERSION,
      });
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
      writeVersioned(DASHBOARD_VALUES_STABLE_KEY, newStableData, {
        version: DASHBOARD_VALUES_SCHEMA_VERSION,
      });
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
      touchTimer.current = null;
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
