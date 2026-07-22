import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  coreError,
  opaqueId,
  type AggregateId,
  type CampaignClockPayload,
  type CampaignId,
  type CampaignRecord,
  type CommandId,
  type CommitId,
  type EventId,
  type RepositoryClock
} from "../../src/core";
import {
  NarrativeTurnControllerV1,
  createInitialReferenceSceneStateV1,
  normalizeSurfaceTyposV1,
  validateNpcPerformanceAgainstVisibleSceneV1
} from "../../src/application";
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
  assert.equal(typeof first.value.output.stageTimings?.interpretationMs, "number", "chronométrage interprétation exposé");
  assert.equal(typeof first.value.output.stageTimings?.resolutionMs, "number", "chronométrage résolution exposé");
  assert.equal(typeof first.value.output.stageTimings?.npcPerformanceMs, "number", "chronométrage performer exposé");
  assert.equal(normalizeSurfaceTyposV1("  j'adresse un bonnjour  "), "j'adresse un bonjour", "correction locale superficielle sans reformulation");
  assert.equal(validateNpcPerformanceAgainstVisibleSceneV1({
    utterances: [{ text: "Entrez donc à l'abri de cette pluie." }]
  } as never, createInitialReferenceSceneStateV1()).length, 1, "invitation à entrer rejetée lorsque le joueur est déjà dedans");
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

  const weather = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-controller-weather",
    rawInput: "aujourd'hui fait il beau ?"
  });
  if (!weather.ok) throw new Error(weather.error.messageKey);
  assert.equal(weather.value.output.interpretation.intentType, "meta_question");
  assert.equal(weather.value.output.interpretation.expectedTimeEffect, "NO_GAME_TIME");
  assert.equal(weather.value.output.resolution.resultKind, "NO_COMMIT_RESPONSE");
  assert.equal(weather.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "GM_NARRATION" &&
    /pluie|Auberge du Seuil|garde blessé/u.test(block.text)
  ), true, "une question météo doit recevoir une réponse de scène concrète");
  assert.equal(weather.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "SYSTEM_NOTICE" &&
    block.sourceRefs.includes("intent:meta_question") &&
    !block.sourceRefs.includes("intent:possibility_query") &&
    /Réponse de contexte/u.test(block.text)
  ), true, "une question météo doit rester une notification de contexte, pas de possibilité");

  const innDescription = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-controller-inn-description",
    rawInput: "peux tu me décrire l'auberge ?"
  });
  if (!innDescription.ok) throw new Error(innDescription.error.messageKey);
  assert.equal(innDescription.value.output.interpretation.intentType, "meta_question");
  assert.equal(innDescription.value.output.interpretation.expectedTimeEffect, "NO_GAME_TIME");
  assert.equal(innDescription.value.output.resolution.resultKind, "NO_COMMIT_RESPONSE");
  assert.equal(innDescription.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "GM_NARRATION" &&
    /Auberge du Seuil|garde blessé|serveuse|porte du fond/u.test(block.text)
  ), true, "une question de contexte fictionnel doit recevoir une réponse MJ concrète");
  assert.equal(innDescription.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "SYSTEM_NOTICE" &&
    block.sourceRefs.includes("intent:meta_question") &&
    /Réponse de contexte/u.test(block.text)
  ), true, "la description de contexte reste no-commit et sans temps de jeu");

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
  assert.equal(possibility.value.output.displayPacket.displayBlocks.some(block => block.kind === "NPC_SPEECH"), false);
  assert.equal(possibility.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "GM_NARRATION" &&
    /possibilité|pas une action|garde/u.test(block.text)
  ), true, "une possibilité peut être contextualisée sans exécuter l'action");
  assert.match(possibility.value.output.displayPacket.displayBlocks.at(-1)?.text ?? "", /Aucune action/);

  const speech = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-controller-speech",
    rawInput: "je demande au garde ce qu'il cherche"
  });
  if (!speech.ok) throw new Error(speech.error.messageKey);
  assert.equal(speech.value.output.interpretation.intentType, "speech");
  assert.equal(speech.value.output.resolution.resultKind, "COMMIT_APPLIED");
  assert.notEqual(speech.value.output.npcPerformance, null);
  assert.equal(speech.value.output.npcPerformance?.durableCommitments.length, 0);
  assert.equal(speech.value.output.npcPerformance?.revealedRefs.length, 0);
  assert.equal(speech.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" &&
    block.speaker.displayName === "Garde blessé" &&
    /entendu|confirmer/u.test(block.text)
  ), true, "le fallback dialogue doit accuser réception sans inventer une réponse hors sujet");
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
  assert.match(sceneState.shortTermNpcMemory[0]?.npcContinuitySummary ?? "", /garde|question|cherche/iu);

  const afterSpeechObservation = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-controller-after-speech-observe",
    rawInput: "j'observe le garde"
  });
  if (!afterSpeechObservation.ok) throw new Error(afterSpeechObservation.error.messageKey);
  assert.equal(afterSpeechObservation.value.operation.commitId, null);
  assert.equal(afterSpeechObservation.value.output.resolution.perception?.status, "AUTOMATIC_RESULT");
  assert.equal(afterSpeechObservation.value.output.resolution.perception?.depth, "GLANCE");
  assert.deepEqual(afterSpeechObservation.value.output.resolution.perception?.revealedClueRefs, ["guard-immediate-signs"]);
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
  assert.notEqual(repeatedSpeech.value.output.npcPerformance, null);
  assert.equal(repeatedSpeech.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" &&
    /comprends votre question|rien confirmer/u.test(block.text) &&
    !/déjà dit|réponse ne change pas|encore une fois/iu.test(block.text)
  ), true, "le PNJ doit répondre à l'acte courant sans inventer une ancienne réplique");

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

  const failureRepository = new MemoryCampaignRepository({ clock });
  const failureCampaignId = opaqueId<CampaignId>("cmp-controller-failure-release");
  const failureCampaign: CampaignRecord = {
    ...campaign,
    campaignId: failureCampaignId,
    clockAggregateId: opaqueId<AggregateId>("agg-controller-failure-clock")
  };
  const failureCreated = await failureRepository.createCampaign(failureCampaign, {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  });
  if (!failureCreated.ok) throw new Error(failureCreated.error.messageKey);
  const originalGetAggregate = failureRepository.getAggregate.bind(failureRepository);
  let failAggregateOnce = true;
  failureRepository.getAggregate = async (...args) => {
    if (failAggregateOnce) {
      failAggregateOnce = false;
      return { ok: false, error: coreError("VALIDATION_FAILED", "test.forced-precommit-failure") };
    }
    return originalGetAggregate(...args);
  };
  const failureController = new NarrativeTurnControllerV1({ repository: failureRepository, campaignId: failureCampaignId, clock, idPrefix: "failure-release" });
  const failedTurn = await failureController.submit({ schemaVersion: 1, clientRequestId: "req-failure-release-1", rawInput: "Je regarde la serveuse." });
  assert.equal(failedTurn.ok, false, "échec pré-commit forcé attendu");
  const cancelledOperation = await failureRepository.getOperation(opaqueId("failure-release-op-req-failure-release-1"));
  assert.equal(cancelledOperation.ok && cancelledOperation.value.phase, "CANCELLED", "l'opération échouée doit libérer la campagne");
  const recoveredTurn = await failureController.submit({ schemaVersion: 1, clientRequestId: "req-failure-release-2", rawInput: "Je regarde la serveuse." });
  assert.equal(recoveredTurn.ok, true, "le tour suivant ne doit pas rencontrer campaign-busy");

  let dynamicCapabilityCalled = false;
  const dynamicController = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "dynamic-route",
    dynamicPlaceRuntime: {
      canHandle() { dynamicCapabilityCalled = true; return true; },
      async execute(input) {
        const preparing = await input.repository.transitionOperation(input.operation.operationId, "RECEIVED", "PREPARING");
        if (!preparing.ok) return preparing;
        const ready = await input.repository.transitionOperation(input.operation.operationId, "PREPARING", "READY_TO_COMMIT");
        if (!ready.ok) return ready;
        const currentCampaign = await input.repository.getCampaign(input.campaignId);
        if (!currentCampaign.ok) return currentCampaign;
        const writerLease = await input.repository.acquireWriterLease(input.campaignId, opaqueId("writer-dynamic-controller"), 120_000);
        if (!writerLease.ok) return writerLease;
        const aggregateId = opaqueId<AggregateId>("agg-dynamic-controller-proof");
        const commandId = opaqueId<CommandId>("command-dynamic-controller-proof");
        const committed = await input.repository.commit({
          campaignId: input.campaignId, operationId: input.operation.operationId, commitId: opaqueId<CommitId>("commit-dynamic-controller-proof"),
          idempotencyKey: input.operation.idempotencyKey, requestFingerprint: input.operation.requestFingerprint,
          expectedCampaignRevision: currentCampaign.value.campaignRevision, writerLease: writerLease.value,
          acceptedCommands: [{ schemaVersion: 1, contractId: "dynamic-controller-proof", contractVersion: 1, commandId, campaignId: input.campaignId,
            operationId: input.operation.operationId, commandType: "dynamic.place.proof", target: { aggregateType: "test.dynamic-place", aggregateId, expectedAggregateRevision: null },
            payloadSchemaVersion: 1, payload: { routed: true }, acceptedAtGameSecond: 0 }],
          aggregateWrites: [{ aggregateType: "test.dynamic-place", aggregateId, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: { routed: true } }],
          events: [{ schemaVersion: 1, eventId: opaqueId<EventId>("event-dynamic-controller-proof"), campaignId: input.campaignId, operationId: input.operation.operationId,
            eventType: "dynamic.place.proof", origin: "SYSTEM", causation: { kind: "COMMAND", id: commandId }, aggregateRefs: [{ aggregateType: "test.dynamic-place", aggregateId, aggregateRevision: 0 }],
            visibility: { scope: "SYSTEM", actorIds: [] }, occurredAtGameSecond: 0, payloadSchemaVersion: 1, payload: { routed: true } }], outboxTasks: []
        });
        await input.repository.releaseWriterLease(writerLease.value);
        if (!committed.ok) return committed;
        return { ok: true, value: { commit: committed.value, arrival: { schemaVersion: 1, contractVersion: "scene-arrival/1", commitId: committed.value.commitId,
          transitionRequestId: `${input.operation.operationId}:dynamic`, destinationRef: "location:dynamic-test", previousSceneId: input.activeScene.sceneId,
          enteredAtGameSecond: 0, scene: input.activeScene, authoritySourceRefs: ["test:dynamic-route"], reconstructionRefs: [`commit:${committed.value.commitId}`], narrationStatus: "READY_AFTER_COMMIT", version: 1 },
          displayPacket: first.value.output.displayPacket, characterExpression: input.rawInput, durationSeconds: 0 } };
      }
    }
  });
  const dynamicTurn = await dynamicController.submit({ schemaVersion: 1, clientRequestId: "req-dynamic-route", rawInput: "Je m'approche du garde." });
  assert.equal(dynamicTurn.ok, true, dynamicTurn.ok ? undefined : dynamicTurn.error.messageKey);
  assert.equal(dynamicCapabilityCalled, true, "le contrôleur doit consulter la capacité de création dynamique structurée");
  if (dynamicTurn.ok) assert.equal(dynamicTurn.value.output.resolution.safetyNotes.some(note => note.includes("Lieu dynamique créé")), true);

  console.log("narrative-turn-controller/1: OK");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
