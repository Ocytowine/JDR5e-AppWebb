import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "player-campaign-recap-j10e.spec.ts",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:4190", browserName: "chromium", channel: "chrome", headless: true },
  webServer: { command: "npm run dev:ui -- --host 127.0.0.1 --port 4190", url: "http://127.0.0.1:4190", reuseExistingServer: false, timeout: 120_000 }
});
