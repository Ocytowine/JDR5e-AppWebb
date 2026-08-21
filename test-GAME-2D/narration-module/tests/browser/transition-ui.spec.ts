import { expect, test } from "@playwright/test";

test("transition locale jouée depuis la surface narration", async ({ page }) => {
  await page.goto("/narration-module/tests/browser/transition-ui.html");
  const input = page.getByLabel("Entrée libre du joueur");
  const send = page.getByRole("button", { name: "Envoyer" });

  await expect(input).toBeEnabled();
  const originalWelcome = page
    .getByRole("log")
    .getByText(/Tu te trouves à Auberge du Seuil/);
  await expect(originalWelcome).toHaveCount(1);
  await input.fill("Je franchis la porte du fond et entre dans l'arrière-salle.");
  await send.click();
  await expect(page.getByRole("log")).toContainText("Arrière-salle de l'Auberge du Seuil");
  await expect(originalWelcome).toHaveCount(1);

  await input.fill("Que vois-je ici ?");
  await send.click();
  await expect(page.getByRole("log")).toContainText("lampe basse");

  await input.fill("Je m'approche de la lampe basse.");
  await send.click();
  await expect(page.getByRole("log")).toContainText("Action locale enregistrée");

  await input.fill("J'examine les traces humides.");
  await send.click();
  await expect(page.getByRole("log")).toContainText("plusieurs marques irrégulières");
  await expect(page.getByRole("log")).not.toContainText("L'origine exacte des traces n'est pas directement perceptible.");

  await input.fill("Je repasse par la porte vers la salle commune.");
  await send.click();
  await expect(page.getByRole("log")).toContainText("tu arrives à Auberge du Seuil");
  await expect(page.getByRole("log")).toContainText("Destination=location:inn-common-room");
  await expect(page.getByRole("alert")).toHaveCount(0);

  const returnArrival = page.getByRole("log").getByText(/tu arrives à Auberge du Seuil/);
  await expect(returnArrival).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled();
  await expect(returnArrival).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
