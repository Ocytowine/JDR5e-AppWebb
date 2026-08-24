import {
  computeRequestFingerprint, coreError, opaqueId,
  type AggregateId, type AggregateRecord, type CampaignId, type CampaignRepository, type CommandId, type CommitId,
  type EventId, type IdempotencyKey, type OperationId, type OperationRecord, type RepositoryClock, type RequestId,
  type Result, type WriterId
} from "../core";
import { planNextTemporalBatchV1, prepareTemporalSegmentCommitV1, type TemporalTaskV1 } from "../time";
import { buildSceneReferentRegistryV1 } from "./sceneReferentRegistry";
import { prepareSceneTransitionWorldRequestV1 } from "./sceneTransitionAdapter";
import { PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1 } from "./campaignRuntimeBindings";
import { createNarrativeSceneTransitionRuntimeV1, type SceneTransitionRuntimePreparationPortV1 } from "./sceneTransitionRuntime";
import { REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, type PlayableSceneStateV1 } from "./playableScene";
import {
  PROTOTYPE_INN_BACK_ROOM_REF_V1,
  PROTOTYPE_INN_BACK_ROOM_SCENE_V1,
  PROTOTYPE_INN_BACK_ROOM_TRANSITION_SECONDS_V1,
  PROTOTYPE_INN_COMMON_ROOM_REF_V1,
  PROTOTYPE_INN_SCENE_TRANSITION_TOPOLOGY_V1
} from "./prototypeInnSceneTransitionContent";

export const PROTOTYPE_POSITION_AGGREGATE_ID_V1 =
  PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1.positionAggregateId;
export const PROTOTYPE_SCENE_LIFECYCLE_AGGREGATE_ID_V1 =
  PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1.sceneLifecycleAggregateId;
export const PROTOTYPE_SCHEDULE_AGGREGATE_ID_V1 =
  PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1.scheduleAggregateId;
export const PROTOTYPE_CURSOR_AGGREGATE_ID_V1 =
  PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1.simulationCursorAggregateId;
export const PROTOTYPE_PROCESS_AGGREGATE_ID_V1 =
  PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1.processAggregateId;
const POSITION_ID = PROTOTYPE_POSITION_AGGREGATE_ID_V1;
const SCHEDULE_ID = PROTOTYPE_SCHEDULE_AGGREGATE_ID_V1;
const CURSOR_ID = PROTOTYPE_CURSOR_AGGREGATE_ID_V1;
const PROCESS_ID = PROTOTYPE_PROCESS_AGGREGATE_ID_V1;
const PREPARATION_PORT: SceneTransitionRuntimePreparationPortV1 = {
  async prepare(input) {
    const target = input.interpretation.referentResolution?.resolvedTarget ?? input.interpretation.semanticIntent.target;
    if (target?.ref === null || target?.ref === undefined) return failure("narrative.scene-transition.target-required");
    const lifecycle = await input.repository.getAggregate(input.campaign.campaignId, "scene.lifecycle", PROTOTYPE_SCENE_LIFECYCLE_AGGREGATE_ID_V1);
    if (!lifecycle.ok) return lifecycle;
    const sourceScene = sceneById(String(lifecycle.value.payload.activeSceneId));
    if (sourceScene === null) return failure("narrative.scene-transition.prototype-source-scene-unknown", { activeSceneId: lifecycle.value.payload.activeSceneId });
    const sourceSceneVersion = sourceScene.version;
    const request = {
      schemaVersion: 1 as const, contractVersion: "scene-transition/1" as const,
      requestId: `${input.operation.operationId}:scene-transition`, operationId: input.operation.operationId, campaignId: input.campaign.campaignId,
      actorRef: "character:prototype-player", sourceSceneId: sourceScene.sceneId, sourceSceneVersion,
      boundaryRef: target.ref, expectedDestinationRef: null, intentId: input.interpretation.intentId, idempotencyKey: input.operation.idempotencyKey
    };
    const preparedCommand = prepareSceneTransitionWorldRequestV1({ request, registry: buildSceneReferentRegistryV1(sourceScene), topology: PROTOTYPE_INN_SCENE_TRANSITION_TOPOLOGY_V1, currentSceneVersion: sourceSceneVersion });
    if (preparedCommand.command === null) return failure("narrative.scene-transition.prototype-connection-rejected", { code: preparedCommand.decision.code });
    const destinationScene = sceneByLocationRef(preparedCommand.command.destinationRef);
    if (destinationScene === null) return failure("narrative.scene-transition.prototype-destination-scene-unknown", { destinationRef: preparedCommand.command.destinationRef });
    const position = await input.repository.getAggregate(input.campaign.campaignId, "world.position", POSITION_ID);
    if (!position.ok) return position;
    const clock = await input.repository.getAggregate(input.campaign.campaignId, "world.clock", input.campaign.clockAggregateId);
    if (!clock.ok) return clock;
    const currentGameSecond = Number(clock.value.payload.elapsedGameSeconds);
    const task: TemporalTaskV1 = { schemaVersion: 1, taskId: `${input.operation.operationId}:activity:transition`, taskKind: "ACTIVITY_COMPLETION", dueAtGameSecond: currentGameSecond + PROTOTYPE_INN_BACK_ROOM_TRANSITION_SECONDS_V1, boundaryPolicy: "SIMULTANEOUS", dependsOnTaskIds: [], payload: { transitionRequestId: request.requestId } };
    const batch = await planNextTemporalBatchV1({ batchId: `${input.operation.operationId}:temporal-batch`, currentGameSecond, requestedTargetGameSecond: currentGameSecond + PROTOTYPE_INN_BACK_ROOM_TRANSITION_SECONDS_V1, tasks: [task] });
    if (!batch.ok) return failure("narrative.scene-transition.temporal-plan-rejected", { diagnostics: batch.diagnostics });
    if (batch.value === null) return failure("narrative.scene-transition.temporal-plan-empty");
    const schedule = await optionalAggregate(input.repository, input.campaign.campaignId, "world.schedule", SCHEDULE_ID);
    if (!schedule.ok) return schedule;
    const cursor = await optionalAggregate(input.repository, input.campaign.campaignId, "world.simulation-cursor", CURSOR_ID);
    if (!cursor.ok) return cursor;
    const eventId = opaqueId<EventId>(`${input.operation.operationId}:event:transition-time`);
    const temporal = await prepareTemporalSegmentCommitV1({
      campaign: input.campaign, operation: input.operation, writerLease: input.writerLease, clockAggregate: clock.value,
      scheduleAggregate: schedule.value, scheduleAggregateId: SCHEDULE_ID,
      simulationCursorAggregate: cursor.value, simulationCursorAggregateId: CURSOR_ID,
      processAggregate: null, processAggregateId: PROCESS_ID, nextProcess: null,
      batch: batch.value,
      operationBinding: {
        mode: "COMPOSITE_DOMAIN_COMMIT",
        domainCommandId: opaqueId<CommandId>(preparedCommand.command.commandId),
        batchFingerprint: batch.value.batchFingerprint
      },
      resolutions: [{ taskId: task.taskId, outcome: "RESOLVED", eventId, eventType: "world.scene-transition.time-resolved", origin: "PLAYER_INTENT", visibility: { scope: "SYSTEM", actorIds: [] }, payload: { durationSeconds: PROTOTYPE_INN_BACK_ROOM_TRANSITION_SECONDS_V1 } }],
      newEffects: [], commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit:transition`), commandId: opaqueId<CommandId>(`${input.operation.operationId}:command:time`)
    });
    if (!temporal.ok) return failure("narrative.scene-transition.temporal-commit-rejected", { diagnostics: temporal.diagnostics });
    return { ok: true, value: {
      command: preparedCommand.command, temporalCommit: temporal.value,
      worldResult: { schemaVersion: 1, contractVersion: "world-prepared-scene-transition/1", commandId: preparedCommand.command.commandId, requestId: preparedCommand.command.requestId, confirmedDestinationRef: preparedCommand.command.destinationRef, arrivalSceneId: destinationScene.sceneId, durationSeconds: PROTOTYPE_INN_BACK_ROOM_TRANSITION_SECONDS_V1, effectiveAtGameSecond: currentGameSecond + PROTOTYPE_INN_BACK_ROOM_TRANSITION_SECONDS_V1, positionAggregateId: POSITION_ID, expectedPositionRevision: position.value.aggregateRevision, nextPositionPayload: { ...position.value.payload, canonicalLocationRef: preparedCommand.command.destinationRef }, sourceRefs: [...preparedCommand.command.sourceRefs], worldAuthority: true, version: 1 },
      currentPositionAggregate: position.value, currentSceneLifecycleAggregate: lifecycle.value, destinationScene,
      authoritySourceRefs: ["prototype-content:inn/1", "prototype-content:inn-back-room/1"], currentGameSecond, characterExpression: input.rawInput.trim()
    } };
  }
};

export function createPrototypeInnSceneTransitionRuntimeV1() {
  return createNarrativeSceneTransitionRuntimeV1(PREPARATION_PORT);
}

export async function ensurePrototypeInnSceneTransitionStateV1(
  repository: CampaignRepository,
  campaignId: CampaignId,
  clock: RepositoryClock,
  initial: { scene: PlayableSceneStateV1; locationRef: string } = { scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, locationRef: PROTOTYPE_INN_COMMON_ROOM_REF_V1 }
): Promise<void> {
  const [position, lifecycle] = await Promise.all([repository.getAggregate(campaignId, "world.position", POSITION_ID), repository.getAggregate(campaignId, "scene.lifecycle", PROTOTYPE_SCENE_LIFECYCLE_AGGREGATE_ID_V1)]);
  if (position.ok && lifecycle.ok) return;
  if (position.ok !== lifecycle.ok || (!position.ok && position.error.code !== "NOT_FOUND") || (!lifecycle.ok && lifecycle.error.code !== "NOT_FOUND")) throw new Error("Prototype scene transition state is inconsistent");
  const campaign = await repository.getCampaign(campaignId); if (!campaign.ok) throw new Error(campaign.error.messageKey);
  const operationId = opaqueId<OperationId>("prototype-scene-transition-bootstrap");
  const payload = { kind: "prototype.scene-transition.bootstrap" };
  const fingerprint = await computeRequestFingerprint("prototype.scene-transition.bootstrap", 1, payload);
  const now = clock.now().toISOString();
  const operation: OperationRecord = { schemaVersion: 1, operationId, campaignId, clientRequestId: opaqueId<RequestId>("prototype-scene-transition-bootstrap"), idempotencyKey: opaqueId<IdempotencyKey>("prototype-scene-transition-bootstrap"), requestFingerprint: fingerprint, operationKind: "prototype.scene-transition.bootstrap", requestPayloadSchemaVersion: 1, requestPayload: payload, phase: "RECEIVED", observedCampaignRevision: campaign.value.campaignRevision, commitId: null, completionMode: null, resultPayloadSchemaVersion: null, resultPayload: null, failure: null, receivedAt: now, updatedAt: now };
  const received = await repository.receiveOperation(operation); if (!received.ok) throw new Error(received.error.messageKey);
  if (received.value.phase === "COMPLETED") return;
  const preparing = await repository.transitionOperation(operationId, "RECEIVED", "PREPARING"); if (!preparing.ok) throw new Error(preparing.error.messageKey);
  const ready = await repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT"); if (!ready.ok) throw new Error(ready.error.messageKey);
  const lease = await repository.acquireWriterLease(campaignId, opaqueId<WriterId>("prototype-scene-transition-bootstrap-writer"), 120_000); if (!lease.ok) throw new Error(lease.error.messageKey);
  const commandId = opaqueId<CommandId>("prototype-scene-transition-bootstrap-command");
  const commit = await repository.commit({ campaignId, operationId, commitId: opaqueId<CommitId>("prototype-scene-transition-bootstrap-commit"), idempotencyKey: operation.idempotencyKey, requestFingerprint: fingerprint, expectedCampaignRevision: campaign.value.campaignRevision, writerLease: lease.value,
    acceptedCommands: [{ schemaVersion: 1, contractId: "prototype.scene-transition", contractVersion: 1, commandId, campaignId, operationId, commandType: "prototype.scene-transition.bootstrap", target: { aggregateType: "world.position", aggregateId: POSITION_ID, expectedAggregateRevision: null }, payloadSchemaVersion: 1, payload, acceptedAtGameSecond: 0 }],
    aggregateWrites: [{ aggregateType: "world.position", aggregateId: POSITION_ID, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: { characterId: "prototype-player", locationId: initial.locationRef.replace(/^(?:location|place):/u, ""), canonicalLocationRef: initial.locationRef } }, { aggregateType: "scene.lifecycle", aggregateId: PROTOTYPE_SCENE_LIFECYCLE_AGGREGATE_ID_V1, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: { schemaVersion: 1, contractVersion: "scene-lifecycle/1", activeSceneId: initial.scene.sceneId, activeLocationRef: initial.locationRef, previousSceneId: null, enteredAtGameSecond: 0, lastTransitionRequestId: null, version: 1 } }],
    events: [{ schemaVersion: 1, eventId: opaqueId<EventId>("prototype-scene-transition-bootstrap-event"), campaignId, operationId, eventType: "prototype.scene-transition.initialized", origin: "SYSTEM", causation: { kind: "COMMAND", id: commandId }, aggregateRefs: [{ aggregateType: "world.position", aggregateId: POSITION_ID, aggregateRevision: 0 }, { aggregateType: "scene.lifecycle", aggregateId: PROTOTYPE_SCENE_LIFECYCLE_AGGREGATE_ID_V1, aggregateRevision: 0 }], visibility: { scope: "SYSTEM", actorIds: [] }, occurredAtGameSecond: 0, payloadSchemaVersion: 1, payload }], outboxTasks: [] });
  await repository.releaseWriterLease(lease.value); if (!commit.ok) throw new Error(commit.error.messageKey);
  const completed = await repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, { initialized: true }); if (!completed.ok) throw new Error(completed.error.messageKey);
}

export async function readOptionalPrototypeAggregateV1(repository: CampaignRepository, campaignId: CampaignId, type: string, id: AggregateId): Promise<Result<AggregateRecord | null>> {
  const result = await repository.getAggregate(campaignId, type, id);
  return result.ok ? { ok: true, value: result.value } : result.error.code === "NOT_FOUND" ? { ok: true, value: null } : result;
}
const optionalAggregate = readOptionalPrototypeAggregateV1;

export async function resolvePrototypeInnActiveSceneV1(input: { repository: CampaignRepository; campaignId: CampaignId }): Promise<Result<PlayableSceneStateV1>> {
  const lifecycle = await input.repository.getAggregate(input.campaignId, "scene.lifecycle", PROTOTYPE_SCENE_LIFECYCLE_AGGREGATE_ID_V1);
  if (!lifecycle.ok) return lifecycle;
  const activeSceneId = lifecycle.value.payload.activeSceneId;
  if (activeSceneId === REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId) return { ok: true, value: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1 };
  if (activeSceneId === PROTOTYPE_INN_BACK_ROOM_SCENE_V1.sceneId) return { ok: true, value: PROTOTYPE_INN_BACK_ROOM_SCENE_V1 };
  return failure("narrative.active-scene.prototype-unknown", { activeSceneId });
}

function failure(messageKey: string, details: Record<string, unknown> = {}): Result<never> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, details as never) };
}

function sceneById(sceneId: string): PlayableSceneStateV1 | null {
  if (sceneId === REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId) return REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1;
  if (sceneId === PROTOTYPE_INN_BACK_ROOM_SCENE_V1.sceneId) return PROTOTYPE_INN_BACK_ROOM_SCENE_V1;
  return null;
}

function sceneByLocationRef(locationRef: string): PlayableSceneStateV1 | null {
  if (locationRef === PROTOTYPE_INN_COMMON_ROOM_REF_V1) return REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1;
  if (locationRef === PROTOTYPE_INN_BACK_ROOM_REF_V1) return PROTOTYPE_INN_BACK_ROOM_SCENE_V1;
  return null;
}
