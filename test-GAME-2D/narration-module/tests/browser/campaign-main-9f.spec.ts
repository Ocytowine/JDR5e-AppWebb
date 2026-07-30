import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const character = JSON.parse(readFileSync(resolve(
  "narration-module/tests/fixtures/character/valid/creator-ready.json"
), "utf8"));

test("9F certifie entrée réelle, narration, monde committé et reprise", async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => {
    pageErrors.push(error.stack ?? error.message);
  });
  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    if (sessionStorage.getItem("campaign-9f-reset") !== "done") {
      indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
      sessionStorage.setItem("campaign-9f-reset", "done");
    }
  }, {
    id: "sheet-aryn-9f",
    name: "Aryn — certification 9F",
    updatedAt: "2026-07-30T14:00:00.000Z",
    character
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  const log = page.getByRole("log");
  await expect(log).toContainText("Archives de Lysenthe", {
    timeout: 30_000
  });

  const playerInput = page.getByLabel("Entrée libre du joueur");
  await playerInput.fill("J'observe calmement les personnes présentes.");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(log).toContainText(
    "J'observe calmement les personnes présentes.",
    { timeout: 30_000 }
  );
  await expect(playerInput).toBeEnabled({ timeout: 30_000 });

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(log).toContainText(
    "J'observe calmement les personnes présentes.",
    { timeout: 30_000 }
  );

  await page.getByRole("button", { name: "Monde" }).click();
  await page.getByRole("button", { name: "World simulation" }).click();
  await expect(page.getByText(
    "Simulation liée à la campagne : chaque avance est persistée."
  )).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "+1 h" }).click();
  await expect(page.getByText(
    /^J0 01h · cycle 0 · heure 1\/6 · tick 1$/u
  )).toBeVisible({
    timeout: 30_000
  });

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(log).toContainText("Archives de Lysenthe", {
    timeout: 30_000
  });
  await page.getByRole("button", { name: "Monde" }).click();
  await page.getByRole("button", { name: "World simulation" }).click();
  await expect(page.getByText(
    /^J0 01h · cycle 0 · heure 1\/6 · tick 1$/u
  )).toBeVisible({
    timeout: 30_000
  });

  await page.getByRole("button", { name: "Retour carte" }).click();
  await page.getByRole("button", { name: "Retour narration" }).click();
  await expect(log).toContainText(
    "J'observe calmement les personnes présentes.",
    { timeout: 30_000 }
  );

  const prepared = await page.evaluate(async () => {
    const modulePath =
      "/narration-module/tests/browser/campaign-main-9f-preparation.ts";
    const module = await import(/* @vite-ignore */ modulePath) as {
      prepareCampaignMain9fVerticals(): Promise<{
        routingStatus: string;
        incidentStatus: string | null;
      }>;
    };
    return module.prepareCampaignMain9fVerticals();
  });
  expect(prepared).toEqual({
    routingStatus: "TARGETED",
    incidentStatus: "HANDOFF_CREATED"
  });
  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(page.getByRole("region", {
    name: "Disponibilités de campagne"
  })).toContainText("Progression en attente — choix requis : CLASS", {
    timeout: 30_000
  });
  await expect(page.getByRole("region", {
    name: "Disponibilités de campagne"
  })).toContainText("Bastion — Maison forte des Archives");
  await expect(page.getByRole("region", {
    name: "Défense tactique en attente"
  })).toBeVisible();
  await expect(log).not.toContainText("certification-hidden-route");

  await page.getByRole("button", {
    name: "Ouvrir le plateau tactique"
  }).click();
  await expect(page.locator(
    '[data-tactical-ready="true"][data-tactical-process-id]'
  )).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator(
    '[data-tactical-ready="true"][data-tactical-checkpoint-id]'
  )).toHaveCount(1, { timeout: 30_000 });

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await page.getByRole("button", {
    name: /Tactique · défense en attente/
  }).click();
  await expect(page.locator(
    '[data-tactical-ready="true"][data-tactical-restored-checkpoint-id]'
  )).toHaveCount(1, { timeout: 30_000 });
  await page.evaluate(async () => {
    const modulePath =
      "/narration-module/tests/browser/campaign-main-9f-preparation.ts";
    const module = await import(/* @vite-ignore */ modulePath) as {
      prepareCampaignMain9fTerminalCheckpoint(): Promise<string>;
    };
    await module.prepareCampaignMain9fTerminalCheckpoint();
  });
  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await page.getByRole("button", {
    name: /Tactique · défense en attente/
  }).click();
  const resolution = page.getByText(
    /Les assaillants se replient.*bastion reste aux mains de ses défenseurs/iu
  );
  await expect(resolution).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByRole("region", {
    name: "Défense tactique en attente"
  })).toHaveCount(0);
  await expect(log).not.toContainText("certification-hidden-route");
  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(resolution).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("9F refuse explicitement l'absence de fiche active", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("jdr5e_active_sheet");
    localStorage.removeItem("jdr5e_saved_sheets");
  });
  await page.goto("/");
  await expect(page.getByText(
    "Aucune fiche active n’est sélectionnée dans le créateur."
  )).toBeVisible();
  await expect(page.getByRole("button", {
    name: "Créer",
    exact: true
  })).toBeDisabled();
});
