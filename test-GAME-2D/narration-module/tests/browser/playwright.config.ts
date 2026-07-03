import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "indexeddb.spec.ts",
  workers: 1,
  fullyParallel: false,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    channel: "chrome",
    headless: true
  },
  webServer: {
    command: "npm run dev:ui -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000
  }
});
