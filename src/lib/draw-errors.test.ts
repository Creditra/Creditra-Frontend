import { describe, expect, it } from 'vitest';
import { classifyDrawError, DEFAULT_TERMINAL_ERROR_MESSAGE } from './draw-errors';
import { CreditDataError } from '../services/credit/CreditDataSource';
import { getContractErrorCopy } from '../copy/contractErrors';

describe('classifyDrawError — pre-existing behaviour', () => {
  it('classifies known retryable codes', () => {
    expect(classifyDrawError({ code: 'network_error' })).toMatchObject({
      kind: 'retryable',
      code: 'network_error',
    });
    expect(classifyDrawError({ code: 'quote_expired' })).toMatchObject({
      kind: 'retryable',
      code: 'quote_expired',
    });
  });

  it('classifies known terminal codes', () => {
    expect(classifyDrawError({ code: 'insufficient_availability' })).toMatchObject({
      kind: 'terminal',
      code: 'insufficient_availability',
    });
    expect(classifyDrawError({ code: 'user_rejected' })).toMatchObject({
      kind: 'terminal',
      code: 'user_rejected',
    });
  });

  it('classifies uncoded network messages as retryable', () => {
    expect(classifyDrawError(new Error('Network error while submitting'))).toMatchObject({
      kind: 'retryable',
    });
  });

  it('classifies uncoded rejection messages as terminal', () => {
    expect(classifyDrawError(new Error('Transaction rejected by user'))).toMatchObject({
      kind: 'terminal',
    });
  });

  it('falls back to the retryable default for unknown errors', () => {
    expect(classifyDrawError(new Error('Something unexpected'))).toMatchObject({
      kind: 'retryable',
      code: 'unknown_error',
    });
  });
});

describe('classifyDrawError — Soroban contract codes', () => {
  it('maps a known contract code to specific, terminal copy', () => {
    const result = classifyDrawError(
      new Error('Host function invocation failed: Error(Contract, #6)'),
    );
    const copy = getContractErrorCopy(6);

    expect(result.kind).toBe('terminal');
    expect(result.code).toBe('contract_6');
    expect(result.message).toBe(copy?.message);
    expect(result.message).toMatch(/available credit/i);
  });

  it('maps a retryable contract code as retryable', () => {
    expect(
      classifyDrawError(new Error('HostError: Error(Contract, #16)')),
    ).toMatchObject({
      kind: 'retryable',
      code: 'contract_16',
    });
  });

  it('recognises the legacy ContractError(N) rendering', () => {
    expect(
      classifyDrawError(new Error('Host function invocation failed: ContractError(3)')),
    ).toMatchObject({
      kind: 'terminal',
      code: 'contract_3',
      message: getContractErrorCopy(3)?.message,
    });
  });

  it('falls back to the terminal default for unknown contract codes', () => {
    expect(
      classifyDrawError(new Error('Host function invocation failed: Error(Contract, #9999)')),
    ).toEqual({
      kind: 'terminal',
      code: 'contract_9999',
      message: DEFAULT_TERMINAL_ERROR_MESSAGE,
    });
  });

  it('falls back to the terminal default when a contract error carries no code', () => {
    expect(classifyDrawError(new Error('HostError: Error(Contract)'))).toEqual({
      kind: 'terminal',
      code: 'contract_error',
      message: DEFAULT_TERMINAL_ERROR_MESSAGE,
    });
  });

  it('reads the code from diagnostic events when the message is generic', () => {
    const error = new CreditDataError('unavailable', 'Simulation error: host failure', {
      details: {
        error: 'host failure',
        events: [
          {
            type: 'diagnostic',
            data: 'Host function invocation failed: Error(Contract, #3)',
          },
        ],
      },
    });

    expect(classifyDrawError(error)).toMatchObject({
      kind: 'terminal',
      code: 'contract_3',
      message: getContractErrorCopy(3)?.message,
    });
  });
});

describe('classifyDrawError — Soroban host errors', () => {
  it('treats budget exhaustion as retryable', () => {
    expect(
      classifyDrawError(new Error('HostError: Error(Budget, ExceededLimit)')),
    ).toMatchObject({ kind: 'retryable', code: 'host_budget' });
  });

  it('treats auth failures as terminal', () => {
    expect(
      classifyDrawError(new Error('HostError: Error(Auth, InvalidAction)')),
    ).toMatchObject({ kind: 'terminal', code: 'host_auth' });
  });

  it('treats Wasm VM faults as terminal', () => {
    expect(
      classifyDrawError(new Error('HostError: Error(WasmVm, MissingValue)')),
    ).toMatchObject({ kind: 'terminal', code: 'host_wasmvm' });
  });
});

const RETRYABLE_TABLE: ReadonlyArray<[string, string]> = [
  ['network_error', 'Network error. Check your connection and try again.'],
  ['timeout', 'The request timed out. Please try again.'],
  ['quote_expired', 'Your quote expired. Try again to get fresh pricing.'],
];

const TERMINAL_TABLE: ReadonlyArray<[string, string]> = [
  ['insufficient_availability', 'The requested amount exceeds available credit.'],
  ['ineligible_line', 'This credit line is no longer eligible for a draw.'],
  [
    'contract_rejection',
    'The contract rejected this draw. Start over to select different details.',
  ],
  [
    'user_rejected',
    'The request was rejected in your wallet. Start over to select different details.',
  ],
];

const DEFAULT_RETRYABLE_MESSAGE =
  'Something went wrong while processing your draw. Please try again.';

describe('classifyDrawError — every known code', () => {
  it.each(RETRYABLE_TABLE)(
    'classifies %s as retryable with its exact message',
    (code, message) => {
      expect(classifyDrawError({ code })).toEqual({ kind: 'retryable', code, message });
    },
  );

  it.each(TERMINAL_TABLE)(
    'classifies %s as terminal with its exact message',
    (code, message) => {
      expect(classifyDrawError({ code })).toEqual({ kind: 'terminal', code, message });
    },
  );
});

describe('classifyDrawError — code extraction', () => {
  it('prefers code over errorCode and reason', () => {
    expect(
      classifyDrawError({
        code: 'timeout',
        errorCode: 'network_error',
        reason: 'quote_expired',
      }),
    ).toMatchObject({ kind: 'retryable', code: 'timeout' });
  });

  it('falls back to errorCode when code is absent', () => {
    expect(
      classifyDrawError({ errorCode: 'network_error', reason: 'quote_expired' }),
    ).toMatchObject({ kind: 'retryable', code: 'network_error' });
  });

  it('falls back to reason when code and errorCode are absent', () => {
    expect(classifyDrawError({ reason: 'user_rejected' })).toEqual({
      kind: 'terminal',
      code: 'user_rejected',
      message: TERMINAL_TABLE[3][1],
    });
  });

  it('ignores empty-string code fields', () => {
    expect(
      classifyDrawError({ code: '', errorCode: '', reason: 'quote_expired' }),
    ).toMatchObject({ kind: 'retryable', code: 'quote_expired' });
  });

  it('ignores non-string code fields', () => {
    expect(classifyDrawError({ code: 500, errorCode: 'timeout' })).toMatchObject({
      kind: 'retryable',
      code: 'timeout',
    });
  });

  it.each([null, undefined, 42])(
    'falls back for non-object input %s',
    (input) => {
      expect(classifyDrawError(input)).toEqual({
        kind: 'retryable',
        code: 'unknown_error',
        message: DEFAULT_RETRYABLE_MESSAGE,
      });
    },
  );
});

describe('classifyDrawError — message-only classification', () => {
  const retryableKeywords = ['network', 'timed out', 'timeout', 'quote expired'];
  const terminalKeywords = ['insufficient', 'ineligible', 'rejected'];

  it.each(retryableKeywords)(
    'treats a message containing "%s" as retryable',
    (keyword) => {
      const message = `Request failed: ${keyword}`;
      expect(classifyDrawError(new Error(message))).toEqual({
        kind: 'retryable',
        code: 'unknown_error',
        message,
      });
    },
  );

  it.each(terminalKeywords)(
    'treats a message containing "%s" as terminal',
    (keyword) => {
      const message = `Request failed: ${keyword}`;
      expect(classifyDrawError(new Error(message))).toEqual({
        kind: 'terminal',
        code: 'unknown_error',
        message,
      });
    },
  );

  it('matches keywords case-insensitively', () => {
    expect(classifyDrawError(new Error('NETWORK unreachable')).kind).toBe('retryable');
    expect(classifyDrawError(new Error('INSUFFICIENT balance')).kind).toBe('terminal');
  });

  it('classifies plain string errors', () => {
    expect(classifyDrawError('Quote expired — try again')).toEqual({
      kind: 'retryable',
      code: 'unknown_error',
      message: 'Quote expired — try again',
    });
    expect(classifyDrawError('User rejected')).toEqual({
      kind: 'terminal',
      code: 'unknown_error',
      message: 'User rejected',
    });
  });

  it('keeps an unrecognised code but uses the retryable default message', () => {
    expect(classifyDrawError({ code: 'mystery' })).toEqual({
      kind: 'retryable',
      code: 'mystery',
      message: DEFAULT_RETRYABLE_MESSAGE,
    });
  });
});

describe('classifyDrawError — final fallback', () => {
  it('returns the retryable default when there is no code and no message', () => {
    expect(classifyDrawError({})).toEqual({
      kind: 'retryable',
      code: 'unknown_error',
      message: DEFAULT_RETRYABLE_MESSAGE,
    });
  });

  it('exports a non-empty terminal default message distinct from the retryable one', () => {
    expect(typeof DEFAULT_TERMINAL_ERROR_MESSAGE).toBe('string');
    expect(DEFAULT_TERMINAL_ERROR_MESSAGE.trim().length).toBeGreaterThan(0);
    expect(DEFAULT_TERMINAL_ERROR_MESSAGE).not.toBe(DEFAULT_RETRYABLE_MESSAGE);
  });
});

