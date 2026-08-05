import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "campaign-access-lot-e.spec.ts",
  workers: 1,
  timeout: 120_000,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4194",
    browserName: "chromium",
    channel: "chrome",
    headless: true
  },
  webServer: {
    command: "npm run dev:ui -- --host 127.0.0.1 --port 4194",
    url: "http://127.0.0.1:4194",
    reuseExistingServer: false,
    timeout: 120_000
  }
});
