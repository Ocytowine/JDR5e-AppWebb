import { expect, test } from "@playwright/test";

test("repos segmenté restauré après rechargement", async ({ page }) => {
  await page.goto("/narration-module/tests/browser/rest-ui.html");
  const input = page.getByLabel("Entrée libre du joueur");
  await expect(input).toBeEnabled();
  await input.fill("Je commence un repos long.");
  await page.getByRole("button", { name: "Envoyer" }).click();

  const restPanel = page.getByLabel("Repos en cours");
  await expect(restPanel).toContainText("0 h sur 8 h");
  await page.getByRole("button", { name: "Continuer le repos d’un segment" }).click();
  await expect(restPanel).toContainText("1 h sur 8 h");
  await expect(page.getByRole("log")).toContainText("Une heure s’écoule");
  const autonomousInitiative = page.getByText(
    /adresse un signe d'avertissement à la serveuse/iu
  );
  await expect(autonomousInitiative).toHaveCount(1);

  await page.reload();
  await expect(page.getByLabel("Repos en cours")).toContainText("1 h sur 8 h");
  await expect(autonomousInitiative).toHaveCount(1);
  await page.getByRole("button", { name: "Continuer le repos d’un segment" }).click();
  await expect(page.getByLabel("Repos en cours")).toContainText("2 h sur 8 h");
  await expect(autonomousInitiative).toHaveCount(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("interruption committée ferme le repos sans bénéfice", async ({ page }) => {
  await page.goto("/narration-module/tests/browser/rest-ui.html?danger=100");
  const input = page.getByLabel("Entrée libre du joueur");
  await input.fill("Je commence un repos long.");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await page.getByRole("button", { name: "Continuer le repos d’un segment" }).click();
  await expect(page.getByLabel("Repos en cours")).toContainText("1 h sur 8 h");
  await page.getByRole("button", { name: "Continuer le repos d’un segment" }).click();
  await expect(page.getByLabel("Repos en cours")).toHaveCount(0);
  await expect(page.getByRole("log")).toContainText("Un bruit soudain brise le calme");
  await expect(page.getByRole("log")).toContainText("Aucun bénéfice non validé n’est accordé");

  await page.reload();
  await expect(page.getByLabel("Repos en cours")).toHaveCount(0);
  await expect(page.getByRole("log")).toContainText("Un bruit soudain brise le calme");
});

test("repos achevé attend encore les autorités de bénéfices", async ({ page }) => {
  await page.goto("/narration-module/tests/browser/rest-ui.html");
  const input = page.getByLabel("Entrée libre du joueur");
  await input.fill("Je commence un repos long.");
  await page.getByRole("button", { name: "Envoyer" }).click();
  for (let segment = 0; segment < 8; segment += 1) {
    await page.getByRole("button", { name: "Continuer le repos d’un segment" }).click();
  }
  await expect(page.getByLabel("Repos en cours")).toHaveCount(0);
  await expect(page.getByRole("log")).toContainText("Les bénéfices restent en attente");
  await expect(page.getByRole("log")).not.toContainText("bénéfices accordés");

  await page.reload();
  await expect(page.getByLabel("Repos en cours")).toHaveCount(0);
  await expect(page.getByRole("log")).toContainText("Les bénéfices restent en attente");
});
