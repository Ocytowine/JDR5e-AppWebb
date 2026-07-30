import { expect, test } from "@playwright/test";

test("une progression validée est restaurée sans duplication ni donnée technique", async ({ page }) => {
  await page.goto("/narration-module/tests/browser/character-progression-ui.html");

  const narration = page.getByText(
    /L'expérience d'Aryn porte ses fruits.*guerrier de niveau 2.*Fougue/iu
  );
  await expect(narration).toHaveCount(1);
  await expect(page.getByRole("log")).not.toContainText("pc-aryn");
  await expect(page.getByRole("log")).not.toContainText("action-surge");
  await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.reload();

  await expect(narration).toHaveCount(1);
  await expect(page.getByRole("log")).not.toContainText("pc-aryn");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
