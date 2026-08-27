import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type RepositoryClock
} from "../../src/core";
import {
  NarrativeTurnControllerV1,
  type NarrativeTurnControllerOutputWithSemanticFidelityV1
} from "../../src/application";
import {
  ConversationSemanticProviderH0,
  createConversationSemanticConfigH0
} from "../fixtures/conversation-semantic-fixtures-h0";

class FixedClock implements RepositoryClock {
  now(): Date {
    return new Date("2026-08-26T10:00:00.000Z");
  }
}

async function main(): Promise<void> {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-j10-h3-fidelity");
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>("agg-j10-h3-clock"),
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  });
  if (!created.ok) throw new Error(created.error.messageKey);

  const rawInput = "je m'approche du garde pour le saluer";
  const targetRef = "npc:npc-garde-blesse";
  const frame = {
    schemaVersion: 1 as const,
    understandingStatus: "UNDERSTOOD" as const,
    overallMeaning: "Le personnage s'approche du garde blessé, puis le salue.",
    overallCommitment: "committed" as const,
    globalConditions: [],
    components: [{
      componentId: "h3:approach",
      order: 1,
      meaning: "Le personnage s'approche du garde blessé.",
      commitment: "committed" as const,
      conditions: [],
      negated: false,
      quoted: false,
      relationToPrevious: "NONE" as const,
      alternativeGroupId: null,
      dependsOnComponentIds: [],
      simultaneousWithComponentIds: [],
      supersedesComponentIds: [],
      mentionedTargets: [{ surface: "le garde", proposedRef: targetRef }],
      suggestedDomain: "scene_resolution",
      suggestedAction: "S'approcher du garde blessé.",
      suggestedCapabilityId: "scene.visible-actor-approach",
      dialogueAct: null
    }, {
      componentId: "h3:greeting",
      order: 2,
      meaning: "Le personnage salue le garde blessé.",
      commitment: "committed" as const,
      conditions: [],
      negated: false,
      quoted: false,
      relationToPrevious: "THEN" as const,
      alternativeGroupId: null,
      dependsOnComponentIds: ["h3:approach"],
      simultaneousWithComponentIds: [],
      supersedesComponentIds: [],
      mentionedTargets: [{ surface: "le garde", proposedRef: targetRef }],
      suggestedDomain: "social",
      suggestedAction: "Saluer le garde blessé.",
      suggestedCapabilityId: "scene.visible-dialogue",
      dialogueAct: {
        act: "INITIATE_CONVERSATION" as const,
        contentGoal: "Saluer le garde blessé."
      }
    }],
    ambiguities: [],
    clarificationQuestion: null,
    confidence: "high" as const
  };
  const intentInterpreterConfig = createConversationSemanticConfigH0([{ rawInput, frame }]);
  const controller = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "j10-h3",
    intentInterpreterConfig
  });
  const submitted = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j10-h3-turn",
    rawInput
  });
  if (!submitted.ok) throw new Error(submitted.error.messageKey);
  const output = submitted.value.output as NarrativeTurnControllerOutputWithSemanticFidelityV1;
  const receipt = output.openSemanticFidelity;
  assert.ok(receipt, "un tour V8 doit publier son reçu de fidélité");
  assert.deepEqual(output.interpretation.openSemanticFrame, frame, "le cadre V8 original reste inchangé");
  assert.equal(output.resolution.interpretation.semanticSource, "OPEN_SEMANTIC_OWNER_ADAPTER_V1", "la résolution expose la projection réellement exécutée");
  assert.equal(output.resolution.characterExpression?.rawPlayerText, rawInput);
  assert.equal(output.resolution.characterExpression?.expressionText, rawInput);
  assert.equal(output.resolution.characterExpression?.fidelity, "RAW_EQUIVALENT");
  assert.equal(output.resolution.preparedEffects[0]?.targetRef, targetRef);
  assert.deepEqual(receipt.orderedComponents.map(component => component.componentId), ["h3:approach", "h3:greeting"]);
  assert.deepEqual(receipt.orderedComponents.map(component => component.order), [1, 2]);
  assert.deepEqual(receipt.orderedComponents.map(component => component.selectedByOwnerAdapter), [true, true]);
  assert.equal(receipt.dialogueAct?.act, "INITIATE_CONVERSATION");
  assert.equal(receipt.rawInputAccessByOwner, "FORBIDDEN");
  assert.deepEqual(receipt.validatedTargetRefs, [targetRef]);
  const projection = receipt.effectiveOwnerProjection as { rawInputAccess?: string; semanticInputText?: string };
  assert.equal(projection.rawInputAccess, "FORBIDDEN");
  assert.equal(projection.semanticInputText, frame.overallMeaning);
  const provider = intentInterpreterConfig.provider as ConversationSemanticProviderH0;
  assert.equal(provider.requests.length, 1, "la gate reste locale et n'effectue aucun appel OpenAI live");
  console.log("open-semantic-fidelity-j10h3/1: OK");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
