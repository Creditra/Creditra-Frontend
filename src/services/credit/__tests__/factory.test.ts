import { afterEach, describe, it, expect, vi } from 'vitest';
import { createCreditDataSource } from '../factory';
import { MockCreditDataSource } from '../mockCreditDataSource';
import { SorobanCreditDataSource } from '../sorobanCreditDataSource';

describe('createCreditDataSource', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates MockCreditDataSource by default', () => {
    vi.stubEnv('VITE_CREDIT_DATA_SOURCE', undefined);
    const source = createCreditDataSource();
    expect(source).toBeInstanceOf(MockCreditDataSource);
  });

  it('creates MockCreditDataSource when mock is configured', () => {
    vi.stubEnv('VITE_CREDIT_DATA_SOURCE', 'mock');
    const source = createCreditDataSource();
    expect(source).toBeInstanceOf(MockCreditDataSource);
  });

  it.each(['', '   '])('defaults to mock for an empty configured value (%j)', (value) => {
    vi.stubEnv('VITE_CREDIT_DATA_SOURCE', value);
    const source = createCreditDataSource();
    expect(source).toBeInstanceOf(MockCreditDataSource);
  });

  it('creates SorobanCreditDataSource for a case-insensitive configured value', () => {
    vi.stubEnv('VITE_CREDIT_DATA_SOURCE', ' SOROBAN ');
    const source = createCreditDataSource();
    expect(source).toBeInstanceOf(SorobanCreditDataSource);
  });

  it('throws for an unrecognized configured value', () => {
    vi.stubEnv('VITE_CREDIT_DATA_SOURCE', 'sorobna');
    expect(() => createCreditDataSource()).toThrow(
      'Invalid VITE_CREDIT_DATA_SOURCE value "sorobna". Allowed values are "mock" and "soroban".',
    );
  });

  it('throws for an unrecognized explicit type', () => {
    expect(() => createCreditDataSource('sorobna')).toThrow(
      'Unknown credit data source type "sorobna". Allowed values are "mock" and "soroban".',
    );
  });

  it('MockCreditDataSource lists and gets credit lines', async () => {
    const source = new MockCreditDataSource();
    const lines = await source.listCreditLines('any-borrower');
    expect(lines.length).toBeGreaterThan(0);

    const firstLine = await source.getCreditLine(lines[0].id);
    expect(firstLine.id).toBe(lines[0].id);
  });

  it('MockCreditDataSource throws not_found for non-existent line', async () => {
    const source = new MockCreditDataSource();
    await expect(source.getCreditLine('non-existent')).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});
