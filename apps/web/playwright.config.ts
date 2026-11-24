import { defineConfig, devices } from "@playwright/test";

// Contra `next start` (build de producción), como recomienda la guía de Next:
// el dev server compila cada ruta en la primera visita y alarga los timeouts.
export default defineConfig({
  testDir: "e2e",
  // Las pruebas comparten la base de datos sembrada: una detrás de otra.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    locale: "es-ES",
    screenshot: "on",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    serviceWorkers: "block",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
  },
});
