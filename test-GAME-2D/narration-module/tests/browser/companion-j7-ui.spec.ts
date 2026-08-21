import { expect, test } from "@playwright/test";

test("J7 traite une demande libre au compagnon et restaure sa décision", async ({ page }) => {
  await page.goto("/narration-module/tests/browser/companion-j7-ui.html");
  const input = page.getByLabel("Entrée libre du joueur");
  const send = page.getByRole("button", { name: "Envoyer" });
  const log = page.getByRole("log");

  await expect(input).toBeEnabled();
  await input.fill("Marel, pourrais-tu comparer ces deux registres avec moi ?");
  await send.click();
  await expect(log).toContainText("Marel acquiesce et se prépare à t'aider");
  await expect(log).not.toContainText("ACCEPTED");
  await expect(log).not.toContainText("NOT_STARTED");

  await input.fill("Marel, va seul face au danger pour faire diversion.");
  await send.click();
  await expect(log).toContainText("Marel refuse, sans détour");
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.reload();
  await expect(input).toBeEnabled();
  await expect(log).toContainText("Marel acquiesce et se prépare à t'aider");
  await expect(log).toContainText("Marel refuse, sans détour");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
