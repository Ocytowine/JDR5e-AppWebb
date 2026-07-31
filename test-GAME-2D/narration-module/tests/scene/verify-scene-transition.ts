import assert from "node:assert/strict";
import {
  decideSceneTransitionV1,
  type SceneTransitionRequestV1,
  type SceneTransitionTopologyV1
} from "../../src/application/sceneTransition";
import {
  prepareSceneTransitionWorldRequestV1,
  validateSceneTransitionWorldCommandV1,
  type SceneTransitionWorldCommandV1
} from "../../src/application/sceneTransitionAdapter";
import type { SceneReferentRegistryV1 } from "../../src/application/sceneReferentRegistry";
import {
  augmentTemporalCommitWithSceneTransitionV1,
  type WorldPreparedSceneTransitionV1
} from "../../src/application/sceneTransitionCommit";
import { opaqueId, validateCommitRequest, type AggregateId, type AggregateRecord, type CampaignId, type CampaignRecord, type CampaignRepository, type CommandId, type CommitId, type CommitRecord, type CommitRequest, type IdempotencyKey, type OperationId, type OperationRecord, type WriterId } from "../../src/core";
import { buildSceneArrivalAfterCommitV1 } from "../../src/application/sceneArrival";
import { buildSceneArrivalDisplayPacketV1, buildSceneArrivalRenderPlanV1 } from "../../src/application/sceneArrivalRender";
import { WATCHTOWER_DAWN_PLAYABLE_SCENE_V1 } from "../../src/application/playableScene";
import { createNarrativeSceneTransitionRuntimeV1 } from "../../src/application/sceneTransitionRuntime";
import { mergePlaceCreationWithTemporalCommitV1 } from "../../src/application/dynamicPlaceEntryRuntime";
import {
  buildCampaignDynamicPlaceTransitionIdsV1
} from "../../src/application/campaignDynamicPlaceRuntime";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2,
  buildActiveSceneContextPackV1,
  buildActiveSceneNarrativeBriefV1,
  createDefaultAiIntentInterpreterConfigV1,
  createPrototypeNarrativeTurnControllerV1,
  PROTOTYPE_INN_BACK_ROOM_SCENE_V1,
  validateActiveSceneNarrativeCandidateV1
} from "../../src/application";
import type { AiCallRequestV1, AiRoleOutputEnvelopeV1, AiSemanticIntentPayloadV2, ContractAiProviderV1 } from "../../src/ai";

const request: SceneTransitionRequestV1 = {
  schemaVersion: 1,
  contractVersion: "scene-transition/1",
  requestId: "request-1",
  operationId: "operation-1",
  campaignId: "campaign-1",
  actorRef: "character:hero-1",
  sourceSceneId: "scene-common-room",
  sourceSceneVersion: 3,
  boundaryRef: "poi:service-door",
  expectedDestinationRef: "location:service-room",
  intentId: "intent-1",
  idempotencyKey: "campaign-1:operation-1:transition-1"
};

const topology: SceneTransitionTopologyV1 = {
  schemaVersion: 1,
  contractVersion: "scene-transition/1",
  topologyId: "building-topology-1",
  topologyVersion: 2,
  connections: [{
    schemaVersion: 1,
    connectionId: "connection-service-door",
    sourceSceneId: "scene-common-room",
    boundaryRef: "poi:service-door",
    destinationRef: "location:service-room",
    scale: "LOCAL",
    state: "OPEN",
    sourceRefs: ["lore-location:inn-1", "world-topology:inn-1:2"],
    version: 1
  }]
};

const ready = decideSceneTransitionV1({ request, topology, currentSceneVersion: 3 });
assert.equal(ready.disposition, "READY");
assert.equal(ready.code, "READY_FOR_LOCAL_COMMIT");
assert.equal(ready.destinationRef, "location:service-room");
assert.equal(ready.commitAuthority, false);

const registry: SceneReferentRegistryV1 = {
  schemaVersion: 1,
  contractVersion: "scene-referent-registry/1",
  sceneId: "scene-common-room",
  sceneVersion: 3,
  referents: [{
    schemaVersion: 1,
    canonicalRef: "poi:service-door",
    kind: "object",
    displayName: "Passage de service",
    publicAliases: ["passage latéral"],
    publicProperties: ["Un passage visible dans le mur est."],
    publicDestinationAliases: ["pièce voisine"],
    present: true,
    visible: true,
    interactionCapabilities: ["observe", "manipulate"],
    sourceRef: "scene:scene-common-room:poi:service-door",
    version: 1
  }]
};
const prepared = prepareSceneTransitionWorldRequestV1({ request, registry, topology, currentSceneVersion: 3 });
assert.equal(prepared.decision.code, "READY_FOR_LOCAL_COMMIT");
assert.ok(prepared.command);
assert.equal(prepared.command.destinationRef, "location:service-room");
assert.equal(prepared.command.timePolicy, "WORLD_VALIDATED");
assert.equal(prepared.command.commitAuthority, false);
assert.equal(validateSceneTransitionWorldCommandV1(prepared.command).ok, true);

const campaignId = opaqueId<CampaignId>("campaign-1");
const operationId = opaqueId<OperationId>("operation-1");
const positionId = opaqueId<AggregateId>("agg-position-1");
const lifecycleId = opaqueId<AggregateId>("agg-scene-lifecycle-1");
const temporalCommit: CommitRequest = {
  campaignId,
  operationId,
  commitId: opaqueId<CommitId>("commit-transition-1"),
  idempotencyKey: opaqueId<IdempotencyKey>("campaign-1:operation-1:transition-1"),
  requestFingerprint: `sha256:${"0".repeat(64)}`,
  expectedCampaignRevision: 7,
  writerLease: { campaignId, writerId: opaqueId<WriterId>("writer-1"), fencingToken: 1, acquiredAt: "2026-07-22T10:00:00.000Z", expiresAt: "2026-07-22T10:02:00.000Z" },
  acceptedCommands: [{
    schemaVersion: 1,
    contractId: "temporal-kernel",
    contractVersion: 1,
    commandId: opaqueId<CommandId>("command-time-1"),
    campaignId,
    operationId,
    commandType: "time.resolve-segment",
    target: { aggregateType: "world.clock", aggregateId: opaqueId<AggregateId>("agg-clock-1"), expectedAggregateRevision: 2 },
    payloadSchemaVersion: 1,
    payload: {
      durationSeconds: 8,
      operationBindingMode: "COMPOSITE_DOMAIN_COMMIT",
      domainCommandId: prepared.command.commandId
    },
    acceptedAtGameSecond: 100
  }],
  aggregateWrites: [{ aggregateType: "world.clock", aggregateId: opaqueId<AggregateId>("agg-clock-1"), expectedAggregateRevision: 2, payloadSchemaVersion: 1, payload: { elapsedGameSeconds: 108, calendarId: "calendar-1", calendarVersion: 1 } }],
  events: [],
  outboxTasks: []
};
const currentPosition: AggregateRecord = { schemaVersion: 1, campaignId, aggregateType: "world.position", aggregateId: positionId, aggregateRevision: 5, payloadSchemaVersion: 1, payload: { characterId: "hero-1", canonicalLocationRef: "location:common-room" }, updatedByCommitId: null };
const currentLifecycle: AggregateRecord = { schemaVersion: 1, campaignId, aggregateType: "scene.lifecycle", aggregateId: lifecycleId, aggregateRevision: 4, payloadSchemaVersion: 1, payload: { schemaVersion: 1, contractVersion: "scene-lifecycle/1", activeSceneId: "scene-common-room", activeLocationRef: "location:common-room", previousSceneId: null, enteredAtGameSecond: 20, lastTransitionRequestId: null, version: 3 }, updatedByCommitId: null };
const worldResult: WorldPreparedSceneTransitionV1 = {
  schemaVersion: 1,
  contractVersion: "world-prepared-scene-transition/1",
  commandId: prepared.command.commandId,
  requestId: prepared.command.requestId,
  confirmedDestinationRef: "location:service-room",
  arrivalSceneId: "scene-service-room-arrival-1",
  durationSeconds: 8,
  effectiveAtGameSecond: 108,
  positionAggregateId: positionId,
  expectedPositionRevision: 5,
  nextPositionPayload: { characterId: "hero-1", canonicalLocationRef: "location:service-room" },
  sourceRefs: ["world-topology:building-1:2"],
  worldAuthority: true,
  version: 1
};
const atomic = augmentTemporalCommitWithSceneTransitionV1({ temporalCommit, command: prepared.command, result: worldResult, currentGameSecond: 100, currentPositionAggregate: currentPosition, sceneLifecycleAggregate: currentLifecycle });
assert.equal(atomic.ok, true, atomic.ok ? undefined : atomic.issues.join(" | "));
if (!atomic.ok) throw new Error("atomic transition preparation failed");
assert.equal(atomic.value.aggregateWrites.some(write => write.aggregateType === "world.position"), true);
assert.equal(atomic.value.aggregateWrites.some(write => write.aggregateType === "scene.lifecycle"), true);
assert.equal(atomic.value.events.at(-1)?.eventType, "world.scene-transition.completed");
const atomicValidation = validateCommitRequest(atomic.value);
assert.equal(atomicValidation.valid, true, atomicValidation.valid ? undefined : atomicValidation.issues.join(" | "));
assert.equal(temporalCommit.aggregateWrites.length, 1, "la préparation ne doit pas muter le commit temporel source");
const replay = augmentTemporalCommitWithSceneTransitionV1({ temporalCommit, command: prepared.command, result: worldResult, currentGameSecond: 100, currentPositionAggregate: currentPosition, sceneLifecycleAggregate: currentLifecycle });
assert.deepEqual(replay, atomic, "un rejeu avec les mêmes versions doit préparer exactement le même commit");
const staleAtomic = augmentTemporalCommitWithSceneTransitionV1({ temporalCommit, command: prepared.command, result: { ...worldResult, expectedPositionRevision: 4 }, currentGameSecond: 100, currentPositionAggregate: currentPosition, sceneLifecycleAggregate: currentLifecycle });
assert.equal(staleAtomic.ok, false);
assert.equal(temporalCommit.aggregateWrites.length, 1, "un rejet ne doit laisser aucune écriture partielle");

const placeCreationCommit: CommitRequest = {
  ...temporalCommit,
  acceptedCommands: [{
    schemaVersion: 1, contractId: "place-creation-command", contractVersion: 1,
    commandId: opaqueId<CommandId>("command-place-composite-1"), campaignId, operationId,
    commandType: "world.create-place", target: { aggregateType: "world.place-registry", aggregateId: opaqueId<AggregateId>("agg-places-1"), expectedAggregateRevision: 0 },
    payloadSchemaVersion: 1, payload: { proposalId: "proposal-composite-1" }, acceptedAtGameSecond: 108
  }],
  aggregateWrites: [
    { aggregateType: "world.place-registry", aggregateId: opaqueId<AggregateId>("agg-places-1"), expectedAggregateRevision: 0, payloadSchemaVersion: 1, payload: { places: ["location:service-room"] } },
    { aggregateType: "world.scene-topology", aggregateId: opaqueId<AggregateId>("agg-topology-1"), expectedAggregateRevision: 0, payloadSchemaVersion: 1, payload: { connections: ["connection-service-door"] } },
    { aggregateType: "campaign.place-facts", aggregateId: opaqueId<AggregateId>("agg-place-facts-1"), expectedAggregateRevision: 0, payloadSchemaVersion: 1, payload: { facts: ["stable-place"] } }
  ],
  events: [{
    schemaVersion: 1, eventId: opaqueId("event-place-composite-1"), campaignId, operationId,
    eventType: "world.place.created", origin: "AI_PROPOSAL", causation: { kind: "COMMAND", id: "command-place-composite-1" },
    aggregateRefs: [
      { aggregateType: "world.place-registry", aggregateId: opaqueId<AggregateId>("agg-places-1"), aggregateRevision: 1 },
      { aggregateType: "world.scene-topology", aggregateId: opaqueId<AggregateId>("agg-topology-1"), aggregateRevision: 1 },
      { aggregateType: "campaign.place-facts", aggregateId: opaqueId<AggregateId>("agg-place-facts-1"), aggregateRevision: 1 }
    ], visibility: { scope: "SYSTEM", actorIds: [] }, occurredAtGameSecond: 108, payloadSchemaVersion: 1, payload: { placeRef: "location:service-room" }
  }]
};
const mergedCreation = mergePlaceCreationWithTemporalCommitV1({ temporalCommit, placeCommit: placeCreationCommit, writerLease: temporalCommit.writerLease });
assert.equal(mergedCreation.ok, true, mergedCreation.ok ? undefined : mergedCreation.issues.join(" | "));
if (!mergedCreation.ok) throw new Error("composite creation merge failed");
const atomicCreationAndEntry = augmentTemporalCommitWithSceneTransitionV1({ temporalCommit: mergedCreation.commit, command: prepared.command, result: worldResult, currentGameSecond: 100, currentPositionAggregate: currentPosition, sceneLifecycleAggregate: currentLifecycle });
assert.equal(atomicCreationAndEntry.ok, true, atomicCreationAndEntry.ok ? undefined : atomicCreationAndEntry.issues.join(" | "));
if (!atomicCreationAndEntry.ok) throw new Error("atomic creation and entry failed");
assert.equal(atomicCreationAndEntry.value.aggregateWrites.length, 6, "time, place, topology, facts, position and scene lifecycle must share one commit");
assert.equal(validateCommitRequest(atomicCreationAndEntry.value).valid, true);

async function verifyPlayerCampaignDynamicTransitionIds(): Promise<void> {
  const playerCampaignOperationId = opaqueId<OperationId>(
    "nar:cmp-player-f82559af7f30cfcf03bcc8a41f6820e9-op-nar-ui-02c62261-e5fc-4a70-9b0c-caf4cb76edce"
  );
  const playerCampaignTransitionIds =
    await buildCampaignDynamicPlaceTransitionIdsV1(playerCampaignOperationId);
  assert.match(
    playerCampaignTransitionIds.requestId,
    /^[a-z][a-z0-9._:-]{2,127}$/u
  );
  assert.match(
    playerCampaignTransitionIds.commandId,
    /^[a-z][a-z0-9._:-]{2,127}$/u
  );
  const playerCampaignCommand: SceneTransitionWorldCommandV1 = {
    ...prepared.command!,
    requestId: playerCampaignTransitionIds.requestId,
    commandId: playerCampaignTransitionIds.commandId,
    operationId: playerCampaignOperationId
  };
  const playerCampaignTemporalCommit: CommitRequest = {
    ...temporalCommit,
    operationId: playerCampaignOperationId,
    acceptedCommands: temporalCommit.acceptedCommands.map(command => ({
      ...command,
      operationId: playerCampaignOperationId,
      payload: {
        ...command.payload,
        domainCommandId: playerCampaignTransitionIds.commandId
      }
    }))
  };
  const playerCampaignPlaceCommit: CommitRequest = {
    ...placeCreationCommit,
    operationId: playerCampaignOperationId,
    acceptedCommands: placeCreationCommit.acceptedCommands.map(command => ({
      ...command,
      operationId: playerCampaignOperationId
    })),
    events: placeCreationCommit.events.map(event => ({
      ...event,
      operationId: playerCampaignOperationId
    }))
  };
  const playerCampaignMerged = mergePlaceCreationWithTemporalCommitV1({
    temporalCommit: playerCampaignTemporalCommit,
    placeCommit: playerCampaignPlaceCommit,
    writerLease: temporalCommit.writerLease
  });
  assert.equal(
    playerCampaignMerged.ok,
    true,
    playerCampaignMerged.ok ? undefined : playerCampaignMerged.issues.join(" | ")
  );
  if (!playerCampaignMerged.ok) {
    throw new Error("player campaign composite creation merge failed");
  }
  const playerCampaignAtomic = augmentTemporalCommitWithSceneTransitionV1({
    temporalCommit: playerCampaignMerged.commit,
    command: playerCampaignCommand,
    result: {
      ...worldResult,
      requestId: playerCampaignTransitionIds.requestId,
      commandId: playerCampaignTransitionIds.commandId
    },
    currentGameSecond: 100,
    currentPositionAggregate: currentPosition,
    sceneLifecycleAggregate: currentLifecycle
  });
  assert.equal(
    playerCampaignAtomic.ok,
    true,
    playerCampaignAtomic.ok ? undefined : playerCampaignAtomic.issues.join(" | ")
  );
  if (!playerCampaignAtomic.ok) {
    throw new Error("player campaign atomic transition preparation failed");
  }
  const playerCampaignValidation = validateCommitRequest(
    playerCampaignAtomic.value
  );
  assert.equal(
    playerCampaignValidation.valid,
    true,
    playerCampaignValidation.valid
      ? undefined
      : playerCampaignValidation.issues.join(" | ")
  );
  assert.equal(
    playerCampaignAtomic.value.acceptedCommands[2]?.commandId,
    playerCampaignTransitionIds.commandId
  );
  assert.equal(
    playerCampaignAtomic.value.events[1]?.causation.id,
    playerCampaignTransitionIds.commandId
  );
}

const committed: CommitRecord = {
  schemaVersion: 1,
  commitId: temporalCommit.commitId,
  campaignId,
  operationId,
  idempotencyKey: temporalCommit.idempotencyKey,
  requestFingerprint: temporalCommit.requestFingerprint,
  previousCampaignRevision: 7,
  campaignRevision: 8,
  commitSequence: 8,
  commandIds: atomic.value.acceptedCommands.map(command => command.commandId),
  eventIds: atomic.value.events.map(event => event.eventId),
  aggregateWrites: atomic.value.aggregateWrites.map(write => ({
    aggregateType: write.aggregateType,
    aggregateId: write.aggregateId,
    previousRevision: write.expectedAggregateRevision,
    aggregateRevision: write.expectedAggregateRevision === null ? 0 : write.expectedAggregateRevision + 1
  })),
  outboxTaskIds: [],
  committedAt: "2026-07-22T10:00:08.000Z"
};
const committedPosition: AggregateRecord = {
  ...currentPosition,
  aggregateRevision: 6,
  payload: worldResult.nextPositionPayload,
  updatedByCommitId: committed.commitId
};
const lifecycleWrite = atomic.value.aggregateWrites.find(write => write.aggregateType === "scene.lifecycle")!;
const committedLifecycle: AggregateRecord = {
  ...currentLifecycle,
  aggregateRevision: 5,
  payload: lifecycleWrite.payload,
  updatedByCommitId: committed.commitId
};
const destinationScene = {
  ...WATCHTOWER_DAWN_PLAYABLE_SCENE_V1,
  sceneId: "scene-service-room-arrival-1",
  locationName: "Pièce de service",
  perceptibleSituation: ["Une pièce de service étroite s'ouvre au-delà du passage."],
  playerKnownFacts: ["Le personnage a franchi le passage depuis la salle commune."],
  currentTension: "Le contenu visible de la pièce reste à examiner."
};
const sourceScene = {
  ...WATCHTOWER_DAWN_PLAYABLE_SCENE_V1,
  sceneId: "scene-common-room",
  locationName: "Salle commune",
  pointsOfInterest: [{
    schemaVersion: 1 as const,
    pointId: "service-door",
    label: "Passage de service",
    visibleDescription: "Un passage visible mène vers la pièce voisine.",
    keywords: ["passage", "service"],
    destinationAliases: ["la pièce voisine"],
    version: 1 as const
  }]
};
const arrival = buildSceneArrivalAfterCommitV1({
  commit: committed,
  positionAggregate: committedPosition,
  sceneLifecycleAggregate: committedLifecycle,
  destinationScene,
  authoritySourceRefs: ["lore-location:service-room", "world-position:campaign-1:8"]
});
assert.equal(arrival.ok, true, arrival.ok ? undefined : arrival.issues.join(" | "));
if (!arrival.ok) throw new Error("arrival reconstruction failed");
assert.equal(arrival.value.narrationStatus, "READY_AFTER_COMMIT");
assert.equal(arrival.value.scene.locationName, "Pièce de service");
assert.equal(arrival.value.previousSceneId, "scene-common-room");
assert.equal(arrival.value.scene.perceptibleSituation.some(text => text.includes("tour de pierre")), false, "la mise en scène précédente ne doit pas être restaurée");
const arrivalPlan = buildSceneArrivalRenderPlanV1({ operationId, rawInput: "Je franchis le passage.", characterExpression: "Je franchis le passage.", arrival: arrival.value, durationSeconds: 8, sourceScene, sourceBoundaryRef: "poi:service-door" });
assert.equal(arrivalPlan.rhythmDecision.reason, "ASK_PLAYER");
assert.equal(arrivalPlan.blocks.find(block => block.kind === "GM_NARRATION")?.textPolicy, "AI_NARRATIVE_ALLOWED");
assert.equal(arrivalPlan.blocks.find(block => block.kind === "GM_NARRATION")?.groundedIn.includes(`commit:${committed.commitId}`), true);
const arrivalPacket = buildSceneArrivalDisplayPacketV1({ operationId, rawInput: "Je franchis le passage.", characterExpression: "Je franchis le passage.", arrival: arrival.value, durationSeconds: 8, sourceScene, sourceBoundaryRef: "poi:service-door" });
assert.equal(arrivalPacket.sceneId, destinationScene.sceneId);
assert.match(arrivalPacket.displayBlocks.find(block => block.kind === "GM_NARRATION")?.text ?? "", /Pièce de service/u);
assert.match(arrivalPacket.displayBlocks.find(block => block.kind === "GM_NARRATION")?.text ?? "", /quittes Salle commune/u);
assert.match(arrivalPacket.displayBlocks.find(block => block.kind === "GM_NARRATION")?.text ?? "", /passage indiqué vers la pièce voisine/u);
assert.match(arrivalPacket.displayBlocks.find(block => block.kind === "SYSTEM_NOTICE")?.text ?? "", /temps=8 s/u);

const uncommittedArrival = buildSceneArrivalAfterCommitV1({
  commit: committed,
  positionAggregate: { ...committedPosition, updatedByCommitId: null },
  sceneLifecycleAggregate: committedLifecycle,
  destinationScene,
  authoritySourceRefs: ["lore-location:service-room"]
});
assert.equal(uncommittedArrival.ok, false, "aucune scène d'arrivée ne doit être produite avant confirmation du commit");

const wrongDestinationArrival = buildSceneArrivalAfterCommitV1({
  commit: committed,
  positionAggregate: { ...committedPosition, payload: { canonicalLocationRef: "location:cellar" } },
  sceneLifecycleAggregate: committedLifecycle,
  destinationScene,
  authoritySourceRefs: ["lore-location:service-room"]
});
assert.equal(wrongDestinationArrival.ok, false);

const runtimeCampaign: CampaignRecord = { schemaVersion: 1, campaignId, campaignRevision: 7, status: "ACTIVE", clockAggregateId: opaqueId<AggregateId>("agg-clock-1"), dependencies: { contentPackageId: "content-1", contentPackageVersion: 1, rulesetId: "rules-1", rulesetVersion: 1, calendarId: "calendar-1", calendarVersion: 1 }, writeBlock: null, lastCommitId: null, createdAt: "2026-07-22T10:00:00.000Z", updatedAt: "2026-07-22T10:00:00.000Z" };
const runtimeOperation: OperationRecord = { schemaVersion: 1, operationId, campaignId, clientRequestId: opaqueId("request-1"), idempotencyKey: temporalCommit.idempotencyKey, requestFingerprint: temporalCommit.requestFingerprint, operationKind: "narrative.turn.input", requestPayloadSchemaVersion: 1, requestPayload: { rawInput: "Je franchis le passage." }, phase: "RECEIVED", observedCampaignRevision: 7, commitId: null, completionMode: null, resultPayloadSchemaVersion: null, resultPayload: null, failure: null, receivedAt: "2026-07-22T10:00:00.000Z", updatedAt: "2026-07-22T10:00:00.000Z" };
let leaseReleased = false;
const runtimeRepository = {
  async transitionOperation(_operationId: OperationId, _expected: string, next: string) { return { ok: true, value: { ...runtimeOperation, phase: next } }; },
  async getCampaign() { return { ok: true, value: runtimeCampaign }; },
  async acquireWriterLease() { return { ok: true, value: temporalCommit.writerLease }; },
  async releaseWriterLease() { leaseReleased = true; return { ok: true, value: undefined }; },
  async commit(request: CommitRequest) { assert.equal(validateCommitRequest(request).valid, true); return { ok: true, value: committed }; },
  async getAggregate(_campaignId: CampaignId, aggregateType: string) {
    return aggregateType === "world.position" ? { ok: true, value: committedPosition } : { ok: true, value: committedLifecycle };
  }
} as unknown as CampaignRepository;
const concreteRuntime = createNarrativeSceneTransitionRuntimeV1({
  async prepare() {
    return { ok: true, value: { command: prepared.command!, temporalCommit, worldResult, currentPositionAggregate: currentPosition, currentSceneLifecycleAggregate: currentLifecycle, destinationScene, authoritySourceRefs: ["lore-location:service-room"], currentGameSecond: 100, characterExpression: "Je franchis le passage." } };
  }
});
async function verifyConcreteRuntime(): Promise<void> {
  const runtimeResult = await concreteRuntime.execute({ repository: runtimeRepository, campaignId, operation: runtimeOperation, rawInput: "Je franchis le passage.", interpretation: {} as never, domainCommand: {} as never, activeScene: sourceScene });
  assert.ok(runtimeResult.ok, runtimeResult.ok ? undefined : runtimeResult.error.messageKey);
  assert.equal(runtimeResult.value.arrival.scene.sceneId, destinationScene.sceneId);
  assert.equal(runtimeResult.value.displayPacket.displayBlocks.some(block => block.kind === "GM_NARRATION"), true);
  assert.equal(leaseReleased, true, "le runtime doit libérer le lease après succès");
}

async function verifyPrototypeVerticalTransition(): Promise<void> {
  const observedSceneIds: string[] = [];
  const provider: ContractAiProviderV1 = {
    async generate(call: AiCallRequestV1): Promise<unknown> {
      const rawInput = (call.input.task as { rawInput: string }).rawInput;
      observedSceneIds.push(String((call.input.roleContextPack as { sceneId?: string }).sceneId));
      const observation = rawInput === "Que vois-je ici ?" || rawInput === "J'examine les traces humides.";
      const approachLamp = rawInput === "Je m'approche de la lampe basse.";
      const returnToCommonRoom = rawInput === "Je repasse par la porte vers la salle commune.";
      const targetMention = approachLamp
        ? { surface: "la lampe basse", candidateKind: "object" as const, proposedRef: "element:low-lamp", contextLink: "EXPLICIT" as const }
        : rawInput === "J'examine les traces humides."
          ? { surface: "les traces humides", candidateKind: "object" as const, proposedRef: "element:wet-traces", contextLink: "EXPLICIT" as const }
          : observation
            ? null
            : returnToCommonRoom
              ? { surface: "la porte vers la salle commune", candidateKind: "object" as const, proposedRef: "poi:common-room-door", contextLink: "EXPLICIT" as const }
              : { surface: "la porte du fond", candidateKind: "object" as const, proposedRef: "poi:back-room-door", contextLink: "EXPLICIT" as const };
      const payload: AiSemanticIntentPayloadV2 = {
        rawInputEcho: rawInput,
        intent: {
          kind: observation ? "observe_environment" : approachLamp ? "move_near_visible_actor" : "traverse_visible_boundary",
          commitment: "committed",
          preconditions: [],
          playerGoal: observation ? "Observer les éléments demandés dans la scène actuelle." : approachLamp ? "Se placer près de la lampe basse." : returnToCommonRoom ? "Revenir dans la salle commune." : "Franchir la porte du fond et entrer dans l'arrière-salle.",
          actionHint: observation ? "observer" : approachLamp ? "approcher" : "franchir",
          domainHint: observation ? "perception" : approachLamp ? "scene_resolution" : "world",
          scope: observation ? "PERCEPTION" : approachLamp ? "LOCAL_INTERACTION" : "SCENE_TRANSITION",
          targetMention,
          perception: observation ? { schemaVersion: 1, depth: rawInput.includes("traces") ? "FOCUSED" : "GLANCE", focus: rawInput.includes("traces") ? "traces humides" : "scène actuelle", soughtInformation: "éléments visibles" } : null,
          dialogueAct: null,
          uncertainties: [],
          clarificationPrompt: null,
          confidence: "high"
        }
      };
      return {
        schemaVersion: 1, contractVersion: call.contractVersion, outputId: `output:${call.attemptId}`,
        callId: call.callId, attemptId: call.attemptId, packId: call.packId, snapshotId: call.snapshotId,
        role: call.role, status: "OK", payload, diagnostics: [], supersedesOutputId: null
      } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV2>;
    }
  };
  const base = createDefaultAiIntentInterpreterConfigV1();
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: {
      ...base,
      provider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2,
      route: { ...base.route, allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2] }
    },
    mjPlannerConfig: null,
    npcPerformerConfig: null
  });
  const result = await controller.submit({ schemaVersion: 1, clientRequestId: "prototype-transition-vertical", rawInput: "Je franchis la porte du fond et entre dans l'arrière-salle." });
  assert.ok(result.ok, result.ok ? undefined : `${result.error.messageKey} ${JSON.stringify(result.error.details)}`);
  assert.equal(result.value.output.noGameTime, false);
  assert.equal(result.value.output.sceneArrival?.scene.sceneId, "reference-inn-back-room-001");
  assert.equal(result.value.output.sceneArrival?.enteredAtGameSecond, 8);
  assert.equal(result.value.output.displayPacket.displayBlocks.some(block => block.kind === "GM_NARRATION" && block.text.includes("Arrière-salle")), true);
  const arrivalBrief = buildActiveSceneNarrativeBriefV1({
    rawInput: "Je franchis la porte du fond et entre dans l'arrière-salle.",
    interpretation: result.value.output.interpretation,
    resolution: result.value.output.resolution,
    activeScene: PROTOTYPE_INN_BACK_ROOM_SCENE_V1,
    displayPacket: result.value.output.displayPacket
  });
  assert.equal(arrivalBrief.transitionNarrativeRequired, true);
  assert.match(arrivalBrief.confirmedTransitionNarrative ?? "", /quittes Auberge du Seuil/u);
  assert.match(arrivalBrief.confirmedTransitionNarrative ?? "", /Quelques pas plus loin/u);
  const arrivalPack = await buildActiveSceneContextPackV1({
    campaignId: "cmp-narrative-prototype",
    operationId: result.value.output.operationId,
    packId: "pack-transition-journey",
    snapshotId: "snapshot-transition-journey",
    activeScene: PROTOTYPE_INN_BACK_ROOM_SCENE_V1,
    brief: arrivalBrief
  });
  assert.equal(
    arrivalPack.blocks.some(block =>
      block.text.includes("départ, franchissement, arrivée")
    ),
    true,
    "le writer reçoit le cheminement confirmé sans la scène source complète"
  );
  const next = await controller.submit({ schemaVersion: 1, clientRequestId: "prototype-transition-observation", rawInput: "Que vois-je ici ?" });
  assert.ok(next.ok, next.ok ? undefined : next.error.messageKey);
  assert.deepEqual(observedSceneIds, ["reference-inn-rain-001", "reference-inn-back-room-001"]);
  assert.equal(next.value.output.displayPacket.sceneId, "reference-inn-back-room-001");
  assert.equal(next.value.output.displayPacket.displayBlocks.some(block => block.kind === "GM_NARRATION" && block.text.includes("lampe basse")), true);
  const approached = await controller.submit({ schemaVersion: 1, clientRequestId: "prototype-transition-approach-lamp", rawInput: "Je m'approche de la lampe basse." });
  assert.ok(approached.ok, approached.ok ? undefined : approached.error.messageKey);
  assert.equal(approached.value.output.displayPacket.sceneId, "reference-inn-back-room-001");
  const traces = await controller.submit({ schemaVersion: 1, clientRequestId: "prototype-transition-examine-traces", rawInput: "J'examine les traces humides." });
  assert.ok(traces.ok, traces.ok ? undefined : traces.error.messageKey);
  assert.equal(traces.value.output.resolution.perception?.revealedTexts.some(text => text.includes("plusieurs marques irrégulières")), true);
  const returned = await controller.submit({ schemaVersion: 1, clientRequestId: "prototype-transition-return", rawInput: "Je repasse par la porte vers la salle commune." });
  assert.ok(returned.ok, returned.ok ? undefined : `${returned.error.messageKey} ${JSON.stringify(returned.error.details)}`);
  assert.equal(returned.value.output.sceneArrival?.scene.sceneId, "reference-inn-rain-001");
  assert.equal(returned.value.output.sceneArrival?.enteredAtGameSecond, 16);
  assert.deepEqual(observedSceneIds, ["reference-inn-rain-001", "reference-inn-back-room-001", "reference-inn-back-room-001", "reference-inn-back-room-001", "reference-inn-back-room-001"]);
  const brief = buildActiveSceneNarrativeBriefV1({ rawInput: "Que vois-je ici ?", interpretation: next.value.output.interpretation, resolution: next.value.output.resolution, activeScene: PROTOTYPE_INN_BACK_ROOM_SCENE_V1, priorDisplayPackets: [result.value.output.displayPacket, next.value.output.displayPacket] });
  const pack = await buildActiveSceneContextPackV1({ campaignId: "cmp-narrative-prototype", operationId: next.value.output.operationId, packId: "pack-active-scene-test", snapshotId: "snapshot-active-scene-test", activeScene: PROTOTYPE_INN_BACK_ROOM_SCENE_V1, brief, priorDisplayPackets: [result.value.output.displayPacket, next.value.output.displayPacket] });
  assert.equal(pack.blocks.some(block => block.text.includes("Garde blessé")), false, "l'ancienne scène ne doit pas entrer dans le contexte du writer");
  assert.equal(validateActiveSceneNarrativeCandidateV1({ brief, groundedIn: brief.allowedGrounding, factDiscipline: { addedUnsupportedFacts: [], usesOnlyProvidedVisibleEntities: true, noNewEvents: true, noHiddenPresence: true } }).ok, true);
  assert.equal(validateActiveSceneNarrativeCandidateV1({ brief, groundedIn: ["playable-scene:reference-inn-rain-001:1"], factDiscipline: { addedUnsupportedFacts: [], usesOnlyProvidedVisibleEntities: false, noNewEvents: true, noHiddenPresence: true } }).ok, false);
}

const aliasIsNotAuthority = prepareSceneTransitionWorldRequestV1({
  request: { ...request, boundaryRef: "pièce voisine" }, registry, topology, currentSceneVersion: 3
});
assert.equal(aliasIsNotAuthority.command, null);
assert.equal(aliasIsNotAuthority.decision.code, "INVALID_REQUEST");

const mismatch = decideSceneTransitionV1({
  request: { ...request, expectedDestinationRef: "location:cellar" }, topology, currentSceneVersion: 3
});
assert.equal(mismatch.code, "DESTINATION_MISMATCH");
assert.equal(mismatch.disposition, "REJECT");

const blocked = decideSceneTransitionV1({
  request,
  topology: { ...topology, connections: [{ ...topology.connections[0]!, state: "BLOCKED" }] },
  currentSceneVersion: 3
});
assert.equal(blocked.code, "BOUNDARY_STATE_REQUIRES_RESOLUTION");
assert.equal(blocked.disposition, "HANDOFF");

const travel = decideSceneTransitionV1({
  request,
  topology: { ...topology, connections: [{ ...topology.connections[0]!, scale: "TRAVEL" }] },
  currentSceneVersion: 3
});
assert.equal(travel.code, "TRAVEL_HANDOFF_REQUIRED");
const preparedTravel = prepareSceneTransitionWorldRequestV1({
  request,
  registry,
  topology: { ...topology, connections: [{ ...topology.connections[0]!, scale: "TRAVEL" }] },
  currentSceneVersion: 3
});
assert.equal(preparedTravel.command, null);
assert.equal(preparedTravel.decision.code, "TRAVEL_HANDOFF_REQUIRED");

const stale = decideSceneTransitionV1({ request, topology, currentSceneVersion: 4 });
assert.equal(stale.code, "STALE_SCENE_VERSION");

const absent = decideSceneTransitionV1({
  request: { ...request, boundaryRef: "poi:unknown-door" }, topology, currentSceneVersion: 3
});
assert.equal(absent.code, "CONNECTION_NOT_FOUND");

const ambiguous = decideSceneTransitionV1({
  request,
  topology: { ...topology, connections: [...topology.connections, { ...topology.connections[0]!, connectionId: "connection-service-door-2", destinationRef: "location:courtyard" }] },
  currentSceneVersion: 3
});
assert.equal(ambiguous.code, "AMBIGUOUS_CONNECTION");
assert.equal(ambiguous.disposition, "CLARIFY");

void Promise.all([
  verifyConcreteRuntime(),
  verifyPrototypeVerticalTransition(),
  verifyPlayerCampaignDynamicTransitionIds()
]).then(() => {
  console.log("scene-transition/1: OK");
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
