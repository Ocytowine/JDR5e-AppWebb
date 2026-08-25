import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const character = JSON.parse(readFileSync(resolve(
  "narration-module/tests/fixtures/character/valid/creator-ready.json"
), "utf8"));
const notebookCanary = "NOTE-PRIVEE-J10F-NE-DOIT-PAS-REJOINDRE-LE-RECIT";

test("J10-F certifie le parcours immersif réel sans contrôle omniscient", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.stack ?? error.message));
  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    if (sessionStorage.getItem("j10f-browser-reset") !== "done") {
      indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
      indexedDB.deleteDatabase("jdr5e-player-private-notebook-v1");
      sessionStorage.setItem("j10f-browser-reset", "done");
    }
  }, {
    id: "sheet-j10f-browser",
    name: "Aryn — certification J10-F",
    updatedAt: "2026-08-25T12:00:00.000Z",
    character
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  const log = page.getByRole("log");
  await expect(log).toContainText("Archives de Lysenthe", { timeout: 30_000 });
  await assertImmersiveDefault(page);

  const technicalOptions = page.getByRole("button", { name: "Options techniques" });
  await technicalOptions.focus();
  await page.keyboard.press("Enter");
  await expect(technicalOptions).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("region", { name: "Interprétation narrative" })).toBeVisible();
  await expect(page.locator("[data-narrative-ux-badge]").first()).toBeVisible();
  await technicalOptions.click();
  await expect(page.getByRole("region", { name: "Interprétation narrative" })).toHaveCount(0);
  await expect(page.locator("[data-narrative-ux-badge]")).toHaveCount(0);

  await page.getByRole("button", { name: "Mon carnet" }).click();
  await page.getByRole("button", { name: "+ Intercalaire" }).click();
  await page.getByLabel("Titre de l’intercalaire").fill("Pistes en cours");
  await page.getByLabel("Titre de l’intercalaire").blur();
  await page.getByLabel("Notes privées").fill(notebookCanary);
  await expect(page.getByText("Notes enregistrées.")).toBeVisible();

  await page.getByText("Reprendre le fil").click();
  await expect(page.getByRole("heading", { name: "Inventaire personnel" })).toBeVisible();
  await expect(page.getByText("Aide-mémoire en lecture seule.")).toBeVisible();
  await expect(page.getByText("Reprendre le fil").locator("xpath=.." )).not.toContainText(notebookCanary);

  await submit(page, "Clerc, veux-tu rejoindre mon groupe ?");
  await expect(log).toContainText(/refus|décline|ne (?:peux|peut|souhaite)/iu);
  await submit(page, "Archiviste, veux-tu rejoindre mon groupe ?");
  await submit(page, "Archiviste, va seul affronter ce danger.");
  await expect(log).toContainText(/refuse/iu);
  await submit(page, "Archiviste, reste ici pendant que je poursuis.");
  await expect(log).toContainText(/reste ici/iu);
  await submit(page, "Archiviste, reviens avec moi.");
  await expect(log).toContainText(/revient/iu);

  await page.getByRole("button", { name: "Actualiser le résumé" }).click();
  await expect(page.getByRole("heading", { name: "Compagnons" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Compagnons" })
    .locator("xpath=..")
    .getByText(/1.*à tes côtés/iu)).toBeVisible();

  await submit(page, "Nous partons vers les Halles des commerces.");
  await expect(log).toContainText(/prenez la route/iu);
  await submit(page, "Nous reprenons la route vers les Halles.");
  await expect(log).toContainText(/cortège compact/iu);
  await expect(page.getByText("Monde", { exact: true })).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(log).toContainText(/cortège compact/iu, { timeout: 30_000 });
  await page.getByRole("button", { name: "Mon carnet" }).click();
  await expect(page.getByRole("tab", { name: "Pistes en cours" })).toBeVisible();
  await expect(page.getByLabel("Notes privées")).toHaveValue(notebookCanary);
  await page.getByRole("button", { name: "Mon carnet" }).click();

  await submit(page, "Nous reprenons la route vers les Halles en contournant le cortège.");
  await expect(log).toContainText(/route redevient praticable/iu);
  await submit(page, "Nous poursuivons la route jusqu'aux Halles.");
  await expect(log).toContainText(/atteignez les Halles/iu);
  await page.getByText("Reprendre le fil").click();
  await expect(page.getByText(/se trouve à Halles des Commerces/iu)).toBeVisible();

  await assertImmersiveDefault(page);
  await expect(log).not.toContainText(notebookCanary);
  for (const rawInput of [
    "Clerc, veux-tu rejoindre mon groupe ?",
    "Archiviste, veux-tu rejoindre mon groupe ?",
    "Nous partons vers les Halles des commerces.",
    "Nous reprenons la route vers les Halles."
  ]) {
    await expect(log.locator('[data-narrative-block-kind="RAW_INPUT"]', { hasText: rawInput })).toHaveCount(1);
  }
  expect(pageErrors).toEqual([]);
});

async function submit(page: Page, rawInput: string): Promise<void> {
  const input = page.getByLabel("Entrée libre du joueur");
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill(rawInput);
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("log").locator('[data-narrative-block-kind="RAW_INPUT"]', { hasText: rawInput })).toHaveCount(1, { timeout: 30_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
}

async function assertImmersiveDefault(page: Page): Promise<void> {
  const body = page.locator("body");
  await expect(body).not.toContainText("Trace système et mémoire");
  await expect(body).not.toContainText("Diagnostic du tour:");
  await expect(body).not.toContainText("Diagnostic sûr :");
  await expect(body).not.toContainText("Indicateurs UX:");
  await expect(body).not.toContainText("Progression en attente");
  await expect(page.getByRole("region", { name: "Interprétation narrative" })).toHaveCount(0);
  await expect(page.getByText("Monde", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^Tactique/u)).toHaveCount(0);
}
