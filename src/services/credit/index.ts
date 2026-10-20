/**
 * Credit data services.
 *
 * Public API for fetching and validating credit lines and transactions.
 */

export {
  fetchCreditLines,
  fetchCreditLineById,
  fetchAllTransactions,
  fetchTransactionsByCreditLine,
  fetchTransactionById,
  quoteDraw,
  type CreditLinesResult,
  type TransactionsResult,
} from './adapter';

export {
  decodeCreditLine,
  decodeCreditLines,
  decodeTransaction,
  decodeTransactions,
  type DecodedCreditLine,
  type DecodeIssue,
  type Result,
  type Path,
} from './decode';

export { CreditDataError } from './errors';
