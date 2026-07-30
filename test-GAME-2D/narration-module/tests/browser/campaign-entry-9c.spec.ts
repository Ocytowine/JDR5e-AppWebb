import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const character = JSON.parse(readFileSync(resolve(
  "narration-module/tests/fixtures/character/valid/creator-ready.json"
), "utf8"));

test("9C crée puis reprend une campagne depuis la fiche active", async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => {
    pageErrors.push(error.stack ?? error.message);
  });
  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
  }, {
    id: "sheet-aryn-9c",
    name: "Aryn prête à jouer",
    updatedAt: "2026-07-30T10:00:00.000Z",
    character
  });
  await page.goto("/");

  await expect(page.getByRole("heading", {
    name: "Où souhaites-tu reprendre l’aventure ?"
  })).toBeVisible();
  await expect(page.getByText("Aryn prête à jouer")).toBeVisible();
  await page.getByRole("button", { name: "Créer", exact: true }).click();

  await expect(page.getByRole("log")).toContainText(
    "Archives de Lysenthe",
    { timeout: 30_000 }
  );
  await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled();
  await page.getByRole("button", { name: "Campagnes" }).click();
  await expect(page.getByRole("button", {
    name: "Reprendre",
    exact: true
  })).toBeVisible();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(page.getByRole("log")).toContainText(
    "Archives de Lysenthe",
    { timeout: 30_000 }
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("9C refuse une fiche invalide avant création et garde le pilote explicite", async ({
  page
}) => {
  const invalidCharacter = structuredClone(character);
  invalidCharacter.raceId = "race-absente-du-paquet";
  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
  }, {
    id: "sheet-invalid-9c",
    name: "Fiche invalide",
    updatedAt: "2026-07-30T11:00:00.000Z",
    character: invalidCharacter
  });
  await page.goto("/");

  await expect(page.getByText(/CHARACTER_RACE_UNKNOWN/)).toBeVisible();
  await expect(page.getByRole("button", {
    name: "Créer",
    exact: true
  })).toBeDisabled();
  await page.getByRole("button", { name: "Ouvrir le pilote" }).click();
  await expect(page.getByRole("log")).toContainText(
    "Archives de Lysenthe",
    { timeout: 30_000 }
  );
});

test("l'accueil sans fiche ouvre directement le créateur puis permet le retour", async ({
  page
}) => {
  await page.addInitScript(() => {
    localStorage.removeItem("jdr5e_active_sheet");
    localStorage.removeItem("jdr5e_saved_sheets");
  });
  await page.goto("/");

  await page.getByRole("button", {
    name: "Créer ou sélectionner une fiche"
  }).click();

  await expect(page.getByRole("button", { name: "Espece" })).toBeVisible();
  await expect(page.getByText("Fiches sauvegardees")).toBeVisible();
  await page.getByRole("button", { name: "Retour aux campagnes" }).click();
  await expect(page.getByRole("heading", {
    name: "Où souhaites-tu reprendre l’aventure ?"
  })).toBeVisible();
});
