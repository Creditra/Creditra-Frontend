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
