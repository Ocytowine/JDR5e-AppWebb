import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const character = JSON.parse(readFileSync(resolve(
  "narration-module/tests/fixtures/character/valid/creator-ready.json"
), "utf8"));

test("lot C: perception sourcée sans ouverture arbitraire du passage", async ({
  page
}) => {
  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    if (sessionStorage.getItem("campaign-access-lot-c-reset") !== "done") {
      indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
      sessionStorage.setItem("campaign-access-lot-c-reset", "done");
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
    id: "sheet-access-lot-c",
    name: "Aryn — perception lot C",
    updatedAt: "2026-08-04T14:00:00.000Z",
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

  const input = page.getByLabel("Entrée libre du joueur");
  await input.fill("J'observe le passage vers le Château Tharqual.");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("log")).toContainText(
    "gardé en permanence et son ouverture dépend d'un contrôle formel"
  );

  await input.fill(
    "J'inspecte attentivement le passage et la porte latérale supposée vers le Château Tharqual."
  );
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("log")).toContainText(
    "aucune ouverture secondaire visible"
  );
  await expect(page.getByRole("log")).toContainText("n'est pas confirmée");

  await input.fill(
    "Je cherche minutieusement une autre entrée vers le Château Tharqual."
  );
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByLabel("Test de compétence en attente")).toBeVisible();
  const beforeRoll = await inspectAccess(page);
  expect(beforeRoll.state).toBe("CONTROLLED");

  await page.getByRole("button", {
    name: "Lancer le dé pour résoudre le test"
  }).click();
  await expect(page.getByRole("log")).toContainText(
    "lui adresser une demande est une approche possible"
  );
  const afterRoll = await inspectAccess(page);
  expect(afterRoll.state).toBe("CONTROLLED");
  expect(afterRoll.activeSceneId).toBe("wiki-location:caserne_centrale");

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(page.getByRole("log")).toContainText(
    "lui adresser une demande est une approche possible"
  );
  const restored = await inspectAccess(page);
  expect(restored.state).toBe("CONTROLLED");
  expect(restored.activeSceneId).toBe("wiki-location:caserne_centrale");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

async function inspectAccess(page: Page) {
  return page.evaluate(async () => {
    const modulePath =
      "/narration-module/tests/browser/campaign-access-lot-b-preparation.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    return module.inspectTharqualAccessLotBV1();
  });
}
