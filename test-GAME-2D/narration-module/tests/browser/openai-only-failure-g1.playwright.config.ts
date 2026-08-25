import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "openai-only-failure-g1.spec.ts",
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4191",
    browserName: "chromium",
    channel: "chrome",
    headless: true
  },
  webServer: {
    command: "npm run dev:ui -- --host 127.0.0.1 --port 4191",
    url: "http://127.0.0.1:4191",
    reuseExistingServer: false,
    timeout: 120_000
  }
});
