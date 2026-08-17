import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const character = JSON.parse(readFileSync(resolve(
  "narration-module/tests/fixtures/character/valid/creator-ready.json"
), "utf8"));

test("campagne réelle: contact, registres et opinions du clerc", async ({ page }) => {
  test.setTimeout(420_000);
  const calls: Array<{ turn: number; role: string; status: number | null }> = [];
  const byRequest = new Map<import("@playwright/test").Request, number>();
  const pageErrors: string[] = [];
  let activeTurn = 0;
  page.on("request", request => {
    if (!request.url().includes("/api/narration/enhance-openai")) return;
    const body = request.postDataJSON() as { request?: { role?: string } } | null;
    if (!body?.request?.role) return;
    calls.push({ turn: activeTurn, role: body.request.role, status: null });
    byRequest.set(request, calls.length - 1);
  });
  page.on("response", response => {
    const index = byRequest.get(response.request());
    if (index !== undefined) calls[index]!.status = response.status();
  });
  page.on("pageerror", error => pageErrors.push(error.stack ?? error.message));
  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    if (sessionStorage.getItem("campaign-clerk-conversation-live-reset") !== "done") {
      indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
      sessionStorage.setItem("campaign-clerk-conversation-live-reset", "done");
    }
  }, {
    id: "sheet-campaign-clerk-conversation-live",
    name: "Aryn — dialogue clerc live",
    updatedAt: "2026-08-17T12:30:00.000Z",
    character
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  const log = page.getByRole("log");
  await expect(log).toContainText("Archives de Lysenthe", { timeout: 30_000 });
  await page.getByRole("radio", { name: "OpenAI" }).check();
  const input = page.getByLabel("Entrée libre du joueur");
  const send = page.getByRole("button", { name: "Envoyer" });
  const npcSpeech = page.locator('[data-narrative-block-kind="NPC_SPEECH"]');
  const notices = page.locator('[data-narrative-block-kind="SYSTEM_NOTICE"]');
  await expect(input).toBeEnabled({ timeout: 30_000 });

  await submitDialogue(1, "Je voudrais parler à un clerc.");
  await submitDialogue(
    2,
    "Je souhaiterais accéder à des documents relatifs aux naissances pour retrouver mes parents."
  );
  await submitDialogue(3, "Depuis combien de temps travaillez-vous aux Archives ?");
  await submitDialogue(4, "Que pensez-vous des restrictions d'accès aux registres ?");

  for (const turn of [1, 2, 3, 4]) {
    const turnCalls = calls.filter(call => call.turn === turn);
    expect(turnCalls.map(call => call.role), `tour ${turn}: rôles`).toEqual([
      "player_intent_interpreter",
      "mj_planner",
      "npc_performer"
    ]);
    expect(turnCalls.every(call => call.status === 200), `tour ${turn}: statuts HTTP`).toBe(true);
  }
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toEqual([]);

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(npcSpeech).toHaveCount(4, { timeout: 30_000 });
  await expect(log).toContainText("restrictions d'accès aux registres");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toEqual([]);

  console.log(`[campaign-clerk-live] ${JSON.stringify(calls)}`);

  async function submitDialogue(turn: number, text: string): Promise<void> {
    activeTurn = turn;
    const previousCount = await npcSpeech.count();
    await input.fill(text);
    await expect(send).toBeEnabled();
    await send.click();
    await expect(npcSpeech).toHaveCount(previousCount + 1, { timeout: 120_000 });
    await expect(input).toBeEnabled({ timeout: 30_000 });
    await expect(notices.last()).toContainText("Intention canonique: address_visible_actor");
    await expect(notices.last()).not.toContainText("Clarification requise");
  }
});
