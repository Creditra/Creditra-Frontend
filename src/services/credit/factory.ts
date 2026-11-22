import type { CreditDataSource } from './CreditDataSource';
import { getCreditDataSourceType } from './config';
import { MockCreditDataSource } from './mockCreditDataSource';
import {
  SorobanCreditDataSource,
  type SorobanCreditDataSourceOptions,
} from './sorobanCreditDataSource';

export function createCreditDataSource(
  type?: 'mock' | 'soroban' | string,
  options?: SorobanCreditDataSourceOptions,
): CreditDataSource {
  const selectedType = type || getCreditDataSourceType();

  switch (selectedType) {
    case 'soroban':
      return new SorobanCreditDataSource(options);
    case 'mock':
    default:
      return new MockCreditDataSource();
  }
}
