import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "j9c-browser.spec.ts",
  workers: 1,
  timeout: 180_000,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4207",
    browserName: "chromium",
    channel: "chrome",
    headless: true
  },
  webServer: {
    command: "npm run dev:ui -- --host 127.0.0.1 --port 4207",
    url: "http://127.0.0.1:4207",
    reuseExistingServer: false,
    timeout: 120_000
  }
});
