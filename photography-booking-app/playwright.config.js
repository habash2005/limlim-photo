// Playwright config — smoke E2E tests against a Vite preview build.
// Vitest specs (src/**/*.test.{js,jsx}) are excluded; only e2e/ runs here.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Run sequentially so the dev server isn't fighting concurrent requests
  fullyParallel: false,
  workers: 1,
  // No retries locally — flaky tests should be fixed, not papered over
  retries: 0,
  reporter: [["list"]],
  // Auto-start the Vite preview server (production build) on a fixed port
  // and tear it down after the suite finishes.
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
