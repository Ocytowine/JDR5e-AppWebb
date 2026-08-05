import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const character = JSON.parse(readFileSync(resolve(
  "narration-module/tests/fixtures/character/valid/creator-ready.json"
), "utf8"));

test("lot B: contrôle réel, résolution, reprise puis traversée séparée", async ({
  page
}) => {
  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    if (sessionStorage.getItem("campaign-access-lot-b-reset") !== "done") {
      indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
      sessionStorage.setItem("campaign-access-lot-b-reset", "done");
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
    id: "sheet-access-lot-b",
    name: "Aryn — accès lot B",
    updatedAt: "2026-08-04T10:00:00.000Z",
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
  const before = await page.evaluate(async () => {
    const modulePath =
      "/narration-module/tests/browser/campaign-access-lot-b-preparation.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    return module.inspectTharqualAccessLotBV1();
  });
  expect(before).toEqual({
    state: "CONTROLLED",
    activeSceneId: "wiki-location:caserne_centrale",
    passageOrderPresent: false
  });

  const input = page.getByLabel("Entrée libre du joueur");
  await input.fill("Je présente mon ordre de passage Tharqual au garde.");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("log")).toContainText(
    "Je présente mon ordre de passage Tharqual au garde."
  );
  const afterMissingOrder = await page.evaluate(async () => {
    const modulePath =
      "/narration-module/tests/browser/campaign-access-lot-b-preparation.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    return module.inspectTharqualAccessLotBV1();
  });
  expect(afterMissingOrder.state).toBe("CONTROLLED");
  expect(afterMissingOrder.passageOrderPresent).toBe(false);
  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();

  await input.fill(
    "Je demande à l'officier de quart une audience au Château Tharqual."
  );
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByLabel("Test de compétence en attente")).toBeVisible();
  await expect(page.getByLabel("Test de compétence en attente")).toContainText(
    "DD 20"
  );
  await page.getByRole("button", {
    name: "Lancer le dé pour résoudre le test"
  }).click();
  await expect(page.getByRole("log")).toContainText(
    "ordonne au garde de lever le passage"
  );
  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  const opened = await page.evaluate(async () => {
    const modulePath =
      "/narration-module/tests/browser/campaign-access-lot-b-preparation.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    return module.inspectTharqualAccessLotBV1();
  });
  expect(opened.state).toBe("OPEN");
  expect(opened.activeSceneId).toBe("wiki-location:caserne_centrale");

  await page.getByLabel("Entrée libre du joueur").fill(
    "Je vais vers Chateau tharqual."
  );
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("log")).toContainText("Chateau Tharqual", {
    timeout: 30_000
  });
  const traversed = await page.evaluate(async () => {
    const modulePath =
      "/narration-module/tests/browser/campaign-access-lot-b-preparation.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    return module.inspectTharqualAccessLotBV1();
  });
  expect(traversed.activeSceneId).toBe("wiki-location:chateau_tharqual");
  expect(traversed.passageOrderPresent).toBe(false);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
