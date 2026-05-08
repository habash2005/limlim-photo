// Smoke tests for the public-facing routes.
// Verifies each page renders without console errors and key copy is visible.
import { test, expect } from "@playwright/test";

// Capture browser console errors per test. Some are expected/benign (Firebase
// App Check warnings on debug-token mode, Web font preload warnings) — we
// filter those out and fail only on real exceptions.
const BENIGN_PATTERNS = [
  /App Check/i,
  /Helmet/i,
  /Download the React DevTools/i,
  /React Router Future Flag/i,
  /react-router/i,
  /SES Removing/i,
  /lockdown/i,
  /preconnect/i,
  /preload/i,
  /Failed to load resource.*firebaseappcheck/i,
  /firebase\/app-check/i,
];

function watchConsole(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push({ kind: "pageerror", text: String(e) }));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (BENIGN_PATTERNS.some((p) => p.test(text))) return;
    errors.push({ kind: "console.error", text });
  });
  return errors;
}

test.describe("Public routes", () => {
  test("home page renders hero + CTAs", async ({ page }) => {
    const errors = watchConsole(page);
    // Don't wait for networkidle — Firebase keeps long-poll/WebSocket connections
    // open so the page never reaches a fully-idle network state.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Brand wordmark visible in the nav
    await expect(page.getByRole("link", { name: /Lama Wafa/i }).first()).toBeVisible();

    // Hero CTA visible (the home page has multiple "Book Your Session" CTAs;
    // we just need to confirm at least one renders)
    await expect(page.getByRole("link", { name: /Book Your Session/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /View Portfolio/i }).first()).toBeVisible();

    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
  });

  test("portfolio route loads", async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto("/portfolio");
    await expect(page.getByRole("heading", { name: /Portfolio/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
  });

  test("booking page renders services with 'Starts at' pricing", async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto("/booking", { waitUntil: "domcontentloaded" });

    // Page hero heading
    await expect(page.getByRole("heading", { name: /Book Your Session/i })).toBeVisible({
      timeout: 10_000,
    });

    // The "Starts at $X" prices we wired into each service card
    await expect(page.getByText(/Starts at/i).first()).toBeVisible();
    await expect(page.getByText(/\$300/).first()).toBeVisible(); // Events
    await expect(page.getByText(/\$120/).first()).toBeVisible(); // Portraits
    await expect(page.getByText(/\$130/).first()).toBeVisible(); // Couples

    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
  });

  test("FAQ accordion renders", async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto("/faq");
    await expect(page.getByRole("heading", { name: /Frequently Asked Questions/i })).toBeVisible({
      timeout: 10_000,
    });
    // First FAQ question
    await expect(page.getByText(/wear for my session/i)).toBeVisible();
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
  });

  test("admin login page is reachable at /admin-login", async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto("/admin-login");
    await expect(page.getByRole("heading", { name: /Admin Login/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
  });

  test("admin link is NOT in the public nav", async ({ page }) => {
    await page.goto("/");
    // Scope to the <nav> element — Footer also contains Portfolio/Book/etc
    // links, which would trigger strict-mode violations on a page-wide query.
    const nav = page.locator("nav").first();
    await expect(nav.getByRole("link", { name: /^Portfolio$/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^Book$/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^Client Portal$/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^FAQ$/ })).toBeVisible();
    // Admin link should NOT appear anywhere in the public nav
    await expect(nav.getByRole("link", { name: /^Admin$/ })).toHaveCount(0);
  });

  test("logo image loads (200) and is referenced from Nav", async ({ page }) => {
    const requests = [];
    page.on("response", (res) => {
      if (res.url().endsWith("/lama-logo.png")) {
        requests.push({ url: res.url(), status: res.status() });
      }
    });
    await page.goto("/");
    // Logo present in DOM
    const navLogo = page.locator("nav img[alt='Lama Wafa']").first();
    await expect(navLogo).toBeVisible();
    // The browser fetched it successfully
    expect(requests.length).toBeGreaterThan(0);
    expect(requests[0].status).toBe(200);
  });

  test("favicon link points at the logo", async ({ page }) => {
    await page.goto("/");
    const faviconHref = await page
      .locator('link[rel="icon"]')
      .getAttribute("href");
    expect(faviconHref).toContain("lama-logo");
  });

  test("client portal route renders without errors (no booking ref)", async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto("/portal");
    // The heading or copy specific to the portal landing
    await expect(
      page.getByRole("heading", { name: /Client Portal|Welcome|Enter your reference/i }).first()
    ).toBeVisible({ timeout: 10_000 });
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
  });
});
