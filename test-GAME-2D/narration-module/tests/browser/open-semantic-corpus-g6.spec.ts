import { expect, test } from "@playwright/test";

test("le corpus V8 simulé traverse le contrôleur dans Chromium sans mutation", async ({ page }) => {
  await page.goto("/narration-module/tests/browser/open-semantic-corpus-g6.html");
  await expect(page.locator('[data-status="FAIL"]')).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("5/5 cas certifiés");
  await expect(page.getByTestId("g6-travel-typos")).toContainText("HANDOFF_ONLY");
  await expect(page.getByTestId("g6-conditional-inventory")).toContainText("AWAITING_CONDITION");
  await expect(page.getByTestId("g6-change-of-mind")).toContainText("SKIPPED_SUPERSEDED,ROUTABLE");
  await expect(page.getByTestId("g6-ambiguous-pronouns")).toContainText("NEEDS_CLARIFICATION");
});
