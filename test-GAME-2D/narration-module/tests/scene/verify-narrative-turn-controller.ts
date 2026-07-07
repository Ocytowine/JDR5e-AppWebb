import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignClockPayload,
  type CampaignId,
  type CampaignRecord,
  type RepositoryClock
} from "../../src/core";
import { NarrativeTurnControllerV1 } from "../../src/application";
import {
  REFERENCE_SCENE_STATE_AGGREGATE_ID_V1,
  REFERENCE_SCENE_STATE_AGGREGATE_TYPE_V1,
  resumeSuspendedIntentV1,
  type ReferenceSceneStateV1
} from "../../src/application";

class FixedClock implements RepositoryClock {
  constructor(private readonly instant = new Date("2026-07-07T12:00:00.000Z")) {}
  now(): Date {
    return new Date(this.instant);
  }
}

async function main(): Promise<void> {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-controller-test");
  const clockAggregateId = opaqueId<AggregateId>("agg-controller-clock");
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId,
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

  const controller = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "test"
  });

  const first = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-controller-1",
    rawInput: "je regarde autour de moi"
  });

  if (!first.ok) throw new Error(first.error.messageKey);
  assert.equal(first.value.operation.phase, "COMPLETED");
  assert.equal(first.value.operation.completionMode, "NO_COMMIT_RESPONSE");
  assert.equal(first.value.operation.commitId, null);
  assert.equal(first.value.output.noCommit, true);
  assert.equal(first.value.output.noGameTime, true);
  assert.equal(first.value.output.interpretation.intentType, "action");
  assert.equal(first.value.output.resolution.resultKind, "RESOLUTION_PROPOSED");
  assert.equal(first.value.output.displayPacket.sceneId, "reference-inn-rain-001");
  assert.equal(first.value.output.displayPacket.displayBlocks[0]?.kind, "RAW_INPUT");
  assert.equal(first.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "GM_NARRATION" &&
    /garde blessé|porte du fond|pluie/u.test(block.text)
  ), true, "observation doit produire une narration MJ concrète de la scène de référence");
  assert.match(first.value.output.displayPacket.displayBlocks.at(-1)?.text ?? "", /sans commit/);

  const replay = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-controller-1",
    rawInput: "je regarde autour de moi"
  });

  if (!replay.ok) throw new Error(replay.error.messageKey);
  assert.equal(replay.value.operation.operationId, first.value.operation.operationId);
  assert.deepEqual(replay.value.output, first.value.output);

  const conflict = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-controller-1",
    rawInput: "je force la porte"
  });

  assert.equal(conflict.ok, false, "même idempotence avec texte différent rejetée");
  if (!conflict.ok) assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  const clockAggregate = await repository.getAggregate(campaignId, "world.clock", clockAggregateId);
  if (!clockAggregate.ok) throw new Error(clockAggregate.error.messageKey);
  assert.equal((clockAggregate.value.payload as CampaignClockPayload).elapsedGameSeconds, 0, "aucune avance temporelle");
  const sceneStateBeforeSpeech = await repository.getAggregate(
    campaignId,
    REFERENCE_SCENE_STATE_AGGREGATE_TYPE_V1,
    REFERENCE_SCENE_STATE_AGGREGATE_ID_V1
  );
  assert.equal(sceneStateBeforeSpeech.ok, false, "une observation sans commit ne doit pas créer l'état de scène");
  if (!sceneStateBeforeSpeech.ok) assert.equal(sceneStateBeforeSpeech.error.code, "NOT_FOUND");

  const meta = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-controller-meta",
    rawInput: "comment fonctionne la règle d'inspiration ?"
  });
  if (!meta.ok) throw new Error(meta.error.messageKey);
  assert.equal(meta.value.output.interpretation.intentType, "meta_question");
  assert.equal(meta.value.output.interpretation.expectedTimeEffect, "NO_GAME_TIME");
  assert.equal(meta.value.output.resolution.resultKind, "NO_COMMIT_RESPONSE");
  assert.equal(meta.value.output.displayPacket.displayBlocks.some(block => block.kind === "GM_NARRATION" || block.kind === "NPC_SPEECH"), false);
  assert.match(meta.value.output.displayPacket.displayBlocks.at(-1)?.text ?? "", /sans commit/);

  const possibility = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-controller-possibility",
    rawInput: "je peux lui voler quelque chose ?"
  });
  if (!possibility.ok) throw new Error(possibility.error.messageKey);
  assert.equal(possibility.value.output.interpretation.intentType, "possibility_query");
  assert.equal(possibility.value.output.interpretation.commitment, "hypothetical");
  assert.equal(possibility.value.output.suspendedIntent, null);
  assert.equal(possibility.value.output.resolution.resultKind, "NO_COMMIT_RESPONSE");
  assert.equal(possibility.value.output.displayPacket.displayBlocks.some(block => block.kind === "GM_NARRATION" || block.kind === "NPC_SPEECH"), false);
  assert.match(possibility.value.output.displayPacket.displayBlocks.at(-1)?.text ?? "", /Aucune action/);

  const speech = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-controller-speech",
    rawInput: "je demande au garde ce qu'il cherche"
  });
  if (!speech.ok) throw new Error(speech.error.messageKey);
  assert.equal(speech.value.output.interpretation.intentType, "speech");
  assert.equal(speech.value.output.resolution.resultKind, "COMMIT_APPLIED");
  assert.equal(speech.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" &&
    block.speaker.displayName === "Garde blessé" &&
    /porte du fond/u.test(block.text)
  ), true, "dialogue doit produire une réponse PNJ ancrée dans la scène");
  const sceneStateAfterSpeech = await repository.getAggregate(
    campaignId,
    REFERENCE_SCENE_STATE_AGGREGATE_TYPE_V1,
    REFERENCE_SCENE_STATE_AGGREGATE_ID_V1
  );
  if (!sceneStateAfterSpeech.ok) throw new Error(sceneStateAfterSpeech.error.messageKey);
  const sceneState = sceneStateAfterSpeech.value.payload as ReferenceSceneStateV1;
  assert.equal(sceneState.guardAddressed, true);
  assert.equal(sceneState.backRoomDoorHighlighted, true);
  assert.equal(sceneState.interactionCount, 1);
  assert.equal(sceneState.lastPlayerSpeechSummary, speech.value.output.interpretation.coreMeaning);
  assert.equal(sceneState.shortTermNpcMemory.length, 1);
  assert.match(sceneState.shortTermNpcMemory[0]?.npcContinuitySummary ?? "", /porte du fond/u);

  const afterSpeechObservation = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-controller-after-speech-observe",
    rawInput: "j'observe le garde"
  });
  if (!afterSpeechObservation.ok) throw new Error(afterSpeechObservation.error.messageKey);
  assert.equal(afterSpeechObservation.value.operation.commitId, null);
  assert.equal(afterSpeechObservation.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "GM_NARRATION" &&
    /reconnaît maintenant|porte du fond/u.test(block.text)
  ), true, "l'observation suivante doit utiliser l'état de scène persisté");

  const repeatedSpeech = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-controller-repeat-guard",
    rawInput: "je demande au garde de répéter"
  });
  if (!repeatedSpeech.ok) throw new Error(repeatedSpeech.error.messageKey);
  assert.equal(repeatedSpeech.value.output.resolution.resultKind, "COMMIT_APPLIED");
  assert.equal(repeatedSpeech.value.output.sceneState.interactionCount, 2);
  assert.equal(repeatedSpeech.value.output.sceneState.shortTermNpcMemory.length, 2);
  assert.equal(repeatedSpeech.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" &&
    /Je vous l'ai dit/u.test(block.text)
  ), true, "le PNJ doit tenir compte de la mémoire courte au lieu de répéter la première réponse");

  const ambiguous = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-controller-ambiguous",
    rawInput: "lui voler quelque chose ?"
  });
  if (!ambiguous.ok) throw new Error(ambiguous.error.messageKey);
  assert.equal(ambiguous.value.output.interpretation.intentType, "unclear_commitment");
  assert.equal(ambiguous.value.output.interpretation.requiresClarification, true);
  assert.notEqual(ambiguous.value.output.suspendedIntent, null);
  assert.equal(ambiguous.value.output.resolution.resultKind, "CLARIFICATION_REQUIRED");
  assert.equal(ambiguous.value.output.displayPacket.displayBlocks.at(-1)?.kind, "CLARIFICATION");

  const suspended = ambiguous.value.output.suspendedIntent;
  if (suspended === null) throw new Error("Expected suspended intent.");
  const resume = resumeSuspendedIntentV1({
    suspendedIntentId: suspended.suspendedIntentId,
    answerRawInput: "non, je voulais juste savoir si c'était possible"
  });
  assert.equal(resume.suspendedIntentId, suspended.suspendedIntentId);
  assert.equal(resume.resumedCommitment, "hypothetical");
  assert.equal(resume.noGameTime, true);

  console.log("narrative-turn-controller/1: OK");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
