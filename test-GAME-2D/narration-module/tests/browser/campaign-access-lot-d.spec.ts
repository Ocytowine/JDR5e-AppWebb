import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const character = JSON.parse(readFileSync(resolve(
  "narration-module/tests/fixtures/character/valid/creator-ready.json"
), "utf8"));

test("lot D: équipement absent, test de force et ouverture autoritaire", async ({ page }) => {
  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    if (sessionStorage.getItem("campaign-access-lot-d-reset") !== "done") {
      indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
      sessionStorage.setItem("campaign-access-lot-d-reset", "done");
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
    id: "sheet-access-lot-d",
    name: "Aryn — règles lot D",
    updatedAt: "2026-08-04T16:00:00.000Z",
    character
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Archives de Lysenthe", { timeout: 30_000 });
  await page.evaluate(async () => {
    const modulePath = "/narration-module/tests/browser/campaign-access-lot-b-preparation.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    await module.prepareCampaignAtTharqualBarracksThresholdV1();
  });
  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Caserne centrale", { timeout: 30_000 });

  const input = page.getByLabel("Entrée libre du joueur");
  await input.fill("Je tente de crocheter le passage vers le Château Tharqual avec mes outils de voleur.");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("log")).toContainText("Action non exécutée");
  const afterMissingTools = await inspect(page);
  expect(afterMissingTools.state).toBe("CONTROLLED");
  expect(afterMissingTools.attemptCount).toBe(0);
  expect(afterMissingTools.elapsedGameSeconds).toBe(0);

  await input.fill("Je force le passage vers le Château Tharqual.");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByLabel("Test de compétence en attente")).toBeVisible();
  await expect(page.getByLabel("Test de compétence en attente")).toContainText("DD 20");
  const pending = await inspect(page);
  expect(pending.state).toBe("CONTROLLED");
  expect(pending.attemptCount).toBe(1);
  expect(pending.outcome).toBeNull();

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(page.getByLabel("Test de compétence en attente")).toBeVisible();
  await page.getByRole("button", { name: "Lancer le dé pour résoudre le test" }).click();
  await expect(page.getByRole("log")).toContainText("cède dans un fracas métallique");
  const resolved = await inspect(page);
  expect(resolved).toEqual({
    state: "OPEN",
    attemptCount: 1,
    outcome: "SUCCESS",
    noise: "LOUD",
    elapsedGameSeconds: 6
  });

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("cède dans un fracas métallique");
  expect(await inspect(page)).toEqual(resolved);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

async function inspect(page: Page) {
  return page.evaluate(async () => {
    const modulePath = "/narration-module/tests/browser/campaign-access-lot-b-preparation.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    return module.inspectTharqualRulesAccessLotDV1();
  });
}
