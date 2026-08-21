import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const character = JSON.parse(readFileSync(resolve(
  "narration-module/tests/fixtures/character/valid/creator-ready.json"
), "utf8"));

test("lot F: second seuil régional, refus, reprise, ouverture et traversée", async ({ page }) => {
  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    if (sessionStorage.getItem("campaign-access-lot-f-reset") !== "done") {
      indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
      sessionStorage.setItem("campaign-access-lot-f-reset", "done");
    }
    const original = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, "getRandomValues", {
      configurable: true,
      value<T extends ArrayBufferView>(array: T): T {
        if (array instanceof Uint32Array) array.fill(19);
        else original(array);
        return array;
      }
    });
  }, {
    id: "sheet-access-lot-f",
    name: "Aryn — certification multi-régions lot F",
    updatedAt: "2026-08-04T18:00:00.000Z",
    character
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Archives de Lysenthe", {
    timeout: 30_000
  });
  await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled();
  await page.evaluate(async () => {
    const modulePath =
      "/narration-module/tests/browser/campaign-access-lot-b-preparation.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    await module.prepareCampaignAtArdherneRockfallThresholdV1();
  });
  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(page.getByRole("log")).toContainText(
    "Passage éboulé du Torrent-Froid",
    { timeout: 30_000 }
  );

  const before = await inspect(page);
  expect(before).toMatchObject({
    ardherneState: "CONTROLLED",
    tharqualState: "CONTROLLED",
    installedControlCount: 3,
    activeSceneId: "wiki-location:passage_eboule_du_torrent",
    attemptCount: 0,
    elapsedGameSeconds: 0,
    swordPresent: true
  });

  const input = page.getByLabel("Entrée libre du joueur");
  await input.fill(
    "Je tente et j'utilise mon épée longue sur le passage vers Hameau du torrent froid."
  );
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("log")).toContainText("Action non exécutée");
  await expect(page.getByRole("log")).toContainText(
    "inventory.access-policy-rejected"
  );
  expect(await inspect(page)).toEqual(before);

  await input.fill(
    "Je force le passage vers Hameau du torrent froid."
  );
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByLabel("Test de compétence en attente")).toBeVisible();
  await expect(page.getByLabel("Test de compétence en attente")).toContainText("DD 15");
  const pending = await inspect(page);
  expect(pending).toMatchObject({
    ardherneState: "CONTROLLED",
    tharqualState: "CONTROLLED",
    attemptCount: 1,
    outcome: null,
    elapsedGameSeconds: 0
  });

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(page.getByLabel("Test de compétence en attente")).toBeVisible();
  await page.getByRole("button", {
    name: "Lancer le dé pour résoudre le test"
  }).click();
  await expect(page.getByRole("log")).toContainText(
    "La route vers le Hameau du Torrent-Froid est ouverte"
  );
  const opened = await inspect(page);
  expect(opened).toMatchObject({
    ardherneState: "OPEN",
    tharqualState: "CONTROLLED",
    installedControlCount: 3,
    activeSceneId: "wiki-location:passage_eboule_du_torrent",
    attemptCount: 1,
    outcome: "SUCCESS",
    noise: "AUDIBLE",
    elapsedGameSeconds: 60,
    swordPresent: true
  });

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await input.fill("Je vais vers Hameau du torrent froid.");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect.poll(async () => (await inspect(page)).activeSceneId, {
    timeout: 30_000
  }).toBe("wiki-location:hameau_du_torrent_froid");
  const traversed = await inspect(page);
  expect(traversed).toMatchObject({
    ardherneState: "OPEN",
    tharqualState: "CONTROLLED",
    activeSceneId: "wiki-location:hameau_du_torrent_froid",
    elapsedGameSeconds: 68,
    swordPresent: true
  });

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Hameau du Torrent-Froid");
  expect(await inspect(page)).toEqual(traversed);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

async function inspect(page: Page) {
  return page.evaluate(async () => {
    const modulePath =
      "/narration-module/tests/browser/campaign-access-lot-b-preparation.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    return module.inspectMultiRegionAccessLotFV1();
  });
}
