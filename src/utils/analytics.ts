import { readJson } from './storage';
import { AnalyticsCategory, AnalyticsPreferences, DEFAULT_ANALYTICS_PREFS } from '../types/analytics';

const STORAGE_KEY = 'creditra_analytics_prefs';
const REDACTED = '[REDACTED]';

/**
 * Checks if the user has explicitly consented to a specific analytics category.
 * Defaults to false (fail-closed) if storage is unavailable or preferences are unreadable.
 */
export function hasConsent(category: AnalyticsCategory): boolean {
  try {
    const prefs = readJson<AnalyticsPreferences>(STORAGE_KEY, DEFAULT_ANALYTICS_PREFS);
    return prefs[category] === true;
  } catch {
    return false;
  }
}

/**
 * Deterministically redacts financial and sensitive data from an analytics payload.
 * Enforces least privilege by redacting fields commonly containing PII or financial values.
 * Limits depth to prevent stack overflow from deep or circular references.
 */
export function redactFinancialData(payload: unknown, depth = 0): unknown {
  // Enforce invariant: bounded depth
  if (depth > 10) return REDACTED;

  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === 'string') {
    // Redact generic hex addresses (e.g. Ethereum)
    if (/^0x[a-fA-F0-9]{40}$/i.test(payload)) {
      return REDACTED;
    }
    return payload;
  }

  // Primitives that aren't strings
  if (typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(item => redactFinancialData(item, depth + 1));
  }

  // Handle plain objects
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    
    // Authorization boundary: sensitive keys are stripped
    if (
      lowerKey.includes('amount') ||
      lowerKey.includes('balance') ||
      lowerKey.includes('wallet') ||
      lowerKey.includes('address') ||
      lowerKey.includes('account') ||
      lowerKey.includes('price') ||
      lowerKey.includes('credit')
    ) {
      redacted[key] = REDACTED;
    } else {
      redacted[key] = redactFinancialData(value, depth + 1);
    }
  }
  
  return redacted;
}

export interface AnalyticsEvent {
  eventName: string;
  category: AnalyticsCategory;
  payload?: unknown;
}

/**
 * Tracks an analytics event if the user has consented to the specific category.
 * Applies redaction to any payload before processing.
 */
export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  // Validation invariant: valid event shape
  if (!event || !event.category || !event.eventName) {
    console.warn('[Analytics] Invalid event payload');
    return;
  }

  // State-transition invariant: Gate on consent
  if (!hasConsent(event.category)) {
    return;
  }

  const redactedPayload = redactFinancialData(event.payload);

  try {
    // Simulate network transmission.
    const response = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: event.eventName,
        category: event.category,
        payload: redactedPayload,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Analytics API returned status ${response.status}`);
    }
  } catch (error) {
    // Failure path: safe logging without exposing sensitive data
    console.warn(`[Analytics] Failed to send event "${event.eventName}" in category "${event.category}".`);
  }
}
