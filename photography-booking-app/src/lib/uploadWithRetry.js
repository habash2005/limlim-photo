// Retry-with-backoff wrapper for upload-style operations.
// Pure logic — no Firebase imports — so it's straightforward to unit-test.

export const TRANSIENT_CODES = new Set([
  "storage/retry-limit-exceeded",
  "storage/canceled",
  "storage/unknown",
  "storage/quota-exceeded",
  "storage/server-file-wrong-size",
]);

/**
 * Run an attempt function up to `maxAttempts` times, retrying only on
 * transient errors with exponential backoff.
 *
 * @typedef {{ ok: true, value?: any } | { ok: false, error?: any }} AttemptResult
 *
 * @param {Object} opts
 * @param {(attempt: number, total: number) => Promise<AttemptResult>} opts.attempt
 *        async function that performs one upload attempt. Receives 1-based
 *        attempt number and total attempts. Must return { ok, value } or { ok: false, error }.
 *        `error.code` is checked against the transient set.
 * @param {number} [opts.maxAttempts=3]
 * @param {Set<string>} [opts.transientCodes]  defaults to TRANSIENT_CODES
 * @param {(attempt: number) => number} [opts.delay]
 *        returns ms to wait before retry N+1. Default: exponential 2s, 6s, 14s + jitter.
 * @param {(ms: number) => Promise<void>} [opts.sleep]  injectable for tests
 * @returns {Promise<{ ok: boolean, value?: any, error?: any, attemptsUsed: number }>}
 */
export async function uploadWithRetry({
  attempt,
  maxAttempts = 3,
  transientCodes = TRANSIENT_CODES,
  delay = (n) => Math.pow(2, n) * 1000 + Math.random() * 1000,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  if (typeof attempt !== "function") {
    throw new TypeError("uploadWithRetry: `attempt` must be a function");
  }
  let lastErr = null;
  for (let n = 1; n <= maxAttempts; n++) {
    const result = await attempt(n, maxAttempts);
    if (result && result.ok) {
      return { ok: true, value: result.value, attemptsUsed: n };
    }
    lastErr = result?.error;
    const code = lastErr?.code || "";
    const isTransient = transientCodes.has(code);
    const moreAttemptsLeft = n < maxAttempts;
    if (!isTransient || !moreAttemptsLeft) {
      return { ok: false, error: lastErr, attemptsUsed: n };
    }
    await sleep(delay(n));
  }
  // Defensive fallthrough — not reachable given the loop bounds above.
  return { ok: false, error: lastErr, attemptsUsed: maxAttempts };
}
