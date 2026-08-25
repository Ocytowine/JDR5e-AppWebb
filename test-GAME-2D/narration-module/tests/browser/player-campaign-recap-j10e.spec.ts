import { expect, test } from "@playwright/test";

test("J10-E présente un résumé repliable et un inventaire strictement consultatif", async ({ page }) => {
  await page.goto("/narration-module/tests/browser/player-campaign-recap-j10e.html");
  await expect(page.getByText("Épée")).not.toBeVisible();
  await page.getByText("Reprendre le fil").click();
  await expect(page.getByText("Elwen se trouve à Archives de Lysenthe.")).toBeVisible();
  await expect(page.getByText("Observé")).toBeVisible();
  await expect(page.getByText("Retrouver le registre disparu", { exact: false })).toBeVisible();
  await expect(page.getByText("Épée", { exact: false })).toBeVisible();
  await expect(page.getByText("Corde ×2", { exact: false })).toBeVisible();
  await expect(page.getByText("Aide-mémoire en lecture seule.")).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(1);
  await page.reload();
  await page.getByText("Reprendre le fil").click();
  await expect(page.getByText("Le sceau vient peut-être du port.", { exact: false })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("SECRET-");
});
