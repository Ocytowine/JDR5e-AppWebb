import { expect, test } from "@playwright/test";
import type { NarrativeTurnControllerV1 } from "../../src/application";
import type { DurableNpcCauseConfirmationV1 } from "../../src/application";

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
  await expect(log).toContainText("Répliques PNJ antérieures visibles (3)");
  await expect(log).toContainText("Couples intention → réponse (3)");
  await expect(log).not.toContainText("Interlocuteur");
  await expect(page.getByRole("alert")).toHaveCount(0);

  const forgedBeforeOwnerDecision = await page.evaluate(async ({ sceneActorId }) => {
    if (!window.__npcReturnController) throw new Error("controller unavailable");
    return window.__npcReturnController.promoteSceneActor({
      schemaVersion: 1,
      clientRequestId: "forged-copy-journal-mission",
      sceneId: "reference-inn-rain-001",
      sceneActorId,
      ownerConfirmation: {
        schemaVersion: 1,
        contractVersion: "durable-npc-cause-confirmation/1",
        engagementId: "engagement:not-persisted",
        ownerCommandId: "quest-command:not-persisted",
        ownerAuthority: true,
        cause: {
          schemaVersion: 1,
          causeKind: "ONGOING_COMMITMENT",
          authority: "QUEST",
          durableRef: "quest:copy-lost-journal",
          publicSourceRefs: ["event:invented-acceptance"],
          version: 1
        }
      }
    });
  }, { sceneActorId: "reference-inn-rain-001:ambient:copiste" });
  expect(forgedBeforeOwnerDecision.ok).toBe(false);

  const ownerConfirmation = await page.evaluate(async ({ sceneActorId }) => {
    if (!window.__npcReturnController) throw new Error("controller unavailable");
    const proposed = await window.__npcReturnController.proposeMissionRelationEngagement({
      schemaVersion: 1,
      contractVersion: "mission-relation-proposal-command/1",
      clientRequestId: "propose-copy-journal-mission",
      engagementId: "engagement:copy-lost-journal",
      engagementKind: "MISSION",
      sceneId: "reference-inn-rain-001",
      sceneActorId,
      durableRef: "quest:copy-lost-journal",
      summary: "Le copiste pourrait recopier le journal perdu.",
      proposedBy: "PLAYER",
      publicSourceRefs: ["dialogue:copy-lost-journal-proposed"]
    });
    if (!proposed.ok) throw new Error(proposed.error.messageKey);
    const resolved = await window.__npcReturnController.resolveMissionRelationEngagement({
      schemaVersion: 1,
      contractVersion: "mission-relation-resolution-command/1",
      clientRequestId: "resolve-copy-journal-mission",
      engagementId: "engagement:copy-lost-journal",
      resolution: {
        schemaVersion: 1,
        disposition: "ACCEPTED",
        authority: "QUEST",
        evidenceKind: "QUEST_RESOLUTION",
        authorityOperationId: "quest-resolution:copy-lost-journal",
        publicSourceRefs: ["event:copiste-accepted"],
        conditions: [],
        version: 1
      }
    });
    if (!resolved.ok) throw new Error(resolved.error.messageKey);
    if (resolved.value.ownerConfirmation === null) throw new Error("accepted engagement did not emit a confirmation");
    return resolved.value.ownerConfirmation;
  }, { sceneActorId: "reference-inn-rain-001:ambient:copiste" }) as DurableNpcCauseConfirmationV1;
  const ownerConfirmationText = JSON.stringify(ownerConfirmation);

  const promoted = await page.evaluate(async ({ sceneActorId, ownerConfirmationText }) => {
    if (!window.__npcReturnController) throw new Error("controller unavailable");
    const ownerConfirmation = JSON.parse(ownerConfirmationText) as DurableNpcCauseConfirmationV1;
    return window.__npcReturnController.promoteSceneActor({
      schemaVersion: 1,
      clientRequestId: "accept-copy-journal-mission",
      sceneId: "reference-inn-rain-001",
      sceneActorId,
      ownerConfirmation
    });
  }, { sceneActorId: "reference-inn-rain-001:ambient:copiste", ownerConfirmationText });
  expect(promoted.ok).toBe(true);
  if (!promoted.ok) throw new Error(promoted.error.messageKey);
  expect(promoted.value.replayed).toBe(false);
  expect(promoted.value.campaignNpc.displayName).toBe("Copiste itinérant");

  const replayed = await page.evaluate(async ({ sceneActorId, ownerConfirmationText }) => {
    if (!window.__npcReturnController) throw new Error("controller unavailable");
    const ownerConfirmation = JSON.parse(ownerConfirmationText) as DurableNpcCauseConfirmationV1;
    return window.__npcReturnController.promoteSceneActor({
      schemaVersion: 1,
      clientRequestId: "accept-copy-journal-mission",
      sceneId: "reference-inn-rain-001",
      sceneActorId,
      ownerConfirmation
    });
  }, { sceneActorId: "reference-inn-rain-001:ambient:copiste", ownerConfirmationText });
  expect(replayed.ok).toBe(true);
  if (!replayed.ok) throw new Error(replayed.error.messageKey);
  expect(replayed.value.replayed).toBe(true);

  const conflictingReplay = await page.evaluate(async ({ sceneActorId, ownerConfirmationText }) => {
    if (!window.__npcReturnController) throw new Error("controller unavailable");
    const ownerConfirmation = JSON.parse(ownerConfirmationText) as DurableNpcCauseConfirmationV1;
    return window.__npcReturnController.promoteSceneActor({
      schemaVersion: 1,
      clientRequestId: "accept-copy-journal-mission",
      sceneId: "reference-inn-rain-001",
      sceneActorId,
      ownerConfirmation: {
        ...ownerConfirmation,
        ownerCommandId: "quest-command:different-mission",
        cause: {
          ...ownerConfirmation.cause,
          durableRef: "quest:different-mission",
          publicSourceRefs: ["quest:different-mission"]
        }
      }
    });
  }, { sceneActorId: "reference-inn-rain-001:ambient:copiste", ownerConfirmationText });
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
