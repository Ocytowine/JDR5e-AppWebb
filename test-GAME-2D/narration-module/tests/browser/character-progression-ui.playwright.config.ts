import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "character-progression-ui.spec.ts",
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4184",
    browserName: "chromium",
    channel: "chrome",
    headless: true
  },
  webServer: {
    command: "npm run dev:ui -- --host 127.0.0.1 --port 4184",
    url: "http://127.0.0.1:4184",
    reuseExistingServer: false,
    timeout: 120_000
  }
});
