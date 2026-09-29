/**
 * Shared HTTP helpers for server-side calls to external APIs (Bright Data,
 * OpenRouter, Gemini). Every outbound request needs a hard deadline so a
 * stalled upstream can't hang a serverless function or burn budget while a
 * poll loop waits forever.
 */

/** fetch() with a hard timeout. Aborts the request after `timeoutMs`. */
export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/** Race any promise against a timeout — for SDK calls that don't accept a signal. */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = "operation",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timer),
  ) as Promise<T>;
}
