import { describe, it, expect } from 'vitest';
import { createCreditDataSource } from '../factory';
import { MockCreditDataSource } from '../mockCreditDataSource';
import { SorobanCreditDataSource } from '../sorobanCreditDataSource';

describe('createCreditDataSource', () => {
  it('creates MockCreditDataSource by default', () => {
    const source = createCreditDataSource('mock');
    expect(source).toBeInstanceOf(MockCreditDataSource);
  });

  it('creates SorobanCreditDataSource when soroban type is passed', () => {
    const source = createCreditDataSource('soroban');
    expect(source).toBeInstanceOf(SorobanCreditDataSource);
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
