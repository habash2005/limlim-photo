import { describe, it, expect, vi } from "vitest";
import {
  downloadWithRetry,
  openWithFallback,
  isTransientError,
  TRANSIENT_HTTP_CODES,
  TERMINAL_HTTP_CODES,
} from "./downloadWithRetry";

const noSleep = () => vi.fn(async () => {});

function script(steps) {
  let n = 0;
  return vi.fn(async () => {
    const step = steps[n++];
    if (step === "ok") return { ok: true, value: `attempt-${n}` };
    if (step === "transient") {
      const e = new Error("Failed to fetch");
      e.name = "TypeError";
      return { ok: false, error: e };
    }
    if (step === "terminal-401") {
      const e = new Error("HTTP 401 Unauthorized");
      e.httpStatus = 401;
      return { ok: false, error: e };
    }
    if (step === "transient-503") {
      const e = new Error("HTTP 503");
      e.httpStatus = 503;
      return { ok: false, error: e };
    }
    if (step === "abort") {
      const e = new Error("aborted");
      e.name = "AbortError";
      return { ok: false, error: e };
    }
    throw new Error(`unknown step: ${step}`);
  });
}

describe("isTransientError", () => {
  it("treats fetch TypeError as transient (network blips, dropped streams)", () => {
    const e = new Error("Failed to fetch");
    e.name = "TypeError";
    expect(isTransientError(e)).toBe(true);
  });

  it("never retries AbortError or NotAllowedError", () => {
    const a = new Error("");
    a.name = "AbortError";
    expect(isTransientError(a)).toBe(false);
    const b = new Error("");
    b.name = "NotAllowedError";
    expect(isTransientError(b)).toBe(false);
  });

  it.each([0, 408, 425, 429, 500, 502, 503, 504, 522, 524])(
    "treats HTTP %s as transient",
    (status) => {
      expect(isTransientError({ httpStatus: status })).toBe(true);
    }
  );

  it.each([400, 401, 403, 404, 410])(
    "treats HTTP %s as terminal — auth/missing should not waste retries",
    (status) => {
      expect(isTransientError({ httpStatus: status })).toBe(false);
    }
  );

  it("uses the documented sets", () => {
    for (const c of [503, 504, 429]) expect(TRANSIENT_HTTP_CODES.has(c)).toBe(true);
    for (const c of [401, 403, 404]) expect(TERMINAL_HTTP_CODES.has(c)).toBe(true);
  });

  it("recognises Firebase Storage transient codes", () => {
    expect(isTransientError({ code: "storage/retry-limit-exceeded" })).toBe(true);
    expect(isTransientError({ code: "storage/canceled" })).toBe(true);
    expect(isTransientError({ code: "storage/unauthorized" })).toBe(false);
  });

  it("falls through to false for unknown errors (don't retry garbage)", () => {
    expect(isTransientError(new Error("totally unknown"))).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });
});

describe("downloadWithRetry", () => {
  it("succeeds on first attempt — no retry, no sleep", async () => {
    const attempt = script(["ok"]);
    const sleep = noSleep();
    const r = await downloadWithRetry({ attempt, sleep });
    expect(r.ok).toBe(true);
    expect(r.attemptsUsed).toBe(1);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries fetch TypeError up to maxAttempts then succeeds", async () => {
    const attempt = script(["transient", "transient", "ok"]);
    const sleep = noSleep();
    const r = await downloadWithRetry({ attempt, sleep });
    expect(r.ok).toBe(true);
    expect(r.attemptsUsed).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("retries HTTP 503 then succeeds", async () => {
    const attempt = script(["transient-503", "ok"]);
    const r = await downloadWithRetry({ attempt, sleep: noSleep() });
    expect(r.ok).toBe(true);
    expect(r.attemptsUsed).toBe(2);
  });

  it("fails fast on HTTP 401 — never burns retries on auth", async () => {
    const attempt = script(["terminal-401"]);
    const sleep = noSleep();
    const r = await downloadWithRetry({ attempt, sleep });
    expect(r.ok).toBe(false);
    expect(r.error.httpStatus).toBe(401);
    expect(r.attemptsUsed).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("propagates AbortError immediately — user cancellation must not retry", async () => {
    const attempt = script(["abort"]);
    const sleep = noSleep();
    const r = await downloadWithRetry({ attempt, sleep });
    expect(r.ok).toBe(false);
    expect(r.error.name).toBe("AbortError");
    expect(r.attemptsUsed).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("gives up after maxAttempts of consecutive transient failures", async () => {
    const attempt = script(["transient", "transient", "transient"]);
    const r = await downloadWithRetry({ attempt, sleep: noSleep() });
    expect(r.ok).toBe(false);
    expect(r.attemptsUsed).toBe(3);
  });

  it("default delay grows exponentially — sanity check first sleep is in [1000, 1500)", async () => {
    let captured;
    const attempt = script(["transient", "ok"]);
    await downloadWithRetry({
      attempt,
      sleep: vi.fn(async (ms) => {
        captured = ms;
      }),
    });
    // 2^1 * 500 + [0..500) = [1000, 1500)
    expect(captured).toBeGreaterThanOrEqual(1000);
    expect(captured).toBeLessThan(1500);
  });

  it("throws on missing attempt fn", async () => {
    await expect(downloadWithRetry({})).rejects.toThrow(/attempt/);
  });
});

describe("openWithFallback", () => {
  it("uses primary on success — fallback never called", async () => {
    const primary = vi.fn(async () => "primary-result");
    const fallback = vi.fn(async () => "fallback-result");
    const r = await openWithFallback({ primary, fallback, sleep: noSleep() });
    expect(r).toBe("primary-result");
    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("retries primary on transient failure before falling back", async () => {
    let n = 0;
    const primary = vi.fn(async () => {
      n++;
      if (n < 3) {
        const e = new Error("Failed to fetch");
        e.name = "TypeError";
        throw e;
      }
      return "primary-eventually";
    });
    const fallback = vi.fn(async () => "fallback");
    const r = await openWithFallback({ primary, fallback, sleep: noSleep() });
    expect(r).toBe("primary-eventually");
    expect(primary).toHaveBeenCalledTimes(3);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("falls back when primary exhausts all retries", async () => {
    const primary = vi.fn(async () => {
      const e = new Error("Failed to fetch");
      e.name = "TypeError";
      throw e;
    });
    const fallback = vi.fn(async () => "from-fallback");
    const r = await openWithFallback({
      primary,
      fallback,
      maxAttempts: 2,
      sleep: noSleep(),
    });
    expect(r).toBe("from-fallback");
    expect(primary).toHaveBeenCalledTimes(2);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it("doesn't retry primary on terminal 404 — falls back immediately", async () => {
    const primary = vi.fn(async () => {
      const e = new Error("HTTP 404");
      e.httpStatus = 404;
      throw e;
    });
    const fallback = vi.fn(async () => "from-fallback");
    const r = await openWithFallback({ primary, fallback, sleep: noSleep() });
    expect(r).toBe("from-fallback");
    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it("throws combined error when both primary and fallback fail", async () => {
    const primary = vi.fn(async () => {
      const e = new Error("primary network died");
      e.name = "TypeError";
      throw e;
    });
    const fallback = vi.fn(async () => {
      const e = new Error("storage/unauthorized");
      e.code = "storage/unauthorized";
      throw e;
    });
    await expect(
      openWithFallback({ primary, fallback, maxAttempts: 2, sleep: noSleep() })
    ).rejects.toThrow(/primary network died/);
  });

  it("propagates primary error when no fallback is provided", async () => {
    const primary = vi.fn(async () => {
      const e = new Error("Failed to fetch");
      e.name = "TypeError";
      throw e;
    });
    await expect(
      openWithFallback({ primary, maxAttempts: 2, sleep: noSleep() })
    ).rejects.toThrow(/Failed to fetch/);
  });
});
