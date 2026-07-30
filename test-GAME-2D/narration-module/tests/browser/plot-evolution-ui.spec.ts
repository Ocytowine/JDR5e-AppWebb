import { expect, test } from "@playwright/test";

test("une évolution cachée ne révèle que son signe perceptible et ne se duplique pas", async ({ page }) => {
  await page.goto("/narration-module/tests/browser/plot-evolution-ui.html");

  const visibleSign = page.getByText(/étagère porte la marque claire d'un volume récemment retiré/iu);
  await expect(visibleSign).toHaveCount(1);
  await expect(page.getByRole("log")).not.toContainText("caché le registre");
  await expect(page.getByRole("log")).not.toContainText("sous l'escalier de la cave");
  await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.reload();

  await expect(visibleSign).toHaveCount(1);
  await expect(page.getByRole("log")).not.toContainText("caché le registre");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
