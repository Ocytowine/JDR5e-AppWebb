import { expect, test } from "@playwright/test";

test("une initiative PNJ reste idempotente après promotion d'un acteur et rechargement", async ({ page }) => {
  await page.goto("/narration-module/tests/browser/social-initiative-ui.html");

  const initiative = page.getByText(
    /adresse un signe d'avertissement à la serveuse/iu
  );
  await expect(initiative).toHaveCount(1);
  await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.evaluate(() => {
    window.sessionStorage.setItem("social-initiative-promoted-actor", "1");
  });

  await page.reload();

  await expect(initiative).toHaveCount(1);
  await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
