/**
 * Parser for Soroban simulation failures.
 *
 * Simulation errors arrive as free-form strings such as:
 *
 *   Host function invocation failed: Error(Contract, #6)
 *   HostError: Error(WasmVm, MissingValue)
 *   ContractError(7)
 *
 * `parseSorobanError` normalises those strings (and the structured error
 * objects produced by the RPC layer) into a typed shape the draw-error
 * classifier can reason about. Diagnostic events are carried along when the
 * caller supplies them, because they are often the only place the contract
 * code appears.
 */

export type SorobanErrorCategory =
  | 'contract'
  | 'host'
  | 'unknown';

export interface SorobanDiagnosticEvent {
  /** Event type reported by the RPC (`system`, `contract`, `diagnostic`, …). */
  type?: string;
  contractId?: string;
  topics?: string[];
  data?: string;
}

export interface ParsedSorobanError {
  /** Original message, trimmed. */
  raw: string;
  category: SorobanErrorCategory;
  /** `Contract`, `WasmVm`, `Auth`, … when a host error was present. */
  hostErrorType?: string;
  /** Lower-cased `hostErrorType`, used as a lookup key. */
  hostErrorKey?: string;
  /** Numeric code from `Error(Contract, #N)` or `ContractError(N)`. */
  contractCode?: number;
  /** Free-form text surrounding the host error. */
  detail?: string;
  /** Diagnostic events supplied by the caller, normalised to plain strings. */
  diagnostics: SorobanDiagnosticEvent[];
}

/**
 * Matches the canonical host-error rendering:
 *   Error(Contract, #6)
 *   Error(WasmVm, MissingValue)
 *   Error(Auth, InvalidAction)
 */
const HOST_ERROR_RE = /Error\(\s*([A-Za-z][A-Za-z0-9_]*)\s*(?:,\s*#?(-?\d+|[A-Za-z][A-Za-z0-9_]*)\s*)?\)/i;

/** Matches the older SDK rendering `ContractError(101)`. */
const LEGACY_CONTRACT_ERROR_RE = /ContractError\(\s*(-?\d+)\s*\)/i;

function asText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.length > 0 ? value : undefined;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Error) {
    return value.message || undefined;
  }
  return undefined;
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

/**
 * Normalise one diagnostic event. XDR-backed events expose their payload via
 * methods, so we fall back to `String(value)` where a primitive is expected
 * and ignore anything that stringifies to `[object Object]`.
 */
function normaliseEvent(event: unknown): SorobanDiagnosticEvent | null {
  if (!event || typeof event !== 'object') return null;

  const record = event as Record<string, unknown>;
  const type = asText(record.type);
  const contractId = asText(record.contractId ?? record.contract_id);
  const topics = asArray(record.topics)
    ?.map((topic) => asText(topic))
    .filter((topic): topic is string => topic !== undefined);
  const data = asText(record.data);

  if (!type && !contractId && !topics?.length && !data) {
    return null;
  }

  return {
    ...(type ? { type } : {}),
    ...(contractId ? { contractId } : {}),
    ...(topics?.length ? { topics } : {}),
    ...(data ? { data } : {}),
  };
}

/** Collect diagnostic events from every shape the RPC/UI layers may pass. */
function collectDiagnostics(raw: unknown): SorobanDiagnosticEvent[] {
  const candidates: unknown[] = [raw];
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    candidates.push(record.details, record.cause, record.error, record.response);
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;
    const events =
      asArray(record.events) ??
      asArray(record.diagnostics) ??
      asArray(record.diagnosticEvents);
    if (events) {
      return events
        .map(normaliseEvent)
        .filter((event): event is SorobanDiagnosticEvent => event !== null);
    }
  }

  return [];
}

/** Extract every message string we can reach from an error shape. */
function collectMessages(raw: unknown, seen = new Set<unknown>()): string[] {
  if (raw === null || raw === undefined || seen.has(raw)) return [];
  if (typeof raw === 'string') return raw ? [raw] : [];
  if (typeof raw !== 'object') return [];
  seen.add(raw);

  const record = raw as Record<string, unknown>;
  const messages: string[] = [];
  if (raw instanceof Error && raw.message) {
    messages.push(raw.message);
  }
  for (const key of ['message', 'error', 'reason']) {
    if (raw instanceof Error && key === 'message') continue;
    const text = asText(record[key]);
    if (text) messages.push(text);
  }
  for (const key of ['cause', 'details', 'response']) {
    messages.push(...collectMessages(record[key], seen));
  }
  return messages;
}

function parseContractCode(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const parsed = Number.parseInt(token.replace(/^#/, ''), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Parse a Soroban simulation error into a typed shape.
 *
 * Returns `null` when `raw` carries no message at all. A non-null result does
 * not guarantee a contract code was found — check
 * `category`/`contractCode`.
 */
export function parseSorobanError(raw: unknown): ParsedSorobanError | null {
  const messages = collectMessages(raw);
  if (messages.length === 0) return null;

  const diagnostics = collectDiagnostics(raw);

  for (const message of messages) {
    const trimmed = message.trim();
    if (!trimmed) continue;

    const hostMatch = HOST_ERROR_RE.exec(trimmed);
    if (hostMatch) {
      const hostErrorType = hostMatch[1];
      const codeToken = hostMatch[2];
      const hostErrorKey = hostErrorType.toLowerCase();
      const isContract = hostErrorKey === 'contract';

      return {
        raw: trimmed,
        category: isContract ? 'contract' : 'host',
        hostErrorType,
        hostErrorKey,
        ...(isContract ? { contractCode: parseContractCode(codeToken) } : {}),
        detail:
          trimmed.replace(hostMatch[0], '').replace(/[:.\s]+$/, '').trim() || undefined,
        diagnostics,
      };
    }

    const legacyMatch = LEGACY_CONTRACT_ERROR_RE.exec(trimmed);
    if (legacyMatch) {
      return {
        raw: trimmed,
        category: 'contract',
        hostErrorType: 'Contract',
        hostErrorKey: 'contract',
        contractCode: parseContractCode(legacyMatch[1]),
        detail:
          trimmed.replace(legacyMatch[0], '').replace(/[:.\s]+$/, '').trim() || undefined,
        diagnostics,
      };
    }
  }

  // Some RPC responses only carry the code inside diagnostic events.
  for (const event of diagnostics) {
    const eventText = [event.data, ...(event.topics ?? [])]
      .filter((value): value is string => Boolean(value))
      .join(' ');
    const hostMatchInEvent = HOST_ERROR_RE.exec(eventText);
    const legacyMatchInEvent = hostMatchInEvent
      ? null
      : LEGACY_CONTRACT_ERROR_RE.exec(eventText);
    if (hostMatchInEvent || legacyMatchInEvent) {
      const hostErrorType = hostMatchInEvent ? hostMatchInEvent[1] : 'Contract';
      const codeToken = hostMatchInEvent ? hostMatchInEvent[2] : legacyMatchInEvent![1];
      const isContract = hostErrorType.toLowerCase() === 'contract';
      return {
        raw: messages[0].trim(),
        category: isContract ? 'contract' : 'host',
        hostErrorType,
        hostErrorKey: hostErrorType.toLowerCase(),
        ...(isContract ? { contractCode: parseContractCode(codeToken) } : {}),
        detail: messages[0].trim() || undefined,
        diagnostics,
      };
    }
  }

  return {
    raw: messages[0].trim(),
    category: 'unknown',
    diagnostics,
  };
}
