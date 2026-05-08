import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: false,
    include: ["src/**/*.test.{js,jsx}"],
    // Don't run E2E specs (those use @playwright/test, not vitest)
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
