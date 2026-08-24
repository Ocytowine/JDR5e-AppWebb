import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const character = JSON.parse(readFileSync(resolve(
  "narration-module/tests/fixtures/character/valid/creator-ready.json"
), "utf8"));

test("J9-C certifie la campagne continue dans le navigateur et IndexedDB", async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.stack ?? error.message));
  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    if (sessionStorage.getItem("j9c-browser-reset") !== "done") {
      indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
      sessionStorage.setItem("j9c-browser-reset", "done");
    }
  }, {
    id: "sheet-j9c-browser",
    name: "Aryn — certification J9-C",
    updatedAt: "2026-08-24T12:00:00.000Z",
    character
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  const log = page.getByRole("log");
  const playerInput = page.getByLabel("Entrée libre du joueur");
  const send = page.getByRole("button", { name: "Envoyer" });
  await expect(log).toContainText("Archives de Lysenthe", { timeout: 30_000 });

  const uiRequests = [
    "Je voudrais parler à l'archiviste.",
    "Je voudrais parler à un clerc.",
    "Je déséquipe mon épée longue.",
    "J'équipe mon épée longue dans ma main droite.",
    "Je retire mes pièces d'or de ma bourse.",
    "Je donne mes pièces d'or à l'archiviste.",
    "Je reçois mes pièces d'or de l'archiviste.",
    "Je range mes pièces d'or dans ma bourse."
  ];
  for (const rawInput of uiRequests) {
    await playerInput.fill(rawInput);
    await send.click();
    await expect(log).toContainText(rawInput, { timeout: 30_000 });
    await expect(playerInput).toBeEnabled({ timeout: 30_000 });
    await expect(page.getByRole("alert")).toHaveCount(0);
  }

  const firstState = await runDriver(page, "runJ9cBrowserVertical");
  expect(firstState).toMatchObject({
    activeSceneId: "wiki-location:halles_des_commerces",
    elapsedGameSeconds: 1_800,
    companionCount: 1,
    companionSceneId: "wiki-location:halles_des_commerces",
    directiveDispositions: ["REFUSED"],
    plotStatus: "RESOLVED",
    discoveryCount: 2,
    hypothesisStatuses: ["REFUTED", "SUPPORTED"],
    goldContainer: "item-bourse",
    archivistInventoryCount: 0,
    narrativeTurnCount: 14
  });

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(log).toContainText("Halles des Commerces", { timeout: 30_000 });
  for (const rawInput of uiRequests) {
    await expect(log.locator('[data-narrative-block-kind="RAW_INPUT"]', {
      hasText: rawInput
    })).toHaveCount(1);
  }
  const restoredState = await runDriver(page, "inspectJ9cBrowserState");
  expect(restoredState).toEqual(firstState);

  const replayedState = await runDriver(page, "replayJ9cBrowserCriticalRequests");
  expect(replayedState).toEqual(firstState);
  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(log).toContainText("Halles des Commerces", { timeout: 30_000 });
  for (const rawInput of uiRequests) {
    await expect(log.locator('[data-narrative-block-kind="RAW_INPUT"]', {
      hasText: rawInput
    })).toHaveCount(1);
  }
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

async function runDriver(
  page: Page,
  functionName:
    | "runJ9cBrowserVertical"
    | "inspectJ9cBrowserState"
    | "replayJ9cBrowserCriticalRequests"
) {
  return page.evaluate(async name => {
    const modulePath = "/narration-module/tests/browser/j9c-browser-driver.ts";
    const module = await import(/* @vite-ignore */ modulePath) as Record<
      string,
      () => Promise<Record<string, unknown>>
    >;
    return module[name]!();
  }, functionName);
}
