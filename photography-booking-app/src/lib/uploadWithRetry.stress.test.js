// Aggressive stress + integration tests for the upload retry path.
//
// These simulate the failure patterns that caused the original
// `storage/retry-limit-exceeded` reports during 100MB / batch uploads:
//   - random transient flakes during multi-file batches
//   - every documented Firebase Storage transient code
//   - long sequences of consecutive transient failures within one file
//   - many files in flight at once (mimicking CONCURRENCY=3 batches at scale)
//
// We can't fire real network uploads from a unit test, so instead we drive
// the retry helper with deterministic + randomized failure scripts and
// assert it behaves correctly under each pattern.
import { describe, it, expect, vi } from "vitest";
import { uploadWithRetry, TRANSIENT_CODES } from "./uploadWithRetry";

const noSleep = () => vi.fn(async () => {});

// ---------- helpers ----------

// Deterministic PRNG so a "random" stress run is reproducible. Mulberry32.
function rng(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Build an attempt fn that flakes `flakes` times with a transient code,
// then succeeds — or fails non-transient if `terminalCode` is set.
function flakeyAttempt({ flakes, transientCode, terminalCode, value = "ok" }) {
  let n = 0;
  return vi.fn(async () => {
    n++;
    if (n <= flakes) {
      return {
        ok: false,
        error: { code: transientCode || "storage/retry-limit-exceeded" },
      };
    }
    if (terminalCode) {
      return { ok: false, error: { code: terminalCode } };
    }
    return { ok: true, value };
  });
}

// ---------- Firebase code coverage ----------

describe("Firebase Storage error code matrix", () => {
  // From firebase-js-sdk packages/storage/src/implementation/error.ts. These
  // are the error codes the SDK actually emits — verify each one routes to
  // the correct retry/no-retry branch.
  const TRANSIENT_OBSERVED = [
    "storage/retry-limit-exceeded",
    "storage/canceled",
    "storage/unknown",
    "storage/quota-exceeded",
    "storage/server-file-wrong-size",
  ];
  const NON_TRANSIENT_OBSERVED = [
    "storage/unauthorized",
    "storage/unauthenticated",
    "storage/object-not-found",
    "storage/bucket-not-found",
    "storage/project-not-found",
    "storage/invalid-checksum",
    "storage/invalid-event-name",
    "storage/invalid-url",
    "storage/invalid-argument",
    "storage/no-default-bucket",
    "storage/cannot-slice-blob",
  ];

  it.each(TRANSIENT_OBSERVED)(
    "transient code %s triggers a retry",
    async (code) => {
      const attempt = flakeyAttempt({ flakes: 1, transientCode: code });
      const r = await uploadWithRetry({ attempt, sleep: noSleep() });
      expect(r.ok).toBe(true);
      expect(r.attemptsUsed).toBe(2);
      expect(attempt).toHaveBeenCalledTimes(2);
    }
  );

  it.each(NON_TRANSIENT_OBSERVED)(
    "non-transient code %s fails fast (1 attempt, no retry)",
    async (code) => {
      const sleep = noSleep();
      const attempt = vi.fn(async () => ({ ok: false, error: { code } }));
      const r = await uploadWithRetry({ attempt, sleep });
      expect(r.ok).toBe(false);
      expect(r.error.code).toBe(code);
      expect(r.attemptsUsed).toBe(1);
      expect(attempt).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    }
  );

  it("the published TRANSIENT_CODES set covers the codes we observed in prod", () => {
    for (const c of TRANSIENT_OBSERVED) expect(TRANSIENT_CODES.has(c)).toBe(true);
    for (const c of NON_TRANSIENT_OBSERVED) expect(TRANSIENT_CODES.has(c)).toBe(false);
  });
});

// ---------- mass concurrency ----------

describe("mass parallel uploads", () => {
  // The real bug report was "150+ photos uploaded, some hit retry-limit".
  // We simulate batches of that size with realistic flake rates.
  it("500 files, 30% flake rate, recovers all within 3 attempts", async () => {
    const rand = rng(0xdeadbeef);
    const tasks = Array.from({ length: 500 }, (_, i) => {
      // Each "file" flakes 0..2 times then succeeds. Heavy tail at 0.
      const flakes = rand() < 0.3 ? (rand() < 0.5 ? 1 : 2) : 0;
      return uploadWithRetry({
        attempt: flakeyAttempt({ flakes, value: `file-${i}` }),
        sleep: noSleep(),
      });
    });
    const results = await Promise.all(tasks);
    const ok = results.filter((r) => r.ok);
    expect(ok).toHaveLength(500);
    // attemptsUsed should never exceed 3 (success comes on attempt 1, 2, or 3)
    for (const r of results) expect(r.attemptsUsed).toBeLessThanOrEqual(3);
  });

  it("500 files, pathological 80% flake rate: most still succeed within 3 attempts", async () => {
    const rand = rng(0xc0ffee);
    const tasks = Array.from({ length: 500 }, (_, i) => {
      // Flake count: weighted 0..4, so many files exhaust the 3-attempt budget.
      const r = rand();
      const flakes = r < 0.2 ? 0 : r < 0.5 ? 1 : r < 0.8 ? 2 : r < 0.95 ? 3 : 4;
      return uploadWithRetry({
        attempt: flakeyAttempt({ flakes, value: `file-${i}` }),
        sleep: noSleep(),
      });
    });
    const results = await Promise.all(tasks);
    const ok = results.filter((r) => r.ok).length;
    const fail = results.length - ok;
    // With this distribution, ~85% should succeed (flakes in {0,1,2}).
    // The point is to verify the retry helper doesn't deadlock or leak —
    // every task settles, success or failure. The exact ratio is asserted
    // loosely so the test isn't fragile to PRNG drift.
    expect(ok + fail).toBe(500);
    expect(ok).toBeGreaterThan(400);
    // Every failure carries a transient code, since that's all this scenario emits.
    for (const r of results) {
      if (!r.ok) expect(TRANSIENT_CODES.has(r.error.code)).toBe(true);
    }
  });

  it("one bad file does not block others (failure isolation)", async () => {
    const stuck = uploadWithRetry({
      attempt: flakeyAttempt({ flakes: 99, value: "stuck" }), // never succeeds
      sleep: noSleep(),
    });
    const fast = Array.from({ length: 50 }, (_, i) =>
      uploadWithRetry({
        attempt: flakeyAttempt({ flakes: 0, value: `f-${i}` }),
        sleep: noSleep(),
      })
    );
    const all = await Promise.all([stuck, ...fast]);
    expect(all[0].ok).toBe(false);
    expect(all[0].error.code).toBe("storage/retry-limit-exceeded");
    for (let i = 1; i < all.length; i++) expect(all[i].ok).toBe(true);
  });
});

// ---------- backoff timing ----------

describe("backoff timing", () => {
  it("default delay sequence: 2 sleeps, both bounded by exponential+jitter", async () => {
    const attempt = flakeyAttempt({ flakes: 2, value: "ok" });
    const sleeps = [];
    const sleep = vi.fn(async (ms) => {
      sleeps.push(ms);
    });
    const r = await uploadWithRetry({ attempt, sleep });
    expect(r.ok).toBe(true);
    expect(sleeps).toHaveLength(2);
    // 2^1*1000 + [0..1000) = [2000, 3000)
    expect(sleeps[0]).toBeGreaterThanOrEqual(2000);
    expect(sleeps[0]).toBeLessThan(3000);
    // 2^2*1000 + [0..1000) = [4000, 5000)
    expect(sleeps[1]).toBeGreaterThanOrEqual(4000);
    expect(sleeps[1]).toBeLessThan(5000);
  });

  it("worst-case wall clock for one stuck file (PER_FILE_RETRIES=3) stays under ~8s helper-side", async () => {
    // Helper-side budget is just sleep time between attempts. The SDK's own
    // 10-minute retry window happens *inside* each attempt and is mocked here.
    // 2 sleeps, max ~3s + ~5s = ~8s.
    const attempt = flakeyAttempt({ flakes: 99, value: "x" });
    const sleeps = [];
    await uploadWithRetry({
      attempt,
      maxAttempts: 3,
      sleep: vi.fn(async (ms) => sleeps.push(ms)),
    });
    const total = sleeps.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(8000);
  });

  it("custom delay function is honored (e.g. linear backoff)", async () => {
    const attempt = flakeyAttempt({ flakes: 4, value: "ok" });
    const sleeps = [];
    const linear = (n) => n * 100;
    await uploadWithRetry({
      attempt,
      maxAttempts: 5,
      delay: linear,
      sleep: vi.fn(async (ms) => sleeps.push(ms)),
    });
    expect(sleeps).toEqual([100, 200, 300, 400]);
  });
});

// ---------- realistic batch scenarios ----------

describe("realistic batch scenarios", () => {
  it("150 mixed files: some succeed first try, some retry, some fail-fast on auth", async () => {
    // Distribution modeled on the user's reported batch:
    //  - 60%: success on first try
    //  - 30%: 1-2 transient flakes then success
    //  - 5%:  permanent transient (all 3 attempts fail) — the original bug
    //  - 5%:  non-transient (e.g. auth blip)
    const rand = rng(0x1234abcd);
    const tasks = Array.from({ length: 150 }, () => {
      const r = rand();
      if (r < 0.60) return flakeyAttempt({ flakes: 0 });
      if (r < 0.90) return flakeyAttempt({ flakes: rand() < 0.5 ? 1 : 2 });
      if (r < 0.95) return flakeyAttempt({ flakes: 99 }); // permanent transient
      return vi.fn(async () => ({
        ok: false,
        error: { code: "storage/unauthorized" },
      }));
    });
    const results = await Promise.all(
      tasks.map((attempt) => uploadWithRetry({ attempt, sleep: noSleep() }))
    );
    const ok = results.filter((r) => r.ok).length;
    const stuckTransient = results.filter(
      (r) => !r.ok && r.error?.code === "storage/retry-limit-exceeded"
    ).length;
    const auth = results.filter(
      (r) => !r.ok && r.error?.code === "storage/unauthorized"
    ).length;
    expect(ok + stuckTransient + auth).toBe(150);
    // The whole batch always settles. Most succeed; the rest report a clear,
    // categorized error rather than a generic retry-limit failure.
    expect(ok).toBeGreaterThan(120);
    // Auth failures used 1 attempt only — never spent retries on something
    // that won't recover.
    for (const r of results.filter((x) => !x.ok && x.error?.code === "storage/unauthorized")) {
      expect(r.attemptsUsed).toBe(1);
    }
  });

  it("a single file that recovers on the very last attempt still succeeds", async () => {
    const attempt = flakeyAttempt({ flakes: 2, value: "last-chance" });
    const r = await uploadWithRetry({ attempt, maxAttempts: 3, sleep: noSleep() });
    expect(r.ok).toBe(true);
    expect(r.value).toBe("last-chance");
    expect(r.attemptsUsed).toBe(3);
  });

  it("transient flake followed by non-transient error fails on the non-transient code", async () => {
    let n = 0;
    const attempt = vi.fn(async () => {
      n++;
      if (n === 1) return { ok: false, error: { code: "storage/retry-limit-exceeded" } };
      return { ok: false, error: { code: "storage/unauthorized" } };
    });
    const r = await uploadWithRetry({ attempt, sleep: noSleep() });
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe("storage/unauthorized");
    expect(r.attemptsUsed).toBe(2);
  });
});

// ---------- AdminUpload structural / config integration ----------

describe("AdminUpload config (structural)", () => {
  it("MAX_SIZE is 100MB, CONCURRENCY=3, PER_FILE_RETRIES=3", async () => {
    // We read the source rather than executing the React module so this test
    // doesn't pull in Firebase. If someone bumps the constants the test
    // updates with the change — that's intentional documentation.
    // happy-dom resolves `import.meta.url` to an http URL, so resolve relative
    // to cwd (vitest runs from the package root) instead.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.resolve(process.cwd(), "src/pages/AdminUpload.jsx"),
      "utf8"
    );
    expect(src).toMatch(/MAX_SIZE\s*=\s*100\s*\*\s*1024\s*\*\s*1024/);
    expect(src).toMatch(/CONCURRENCY\s*=\s*3\b/);
    expect(src).toMatch(/PER_FILE_RETRIES\s*=\s*3\b/);
    // SDK retry windows are raised above the 2-minute default.
    expect(src).toMatch(/maxUploadRetryTime\s*=\s*10\s*\*\s*60\s*\*\s*1000/);
    expect(src).toMatch(/maxOperationRetryTime\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
    // The retry helper is wired in (not duplicated inline).
    expect(src).toMatch(/from\s+["']\.\.\/lib\/uploadWithRetry["']/);
    expect(src).toMatch(/uploadWithRetry\s*\(/);
  });
});
