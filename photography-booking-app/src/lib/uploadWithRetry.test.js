import { describe, it, expect, vi } from "vitest";
import { uploadWithRetry, TRANSIENT_CODES } from "./uploadWithRetry";

// Helper: builds an `attempt` function from a script of outcomes.
// e.g. scenario(["ok"]) → succeeds on attempt 1
//      scenario(["transient", "ok"]) → fails attempt 1, succeeds attempt 2
//      scenario(["nontransient"]) → fails attempt 1 with non-transient code
function scenario(steps) {
  let n = 0;
  return vi.fn(async () => {
    const step = steps[n++];
    if (step === "ok") return { ok: true, value: `attempt-${n}` };
    if (step === "transient")
      return { ok: false, error: { code: "storage/retry-limit-exceeded", message: "fake" } };
    if (step === "nontransient")
      return { ok: false, error: { code: "storage/unauthorized", message: "fake" } };
    if (step === "no-code")
      return { ok: false, error: { message: "no code present" } };
    throw new Error(`unknown scenario step: ${step}`);
  });
}

function makeNoSleep() {
  return vi.fn(async () => {});
}

describe("uploadWithRetry", () => {
  it("succeeds on first attempt — no retry, no sleep", async () => {
    const attempt = scenario(["ok"]);
    const noSleep = makeNoSleep();
    const r = await uploadWithRetry({ attempt, sleep: noSleep });
    expect(r.ok).toBe(true);
    expect(r.value).toBe("attempt-1");
    expect(r.attemptsUsed).toBe(1);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(noSleep).not.toHaveBeenCalled();
  });

  it("retries on transient error and eventually succeeds", async () => {
    const attempt = scenario(["transient", "transient", "ok"]);
    const noSleep = makeNoSleep();
    const r = await uploadWithRetry({ attempt, sleep: noSleep });
    expect(r.ok).toBe(true);
    expect(r.value).toBe("attempt-3");
    expect(r.attemptsUsed).toBe(3);
    expect(attempt).toHaveBeenCalledTimes(3);
    // Slept exactly twice (between attempts 1->2 and 2->3, not after the success)
    expect(noSleep).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxAttempts of consecutive transient failures", async () => {
    const attempt = scenario(["transient", "transient", "transient"]);
    const noSleep = makeNoSleep();
    const r = await uploadWithRetry({ attempt, sleep: noSleep });
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe("storage/retry-limit-exceeded");
    expect(r.attemptsUsed).toBe(3);
    expect(attempt).toHaveBeenCalledTimes(3);
    // Slept twice (between attempts 1->2 and 2->3), not after the final failure
    expect(noSleep).toHaveBeenCalledTimes(2);
  });

  it("fails fast on non-transient error — no retry", async () => {
    const attempt = scenario(["nontransient"]);
    const noSleep = makeNoSleep();
    const r = await uploadWithRetry({ attempt, sleep: noSleep });
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe("storage/unauthorized");
    expect(r.attemptsUsed).toBe(1);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(noSleep).not.toHaveBeenCalled();
  });

  it("fails fast on error with no code — treated as non-transient", async () => {
    const attempt = scenario(["no-code"]);
    const noSleep = makeNoSleep();
    const r = await uploadWithRetry({ attempt, sleep: noSleep });
    expect(r.ok).toBe(false);
    expect(r.attemptsUsed).toBe(1);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("respects custom maxAttempts", async () => {
    const attempt = scenario(["transient", "transient", "transient", "transient", "transient"]);
    const noSleep = makeNoSleep();
    const r = await uploadWithRetry({ attempt, maxAttempts: 5, sleep: noSleep });
    expect(r.ok).toBe(false);
    expect(r.attemptsUsed).toBe(5);
    expect(attempt).toHaveBeenCalledTimes(5);
  });

  it("respects custom transient code set", async () => {
    const customCodes = new Set(["my-app/flaky"]);
    const attempt = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: { code: "my-app/flaky" } })
      .mockResolvedValueOnce({ ok: true, value: "ok" });
    const r = await uploadWithRetry({
      attempt,
      transientCodes: customCodes,
      sleep: makeNoSleep(),
    });
    expect(r.ok).toBe(true);
    expect(r.attemptsUsed).toBe(2);
  });

  it("calls delay() with attempt numbers 1..maxAttempts-1 only", async () => {
    const attempt = scenario(["transient", "transient", "transient"]);
    const delay = vi.fn(() => 0);
    await uploadWithRetry({ attempt, delay, sleep: makeNoSleep() });
    // Sleeps after attempts 1 and 2; no sleep after the final attempt
    expect(delay).toHaveBeenCalledTimes(2);
    expect(delay.mock.calls[0][0]).toBe(1);
    expect(delay.mock.calls[1][0]).toBe(2);
  });

  it("default delay grows exponentially with jitter (sanity check)", async () => {
    let captured;
    const attempt = scenario(["transient", "ok"]);
    const sleep = vi.fn(async (ms) => {
      captured = ms;
    });
    await uploadWithRetry({ attempt, sleep });
    // Default: 2^1 * 1000 + [0..1000] => [2000, 3000)
    expect(captured).toBeGreaterThanOrEqual(2000);
    expect(captured).toBeLessThan(3000);
  });

  it("throws on missing `attempt`", async () => {
    await expect(uploadWithRetry({})).rejects.toThrow(/attempt/);
  });

  it("TRANSIENT_CODES contains the codes we promised the user", () => {
    expect(TRANSIENT_CODES.has("storage/retry-limit-exceeded")).toBe(true);
    expect(TRANSIENT_CODES.has("storage/canceled")).toBe(true);
    expect(TRANSIENT_CODES.has("storage/unknown")).toBe(true);
    expect(TRANSIENT_CODES.has("storage/quota-exceeded")).toBe(true);
    expect(TRANSIENT_CODES.has("storage/server-file-wrong-size")).toBe(true);
    // Non-transient codes are NOT in the set
    expect(TRANSIENT_CODES.has("storage/unauthorized")).toBe(false);
    expect(TRANSIENT_CODES.has("storage/unauthenticated")).toBe(false);
    expect(TRANSIENT_CODES.has("storage/invalid-checksum")).toBe(false);
  });

  it("does not retry on success even if first attempt would have been retried", async () => {
    // Mixed: ok then would-have-been-transient. Should NOT call attempt#2.
    const attempt = scenario(["ok", "transient"]);
    const r = await uploadWithRetry({ attempt, sleep: makeNoSleep() });
    expect(r.ok).toBe(true);
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
