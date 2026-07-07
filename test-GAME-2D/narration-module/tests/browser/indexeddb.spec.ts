import { expect, test } from "@playwright/test";

test("campaign-core, bootstrap and temporal contracts pass against real Chromium IndexedDB", async ({ page }) => {
  page.on("console", message => console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on("pageerror", error => console.error(`[browser:error] ${error.stack ?? error.message}`));
  await page.goto("/narration-module/tests/browser/indexeddb.html");
  const result = await page.evaluate(() => window.indexedDbContractRun);
  const failures = [...result.contracts.failures, ...result.bootstrap.failures, ...result.temporal.failures, ...result.specific.failures];
  expect(failures, failures.map(failure => `${failure.name}\n${failure.message}`).join("\n\n")).toEqual([]);
  expect(result.contracts.passed).toBe(20);
  expect(result.bootstrap.passed).toBe(7);
  expect(result.temporal.passed).toBe(6);
  expect(result.specific.passed).toBe(16);
});
