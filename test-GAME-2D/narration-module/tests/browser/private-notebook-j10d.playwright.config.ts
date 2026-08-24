import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "private-notebook-j10d.spec.ts",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4189",
    browserName: "chromium",
    channel: "chrome",
    headless: true
  },
  webServer: {
    command: "npm run dev:ui -- --host 127.0.0.1 --port 4189",
    url: "http://127.0.0.1:4189",
    reuseExistingServer: false,
    timeout: 120_000
  }
});
