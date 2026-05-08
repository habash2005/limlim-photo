// Real end-to-end test: signs in as admin, uploads a 100MB file to the
// production Firebase bucket, and verifies the upload completes without
// hitting `storage/retry-limit-exceeded`.
//
// **GATED** behind RUN_REAL_UPLOAD=1 so a casual `npx playwright test` run
// doesn't burn bandwidth or pollute the bucket. Set ADMIN_EMAIL +
// ADMIN_PASSWORD in .env.local. The test prints the uploaded filename so
// you can delete it from /admin → Media tab afterward.
import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Load .env.local from the package root (Playwright's CWD when running this file).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const RUN = process.env.RUN_REAL_UPLOAD === "1";
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

test.describe("Real admin upload (gated)", () => {
  test.skip(!RUN, "RUN_REAL_UPLOAD!=1 — skipping real-network upload test");
  test.skip(
    !EMAIL || !PASSWORD,
    "ADMIN_EMAIL / ADMIN_PASSWORD missing from .env.local"
  );

  // 100MB upload over a home connection can take a while. Give it 8 min,
  // well under the SDK's 10-min retry window.
  test.setTimeout(8 * 60 * 1000);

  // --- helpers ---

  async function makeFile(sizeBytes, label) {
    // We need a file that *passes* the React `image/*` accept filter and the
    // server's content-type sniff, but Vite's preview + Firebase Storage
    // don't actually decode the image — they just store bytes. So a real
    // small JPEG header followed by random padding is enough.
    const filePath = path.join(
      os.tmpdir(),
      `lw-e2e-${label}-${Date.now()}.jpg`
    );
    // Minimal valid JPEG: SOI + APP0 (JFIF) + EOI. ~20 bytes.
    const jpegHeader = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    ]);
    const jpegFooter = Buffer.from([0xff, 0xd9]);
    const padding = Buffer.alloc(
      Math.max(0, sizeBytes - jpegHeader.length - jpegFooter.length),
      0x55
    );
    const fd = await fs.open(filePath, "w");
    try {
      await fd.write(jpegHeader);
      // Stream the padding in 4MB chunks so we don't hold a 100MB Buffer.
      const CHUNK = 4 * 1024 * 1024;
      const chunkBuf = Buffer.alloc(Math.min(CHUNK, padding.length), 0x55);
      let written = 0;
      while (written < padding.length) {
        const remaining = padding.length - written;
        const slice =
          remaining >= CHUNK ? chunkBuf : Buffer.alloc(remaining, 0x55);
        await fd.write(slice);
        written += slice.length;
      }
      await fd.write(jpegFooter);
    } finally {
      await fd.close();
    }
    return filePath;
  }

  async function signIn(page) {
    // Watch for unexpected page errors throughout
    const errors = [];
    page.on("pageerror", (e) =>
      errors.push({ kind: "pageerror", text: String(e) })
    );

    await page.goto("/admin-login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await Promise.all([
      page.waitForURL("**/admin", { timeout: 30_000 }),
      page.getByRole("button", { name: /Sign In/i }).click(),
    ]);
    expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
  }

  async function gotoUploadTab(page) {
    // The upload UI lives as a tab inside /admin (AdminDashboard).
    const uploadTab = page.getByRole("button", { name: /^Upload$/ });
    await uploadTab.click();
    // Wait for the upload tab's "Browse files" button to render
    await expect(page.getByRole("button", { name: /Browse files/i })).toBeVisible({
      timeout: 15_000,
    });
  }

  async function selectPortfolioMode(page) {
    // The destination radio defaults to "client" — switch to portfolio so we
    // don't need a client reference.
    await page.locator('input[type="radio"][value="portfolio"]').check();
  }

  async function attachFile(page, filePath) {
    // Hidden `<input type="file">` rendered with sr-only — Playwright can
    // still set its files even when not visible.
    await page.locator('input[type="file"]').setInputFiles(filePath);
  }

  async function clickUploadAndWait(page) {
    // The Upload button has dynamic title text, but it's the only button
    // that says "Upload" or "Uploading…" when active.
    const uploadBtn = page
      .getByRole("button", { name: /^Upload$/ })
      .nth(1); // 0 is the "Upload" tab; 1 is the action button
    // Track network for retry-limit hits
    const retryHits = [];
    page.on("response", (res) => {
      const u = res.url();
      const s = res.status();
      if (
        u.includes("firebasestorage.googleapis.com") &&
        s >= 400 &&
        s !== 401 // unauthenticated will surface differently
      ) {
        retryHits.push({ url: u, status: s });
      }
    });
    await uploadBtn.click();
    // The success path triggers an alert("Uploaded N file(s)…"). Capture it.
    const dialog = await page.waitForEvent("dialog", { timeout: 7 * 60 * 1000 });
    const message = dialog.message();
    await dialog.accept();
    return { message, retryHits };
  }

  // --- the actual test ---

  test("uploads a 100MB image to the portfolio without retry-limit errors", async ({
    page,
  }) => {
    const SIZE = 100 * 1024 * 1024;
    console.log(`[real-upload] generating ${SIZE / 1024 / 1024}MB test file…`);
    const filePath = await makeFile(SIZE, "100mb");
    const stat = await fs.stat(filePath);
    expect(stat.size).toBe(SIZE);
    console.log(`[real-upload] file: ${filePath}`);

    try {
      await signIn(page);
      await gotoUploadTab(page);
      await selectPortfolioMode(page);
      await attachFile(page, filePath);

      // Verify the queue picked it up + didn't reject for size (which would
      // happen if MAX_SIZE were still the old 25MB).
      await expect(page.getByText(/1 file selected/i)).toBeVisible();
      await expect(page.getByText(/files were skipped/i)).not.toBeVisible();

      console.log("[real-upload] kicking off upload…");
      const t0 = Date.now();
      const { message, retryHits } = await clickUploadAndWait(page);
      const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `[real-upload] alert after ${elapsedSec}s: ${JSON.stringify(message)}`
      );
      if (retryHits.length) {
        console.log(
          "[real-upload] non-2xx Firebase Storage responses observed:",
          retryHits
        );
      }

      expect(message, "expected upload-success alert").toMatch(/Uploaded 1 file/i);
      expect(message, "alert should not mention failures").not.toMatch(
        /failed/i
      );
      // The fix removes the retry-limit failure mode entirely.
      expect(
        retryHits.filter((h) => h.status === 503 || h.status === 504),
        "no transient 5xx that exhausted retries"
      ).toHaveLength(0);
    } finally {
      await fs.unlink(filePath).catch(() => {});
      console.log(
        `\n[real-upload] CLEANUP: a ~100MB image was uploaded to your portfolio. ` +
          `Open /admin → Media tab and delete the latest portfolio image to remove it.\n`
      );
    }
  });

  test("uploads 5×20MB files concurrently (CONCURRENCY=3) without errors", async ({
    page,
  }) => {
    // Skipped by default — run with RUN_BATCH_UPLOAD=1 to also exercise the
    // CONCURRENCY=3 batch path. This leaves 5 images in your portfolio bucket
    // that you'll need to delete from /admin → Media.
    test.skip(process.env.RUN_BATCH_UPLOAD !== "1", "RUN_BATCH_UPLOAD!=1");
    const N = 5;
    const SIZE = 20 * 1024 * 1024;
    const files = [];
    for (let i = 0; i < N; i++) {
      files.push(await makeFile(SIZE, `batch${i}`));
    }
    console.log(`[real-upload] generated ${N}x${SIZE / 1024 / 1024}MB files`);

    try {
      await signIn(page);
      await gotoUploadTab(page);
      await selectPortfolioMode(page);
      await page.locator('input[type="file"]').setInputFiles(files);

      await expect(page.getByText(new RegExp(`${N} files selected`, "i"))).toBeVisible();

      const t0 = Date.now();
      const { message, retryHits } = await clickUploadAndWait(page);
      const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `[real-upload] batch alert after ${elapsedSec}s: ${JSON.stringify(message)}`
      );
      if (retryHits.length) {
        console.log("[real-upload] non-2xx responses:", retryHits);
      }

      expect(message).toMatch(new RegExp(`Uploaded ${N} files?`, "i"));
      expect(message).not.toMatch(/failed/i);
    } finally {
      for (const f of files) await fs.unlink(f).catch(() => {});
      console.log(
        `\n[real-upload] CLEANUP: ${N} ~20MB images were uploaded to your portfolio. ` +
          `Open /admin → Media tab and delete the latest ${N} portfolio images.\n`
      );
    }
  });
});
