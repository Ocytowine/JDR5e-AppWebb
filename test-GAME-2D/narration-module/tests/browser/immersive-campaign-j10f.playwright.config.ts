import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "immersive-campaign-j10f.spec.ts",
  timeout: 180_000,
  expect: { timeout: 15_000 },
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
