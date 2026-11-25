export class FetchTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, message?: string) {
    super(message ?? `Request timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface FetchWithTimeoutOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      (typeof DOMException !== "undefined" &&
        error instanceof DOMException &&
        error.name === "AbortError"))
  );
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const { timeoutMs = 15000, signal: optionSignal } = options;
  const callerSignal = optionSignal ?? init.signal ?? undefined;

  const controller = new AbortController();
  let didTimeout = false;

  const onCallerAbort = () => {
    controller.abort(callerSignal?.reason);
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }
  }

  const timerId = setTimeout(() => {
    didTimeout = true;
    controller.abort(new FetchTimeoutError(timeoutMs));
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new FetchTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timerId);
    if (callerSignal) {
      callerSignal.removeEventListener("abort", onCallerAbort);
    }
  }
}
