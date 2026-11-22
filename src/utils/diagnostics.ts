import packageJson from "../../package.json";
import { redactFinancialData } from "./analytics";
import { getCreditNetworkConfig } from "../config/creditNetwork";
import { getCreditDataSourceType } from "../services/credit/config";

const MAX_RECENT_ERRORS = 20;
const MAX_ERROR_LENGTH = 200;
const REDACTED = "[REDACTED]";
const STELLAR_KEY_PATTERN = /\b[GC][A-Z2-7]{55}\b/g;

const recentErrors: string[] = [];

export interface DiagnosticsBundle {
  generatedAt: string;
  appVersion: string;
  userAgent: string;
  network: string;
  dataSource: string;
  recentErrors: string[];
}

function normaliseMessage(message: unknown): string {
  if (typeof message === "string") return message;
  if (message instanceof Error) return message.message;
  if (message === null || message === undefined) return "";
  try {
    return String(message);
  } catch {
    return "";
  }
}

/** Record a single error message, keeping only the most recent entries. */
export function recordDiagnosticError(message: unknown): void {
  const text = normaliseMessage(message).trim();
  if (!text) return;

  recentErrors.push(text.slice(0, MAX_ERROR_LENGTH));
  if (recentErrors.length > MAX_RECENT_ERRORS) {
    recentErrors.splice(0, recentErrors.length - MAX_RECENT_ERRORS);
  }
}

function maskStellarKeys(value: unknown, depth = 0): unknown {
  if (depth >= 10) return REDACTED;

  if (typeof value === "string") {
    return value.replace(STELLAR_KEY_PATTERN, REDACTED);
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskStellarKeys(item, depth + 1));
  }

  if (value !== null && typeof value === "object") {
    const masked: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      masked[key] = maskStellarKeys(nested, depth + 1);
    }
    return masked;
  }

  return value;
}

function readNetwork(): string {
  try {
    return getCreditNetworkConfig().network;
  } catch {
    return "unknown";
  }
}

function readDataSource(): string {
  try {
    return getCreditDataSourceType();
  } catch {
    return "unknown";
  }
}

function readAppVersion(): string {
  const configured = (import.meta.env as Record<string, string | undefined>)
    ?.VITE_APP_VERSION;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim();
  }
  return typeof packageJson.version === "string" && packageJson.version
    ? packageJson.version
    : "unknown";
}

/**
 * Build a redacted support bundle. Nothing is transmitted: callers download it
 * so the user can attach it to a support request.
 */
export function buildDiagnosticsBundle(): DiagnosticsBundle {
  const bundle: DiagnosticsBundle = {
    generatedAt: new Date().toISOString(),
    appVersion: readAppVersion(),
    userAgent:
      typeof navigator !== "undefined" && navigator.userAgent
        ? navigator.userAgent
        : "unknown",
    network: readNetwork(),
    dataSource: readDataSource(),
    recentErrors: [...recentErrors],
  };

  return maskStellarKeys(redactFinancialData(bundle)) as DiagnosticsBundle;
}

/** Create and download the redacted diagnostics JSON file. */
export function downloadDiagnosticsBundle(filename?: string): DiagnosticsBundle {
  const bundle = buildDiagnosticsBundle();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = filename ?? `creditra-diagnostics-${date}.json`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);

  return bundle;
}
