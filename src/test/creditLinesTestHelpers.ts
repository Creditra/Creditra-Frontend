import { MOCK_CREDIT_LINES } from '../data/mockData';
import { setGlobalCreditLines } from '../hooks/useCreditLines';

let legacyRefetchError: Error | null = null;

/** Sets a mock refetch error for tests using `renderWithCredit`. */
export const setMockRefetchError = (error: Error | null) => {
  legacyRefetchError = error;
};

/** Returns the current mock refetch error configured for tests. */
export const getMockRefetchError = () => legacyRefetchError;

/** Resets the global mock credit lines and clears any mock refetch error. */
export const resetGlobalCreditLines = () => {
  setGlobalCreditLines([...MOCK_CREDIT_LINES]);
  legacyRefetchError = null;
};
