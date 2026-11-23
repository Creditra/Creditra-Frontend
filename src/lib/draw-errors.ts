import { getContractErrorCopy, HOST_ERROR_KIND } from '../copy/contractErrors';
import { parseSorobanError } from './soroban-errors';

export { parseSorobanError } from './soroban-errors';
export type {
  ParsedSorobanError,
  SorobanDiagnosticEvent,
  SorobanErrorCategory,
} from './soroban-errors';

export type DrawErrorKind = 'retryable' |'terminal';

export interface ClassifiedDrawError {
  kind: DrawErrorKind;
  code: string;
  message: string;
}

const RETRYABLE_CODES: Record<string, string> = {
  network_error: 'Network error. Check your connection and try again.',
  timeout: 'The request timed out. Please try again.',
  quote_expired: 'Your quote expired. Try again to get fresh pricing.',
};

const TERMINAL_CODES: Record<string, string> = {
  insufficient_availability: 'The requested amount exceeds available credit.',
  ineligible_line: 'This credit line is no longer eligible for a draw.',
  contract_rejection: 'The contract rejected this draw. Start over to select different details.',
  user_rejected: 'The request was rejected in your wallet. Start over to select different details.',
};

const DEFAULT_RETRYABLE_MESSAGE = 'Something went wrong while processing your draw. Please try again.';
const DEFAULT_TERMINAL_MESSAGE = 'Your draw could not be completed. Start over to select different details.';

function extractCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') {
    return undefined;
  }
  const candidate = err as { code?: unknown; errorCode?: unknown; reason?: unknown };
  for (const value of [candidate.code, candidate.errorCode, candidate.reason]) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function extractMessage(err: unknown): string | undefined {
  if (!err) {
    return undefined;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return undefined;
}

/**
 * Map a Soroban simulation failure to specific copy.
 *
 * Explicit `code`/`errorCode`/`reason` fields still win (see the lookups in
 * `classifyDrawError`), so this only runs for errors that reach us as raw
 * simulation text. Returns `null` when the error is not a Soroban error, which
 * keeps every pre-existing classification path untouched.
 */
function classifySorobanError(err: unknown): ClassifiedDrawError | null {
  const parsed = parseSorobanError(err);
  if (!parsed) {
    return null;
  }

  if (parsed.category === 'contract') {
    if (parsed.contractCode === undefined) {
      return {
        kind: 'terminal',
        code: 'contract_error',
        message: DEFAULT_TERMINAL_MESSAGE,
      };
    }
    const copy = getContractErrorCopy(parsed.contractCode);
    if (copy) {
      return {
        kind: copy.kind,
        code: `contract_${copy.code}`,
        message: copy.message,
      };
    }
    // Unknown contract code: keep the existing terminal default rather than
    // inventing copy for a code we do not understand.
    return {
      kind: 'terminal',
      code: `contract_${parsed.contractCode}`,
      message: DEFAULT_TERMINAL_MESSAGE,
    };
  }

  if (parsed.category === 'host' && parsed.hostErrorKey) {
    const kind = HOST_ERROR_KIND[parsed.hostErrorKey];
    if (kind) {
      return {
        kind,
        code: `host_${parsed.hostErrorKey}`,
        message: kind === 'retryable' ? DEFAULT_RETRYABLE_MESSAGE : DEFAULT_TERMINAL_MESSAGE,
      };
    }
  }

  return null;
}

/**
 * Classify a draw error into a retryable or terminal kind.
 *
 * Retryable: network, timeout, quote expired, transient host conditions.
 * Terminal:   insufficient availability, ineligible line, contract rejection,
 *              user rejection, known contract error codes.
 */
export function classifyDrawError(err: unknown): ClassifiedDrawError {
  const code = extractCode(err);

  if (code && code in RETRYABLE_CODES) {
    return { kind: 'retryable', code, message: RETRYABLE_CODES[code] };
  }

  if (code && code in TERMINAL_CODES) {
    return { kind: 'terminal', code, message: TERMINAL_CODES[code] };
  }

  const soroban = classifySorobanError(err);
  if (soroban) {
    return soroban;
  }

  // Message-based classification for errors that lack a code.
  const message = extractMessage(err);
  if (message) {
    const lower = message.toLowerCase();
    if (
      lower.includes('network') ||
      lower.includes('timed out') ||
      lower.includes('timeout') ||
      lower.includes('quote expired')
    ) {
      return {
        kind: 'retryable',
        code: code ?? 'unknown_error',
        message,
      };
    }
    if (
      lower.includes('insufficient') ||
      lower.includes('ineligible') ||
      lower.includes('rejected')
    ) {
      return {
        kind: 'terminal',
        code: code ?? 'unknown_error',
        message,
      };
    }
  }

  return {
    kind: 'retryable',
    code: code ?? 'unknown_error',
    message: message ?? defaultMessageFor(code),
  };
}

function defaultMessageFor(code: string | undefined): string {
  if (code && code in TERMINAL_CODES) {
    return DEFAULT_TERMINAL_MESSAGE;
  }
  return DEFAULT_RETRYABLE_MESSAGE;
}

export const DEFAULT_TERMINAL_ERROR_MESSAGE = DEFAULT_TERMINAL_MESSAGE;
