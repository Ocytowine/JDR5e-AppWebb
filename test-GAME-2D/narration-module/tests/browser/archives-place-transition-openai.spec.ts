import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const character = JSON.parse(readFileSync(resolve(
  "narration-module/tests/fixtures/character/valid/creator-ready.json"
), "utf8"));

test("campagne propre: transition OpenAI des Archives vers la Place des Archives", async ({ page }) => {
  test.setTimeout(240_000);
  const roles: string[] = [];
  const statuses: number[] = [];
  const pageErrors: string[] = [];
  page.on("request", request => {
    if (!request.url().includes("/api/narration/enhance-openai")) return;
    const body = request.postDataJSON() as { request?: { role?: string } } | null;
    if (body?.request?.role) roles.push(body.request.role);
  });
  page.on("response", response => {
    if (response.url().includes("/api/narration/enhance-openai")) statuses.push(response.status());
  });
  page.on("pageerror", error => pageErrors.push(error.stack ?? error.message));
  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    if (sessionStorage.getItem("archives-place-transition-live-reset") !== "done") {
      indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
      sessionStorage.setItem("archives-place-transition-live-reset", "done");
    }
  }, {
    id: "sheet-archives-place-transition-live",
    name: "Aryn — transition Place des Archives",
    updatedAt: "2026-08-17T12:00:00.000Z",
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
  await input.fill("Je me dirige vers la Place des Archives.");
  await send.click();

  await expect(input).toBeEnabled({ timeout: 180_000 });
  await expect(log).toContainText("Je me dirige vers la Place des Archives.");
  await expect(log).toContainText("Place des Archives", { timeout: 30_000 });
  const logText = await log.innerText();
  expect(logText).not.toContain("Clarification requise");
  expect(logText).not.toContain("Action non exécutée");
  expect(logText).toContain("Transition locale confirmée");
  expect(logText).toMatch(/Destination=place:place[-_]des[-_]archives/u);
  expect(logText).toMatch(/scène=[^;\s]*place[-_]des[-_]archives[^;\s]*/u);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(roles).toEqual([
    "player_intent_interpreter",
    "scene_creator",
    "scene_writer"
  ]);
  expect(statuses.length).toBeGreaterThan(0);
  expect(statuses.every(status => status === 200)).toBe(true);
  expect(pageErrors).toEqual([]);

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(log).toContainText(/Destination=place:place[-_]des[-_]archives/u, { timeout: 30_000 });
  await expect(log).toContainText(/Tu te trouves (?:désormais )?à Place des Archives/u, { timeout: 30_000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(roles.filter(role => role === "scene_creator")).toHaveLength(1);
  expect(pageErrors).toEqual([]);

  console.log(`[archives-place-transition-live] roles=${roles.join(",")} statuses=${statuses.join(",")} log=${logText.replace(/\s+/gu, " ").slice(-1200)}`);
});
