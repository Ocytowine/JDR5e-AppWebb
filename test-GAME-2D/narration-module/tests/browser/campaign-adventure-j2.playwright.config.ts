import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "campaign-adventure-j2.spec.ts",
  workers: 1,
  timeout: 120_000,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4198",
    browserName: "chromium",
    channel: "chrome",
    headless: true
  },
  webServer: {
    command: "npm run dev:ui -- --host 127.0.0.1 --port 4198",
    url: "http://127.0.0.1:4198",
    reuseExistingServer: false,
    timeout: 120_000
  }
});
