import type { CollateralAsset, SlippageTolerance, SubstitutionError } from '../types/collateral';
import { DEFAULT_SLIPPAGE, isStaleQuote, MAX_RETRY_ATTEMPTS } from '../utils/collateral';

export interface QuoteSnapshot {
  ltvRatio: number;
  timestampMs: number;
}

interface SelectionData {
  selectedAsset: CollateralAsset | null;
  confirmText: string;
  slippageTolerance: SlippageTolerance;
}

interface QuotedData {
  selectedAsset: CollateralAsset;
  confirmText: string;
  slippageTolerance: SlippageTolerance;
  quote: QuoteSnapshot;
  retryCount: number;
}

/** Only phases with a valid selected asset carry quote and retry data. */
export type State =
  | (SelectionData & { phase: 'selecting' })
  | (QuotedData & { phase: 'quoting' })
  | (QuotedData & { phase: 'reviewing'; step: 'review' | 'confirm'; staleQuote: boolean })
  | (QuotedData & { phase: 'submitting' })
  | (QuotedData & { phase: 'retrying' })
  | (QuotedData & { phase: 'success' })
  | (QuotedData & { phase: 'error'; error: SubstitutionError });

export type Action =
  | { type: 'SELECT_ASSET'; asset: CollateralAsset }
  | { type: 'START_QUOTE'; quote: QuoteSnapshot }
  | { type: 'QUOTE_RESOLVED'; nowMs: number }
  | { type: 'SET_SLIPPAGE'; tolerance: SlippageTolerance }
  | { type: 'CONTINUE_TO_CONFIRM'; nowMs: number }
  | { type: 'SET_CONFIRM_TEXT'; value: string }
  | { type: 'REFRESH_QUOTE'; quote: QuoteSnapshot }
  | { type: 'SUBMIT_STARTED'; nowMs: number }
  | { type: 'SUBMIT_SUCCEEDED' }
  | { type: 'SUBMIT_FAILED'; error: SubstitutionError }
  | { type: 'SLIPPAGE_BLOCKED'; error: SubstitutionError }
  | { type: 'RETRY'; nowMs: number }
  | { type: 'BACK' }
  | { type: 'RESET' };

export function createInitialState(): State {
  return {
    phase: 'selecting',
    selectedAsset: null,
    confirmText: '',
    slippageTolerance: DEFAULT_SLIPPAGE,
  };
}

export const initialState: State = createInitialState();

function withReviewStep(state: QuotedData, step: 'review' | 'confirm', staleQuote = false): State {
  return {
    phase: 'reviewing',
    step,
    selectedAsset: state.selectedAsset,
    confirmText: state.confirmText,
    slippageTolerance: state.slippageTolerance,
    quote: state.quote,
    retryCount: state.retryCount,
    staleQuote,
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'RESET':
      return createInitialState();
    case 'SELECT_ASSET':
      return state.phase === 'selecting' ? { ...state, selectedAsset: action.asset } : state;
    case 'START_QUOTE':
      if (state.phase !== 'selecting' || !state.selectedAsset) return state;
      return {
        phase: 'quoting',
        selectedAsset: state.selectedAsset,
        confirmText: '',
        slippageTolerance: state.slippageTolerance,
        quote: action.quote,
        retryCount: 0,
      };
    case 'QUOTE_RESOLVED':
      if (state.phase !== 'quoting') return state;
      return withReviewStep(state, 'review', isStaleQuote(state.quote.timestampMs, action.nowMs));
    case 'SET_SLIPPAGE':
      return state.phase === 'reviewing' && state.step === 'review'
        ? { ...state, slippageTolerance: action.tolerance }
        : state;
    case 'CONTINUE_TO_CONFIRM':
      if (state.phase !== 'reviewing' || state.step !== 'review') return state;
      return withReviewStep(state, 'confirm', isStaleQuote(state.quote.timestampMs, action.nowMs));
    case 'SET_CONFIRM_TEXT':
      if (state.phase === 'reviewing' && state.step === 'confirm') return { ...state, confirmText: action.value };
      if (state.phase === 'error') return { ...state, confirmText: action.value };
      return state;
    case 'REFRESH_QUOTE':
      if (state.phase !== 'reviewing' || state.step !== 'confirm') return state;
      return { ...state, quote: action.quote, staleQuote: false };
    case 'SUBMIT_STARTED':
      if (state.phase !== 'reviewing' || state.step !== 'confirm') return state;
      if (state.staleQuote || isStaleQuote(state.quote.timestampMs, action.nowMs)) {
        return { ...state, staleQuote: true };
      }
      return {
        phase: state.retryCount > 0 ? 'retrying' : 'submitting',
        selectedAsset: state.selectedAsset,
        confirmText: state.confirmText,
        slippageTolerance: state.slippageTolerance,
        quote: state.quote,
        retryCount: state.retryCount,
      };
    case 'SUBMIT_SUCCEEDED':
      if (state.phase !== 'submitting' && state.phase !== 'retrying') return state;
      return { ...state, phase: 'success', retryCount: 0 };
    case 'SUBMIT_FAILED':
      if (state.phase !== 'submitting' && state.phase !== 'retrying') return state;
      return {
        phase: 'error',
        selectedAsset: state.selectedAsset,
        confirmText: state.confirmText,
        slippageTolerance: state.slippageTolerance,
        quote: state.quote,
        retryCount: state.retryCount + 1,
        error: action.error,
      };
    case 'SLIPPAGE_BLOCKED':
      if (
        !(state.phase === 'reviewing' && state.step === 'confirm') &&
        state.phase !== 'submitting' &&
        state.phase !== 'retrying'
      ) return state;
      return {
        phase: 'error',
        selectedAsset: state.selectedAsset,
        confirmText: state.confirmText,
        slippageTolerance: state.slippageTolerance,
        quote: state.quote,
        retryCount: state.retryCount,
        error: action.error,
      };
    case 'RETRY':
      if (state.phase !== 'error' || !state.error.retryable || state.retryCount >= MAX_RETRY_ATTEMPTS) return state;
      return withReviewStep(state, 'confirm', isStaleQuote(state.quote.timestampMs, action.nowMs));
    case 'BACK':
      if (state.phase === 'reviewing' && state.step === 'confirm') return withReviewStep(state, 'review');
      if (state.phase === 'reviewing' && state.step === 'review') {
        return {
          phase: 'selecting',
          selectedAsset: state.selectedAsset,
          confirmText: '',
          slippageTolerance: state.slippageTolerance,
        };
      }
      if (state.phase === 'error') return withReviewStep(state, 'review');
      return state;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

export function isSubmitting(state: State): boolean {
  return state.phase === 'submitting' || state.phase === 'retrying';
}

export function canRetry(state: State): boolean {
  return state.phase === 'error' && state.error.retryable && state.retryCount < MAX_RETRY_ATTEMPTS;
}
