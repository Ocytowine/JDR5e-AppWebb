import { expect, test } from "@playwright/test";
import type { NarrativeTurnControllerV1 } from "../../src/application";

declare global {
  interface Window {
    __npcReturnController?: NarrativeTurnControllerV1;
  }
}

test("un acteur de scène conserve identité et mémoire après une sortie-retour", async ({ page }) => {
  await page.goto("/narration-module/tests/browser/npc-return-ui.html");
  const input = page.getByLabel("Entrée libre du joueur");
  const send = page.getByRole("button", { name: "Envoyer" });
  const log = page.getByRole("log");

  await expect(input).toBeEnabled();
  await submit("Je salue le copiste.", "Copiste itinérant");
  await submit("Je lui demande depuis combien de temps il voyage ?", "Copiste itinérant");
  await submit("Je lui demande s'il recopie des histoires locales ?", "Copiste itinérant");

  await submit("Je franchis la porte du fond vers l'arrière-salle.", "Destination=location:inn-back-room");
  await submit("Je retourne dans la salle commune.", "Destination=location:inn-common-room");
  await expect(log).toContainText("Copiste itinérant");

  await submit("Je lui demande s'il se souvient de mes questions ?", "Copiste itinérant");
  await expect(log).toContainText("Intentions joueur mémorisées (3)");
  await expect(log).not.toContainText("Interlocuteur");
  await expect(page.getByRole("alert")).toHaveCount(0);

  const promoted = await page.evaluate(async ({ sceneActorId }) => {
    if (!window.__npcReturnController) throw new Error("controller unavailable");
    return window.__npcReturnController.promoteSceneActor({
      schemaVersion: 1,
      clientRequestId: "accept-copy-journal-mission",
      sceneId: "reference-inn-rain-001",
      sceneActorId,
      ownerConfirmation: {
        schemaVersion: 1,
        contractVersion: "durable-npc-cause-confirmation/1",
        ownerCommandId: "quest-command:copy-lost-journal",
        ownerAuthority: true,
        cause: {
          schemaVersion: 1,
          causeKind: "ONGOING_COMMITMENT",
          authority: "QUEST",
          durableRef: "quest:copy-lost-journal",
          publicSourceRefs: ["quest:copy-lost-journal", "event:copiste-accepted"],
          version: 1
        }
      }
    });
  }, { sceneActorId: "reference-inn-rain-001:ambient:copiste" });
  expect(promoted.ok).toBe(true);
  if (!promoted.ok) throw new Error(promoted.error.messageKey);
  expect(promoted.value.replayed).toBe(false);
  expect(promoted.value.campaignNpc.displayName).toBe("Copiste itinérant");

  const replayed = await page.evaluate(async ({ sceneActorId }) => {
    if (!window.__npcReturnController) throw new Error("controller unavailable");
    return window.__npcReturnController.promoteSceneActor({
      schemaVersion: 1,
      clientRequestId: "accept-copy-journal-mission",
      sceneId: "reference-inn-rain-001",
      sceneActorId,
      ownerConfirmation: {
        schemaVersion: 1,
        contractVersion: "durable-npc-cause-confirmation/1",
        ownerCommandId: "quest-command:copy-lost-journal",
        ownerAuthority: true,
        cause: {
          schemaVersion: 1,
          causeKind: "ONGOING_COMMITMENT",
          authority: "QUEST",
          durableRef: "quest:copy-lost-journal",
          publicSourceRefs: ["quest:copy-lost-journal", "event:copiste-accepted"],
          version: 1
        }
      }
    });
  }, { sceneActorId: "reference-inn-rain-001:ambient:copiste" });
  expect(replayed.ok).toBe(true);
  if (!replayed.ok) throw new Error(replayed.error.messageKey);
  expect(replayed.value.replayed).toBe(true);

  const conflictingReplay = await page.evaluate(async ({ sceneActorId }) => {
    if (!window.__npcReturnController) throw new Error("controller unavailable");
    return window.__npcReturnController.promoteSceneActor({
      schemaVersion: 1,
      clientRequestId: "accept-copy-journal-mission",
      sceneId: "reference-inn-rain-001",
      sceneActorId,
      ownerConfirmation: {
        schemaVersion: 1,
        contractVersion: "durable-npc-cause-confirmation/1",
        ownerCommandId: "quest-command:different-mission",
        ownerAuthority: true,
        cause: {
          schemaVersion: 1,
          causeKind: "ONGOING_COMMITMENT",
          authority: "QUEST",
          durableRef: "quest:different-mission",
          publicSourceRefs: ["quest:different-mission"],
          version: 1
        }
      }
    });
  }, { sceneActorId: "reference-inn-rain-001:ambient:copiste" });
  expect(conflictingReplay.ok).toBe(false);
  if (conflictingReplay.ok) throw new Error("conflicting replay should fail");
  expect(conflictingReplay.error.code).toBe("IDEMPOTENCY_CONFLICT");

  async function submit(text: string, expected: string): Promise<void> {
    await input.fill(text);
    await send.click();
    await expect(log).toContainText(expected);
    await expect(input).toBeEnabled();
  }
});
