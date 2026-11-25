import { useEffect, useMemo, useRef, useState } from 'react';
import type { xdr } from '@stellar/stellar-sdk';
import {
  estimateInvocationFee,
  feeArgsKey,
  type FeeServiceOptions,
  type NetworkFeeEstimate,
} from '../services/fees';

export type NetworkFeeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; estimate: NetworkFeeEstimate }
  | { status: 'unavailable'; error?: string };

export interface UseNetworkFeeOptions extends FeeServiceOptions {
  /** Skip estimation entirely (e.g. no contract configured). */
  enabled?: boolean;
  /** Debounce applied when the amount (args) changes. */
  debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 350;

/**
 * Debounced network-fee estimate for a contract invocation.
 *
 * Callers get an explicit `loading` state so they can decide whether to keep
 * the previous value. Every failure resolves to `unavailable`, never to a
 * thrown error.
 */
export function useNetworkFee(
  method: string,
  args: xdr.ScVal[] | null,
  options: UseNetworkFeeOptions = {},
): NetworkFeeState {
  const { enabled = true, debounceMs = DEFAULT_DEBOUNCE_MS, ...serviceOptions } = options;
  const [state, setState] = useState<NetworkFeeState>({ status: 'idle' });

  const argsRef = useRef(args);
  argsRef.current = args;
  const serviceOptionsRef = useRef(serviceOptions);
  serviceOptionsRef.current = serviceOptions;

  const argsKey = useMemo(() => (args ? feeArgsKey(args) : null), [args]);

  useEffect(() => {
    if (!enabled || argsKey === null) {
      setState({ status: 'idle' });
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });

    const timer = setTimeout(() => {
      estimateInvocationFee(method, argsRef.current ?? [], {
        ...serviceOptionsRef.current,
        signal: controller.signal,
      })
        .then((estimate) => {
          if (!controller.signal.aborted) setState({ status: 'ready', estimate });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setState({
            status: 'unavailable',
            error: error instanceof Error ? error.message : undefined,
          });
        });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [method, argsKey, enabled, debounceMs]);

  return state;
}
