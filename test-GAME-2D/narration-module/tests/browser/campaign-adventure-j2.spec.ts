import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const character = JSON.parse(readFileSync(resolve(
  "narration-module/tests/fixtures/character/valid/creator-ready.json"
), "utf8"));

const INITIAL_WORLD_TIME = "J0 00h · cycle 0 · heure 0/6 · tick 0";

test("J2 puis J3 gardent l'aventure, les interlocuteurs et l'inventaire jusqu'à la reprise", async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => {
    pageErrors.push(error.stack ?? error.message);
  });
  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    if (sessionStorage.getItem("campaign-adventure-j2-reset") !== "done") {
      indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
      sessionStorage.setItem("campaign-adventure-j2-reset", "done");
    }
  }, {
    id: "sheet-campaign-adventure-j2",
    name: "Aryn — aventure J2",
    updatedAt: "2026-08-19T16:00:00.000Z",
    character
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Créer", exact: true }).click();

  const log = page.getByRole("log");
  const playerInput = page.getByLabel("Entrée libre du joueur");
  const send = page.getByRole("button", { name: "Envoyer" });
  const npcSpeech = page.locator('[data-narrative-block-kind="NPC_SPEECH"]');
  await expect(log).toContainText("Archives de Lysenthe", {
    timeout: 30_000
  });
  await expect(playerInput).toBeEnabled();

  const narrationCount = await page.locator(
    '[data-narrative-block-kind="GM_NARRATION"]'
  ).count();
  const observation = "J'observe calmement les personnes présentes.";
  await playerInput.fill(observation);
  await send.click();
  await expect(log).toContainText(observation);
  await expect(page.locator(
    '[data-narrative-block-kind="GM_NARRATION"]'
  )).toHaveCount(narrationCount + 1, { timeout: 30_000 });
  await expect(playerInput).toBeEnabled();

  expect(await readWorldTime(page)).toBe(INITIAL_WORLD_TIME);

  const contextQuestion = "Où suis-je ?";
  await playerInput.fill(contextQuestion);
  await send.click();
  await expect(log).toContainText(contextQuestion);
  await expect(log).toContainText(
    "Tu es à Archives de Lysenthe. Cette réponse ne fait pas avancer le temps."
  );
  await expect(playerInput).toBeEnabled();

  const metaQuestion = "Est-ce que l'interface sauvegarde automatiquement ?";
  await playerInput.fill(metaQuestion);
  await send.click();
  await expect(log).toContainText(metaQuestion);
  await expect(playerInput).toBeEnabled();

  expect(await readWorldTime(page)).toBe(INITIAL_WORLD_TIME);
  await expect(page.getByRole("alert")).toHaveCount(0);

  const archivistDialogue = "Je voudrais parler à l'archiviste.";
  await submitDialogue(archivistDialogue, /archiviste/iu);
  const clerkDialogue = "Je voudrais parler à un clerc.";
  await submitDialogue(clerkDialogue, /clerc/iu);
  const dialogueTexts = await npcSpeech.allInnerTexts();
  expect(new Set(dialogueTexts.map(text => text.trim())).size).toBe(2);
  expect(await inspectArchivesSocialAccess(page)).toEqual({
    state: "CONTROLLED",
    attemptCount: 0,
    outcome: null,
    conditionRef: null,
    speechText: null,
    elapsedGameSeconds: 0
  });

  const restrictedAccessRequest =
    "Je demande à l'archiviste l'accès aux fonds et registres réservés.";
  const speechCountBeforeAccess = await npcSpeech.count();
  await playerInput.fill(restrictedAccessRequest);
  await send.click();
  await expect(npcSpeech).toHaveCount(speechCountBeforeAccess + 1, {
    timeout: 30_000
  });
  await expect(npcSpeech.last()).toContainText(/mandat de haut rang/iu);
  await expect(page.getByLabel("Test de compétence en attente")).toHaveCount(0);
  const socialAccess = await inspectArchivesSocialAccess(page);
  expect(socialAccess).toEqual({
    state: "CONTROLLED",
    attemptCount: 1,
    outcome: "CONDITION_OFFERED",
    conditionRef: "condition:archives-high-rank-mandate",
    speechText: restrictedAccessRequest,
    elapsedGameSeconds: 0
  });

  const initialInventory = await inspectCampaignInventory(page);
  expect(initialInventory).toMatchObject({
    swordSlot: "main_droite",
    goldContainer: "item-bourse",
    rightHand: "item-epee",
    elapsedGameSeconds: 0
  });
  expect(initialInventory.sceneInventory).toEqual([]);
  expect(initialInventory.archivistInventory).toEqual([]);
  const rejectedInventoryCommand =
    "Je range mon épée longue dans ma bourse.";
  await playerInput.fill(rejectedInventoryCommand);
  await send.click();
  await expect(log).toContainText("Action non exécutée", { timeout: 30_000 });
  expect(await inspectCampaignInventory(page)).toEqual(initialInventory);
  const inventoryCommands = [
    ["Je retire mes pièces d'or de ma bourse.", "Piece d'or est maintenant sorti de Bourse."],
    ["Je range mes pièces d'or dans ma bourse.", "Piece d'or est maintenant rangé dans Bourse."],
    ["Je déséquipe mon épée longue.", "Epee longue est maintenant déséquipé."],
    ["J'équipe mon épée longue dans ma main droite.", "Epee longue est maintenant équipé à l'emplacement main droite."]
  ] as const;
  for (const [command, result] of inventoryCommands) {
    await playerInput.fill(command);
    await send.click();
    await expect(log).toContainText(result, { timeout: 30_000 });
    await expect(playerInput).toBeEnabled();
    if (command.includes("déséquipe")) {
      const unequipped = await inspectCampaignInventory(page);
      expect(unequipped.swordSlot).toBeNull();
      expect(unequipped.rightHand).toBeNull();
      expect(unequipped.tacticalEquipped).not.toContain("item-epee");
      expect(unequipped.narrativeVisibleEquipment).not.toContain("item-epee");
    }
  }
  const finalInventory = await inspectCampaignInventory(page);
  expect(finalInventory).toMatchObject({
    swordSlot: "main_droite",
    goldContainer: "item-bourse",
    rightHand: "item-epee",
    tacticalEquipped: initialInventory.tacticalEquipped,
    narrativeVisibleEquipment: initialInventory.narrativeVisibleEquipment,
    characterRevision: initialInventory.characterRevision + 4,
    tacticalRevision: initialInventory.tacticalRevision + 4,
    narrativeRevision: initialInventory.narrativeRevision + 4,
    elapsedGameSeconds: 0
  });

  const placeTransferCommands = [
    ["Je sors mes pièces d'or de ma bourse.", "Piece d'or est maintenant sorti de Bourse."],
    ["Je dépose mes pièces d'or ici.", "Piece d'or est maintenant déposé dans ce lieu."],
    ["Je prends mes pièces d'or.", "Piece d'or est maintenant dans ton inventaire."],
    ["Je place mes pièces d'or dans ma bourse.", "Piece d'or est maintenant rangé dans Bourse."]
  ] as const;
  for (const [command, result] of placeTransferCommands) {
    await playerInput.fill(command);
    await send.click();
    await expect(log).toContainText(result, { timeout: 30_000 });
    await expect(playerInput).toBeEnabled();
    if (command.includes("dépose")) {
      const deposited = await inspectCampaignInventory(page);
      expect(deposited.goldContainer).toBeNull();
      expect(deposited.sceneInventory).toContain("item-or");
    }
  }
  const finalTransferredInventory = await inspectCampaignInventory(page);
  expect(finalTransferredInventory).toMatchObject({
    swordSlot: "main_droite",
    goldContainer: "item-bourse",
    sceneInventory: [],
    characterRevision: initialInventory.characterRevision + 8,
    tacticalRevision: initialInventory.tacticalRevision + 8,
    narrativeRevision: initialInventory.narrativeRevision + 8,
    externalRevision: initialInventory.externalRevision + 2,
    elapsedGameSeconds: 0
  });

  const npcTransferCommands = [
    ["Je retire mes pièces d'or de ma bourse pour les donner.", "Piece d'or est maintenant sorti de Bourse."],
    ["Je donne mes pièces d'or à l'archiviste.", "Piece d'or est maintenant remis à Archiviste aux gestes soigneux."],
    ["Je reçois mes pièces d'or de l'archiviste.", "Piece d'or est maintenant reçu de Archiviste aux gestes soigneux."],
    ["Je range à nouveau mes pièces d'or dans ma bourse.", "Piece d'or est maintenant rangé dans Bourse."]
  ] as const;
  for (const [command, result] of npcTransferCommands) {
    await playerInput.fill(command);
    await send.click();
    await expect(log).toContainText(result, { timeout: 30_000 });
    await expect(playerInput).toBeEnabled();
    if (command.startsWith("Je donne")) {
      const given = await inspectCampaignInventory(page);
      expect(given.goldContainer).toBeNull();
      expect(given.archivistInventory).toContain("item-or");
    }
  }
  const finalNpcInventory = await inspectCampaignInventory(page);
  expect(finalNpcInventory).toMatchObject({
    goldContainer: "item-bourse",
    sceneInventory: [],
    archivistInventory: [],
    characterRevision: initialInventory.characterRevision + 12,
    tacticalRevision: initialInventory.tacticalRevision + 12,
    narrativeRevision: initialInventory.narrativeRevision + 12,
    externalRevision: initialInventory.externalRevision + 4,
    elapsedGameSeconds: 0
  });

  await page.reload();
  await page.getByRole("button", { name: "Reprendre", exact: true }).click();
  await expect(log).toContainText("Archives de Lysenthe", {
    timeout: 30_000
  });
  await expect(log.locator('[data-narrative-block-kind="RAW_INPUT"]', {
    hasText: observation
  })).toHaveCount(1);
  await expect(log.locator('[data-narrative-block-kind="RAW_INPUT"]', {
    hasText: contextQuestion
  })).toHaveCount(1);
  await expect(log.locator('[data-narrative-block-kind="RAW_INPUT"]', {
    hasText: metaQuestion
  })).toHaveCount(1);
  await expect(log.locator('[data-narrative-block-kind="RAW_INPUT"]', {
    hasText: archivistDialogue
  })).toHaveCount(1);
  await expect(log.locator('[data-narrative-block-kind="RAW_INPUT"]', {
    hasText: clerkDialogue
  })).toHaveCount(1);
  await expect(npcSpeech).toHaveCount(3);
  await expect(npcSpeech.nth(0)).toContainText(/archiviste/iu);
  await expect(npcSpeech.nth(1)).toContainText(/clerc/iu);
  await expect(npcSpeech.nth(2)).toContainText(/mandat de haut rang/iu);
  expect(new Set((await npcSpeech.allInnerTexts()).map(text => text.trim())).size).toBe(3);
  expect(await inspectArchivesSocialAccess(page)).toEqual(socialAccess);
  expect(await inspectCampaignInventory(page)).toEqual(finalNpcInventory);
  await expect(log.locator('[data-narrative-block-kind="RAW_INPUT"]', {
    hasText: rejectedInventoryCommand
  })).toHaveCount(1);
  await expect(log.locator('[aria-label="Transaction d\'inventaire validée"]', {
    hasText: "Action non exécutée"
  })).toHaveCount(1);
  for (const [command, result] of inventoryCommands) {
    await expect(log.locator('[data-narrative-block-kind="RAW_INPUT"]', {
      hasText: command
    })).toHaveCount(1);
    await expect(log.locator('[aria-label="Transaction d\'inventaire validée"]', {
      hasText: result
    })).toHaveCount(result.startsWith("Piece d'or") ? 3 : 1);
  }
  for (const [command, result] of placeTransferCommands) {
    await expect(log.locator('[data-narrative-block-kind="RAW_INPUT"]', { hasText: command })).toHaveCount(1);
    await expect(log.locator('[aria-label="Transaction d\'inventaire validée"]', { hasText: result })).toHaveCount(
      result.startsWith("Piece d'or") && (result.includes("sorti") || result.includes("rangé")) ? 3 : 1
    );
  }
  for (const [command] of npcTransferCommands) {
    await expect(log.locator('[data-narrative-block-kind="RAW_INPUT"]', { hasText: command })).toHaveCount(1);
  }
  await expect(log.locator('[data-narrative-block-kind="GM_NARRATION"]').getByText(
    "Tu es à Archives de Lysenthe. Cette réponse ne fait pas avancer le temps.",
    { exact: true }
  )).toHaveCount(1);
  expect(await readWorldTime(page)).toBe(INITIAL_WORLD_TIME);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toEqual([]);

  async function submitDialogue(text: string, expectedSpeaker: RegExp): Promise<void> {
    const previousCount = await npcSpeech.count();
    await playerInput.fill(text);
    await expect(send).toBeEnabled();
    await send.click();
    await expect(npcSpeech).toHaveCount(previousCount + 1, { timeout: 30_000 });
    await expect(npcSpeech.last()).toContainText(expectedSpeaker);
    await expect(playerInput).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
});

async function inspectArchivesSocialAccess(page: Page) {
  return page.evaluate(async () => {
    const modulePath =
      "/narration-module/tests/browser/campaign-adventure-j2-inspection.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    return module.inspectArchivesSocialAccessJ2V1();
  });
}

async function inspectCampaignInventory(page: Page) {
  return page.evaluate(async () => {
    const modulePath =
      "/narration-module/tests/browser/campaign-adventure-j2-inspection.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    return module.inspectCampaignInventoryJ3V1();
  });
}

async function readWorldTime(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Monde" }).click();
  await page.getByRole("button", { name: "World simulation" }).click();
  const time = page.getByText(/^J\d+ \d{2}h · cycle \d+ · heure \d+\/6 · tick \d+$/u);
  await expect(time).toBeVisible({ timeout: 30_000 });
  const value = (await time.textContent())?.trim() ?? "";
  await page.getByRole("button", { name: "Retour carte" }).click();
  await page.getByRole("button", { name: "Retour narration" }).click();
  await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled({
    timeout: 30_000
  });
  return value;
}
