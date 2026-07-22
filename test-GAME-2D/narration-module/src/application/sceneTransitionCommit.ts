import { cloneJson, opaqueId, type AcceptedCommandDraft, type AggregateId, type AggregateRecord, type CommandId, type CommitRequest, type EventDraft, type EventId, type JsonObject } from "../core";
import type { SceneTransitionWorldCommandV1 } from "./sceneTransitionAdapter";

export const SCENE_LIFECYCLE_CONTRACT_VERSION_V1 = "scene-lifecycle/1" as const;
export const WORLD_PREPARED_SCENE_TRANSITION_VERSION_V1 = "world-prepared-scene-transition/1" as const;

export interface SceneLifecycleStateV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SCENE_LIFECYCLE_CONTRACT_VERSION_V1;
  activeSceneId: string;
  activeLocationRef: string;
  previousSceneId: string | null;
  enteredAtGameSecond: number;
  lastTransitionRequestId: string | null;
  version: number;
}

export interface WorldPreparedSceneTransitionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof WORLD_PREPARED_SCENE_TRANSITION_VERSION_V1;
  commandId: string;
  requestId: string;
  confirmedDestinationRef: string;
  arrivalSceneId: string;
  durationSeconds: number;
  effectiveAtGameSecond: number;
  positionAggregateId: string;
  expectedPositionRevision: number;
  nextPositionPayload: JsonObject;
  sourceRefs: string[];
  worldAuthority: true;
  version: 1;
}

export function validateWorldPreparedSceneTransitionV1(input: {
  command: SceneTransitionWorldCommandV1;
  result: WorldPreparedSceneTransitionV1;
  currentGameSecond: number;
}): { ok: true } | { ok: false; issues: string[] } {
  const { command, result } = input;
  const issues: string[] = [];
  if (result.contractVersion !== WORLD_PREPARED_SCENE_TRANSITION_VERSION_V1) issues.push("contractVersion mismatch");
  if (result.commandId !== command.commandId) issues.push("commandId mismatch");
  if (result.requestId !== command.requestId) issues.push("requestId mismatch");
  if (result.confirmedDestinationRef !== command.destinationRef) issues.push("destination mismatch");
  if (!result.arrivalSceneId.trim()) issues.push("arrivalSceneId is required");
  if (!Number.isInteger(result.durationSeconds) || result.durationSeconds < 1) issues.push("durationSeconds must be a positive integer");
  if (result.effectiveAtGameSecond !== input.currentGameSecond + result.durationSeconds) issues.push("effectiveAtGameSecond mismatch");
  if (!result.positionAggregateId.trim()) issues.push("positionAggregateId is required");
  if (!Number.isInteger(result.expectedPositionRevision) || result.expectedPositionRevision < 0) issues.push("expectedPositionRevision must be a non-negative integer");
  if (result.nextPositionPayload.canonicalLocationRef !== result.confirmedDestinationRef) issues.push("nextPositionPayload must confirm canonicalLocationRef");
  if (result.sourceRefs.length === 0 || result.sourceRefs.some(ref => !ref.trim())) issues.push("sourceRefs are required");
  if (result.worldAuthority !== true) issues.push("worldAuthority must be true");
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function augmentTemporalCommitWithSceneTransitionV1(input: {
  temporalCommit: CommitRequest;
  command: SceneTransitionWorldCommandV1;
  result: WorldPreparedSceneTransitionV1;
  currentGameSecond: number;
  currentPositionAggregate: AggregateRecord;
  sceneLifecycleAggregate: AggregateRecord;
}): { ok: true; value: CommitRequest } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const validation = validateWorldPreparedSceneTransitionV1({ command: input.command, result: input.result, currentGameSecond: input.currentGameSecond });
  if (!validation.ok) issues.push(...validation.issues);
  if (input.temporalCommit.operationId !== input.command.operationId || input.temporalCommit.campaignId !== input.command.campaignId) issues.push("temporal commit identity mismatch");
  if (input.temporalCommit.idempotencyKey !== input.command.idempotencyKey) issues.push("idempotencyKey mismatch");
  const temporalCommand = input.temporalCommit.acceptedCommands.find(command => command.commandType === "time.resolve-segment");
  if (temporalCommand?.payload.operationBindingMode !== "COMPOSITE_DOMAIN_COMMIT" || temporalCommand.payload.domainCommandId !== input.command.commandId) {
    issues.push("temporal commit is not bound to the scene transition command");
  }
  const clockWrite = input.temporalCommit.aggregateWrites.find(write => write.aggregateType === "world.clock");
  if (clockWrite?.payload.elapsedGameSeconds !== input.result.effectiveAtGameSecond) issues.push("temporal commit does not reach transition effective time");
  if (input.currentPositionAggregate.aggregateType !== "world.position" || input.currentPositionAggregate.aggregateId !== input.result.positionAggregateId || input.currentPositionAggregate.aggregateRevision !== input.result.expectedPositionRevision) issues.push("world.position aggregate mismatch");
  if (input.sceneLifecycleAggregate.aggregateType !== "scene.lifecycle") issues.push("scene lifecycle aggregate mismatch");
  const lifecycle = input.sceneLifecycleAggregate.payload as Partial<SceneLifecycleStateV1>;
  if (lifecycle.contractVersion !== SCENE_LIFECYCLE_CONTRACT_VERSION_V1 || lifecycle.activeSceneId !== input.command.sourceSceneId) issues.push("active scene mismatch");
  const existingWriteKeys = new Set(input.temporalCommit.aggregateWrites.map(write => `${write.aggregateType}:${write.aggregateId}`));
  for (const key of [`world.position:${input.currentPositionAggregate.aggregateId}`, `scene.lifecycle:${input.sceneLifecycleAggregate.aggregateId}`]) {
    if (existingWriteKeys.has(key)) issues.push(`duplicate aggregate write ${key}`);
  }
  if (issues.length > 0) return { ok: false, issues };

  const nextLifecycle: SceneLifecycleStateV1 = {
    schemaVersion: 1,
    contractVersion: SCENE_LIFECYCLE_CONTRACT_VERSION_V1,
    activeSceneId: input.result.arrivalSceneId,
    activeLocationRef: input.result.confirmedDestinationRef,
    previousSceneId: input.command.sourceSceneId,
    enteredAtGameSecond: input.result.effectiveAtGameSecond,
    lastTransitionRequestId: input.command.requestId,
    version: Number(lifecycle.version ?? 0) + 1
  };
  const positionRevision = input.currentPositionAggregate.aggregateRevision + 1;
  const sceneRevision = input.sceneLifecycleAggregate.aggregateRevision + 1;
  const acceptedCommand: AcceptedCommandDraft = {
    schemaVersion: 1,
    contractId: "world-scene-transition-command",
    contractVersion: 1,
    commandId: opaqueId<CommandId>(input.command.commandId),
    campaignId: input.temporalCommit.campaignId,
    operationId: input.temporalCommit.operationId,
    commandType: "world.prepare-local-scene-transition",
    target: { aggregateType: "world.position", aggregateId: input.currentPositionAggregate.aggregateId, expectedAggregateRevision: input.currentPositionAggregate.aggregateRevision },
    payloadSchemaVersion: 1,
    payload: cloneJson(input.command),
    acceptedAtGameSecond: input.currentGameSecond
  };
  const event: EventDraft = {
    schemaVersion: 1,
    eventId: opaqueId<EventId>(`${input.temporalCommit.operationId}:event:scene-transition`),
    campaignId: input.temporalCommit.campaignId,
    operationId: input.temporalCommit.operationId,
    eventType: "world.scene-transition.completed",
    origin: "PLAYER_INTENT",
    causation: { kind: "COMMAND", id: input.command.commandId },
    aggregateRefs: [
      { aggregateType: "world.position", aggregateId: input.currentPositionAggregate.aggregateId, aggregateRevision: positionRevision },
      { aggregateType: "scene.lifecycle", aggregateId: input.sceneLifecycleAggregate.aggregateId, aggregateRevision: sceneRevision }
    ],
    visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
    occurredAtGameSecond: input.result.effectiveAtGameSecond,
    payloadSchemaVersion: 1,
    payload: {
      requestId: input.command.requestId,
      sourceSceneId: input.command.sourceSceneId,
      destinationRef: input.result.confirmedDestinationRef,
      arrivalSceneId: input.result.arrivalSceneId,
      durationSeconds: input.result.durationSeconds,
      sourceRefs: [...input.result.sourceRefs]
    }
  };
  return {
    ok: true,
    value: {
      ...cloneJson(input.temporalCommit),
      acceptedCommands: [...input.temporalCommit.acceptedCommands.map(cloneJson), acceptedCommand],
      aggregateWrites: [...input.temporalCommit.aggregateWrites.map(cloneJson), {
        aggregateType: "world.position",
        aggregateId: input.currentPositionAggregate.aggregateId,
        expectedAggregateRevision: input.currentPositionAggregate.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.result.nextPositionPayload)
      }, {
        aggregateType: "scene.lifecycle",
        aggregateId: input.sceneLifecycleAggregate.aggregateId,
        expectedAggregateRevision: input.sceneLifecycleAggregate.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: nextLifecycle
      }],
      events: [...input.temporalCommit.events.map(cloneJson), event]
    }
  };
}
