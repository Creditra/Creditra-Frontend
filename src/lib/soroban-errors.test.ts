import { describe, expect, it } from 'vitest';
import { parseSorobanError } from './soroban-errors';

describe('parseSorobanError', () => {
  it('extracts a contract code from the canonical host error rendering', () => {
    expect(
      parseSorobanError('Host function invocation failed: Error(Contract, #6)'),
    ).toMatchObject({
      category: 'contract',
      hostErrorType: 'Contract',
      contractCode: 6,
      detail: 'Host function invocation failed',
    });
  });

  it('extracts a contract code from the legacy ContractError rendering', () => {
    expect(parseSorobanError('ContractError(101)')).toMatchObject({
      category: 'contract',
      contractCode: 101,
    });
  });

  it('classifies non-contract host errors with their type', () => {
    expect(parseSorobanError('HostError: Error(Auth, InvalidAction)')).toMatchObject({
      category: 'host',
      hostErrorType: 'Auth',
      hostErrorKey: 'auth',
    });
  });

  it('accepts Error instances and nested cause objects', () => {
    const cause = new Error('HostError: Error(Storage, MissingValue)');
    expect(parseSorobanError({ message: 'wrapper', cause })).toMatchObject({
      category: 'host',
      hostErrorKey: 'storage',
    });
  });

  it('normalises diagnostic events passed alongside the error', () => {
    const parsed = parseSorobanError({
      message: 'Simulation error',
      events: [
        {
          type: 'diagnostic',
          contractId: 'CABC',
          topics: ['error'],
          data: 'Error(Contract, #4)',
        },
      ],
    });

    expect(parsed?.diagnostics).toEqual([
      {
        type: 'diagnostic',
        contractId: 'CABC',
        topics: ['error'],
        data: 'Error(Contract, #4)',
      },
    ]);
    expect(parsed).toMatchObject({ category: 'contract', contractCode: 4 });
  });

  it('returns category "unknown" for unrelated messages', () => {
    expect(parseSorobanError(new Error('network down'))).toMatchObject({
      category: 'unknown',
      diagnostics: [],
    });
  });

  it('returns null for non-error input', () => {
    expect(parseSorobanError(undefined)).toBeNull();
    expect(parseSorobanError(null)).toBeNull();
    expect(parseSorobanError(42)).toBeNull();
    expect(parseSorobanError({})).toBeNull();
  });
});
