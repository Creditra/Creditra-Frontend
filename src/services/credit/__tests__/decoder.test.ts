import { describe, expect, it } from 'vitest';
import { CreditDataError } from '../CreditDataSource';
import { decodeCreditLine, decodeLosslessAmount } from '../decoder';

function expectInvalidAmount(value: unknown): void {
  try {
    decodeLosslessAmount(value);
  } catch (error) {
    expect(error).toBeInstanceOf(CreditDataError);
    expect((error as CreditDataError).code).toBe('invalid_response');
    return;
  }

  throw new Error('Expected decodeLosslessAmount to throw');
}

describe('decodeLosslessAmount', () => {
  it('decodes bigint stroops below Number.MAX_SAFE_INTEGER', () => {
    expect(decodeLosslessAmount(12_345_678n)).toBe(1.2345678);
    expect(decodeLosslessAmount(9_007_199_254_740_991n)).toBe(
      Number('900719925.4740991'),
    );
  });

  it('converts bigint stroops above Number.MAX_SAFE_INTEGER through one decimal parse', () => {
    const stroops = 9_007_199_254_740_992n;

    expect(stroops).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
    expect(decodeLosslessAmount(stroops)).toBe(Number('900719925.4740992'));
  });

  it('preserves the sign when decoding negative bigint stroops', () => {
    expect(decodeLosslessAmount(-12_345_678n)).toBe(-1.2345678);
    expect(decodeLosslessAmount(-1n)).toBe(-0.0000001);
  });

  it('decodes zero bigint stroops', () => {
    expect(decodeLosslessAmount(0n)).toBe(0);
  });

  it('treats finite numbers as standard units by default', () => {
    expect(decodeLosslessAmount(1.5)).toBe(1.5);
    expect(decodeLosslessAmount(0)).toBe(0);
    expect(decodeLosslessAmount(-1.5)).toBe(-1.5);
  });

  it('scales numeric stroops when numberUnit is stroops', () => {
    expect(decodeLosslessAmount(15_000_000, { numberUnit: 'stroops' })).toBe(1.5);
    expect(decodeLosslessAmount(-15_000_000, { numberUnit: 'stroops' })).toBe(-1.5);
  });

  it('rejects non-finite numbers with invalid_response', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expectInvalidAmount(value);
    }
  });

  it('rejects strings and other unsupported values with invalid_response', () => {
    for (const value of ['1.5', null, undefined, {}, []]) {
      expectInvalidAmount(value);
    }
  });
});

/** A minimal, otherwise-valid native payload for decodeCreditLine. */
function rawLine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'line-1',
    name: 'Builder credit line',
    status: 'Active',
    limit: 10_000,
    utilized: 2_500,
    apr: 12.5,
    risk_score: 720,
    opened_at: '2023-11-14T22:13:20.000Z',
    updated_at: '2023-11-15T22:13:20.000Z',
    ...overrides,
  };
}

/** Same payload but using only camelCase aliases. */
function camelLine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'line-1',
    name: 'Builder credit line',
    status: 'Active',
    limit: 10_000,
    utilized: 2_500,
    apr: 12.5,
    riskScore: 720,
    openedAt: '2023-11-14T22:13:20.000Z',
    updatedAt: '2023-11-15T22:13:20.000Z',
    ...overrides,
  };
}

function expectInvalidResponse(run: () => unknown): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(CreditDataError);
    expect((error as CreditDataError).code).toBe('invalid_response');
    return;
  }

  throw new Error('Expected CreditDataError with code "invalid_response"');
}

describe('decodeCreditLine — happy path', () => {
  it('decodes a complete payload and defaults the optional collections', () => {
    expect(decodeCreditLine(rawLine())).toEqual({
      id: 'line-1',
      name: 'Builder credit line',
      status: 'Active',
      limit: 10_000,
      utilized: 2_500,
      apr: 12.5,
      riskScore: 720,
      collateral: undefined,
      openedAt: '2023-11-14T22:13:20.000Z',
      updatedAt: '2023-11-15T22:13:20.000Z',
      transactions: [],
      statusHistory: [],
    });
  });

  it('decodes bigint stroop amounts through the lossless amount helper', () => {
    const line = decodeCreditLine(
      rawLine({ limit: 10_000_000n, utilized: 2_500_000n }),
    );
    expect(line.limit).toBe(1);
    expect(line.utilized).toBe(0.25);
  });
});

describe('decodeCreditLine — timestamps', () => {
  it('accepts ISO strings verbatim (normalized to UTC)', () => {
    const line = decodeCreditLine(
      rawLine({
        opened_at: '2023-11-14T22:13:20Z',
        updated_at: '2023-11-15T22:13:20.000Z',
      }),
    );
    expect(line.openedAt).toBe('2023-11-14T22:13:20.000Z');
    expect(line.updatedAt).toBe('2023-11-15T22:13:20.000Z');
  });

  it('treats numbers below 1e11 as unix seconds', () => {
    const line = decodeCreditLine(
      rawLine({ opened_at: 1_700_000_000, updated_at: 1_700_000_000 }),
    );
    expect(line.openedAt).toBe('2023-11-14T22:13:20.000Z');
    expect(line.updatedAt).toBe('2023-11-14T22:13:20.000Z');
  });

  it('treats numbers at or above 1e11 as unix milliseconds', () => {
    const line = decodeCreditLine(
      rawLine({ opened_at: 1_700_000_000_000, updated_at: 1_700_000_000_000 }),
    );
    expect(line.openedAt).toBe('2023-11-14T22:13:20.000Z');
    expect(line.updatedAt).toBe('2023-11-14T22:13:20.000Z');
  });

  it('accepts bigint seconds and bigint milliseconds', () => {
    const seconds = decodeCreditLine(
      rawLine({ opened_at: 1_700_000_000n, updated_at: 1_700_000_000n }),
    );
    const milliseconds = decodeCreditLine(
      rawLine({
        opened_at: 1_700_000_000_000n,
        updated_at: 1_700_000_000_000n,
      }),
    );
    expect(seconds.openedAt).toBe('2023-11-14T22:13:20.000Z');
    expect(milliseconds.openedAt).toBe('2023-11-14T22:13:20.000Z');
  });

  it('switches unit exactly at the 1e11 boundary', () => {
    const below = decodeCreditLine(rawLine({ opened_at: 1e11 - 1 }));
    const atBoundary = decodeCreditLine(rawLine({ opened_at: 1e11 }));
    expect(below.openedAt).toBe('5138-11-16T09:46:39.000Z');
    expect(atBoundary.openedAt).toBe('1973-03-03T09:46:40.000Z');
  });

  it('rejects negative, NaN, empty, invalid ISO and missing timestamps', () => {
    const badValues = [
      -1,
      Number.NaN,
      '',
      '   ',
      'not-a-date',
      undefined,
      null,
      {},
    ];
    for (const field of ['opened_at', 'updated_at']) {
      for (const value of badValues) {
        expectInvalidResponse(() => decodeCreditLine(rawLine({ [field]: value })));
      }
      const missing = rawLine();
      delete missing[field];
      expectInvalidResponse(() => decodeCreditLine(missing));
    }
  });
});

describe('decodeCreditLine — field aliases', () => {
  it('accepts camelCase riskScore, openedAt and updatedAt', () => {
    const line = decodeCreditLine(camelLine());
    expect(line.riskScore).toBe(720);
    expect(line.openedAt).toBe('2023-11-14T22:13:20.000Z');
    expect(line.updatedAt).toBe('2023-11-15T22:13:20.000Z');
  });

  it('accepts snake_case risk_score, opened_at and updated_at', () => {
    const line = decodeCreditLine(rawLine());
    expect(line.riskScore).toBe(720);
    expect(line.openedAt).toBe('2023-11-14T22:13:20.000Z');
    expect(line.updatedAt).toBe('2023-11-15T22:13:20.000Z');
  });

  it('prefers snake_case for all three fields when both spellings exist', () => {
    const line = decodeCreditLine(
      rawLine({
        riskScore: 999,
        openedAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      }),
    );
    expect(line.riskScore).toBe(720);
    expect(line.openedAt).toBe('2023-11-14T22:13:20.000Z');
    expect(line.updatedAt).toBe('2023-11-15T22:13:20.000Z');
  });
});

describe('decodeCreditLine — status variants', () => {
  it('accepts every documented status', () => {
    for (const status of ['Active', 'Suspended', 'Defaulted', 'Closed', 'Frozen']) {
      expect(decodeCreditLine(rawLine({ status })).status).toBe(status);
    }
  });

  it('rejects unknown, lowercase and non-string statuses', () => {
    for (const status of ['Pending', 'active', 'ACTIVE', '', 1, null, undefined, {}]) {
      expectInvalidResponse(() => decodeCreditLine(rawLine({ status })));
    }
  });
});

describe('decodeCreditLine — malformed payloads', () => {
  it('rejects non-object payloads with invalid_response', () => {
    for (const raw of [null, undefined, [], 'payload', 42]) {
      expectInvalidResponse(() => decodeCreditLine(raw));
    }
  });

  it('rejects missing or blank required string fields', () => {
    for (const field of ['id', 'name']) {
      expectInvalidResponse(() => decodeCreditLine(rawLine({ [field]: '' })));
      expectInvalidResponse(() => decodeCreditLine(rawLine({ [field]: '   ' })));
      expectInvalidResponse(() => decodeCreditLine(rawLine({ [field]: 123 })));
      const missing = rawLine();
      delete missing[field];
      expectInvalidResponse(() => decodeCreditLine(missing));
    }
  });

  it('rejects missing or null limit, utilized, apr and risk_score', () => {
    for (const field of ['limit', 'utilized', 'apr', 'risk_score']) {
      for (const value of [undefined, null]) {
        expectInvalidResponse(() => decodeCreditLine(rawLine({ [field]: value })));
      }
      const missing = rawLine();
      delete missing[field];
      expectInvalidResponse(() => decodeCreditLine(missing));
    }
  });

  it('rejects non-numeric apr and risk_score', () => {
    expectInvalidResponse(() => decodeCreditLine(rawLine({ apr: '12.5' })));
    expectInvalidResponse(() => decodeCreditLine(rawLine({ risk_score: NaN })));
    expectInvalidResponse(() =>
      decodeCreditLine(rawLine({ risk_score: Number.POSITIVE_INFINITY })),
    );
  });

  it('normalizes blank collateral to undefined but keeps a real value', () => {
    for (const collateral of ['', '   ', null, undefined, 42]) {
      expect(decodeCreditLine(rawLine({ collateral })).collateral).toBeUndefined();
    }
    expect(decodeCreditLine(rawLine({ collateral: 'Vault 42' })).collateral).toBe(
      'Vault 42',
    );
  });

  it('rejects non-array transactions and status history', () => {
    expectInvalidResponse(() =>
      decodeCreditLine(rawLine({ transactions: 'not an array' })),
    );
    expectInvalidResponse(() =>
      decodeCreditLine(rawLine({ status_history: {} })),
    );
    expectInvalidResponse(() =>
      decodeCreditLine(rawLine({ statusHistory: 7 })),
    );
  });
});
