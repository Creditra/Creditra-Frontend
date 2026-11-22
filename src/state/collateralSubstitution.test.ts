import { describe, expect, it } from 'vitest';
import type { CollateralAsset, SubstitutionError } from '../types/collateral';
import { MAX_RETRY_ATTEMPTS, STALE_QUOTE_THRESHOLD_MS } from '../utils/collateral';
import { canRetry, createInitialState, isSubmitting, reducer, type QuoteSnapshot, type State } from './collateralSubstitution';

const asset: CollateralAsset = {
  id: 'asset-1',
  name: 'Test collateral',
  value: 100_000,
  maxLtvRatio: 0.75,
  category: 'crypto',
};
const quote: QuoteSnapshot = { ltvRatio: 0.4, timestampMs: 1_000 };
const retryableError: SubstitutionError = { reason: 'network', message: 'Network error', retryable: true };
const fatalError: SubstitutionError = { reason: 'slippage', message: 'Slippage exceeded', retryable: false };

function atReview(nowMs = 2_000): State {
  let state = reducer(createInitialState(), { type: 'SELECT_ASSET', asset });
  state = reducer(state, { type: 'START_QUOTE', quote });
  return reducer(state, { type: 'QUOTE_RESOLVED', nowMs });
}
function atConfirm(nowMs = 2_000): State {
  return reducer(atReview(nowMs), { type: 'CONTINUE_TO_CONFIRM', nowMs });
}

describe('collateral substitution reducer', () => {
  it('starts in a clean selecting state', () => {
    expect(createInitialState()).toMatchObject({ phase: 'selecting', selectedAsset: null, confirmText: '' });
  });
  it('selects an asset and captures a quote before entering review', () => {
    let state = reducer(createInitialState(), { type: 'SELECT_ASSET', asset });
    expect(state).toMatchObject({ phase: 'selecting', selectedAsset: asset });
    state = reducer(state, { type: 'START_QUOTE', quote });
    expect(state.phase).toBe('quoting');
    state = reducer(state, { type: 'QUOTE_RESOLVED', nowMs: 2_000 });
    expect(state).toMatchObject({ phase: 'reviewing', step: 'review', quote, staleQuote: false, retryCount: 0 });
  });
  it('ignores quote start until an asset has been selected', () => {
    const state = createInitialState();
    expect(reducer(state, { type: 'START_QUOTE', quote })).toBe(state);
  });
  it('updates slippage only while reviewing the quote', () => {
    expect(reducer(atReview(), { type: 'SET_SLIPPAGE', tolerance: 2 })).toMatchObject({ phase: 'reviewing', slippageTolerance: 2 });
  });
  it('moves to confirmation and records a quote that became stale', () => {
    const staleAt = quote.timestampMs + STALE_QUOTE_THRESHOLD_MS + 1;
    expect(reducer(atReview(), { type: 'CONTINUE_TO_CONFIRM', nowMs: staleAt }))
      .toMatchObject({ phase: 'reviewing', step: 'confirm', staleQuote: true });
  });
  it('never enters submitting while a quote is stale', () => {
    const staleAt = quote.timestampMs + STALE_QUOTE_THRESHOLD_MS + 1;
    const state = reducer(atConfirm(), { type: 'SUBMIT_STARTED', nowMs: staleAt });
    expect(state).toMatchObject({ phase: 'reviewing', step: 'confirm', staleQuote: true });
    expect(isSubmitting(state)).toBe(false);
  });
  it('refreshes a stale quote before submission is allowed', () => {
    const staleAt = quote.timestampMs + STALE_QUOTE_THRESHOLD_MS + 1;
    let state = reducer(atConfirm(), { type: 'SUBMIT_STARTED', nowMs: staleAt });
    state = reducer(state, { type: 'REFRESH_QUOTE', quote: { ...quote, timestampMs: staleAt } });
    expect(state).toMatchObject({ phase: 'reviewing', staleQuote: false });
    state = reducer(state, { type: 'SUBMIT_STARTED', nowMs: staleAt + 1 });
    expect(state.phase).toBe('submitting');
  });
  it('transitions through submit success', () => {
    let state = reducer(atConfirm(), { type: 'SUBMIT_STARTED', nowMs: 2_001 });
    expect(state.phase).toBe('submitting');
    state = reducer(state, { type: 'SUBMIT_SUCCEEDED' });
    expect(state.phase).toBe('success');
  });
  it('classifies submission failure and exposes retry only when allowed', () => {
    let state = reducer(atConfirm(), { type: 'SUBMIT_STARTED', nowMs: 2_001 });
    state = reducer(state, { type: 'SUBMIT_FAILED', error: retryableError });
    expect(state).toMatchObject({ phase: 'error', retryCount: 1, error: retryableError });
    expect(canRetry(state)).toBe(true);
  });
  it('allows a retry, then marks the in-flight attempt as retrying', () => {
    let state = reducer(atConfirm(), { type: 'SUBMIT_STARTED', nowMs: 2_001 });
    state = reducer(state, { type: 'SUBMIT_FAILED', error: retryableError });
    state = reducer(state, { type: 'RETRY', nowMs: 2_002 });
    expect(state).toMatchObject({ phase: 'reviewing', step: 'confirm', retryCount: 1 });
    state = reducer(state, { type: 'SUBMIT_STARTED', nowMs: 2_003 });
    expect(state.phase).toBe('retrying');
    expect(isSubmitting(state)).toBe(true);
  });
  it('stops offering retries at the maximum attempt count', () => {
    let state = atConfirm();
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
      state = reducer(state, { type: 'SUBMIT_STARTED', nowMs: 2_001 + attempt });
      state = reducer(state, { type: 'SUBMIT_FAILED', error: retryableError });
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        expect(canRetry(state)).toBe(true);
        state = reducer(state, { type: 'RETRY', nowMs: 2_002 + attempt });
      }
    }
    expect(state).toMatchObject({ phase: 'error', retryCount: MAX_RETRY_ATTEMPTS });
    expect(canRetry(state)).toBe(false);
    expect(reducer(state, { type: 'RETRY', nowMs: 9_000 })).toBe(state);
  });
  it('moves an in-flight submission to a non-retryable error when slippage changes', () => {
    let state = reducer(atConfirm(), { type: 'SUBMIT_STARTED', nowMs: 2_001 });
    state = reducer(state, { type: 'SLIPPAGE_BLOCKED', error: fatalError });
    expect(state).toMatchObject({ phase: 'error', error: fatalError, retryCount: 0 });
    expect(canRetry(state)).toBe(false);
  });
  it('rechecks quote freshness when recovering from a retryable error', () => {
    let state = reducer(atConfirm(), { type: 'SUBMIT_STARTED', nowMs: 2_001 });
    state = reducer(state, { type: 'SUBMIT_FAILED', error: retryableError });
    const staleAt = quote.timestampMs + STALE_QUOTE_THRESHOLD_MS + 1;
    state = reducer(state, { type: 'RETRY', nowMs: staleAt });
    expect(state).toMatchObject({ phase: 'reviewing', step: 'confirm', staleQuote: true });
    expect(isSubmitting(state)).toBe(false);
  });
  it('does not offer a retry for non-retryable errors', () => {
    const state = reducer(atConfirm(), { type: 'SLIPPAGE_BLOCKED', error: fatalError });
    expect(state.phase).toBe('error');
    expect(canRetry(state)).toBe(false);
    expect(reducer(state, { type: 'RETRY', nowMs: 2_100 })).toBe(state);
  });
  it('updates confirmation text only in the confirmation phase', () => {
    expect(reducer(atConfirm(), { type: 'SET_CONFIRM_TEXT', value: asset.name }))
      .toMatchObject({ phase: 'reviewing', confirmText: asset.name });
  });
  it('clears confirmation text when backing out of confirmation', () => {
    let state = reducer(atConfirm(), { type: 'SET_CONFIRM_TEXT', value: asset.name });
    state = reducer(state, { type: 'BACK' });
    expect(state).toMatchObject({ phase: 'reviewing', step: 'review', confirmText: '' });
  });
  it('navigates back through review and selection without losing the selection', () => {
    let state = reducer(atConfirm(), { type: 'BACK' });
    expect(state).toMatchObject({ phase: 'reviewing', step: 'review' });
    state = reducer(state, { type: 'BACK' });
    expect(state).toMatchObject({ phase: 'selecting', selectedAsset: asset });
  });
  it('clears the error when navigating back from an error state', () => {
    let state = reducer(atConfirm(), { type: 'SLIPPAGE_BLOCKED', error: fatalError });
    state = reducer(state, { type: 'BACK' });
    expect(state).toMatchObject({ phase: 'reviewing', step: 'review' });
    expect('error' in state).toBe(false);
  });
  it('resets every field to its initial value', () => {
    expect(reducer(atConfirm(), { type: 'RESET' })).toEqual(createInitialState());
  });
  it('ignores impossible actions for the current phase', () => {
    const state = createInitialState();
    expect(reducer(state, { type: 'SUBMIT_SUCCEEDED' })).toBe(state);
    expect(reducer(state, { type: 'BACK' })).toBe(state);
  });
});
