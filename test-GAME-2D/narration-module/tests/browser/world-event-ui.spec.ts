import { expect, test } from "@playwright/test";

test("une avance réelle du monde est racontée sans ses données privées et une seule fois", async ({ page }) => {
  await page.goto("/narration-module/tests/browser/world-event-ui.html");

  const advanceWorld = page.getByRole("button", {
    name: "Faire avancer le monde d’une heure"
  });
  const signal = page.getByText(
    /Des signes d'activité religieuse deviennent distinctement perceptibles dans les environs/iu
  );
  await expect(advanceWorld).toBeEnabled();
  await expect(signal).toHaveCount(0);

  await advanceWorld.click();

  await expect(signal).toHaveCount(1);
  await expect(page.getByRole("log")).not.toContainText("faction-faith");
  await expect(page.getByRole("log")).not.toContainText("sanctify_site");
  await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.reload();

  await expect(signal).toHaveCount(1);
  await expect(advanceWorld).toBeEnabled();
  await advanceWorld.click();
  await expect(signal).toHaveCount(1);
  await expect(page.getByRole("log")).not.toContainText("faction-faith");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
