// Pure retry/fallback helper for download GETs against Firebase Storage.
//
// Two layers of resilience that the previous direct `fetch()` lacked:
//
//   1. Retry transient errors with exponential backoff. A single 1.5GB
//      bulk download issues 235 sequential fetches; one network blip
//      anywhere in the chain shouldn't kill the whole zip.
//
//   2. Fall back from the fast path (raw fetch) to a slower-but-different
//      path (SDK getBlob) on persistent failure. Useful when something
//      browser-side (extension, service-worker eviction, antivirus) breaks
//      the fetch lane but leaves the SDK lane working.
//
// Designed to be the same shape as src/lib/uploadWithRetry.js so the two
// stay easy to audit together.

// fetch() throws TypeError("Failed to fetch") for almost every kind of
// failure — CORS, network blip, aborted in-flight, downstream sink dying
// while the body stream is being read. We treat all of those as transient
// and retry. The non-transient cases are HTTP status codes we surface
// explicitly (4xx) — those should fail fast without retry.
export const TRANSIENT_HTTP_CODES = new Set([0, 408, 425, 429, 500, 502, 503, 504, 522, 524]);

// HTTP status codes that mean "don't retry" — auth/permission/missing.
export const TERMINAL_HTTP_CODES = new Set([400, 401, 403, 404, 410]);

export function isTransientError(err) {
  if (!err) return false;
  // AbortController-driven cancellation must propagate, never retry.
  if (err.name === "AbortError" || err.name === "NotAllowedError") return false;
  // fetch() TypeError covers network-level failures. Treat as transient.
  if (err.name === "TypeError") return true;
  // Errors we throw with `httpStatus` set (see fetchWithStatus below).
  if (typeof err.httpStatus === "number") {
    if (TERMINAL_HTTP_CODES.has(err.httpStatus)) return false;
    if (TRANSIENT_HTTP_CODES.has(err.httpStatus)) return true;
    // Default for unrecognised status: retry once, give up.
    return err.httpStatus >= 500;
  }
  // Firebase Storage SDK error codes — mirror the upload helper's set.
  if (err.code === "storage/retry-limit-exceeded") return true;
  if (err.code === "storage/canceled") return true;
  if (err.code === "storage/unknown") return true;
  if (err.code === "storage/server-file-wrong-size") return true;
  if (err.code === "storage/quota-exceeded") return true;
  // Anything else: assume terminal so we don't waste time retrying garbage.
  return false;
}

/**
 * Run an attempt up to maxAttempts times, sleeping between attempts with
 * exponential backoff + jitter. The same `attempt` shape uploadWithRetry
 * uses: a function that resolves to `{ ok: true, value }` or `{ ok: false, error }`.
 *
 * @template T
 * @param {object} options
 * @param {(n: number, total: number) => Promise<{ok: true, value: T} | {ok: false, error: any}>} options.attempt
 * @param {number} [options.maxAttempts=3]
 * @param {(err: any) => boolean} [options.shouldRetry]   defaults to isTransientError
 * @param {(n: number) => number} [options.delay]  attempt # → ms backoff
 * @param {(ms: number) => Promise<void>} [options.sleep]   for tests
 * @returns {Promise<{ok: true, value: T, attemptsUsed: number} | {ok: false, error: any, attemptsUsed: number}>}
 */
export async function downloadWithRetry({
  attempt,
  maxAttempts = 3,
  shouldRetry = isTransientError,
  delay = (n) => Math.pow(2, n) * 500 + Math.random() * 500,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  if (typeof attempt !== "function") {
    throw new TypeError("downloadWithRetry: `attempt` must be a function");
  }
  let lastErr = null;
  for (let n = 1; n <= maxAttempts; n++) {
    const result = await attempt(n, maxAttempts);
    if (result && result.ok) {
      return { ok: true, value: result.value, attemptsUsed: n };
    }
    lastErr = result?.error;
    const moreAttemptsLeft = n < maxAttempts;
    if (!moreAttemptsLeft || !shouldRetry(lastErr)) {
      return { ok: false, error: lastErr, attemptsUsed: n };
    }
    await sleep(delay(n));
  }
  return { ok: false, error: lastErr, attemptsUsed: maxAttempts };
}

/**
 * Wrap fetch so HTTP errors carry an `httpStatus` field — lets isTransientError
 * decide whether to retry without eating the response.
 *
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export async function fetchWithStatus(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status} ${res.statusText || ""}`.trim());
    e.httpStatus = res.status;
    throw e;
  }
  return res;
}

/**
 * Open a remote file with the layered resilience strategy:
 *
 *   1. Try `primary()` (fast path — raw fetch).
 *   2. On transient failure, retry up to `maxAttempts` with backoff.
 *   3. If exhausted and `fallback()` is provided, try fallback once.
 *
 * Returns the value (a Response/Blob/ReadableStream — whatever the caller
 * resolves to). Throws on permanent failure.
 *
 * @template T
 * @param {object} options
 * @param {() => Promise<T>} options.primary
 * @param {() => Promise<T>} [options.fallback]
 * @param {number} [options.maxAttempts=3]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @returns {Promise<T>}
 */
export async function openWithFallback({
  primary,
  fallback,
  maxAttempts = 3,
  sleep,
}) {
  const r = await downloadWithRetry({
    maxAttempts,
    sleep,
    attempt: () =>
      primary().then(
        (value) => ({ ok: true, value }),
        (error) => ({ ok: false, error })
      ),
  });
  if (r.ok) return r.value;
  if (typeof fallback === "function") {
    // Fallback gets ONE shot — if the first path's retries all failed and
    // the alt path also fails we want to surface that quickly.
    try {
      return await fallback();
    } catch (fallbackErr) {
      // Prefer the original error message — it's usually more diagnostic
      // than the fallback's secondary failure (e.g. SDK error code).
      const e = new Error(
        `Download failed (primary: ${r.error?.message || r.error}; fallback: ${fallbackErr?.message || fallbackErr})`
      );
      e.primary = r.error;
      e.fallback = fallbackErr;
      throw e;
    }
  }
  throw r.error;
}
