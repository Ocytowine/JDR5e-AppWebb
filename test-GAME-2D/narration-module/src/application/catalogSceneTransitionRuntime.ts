import { coreError, opaqueId, type CommandId, type CommitId, type EventId, type Result } from "../core";
import { planNextTemporalBatchV1, prepareTemporalSegmentCommitV1, type TemporalTaskV1 } from "../time";
import { buildSceneReferentRegistryV1 } from "./sceneReferentRegistry";
import { prepareSceneTransitionWorldRequestV1 } from "./sceneTransitionAdapter";
import { createNarrativeSceneTransitionRuntimeV1 } from "./sceneTransitionRuntime";
import type { PlaceTopologyStateV1 } from "./placeCreationCommit";
import { DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1 } from "./placeCreationRuntime";
import type { PlayableSceneStateV1 } from "./playableScene";
import {
  PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1,
  type CampaignRuntimeBindingsV1
} from "./campaignRuntimeBindings";
import {
  readOptionalPrototypeAggregateV1
} from "./prototypeSceneTransitionRuntime";

export function createCatalogSceneTransitionRuntimeV1(input: {
  resolveSource(sceneId: string, context: { repository: Parameters<Parameters<typeof createNarrativeSceneTransitionRuntimeV1>[0]["prepare"]>[0]["repository"]; campaignId: string }): Promise<Result<PlayableSceneStateV1>>;
  resolveDestination(destinationRef: string, context: { repository: Parameters<Parameters<typeof createNarrativeSceneTransitionRuntimeV1>[0]["prepare"]>[0]["repository"]; campaignId: string }): Promise<Result<PlayableSceneStateV1>>;
  actorRef?: string;
  transitionSeconds?: number;
  runtimeBindings?: CampaignRuntimeBindingsV1;
}) {
  const duration = input.transitionSeconds ?? 8;
  const bindings =
    input.runtimeBindings ?? PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1;
  return createNarrativeSceneTransitionRuntimeV1({
    async prepare(requestInput) {
      const target = requestInput.interpretation.referentResolution?.resolvedTarget ?? requestInput.interpretation.semanticIntent.target;
      if (!target?.ref) return failure("narrative.scene-transition.target-required");
      const [topologyAggregate, lifecycle, position, clock, schedule, cursor] = await Promise.all([
        requestInput.repository.getAggregate(requestInput.campaign.campaignId, "world.scene-topology", DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1),
        requestInput.repository.getAggregate(requestInput.campaign.campaignId, "scene.lifecycle", bindings.sceneLifecycleAggregateId),
        requestInput.repository.getAggregate(requestInput.campaign.campaignId, "world.position", bindings.positionAggregateId),
        requestInput.repository.getAggregate(requestInput.campaign.campaignId, "world.clock", requestInput.campaign.clockAggregateId),
        readOptionalPrototypeAggregateV1(requestInput.repository, requestInput.campaign.campaignId, "world.schedule", bindings.scheduleAggregateId),
        readOptionalPrototypeAggregateV1(requestInput.repository, requestInput.campaign.campaignId, "world.simulation-cursor", bindings.simulationCursorAggregateId)
      ]);
      if (!topologyAggregate.ok) return topologyAggregate; if (!lifecycle.ok) return lifecycle; if (!position.ok) return position;
      if (!clock.ok) return clock; if (!schedule.ok) return schedule; if (!cursor.ok) return cursor;
      const source = await input.resolveSource(String(lifecycle.value.payload.activeSceneId), { repository: requestInput.repository, campaignId: requestInput.campaign.campaignId });
      if (!source.ok) return source;
      const topology = (topologyAggregate.value.payload as PlaceTopologyStateV1).topology;
      const transitionRequest = {
        schemaVersion: 1 as const, contractVersion: "scene-transition/1" as const,
        requestId: `${requestInput.operation.operationId}:scene-transition`, operationId: requestInput.operation.operationId,
        campaignId: requestInput.campaign.campaignId, actorRef: input.actorRef ?? "character:prototype-player",
        sourceSceneId: source.value.sceneId, sourceSceneVersion: source.value.version,
        boundaryRef: target.ref, expectedDestinationRef: null, intentId: requestInput.interpretation.intentId,
        idempotencyKey: requestInput.operation.idempotencyKey
      };
      const prepared = prepareSceneTransitionWorldRequestV1({ request: transitionRequest, registry: buildSceneReferentRegistryV1(source.value), topology, currentSceneVersion: source.value.version });
      if (prepared.command === null) return failure("narrative.scene-transition.catalog-connection-rejected", {
        decisionCode: prepared.decision.code,
        decisionDisposition: prepared.decision.disposition,
        decisionReason: prepared.decision.reason,
        sourceSceneId: source.value.sceneId,
        sourceSceneVersion: source.value.version,
        boundaryRef: target.ref,
        topologyId: topology.topologyId,
        topologyVersion: topology.topologyVersion,
        sourceConnections: topology.connections
          .filter(connection => connection.sourceSceneId === source.value.sceneId)
          .map(connection => ({ boundaryRef: connection.boundaryRef, destinationRef: connection.destinationRef, state: connection.state, scale: connection.scale }))
      });
      const destination = await input.resolveDestination(prepared.command.destinationRef, { repository: requestInput.repository, campaignId: requestInput.campaign.campaignId });
      if (!destination.ok) return destination;
      const currentGameSecond = Number(clock.value.payload.elapsedGameSeconds);
      const task: TemporalTaskV1 = { schemaVersion: 1, taskId: `${requestInput.operation.operationId}:activity:transition`, taskKind: "ACTIVITY_COMPLETION", dueAtGameSecond: currentGameSecond + duration, boundaryPolicy: "SIMULTANEOUS", dependsOnTaskIds: [], payload: { transitionRequestId: transitionRequest.requestId } };
      const batch = await planNextTemporalBatchV1({ batchId: `${requestInput.operation.operationId}:temporal-batch`, currentGameSecond, requestedTargetGameSecond: currentGameSecond + duration, tasks: [task] });
      if (!batch.ok || batch.value === null) return failure("narrative.scene-transition.temporal-plan-rejected", { diagnostics: batch.ok ? [] : batch.diagnostics });
      const temporal = await prepareTemporalSegmentCommitV1({
        campaign: requestInput.campaign, operation: requestInput.operation, writerLease: requestInput.writerLease,
        clockAggregate: clock.value, scheduleAggregate: schedule.value, scheduleAggregateId: bindings.scheduleAggregateId,
        simulationCursorAggregate: cursor.value, simulationCursorAggregateId: bindings.simulationCursorAggregateId,
        processAggregate: null, processAggregateId: bindings.processAggregateId, nextProcess: null, batch: batch.value,
        operationBinding: { mode: "COMPOSITE_DOMAIN_COMMIT", domainCommandId: opaqueId<CommandId>(prepared.command.commandId), batchFingerprint: batch.value.batchFingerprint },
        resolutions: [{ taskId: task.taskId, outcome: "RESOLVED", eventId: opaqueId<EventId>(`${requestInput.operation.operationId}:event:transition-time`), eventType: "world.scene-transition.time-resolved", origin: "PLAYER_INTENT", visibility: { scope: "SYSTEM", actorIds: [] }, payload: { durationSeconds: duration } }],
        newEffects: [], commitId: opaqueId<CommitId>(`${requestInput.operation.operationId}:commit:transition`), commandId: opaqueId<CommandId>(`${requestInput.operation.operationId}:command:time`)
      });
      if (!temporal.ok) return failure("narrative.scene-transition.temporal-commit-rejected", { diagnostics: temporal.diagnostics });
      return { ok: true, value: {
        command: prepared.command, temporalCommit: temporal.value,
        worldResult: { schemaVersion: 1, contractVersion: "world-prepared-scene-transition/1", commandId: prepared.command.commandId, requestId: prepared.command.requestId, confirmedDestinationRef: prepared.command.destinationRef, arrivalSceneId: destination.value.sceneId, durationSeconds: duration, effectiveAtGameSecond: currentGameSecond + duration, positionAggregateId: bindings.positionAggregateId, expectedPositionRevision: position.value.aggregateRevision, nextPositionPayload: { ...position.value.payload, canonicalLocationRef: prepared.command.destinationRef }, sourceRefs: prepared.command.sourceRefs, worldAuthority: true, version: 1 },
        currentPositionAggregate: position.value, currentSceneLifecycleAggregate: lifecycle.value, destinationScene: destination.value,
        authoritySourceRefs: prepared.command.sourceRefs, currentGameSecond, characterExpression: requestInput.rawInput.trim()
      } };
    }
  });
}

function failure(messageKey: string, details: Record<string, unknown> = {}): Result<never> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, details as never) };
}
