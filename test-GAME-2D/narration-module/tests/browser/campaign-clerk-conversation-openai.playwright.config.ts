import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "campaign-clerk-conversation-openai.spec.ts",
  workers: 1,
  reporter: "line",
  timeout: 420_000,
  use: {
    baseURL: "http://127.0.0.1:4195",
    browserName: "chromium",
    channel: "chrome",
    headless: true
  },
  webServer: [{
    command: "npm run dev:api",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: true,
    timeout: 120_000
  }, {
    command: "npm run dev:ui -- --host 127.0.0.1 --port 4195",
    url: "http://127.0.0.1:4195",
    reuseExistingServer: false,
    timeout: 120_000
  }]
});
