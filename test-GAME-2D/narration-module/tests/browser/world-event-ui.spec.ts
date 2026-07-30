import { expect, test } from "@playwright/test";

test("un signal monde committé est raconté sans ses données privées et une seule fois", async ({ page }) => {
  await page.goto("/narration-module/tests/browser/world-event-ui.html");

  const signal = page.getByText(/Un bruit inhabituel se fait nettement entendre dans les environs/iu);
  await expect(signal).toHaveCount(1);
  await expect(page.getByRole("log")).not.toContainText("private-faction");
  await expect(page.getByRole("log")).not.toContainText("private-action");
  await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.reload();

  await expect(signal).toHaveCount(1);
  await expect(page.getByRole("log")).not.toContainText("private-faction");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
