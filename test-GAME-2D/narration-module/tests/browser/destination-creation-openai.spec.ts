import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const character = JSON.parse(readFileSync(resolve(
  "narration-module/tests/fixtures/character/valid/creator-ready.json"
), "utf8"));

test("destination inventée plausible: arbitrage, création, commit et reprise", async ({ page }) => {
  test.setTimeout(360_000);
  const roles: string[] = [];
  const pageErrors: string[] = [];
  page.on("request", request => {
    if (!request.url().includes("/api/narration/enhance-openai")) return;
    const body = request.postDataJSON() as { request?: { role?: string } } | null;
    if (body?.request?.role) roles.push(body.request.role);
  });
  page.on("pageerror", error => pageErrors.push(error.stack ?? error.message));
  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    if (sessionStorage.getItem("destination-creation-live-reset") !== "done") {
      indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
      sessionStorage.setItem("destination-creation-live-reset", "done");
    }
  }, {
    id: "sheet-destination-creation-live",
    name: "Aryn — destination live",
    updatedAt: "2026-08-03T12:00:00.000Z",
    character
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  const log = page.getByRole("log");
  await expect(log).toContainText("Archives de Lysenthe", { timeout: 30_000 });
  await page.getByRole("radio", { name: "OpenAI" }).check();

  const input = page.getByLabel("Entrée libre du joueur");
  const send = page.getByRole("button", { name: "Envoyer" });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill("Je me rends à la Cour des Copistes, juste à côté des Archives.");
  await expect(input).toHaveValue("Je me rends à la Cour des Copistes, juste à côté des Archives.");
  await expect(send).toBeEnabled();
  await send.click();
  await expect(log).toContainText("Cour des Copistes", { timeout: 150_000 });
  await expect(input).toBeEnabled({ timeout: 150_000 });

  expect(roles).toContain("player_intent_interpreter");
  expect(roles).toContain("destination_arbiter");
  expect(roles).toContain("scene_creator");
  expect(roles.filter(role => role === "destination_arbiter")).toHaveLength(1);
  expect(roles.filter(role => role === "scene_creator")).toHaveLength(1);

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(log).toContainText("Cour des Copistes", { timeout: 30_000 });
  await expect(log).toContainText("Je me rends à la Cour des Copistes", { timeout: 30_000 });
  await page.getByRole("radio", { name: "OpenAI" }).check();

  await input.fill("Je retourne aux Archives de Lysenthe.");
  await expect(input).toHaveValue("Je retourne aux Archives de Lysenthe.");
  await expect(send).toBeEnabled();
  await send.click();
  await expect(log).toContainText("Archives de Lysenthe", { timeout: 90_000 });
  await expect(input).toBeEnabled({ timeout: 90_000 });
  expect(roles.filter(role => role === "scene_creator")).toHaveLength(1);

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(log).toContainText("Je retourne aux Archives de Lysenthe", { timeout: 30_000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toEqual([]);

  console.log(`[destination-creation-live] roles=${roles.join(",")}`);
});
