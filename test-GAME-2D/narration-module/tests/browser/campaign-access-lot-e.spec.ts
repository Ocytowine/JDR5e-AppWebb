import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const character = JSON.parse(readFileSync(resolve(
  "narration-module/tests/fixtures/character/valid/creator-ready.json"
), "utf8"));

test("lot E: l'attaque ouvre un handoff et seul l'outcome tactique ouvre l'acces", async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.stack ?? error.message));
  await page.route("**/api/enemy-ai", route => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "disabled in deterministic access lot E" })
  }));
  await page.route("**/api/enemy-speech", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ line: "" })
  }));
  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    if (sessionStorage.getItem("campaign-access-lot-e-reset") !== "done") {
      indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
      sessionStorage.setItem("campaign-access-lot-e-reset", "done");
    }
  }, {
    id: "sheet-access-lot-e",
    name: "Aryn — tactique lot E",
    updatedAt: "2026-08-04T18:00:00.000Z",
    character
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Archives de Lysenthe", {
    timeout: 30_000
  });
  await page.evaluate(async () => {
    const modulePath =
      "/narration-module/tests/browser/campaign-access-lot-b-preparation.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    await module.prepareCampaignAtTharqualBarracksThresholdV1();
  });
  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Caserne centrale", {
    timeout: 30_000
  });
  expect(await inspect(page)).toEqual({
    state: "CONTROLLED",
    elapsedGameSeconds: 0,
    handoffStartedCount: 0,
    resolvedCount: 0,
    activeProcessId: null
  });

  const input = page.getByLabel("Entrée libre du joueur");
  await input.fill("J'attaque le garde qui bloque le passage vers le Château Tharqual.");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("log")).toContainText(
    "Le conflit doit etre joue sur le plateau tactique"
  );
  await expect(page.getByRole("region", {
    name: "Rencontre tactique en attente"
  })).toBeVisible();
  const started = await inspect(page);
  expect(started.state).toBe("CONTROLLED");
  expect(started.elapsedGameSeconds).toBe(0);
  expect(started.handoffStartedCount).toBe(1);
  expect(started.resolvedCount).toBe(0);
  expect(started.activeProcessId).toMatch(/^tactical:access:/u);

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(page.getByRole("region", {
    name: "Rencontre tactique en attente"
  })).toBeVisible();
  await page.getByRole("button", { name: "Ouvrir le plateau tactique" }).click();
  await expect(page.locator(
    '[data-tactical-ready="true"][data-tactical-process-id]'
  )).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator(
    '[data-tactical-ready="true"][data-tactical-checkpoint-id]'
  )).toHaveCount(1, { timeout: 30_000 });

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await page.getByRole("button", {
    name: /Tactique · conflit d'accès en attente/u
  }).click();
  await expect(page.locator(
    '[data-tactical-ready="true"][data-tactical-restored-checkpoint-id]'
  )).toHaveCount(1, { timeout: 30_000 });
  await page.evaluate(async () => {
    const modulePath =
      "/narration-module/tests/browser/campaign-access-lot-b-preparation.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    await module.prepareTharqualTacticalAccessTerminalV1();
  });

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await page.getByRole("button", {
    name: /Tactique · conflit d'accès en attente/u
  }).click();
  await expect(page.getByText(
    /Les gardes ne tiennent plus le seuil.*passage vers le Chateau Tharqual est ouvert/iu
  )).toHaveCount(1, { timeout: 30_000 });
  const integrated = await inspect(page);
  expect(integrated.state).toBe("OPEN");
  expect(integrated.elapsedGameSeconds).toBeGreaterThanOrEqual(6);
  expect(integrated.handoffStartedCount).toBe(1);
  expect(integrated.resolvedCount).toBe(1);

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(page.getByText(
    /Les gardes ne tiennent plus le seuil.*passage vers le Chateau Tharqual est ouvert/iu
  )).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByRole("region", {
    name: "Rencontre tactique en attente"
  })).toHaveCount(0);
  expect(await inspect(page)).toEqual(integrated);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

async function inspect(page: Page) {
  return page.evaluate(async () => {
    const modulePath =
      "/narration-module/tests/browser/campaign-access-lot-b-preparation.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    return module.inspectTharqualTacticalAccessLotEV1();
  });
}
