import type { LoreInfluencePacketV1 } from "../context";
import { coreError, opaqueId, type AggregateId, type CommandId, type CommitId, type EventId, type Result } from "../core";
import { planNextTemporalBatchV1, prepareTemporalSegmentCommitV1, type TemporalTaskV1 } from "../time";
import type { DynamicCreationValidationPolicyV1 } from "../ai/types";
import { createDynamicPlaceEntryRuntimeV1 } from "./dynamicPlaceEntryRuntime";
import { createLoreGuidedDynamicPlacePreparationPortV1 } from "./loreGuidedDynamicPlacePreparation";
import { buildLoreGuidedSceneCreationBriefFromCampaignV1 } from "./loreGuidedSceneCreation";
import { createCampaignLoreProjectionReaderV1 } from "./campaignLoreProjectionRuntime";
import type { LoreGuidedPlaceCandidateGeneratorConfigV2 } from "./loreGuidedPlaceCandidateGeneration";
import { buildSceneReferentRegistryV1 } from "./sceneReferentRegistry";
import type { PlaceRegistryStateV1, PlaceTopologyStateV1 } from "./placeCreationCommit";
import {
  DYNAMIC_PLACE_FACTS_AGGREGATE_ID_V1,
  DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1,
  DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1
} from "./placeCreationRuntime";
import {
  readOptionalPrototypeAggregateV1
} from "./prototypeSceneTransitionRuntime";
import type { PlaceCreationValidationPolicyV1 } from "./placeCreationValidation";
import type { SceneTransitionWorldCommandV1 } from "./sceneTransitionAdapter";
import type { PlayableSceneStateV1 } from "./playableScene";
import type { SceneTransitionTopologyV1 } from "./sceneTransition";
import {
  PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1,
  type CampaignRuntimeBindingsV1
} from "./campaignRuntimeBindings";

const DEFAULT_TRANSITION_SECONDS = 8;

export function createCampaignLoreGuidedDynamicPlaceRuntimeV1(input: {
  packet?: LoreInfluencePacketV1;
  resolveLorePacket?: (sceneId: string) => LoreInfluencePacketV1 | null;
  resolveAuthoredSceneLocationRef?: (sceneId: string) => string | null;
  knownAuthoredSceneIds?: readonly string[];
  knownAuthoredPlaces?: readonly { placeRef: string; displayName: string; aliases: string[]; parentLocationRef: string; sourceRefs: string[] }[];
  generatorConfig: LoreGuidedPlaceCandidateGeneratorConfigV2;
  actorRef?: string;
  transitionSeconds?: number;
  runtimeBindings?: CampaignRuntimeBindingsV1;
}) {
  const transitionSeconds = input.transitionSeconds ?? DEFAULT_TRANSITION_SECONDS;
  const bindings =
    input.runtimeBindings ?? PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1;
  return createDynamicPlaceEntryRuntimeV1(createLoreGuidedDynamicPlacePreparationPortV1({
    contextPort: {
      async canCreate(request) {
        if (request.interpretation.semanticIntent.kind !== "traverse_visible_boundary" || request.interpretation.requiresClarification) return false;
        const topology = await request.repository.getAggregate(request.campaignId as never, "world.scene-topology", DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1);
        if (!topology.ok) return false;
        const state = topology.value.payload as PlaceTopologyStateV1;
        return resolveUnmappedVisibleCreationBoundaryV1({ semanticKind: request.interpretation.semanticIntent.kind, requiresClarification: request.interpretation.requiresClarification, targetRef: resolvedTargetRef(request.interpretation), activeScene: request.activeScene, topology: state.topology }) !== null;
      },
      async buildContext(request) {
        const packet = input.resolveLorePacket?.(request.activeScene.sceneId) ?? input.packet ?? null;
        if (packet === null) return failure("narrative.dynamic-place.lore-context-missing", { sceneId: request.activeScene.sceneId });
        const [topologyAggregate, registryAggregate] = await Promise.all([
          request.repository.getAggregate(request.campaign.campaignId, "world.scene-topology", DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1),
          request.repository.getAggregate(request.campaign.campaignId, "world.place-registry", DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1)
        ]);
        if (!topologyAggregate.ok) return topologyAggregate;
        if (!registryAggregate.ok) return registryAggregate;
        const topologyState = topologyAggregate.value.payload as PlaceTopologyStateV1;
        const registry = registryAggregate.value.payload as PlaceRegistryStateV1;
        const sourceLocationRef = registry.places.find(place => place.arrivalSceneId === request.activeScene.sceneId)?.placeRef
          ?? input.resolveAuthoredSceneLocationRef?.(request.activeScene.sceneId)
          ?? null;
        if (sourceLocationRef === null) return failure("narrative.dynamic-place.source-location-ref-missing", { sceneId: request.activeScene.sceneId });
        const target = resolveUnmappedVisibleCreationBoundaryV1({ semanticKind: request.interpretation.semanticIntent.kind, requiresClarification: request.interpretation.requiresClarification, targetRef: resolvedTargetRef(request.interpretation), activeScene: request.activeScene, topology: topologyState.topology });
        if (target === null) return failure("narrative.dynamic-place.target-required");
        const brief = await buildLoreGuidedSceneCreationBriefFromCampaignV1({
          briefId: `${request.operation.operationId}:lore-brief`,
          campaignId: request.campaign.campaignId,
          campaignRevision: request.campaign.campaignRevision,
          packet,
          projectionReader: createCampaignLoreProjectionReaderV1({
            repository: request.repository,
            campaignId: request.campaign.campaignId
          })
        });
        if (!brief.ok) return failure("narrative.dynamic-place.lore-brief-invalid", { issues: brief.issues });
        const parentEntityId = packet.geographicChain[1] ?? packet.anchorEntityId;
        const dynamicPolicy: DynamicCreationValidationPolicyV1 = {
          schemaVersion: 1,
          creativeScope: {
            mayCreate: ["PLACE"], mayReference: brief.brief.sourceRefs, mayProposeCommands: [],
            mayReveal: { reveal: [], hint: [], withhold: [] },
            mustPreserve: brief.brief.strictConstraints.map(value => value.effectiveText),
            mustNotCreate: ["new rule", "unvalidated durable actor"], mustNotModify: ["wiki source"],
            noveltyConstraints: ["respect lore influence packet", "campaign projections override initial lore"]
          },
          knownAnchorIds: [packet.anchorEntityId],
          duplicateCandidateIds: registry.places.map(place => place.placeRef),
          allowActorScopedVisibility: false
        };
        const placePolicy: PlaceCreationValidationPolicyV1 = {
          schemaVersion: 1, contractVersion: "place-creation-validation/1",
          allowedPersistenceDepths: ["LIGHT_REFERENCE", "FULL_ENTITY"],
          allowedParentLocationRefs: [`location:${parentEntityId}`],
          knownSourceSceneIds: [...new Set([...(input.knownAuthoredSceneIds ?? []), request.activeScene.sceneId, ...registry.places.map(place => place.arrivalSceneId)])],
          knownPlaces: [
            ...(input.knownAuthoredPlaces ?? []).map(place => ({ ...place, aliases: [...place.aliases], sourceRefs: [...place.sourceRefs] })),
            ...registry.places.map(place => ({ placeRef: place.placeRef, displayName: place.displayName, aliases: [], parentLocationRef: place.parentLocationRef, sourceRefs: place.sourceRefs }))
          ],
          maximumConnections: 3, version: 1
        };
        return { ok: true, value: {
          brief: brief.brief, dynamicCreationPolicy: dynamicPolicy, placeValidationPolicy: placePolicy,
          topology: topologyState.topology, sourceSceneId: request.activeScene.sceneId, sourceLocationRef, sourceBoundaryRef: target,
          requestedDestinationDescription: request.interpretation.semanticIntent.playerGoal,
          generatorConfig: input.generatorConfig
        } };
      }
    },
    worldPort: {
      async prepare(request) {
        const target = request.creative.context.sourceBoundaryRef;
        const incoming = request.creative.validation.topologyAdditions.find(connection =>
          connection.sourceSceneId === request.activeScene.sceneId && connection.boundaryRef === target
        );
        if (!incoming) return failure("narrative.dynamic-place.incoming-connection-missing");
        const place = request.creative.validation.proposal.proposedProperties;
        const arrivalSceneId = typeof place.arrivalSceneId === "string" ? place.arrivalSceneId : null;
        if (arrivalSceneId === null) return failure("narrative.dynamic-place.arrival-scene-missing");
        const [position, lifecycle, clock, schedule, cursor] = await Promise.all([
          request.repository.getAggregate(request.campaign.campaignId, "world.position", bindings.positionAggregateId),
          request.repository.getAggregate(request.campaign.campaignId, "scene.lifecycle", bindings.sceneLifecycleAggregateId),
          request.repository.getAggregate(request.campaign.campaignId, "world.clock", request.campaign.clockAggregateId),
          readOptionalPrototypeAggregateV1(request.repository, request.campaign.campaignId, "world.schedule", bindings.scheduleAggregateId),
          readOptionalPrototypeAggregateV1(request.repository, request.campaign.campaignId, "world.simulation-cursor", bindings.simulationCursorAggregateId)
        ]);
        if (!position.ok) return position; if (!lifecycle.ok) return lifecycle; if (!clock.ok) return clock; if (!schedule.ok) return schedule; if (!cursor.ok) return cursor;
        if (lifecycle.value.payload.activeSceneId !== request.activeScene.sceneId) return failure("narrative.dynamic-place.active-scene-changed");
        const currentGameSecond = Number(clock.value.payload.elapsedGameSeconds);
        const requestId = `${request.operation.operationId}:dynamic-place-transition`;
        const commandId = `${requestId}:world-command:1`;
        const command: SceneTransitionWorldCommandV1 = {
          schemaVersion: 1, contractVersion: "world-scene-transition-command/1", commandId, requestId,
          operationId: request.operation.operationId, campaignId: request.campaign.campaignId,
          intentId: request.interpretation.intentId, domain: "world", commandType: "PREPARE_LOCAL_SCENE_TRANSITION",
          actorRef: input.actorRef ?? "character:prototype-player", sourceSceneId: request.activeScene.sceneId,
          expectedSceneVersion: request.activeScene.version, boundaryRef: target, connectionId: incoming.connectionId,
          destinationRef: incoming.destinationRef, expectedTopologyVersion: request.creative.context.topology.topologyVersion,
          expectedConnectionVersion: incoming.version, sourceRefs: incoming.sourceRefs,
          idempotencyKey: request.operation.idempotencyKey, commitPolicy: "DOMAIN_VALIDATED", timePolicy: "WORLD_VALIDATED",
          commitAuthority: false, source: "SCENE_TRANSITION_ADAPTER"
        };
        const task: TemporalTaskV1 = { schemaVersion: 1, taskId: `${request.operation.operationId}:activity:dynamic-transition`, taskKind: "ACTIVITY_COMPLETION", dueAtGameSecond: currentGameSecond + transitionSeconds, boundaryPolicy: "SIMULTANEOUS", dependsOnTaskIds: [], payload: { transitionRequestId: requestId } };
        const batch = await planNextTemporalBatchV1({ batchId: `${request.operation.operationId}:temporal-batch`, currentGameSecond, requestedTargetGameSecond: currentGameSecond + transitionSeconds, tasks: [task] });
        if (!batch.ok || batch.value === null) return failure("narrative.dynamic-place.temporal-plan-rejected", { diagnostics: batch.ok ? [] : batch.diagnostics });
        const temporal = await prepareTemporalSegmentCommitV1({
          campaign: request.campaign, operation: request.operation, writerLease: request.writerLease,
          clockAggregate: clock.value, scheduleAggregate: schedule.value, scheduleAggregateId: bindings.scheduleAggregateId,
          simulationCursorAggregate: cursor.value, simulationCursorAggregateId: bindings.simulationCursorAggregateId,
          processAggregate: null, processAggregateId: bindings.processAggregateId, nextProcess: null, batch: batch.value,
          operationBinding: { mode: "COMPOSITE_DOMAIN_COMMIT", domainCommandId: opaqueId<CommandId>(commandId), batchFingerprint: batch.value.batchFingerprint },
          resolutions: [{ taskId: task.taskId, outcome: "RESOLVED", eventId: opaqueId<EventId>(`${request.operation.operationId}:event:dynamic-transition-time`), eventType: "world.scene-transition.time-resolved", origin: "PLAYER_INTENT", visibility: { scope: "SYSTEM", actorIds: [] }, payload: { durationSeconds: transitionSeconds } }],
          newEffects: [], commitId: opaqueId<CommitId>(`${request.operation.operationId}:commit:dynamic-place-entry`), commandId: opaqueId<CommandId>(`${request.operation.operationId}:command:time`)
        });
        if (!temporal.ok) return failure("narrative.dynamic-place.temporal-commit-rejected", { diagnostics: temporal.diagnostics });
        return { ok: true, value: {
          placeRegistryAggregateId: DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1, topologyAggregateId: DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1,
          factRegistryAggregateId: DYNAMIC_PLACE_FACTS_AGGREGATE_ID_V1, positionAggregate: position.value,
          sceneLifecycleAggregate: lifecycle.value, temporalCommit: temporal.value, transitionCommand: command,
          worldResult: { schemaVersion: 1, contractVersion: "world-prepared-scene-transition/1", commandId, requestId, confirmedDestinationRef: incoming.destinationRef, arrivalSceneId, durationSeconds: transitionSeconds, effectiveAtGameSecond: currentGameSecond + transitionSeconds, positionAggregateId: bindings.positionAggregateId, expectedPositionRevision: position.value.aggregateRevision, nextPositionPayload: { ...position.value.payload, canonicalLocationRef: incoming.destinationRef }, sourceRefs: incoming.sourceRefs, worldAuthority: true, version: 1 },
          placeCommandId: `${request.operation.operationId}:command:create-place`, commitId: opaqueId<CommitId>(`${request.operation.operationId}:commit:dynamic-place-entry`),
          currentGameSecond, characterExpression: request.rawInput.trim(), authoritySourceRefs: request.creative.validation.proposal.existingFactRefsUsed
        } };
      }
    }
  }));
}

export function isUnmappedVisibleCreationBoundaryV1(input: {
  semanticKind: string;
  requiresClarification: boolean;
  targetRef: string | null;
  activeScene: PlayableSceneStateV1;
  topology: SceneTransitionTopologyV1;
}): boolean {
  return resolveUnmappedVisibleCreationBoundaryV1(input) !== null;
}

export function resolveUnmappedVisibleCreationBoundaryV1(input: {
  semanticKind: string;
  requiresClarification: boolean;
  targetRef: string | null;
  activeScene: PlayableSceneStateV1;
  topology: SceneTransitionTopologyV1;
}): string | null {
  if (input.semanticKind !== "traverse_visible_boundary" || input.requiresClarification) return null;
  if (input.targetRef?.startsWith("requested-destination:")) return input.targetRef;
  const registry = buildSceneReferentRegistryV1(input.activeScene);
  const candidates = registry.referents.filter(referent =>
    referent.interactionCapabilities.includes("manipulate") && referent.publicDestinationAliases.length > 0 &&
    !input.topology.connections.some(connection => connection.sourceSceneId === input.activeScene.sceneId && connection.boundaryRef === referent.canonicalRef)
  );
  if (input.targetRef !== null) {
    if (candidates.some(candidate => candidate.canonicalRef === input.targetRef)) return input.targetRef;
    const targetedReferent = registry.referents.find(referent => referent.canonicalRef === input.targetRef);
    const targetsKnownConnection = input.topology.connections.some(connection =>
      connection.sourceSceneId === input.activeScene.sceneId && connection.boundaryRef === input.targetRef
    );
    if (targetsKnownConnection || targetedReferent?.interactionCapabilities.includes("manipulate")) return null;
    return candidates.length === 1 ? candidates[0]!.canonicalRef : null;
  }
  return candidates.length === 1 ? candidates[0]!.canonicalRef : null;
}

function resolvedTargetRef(interpretation: {
  referentResolution?: { resolvedTarget: { kind: string; ref: string | null; label?: string | null } | null } | null;
  semanticIntent: { target: { kind: string; ref: string | null; label?: string | null } | null };
}): string | null {
  const target = interpretation.referentResolution?.resolvedTarget ?? interpretation.semanticIntent.target ?? null;
  if (target?.ref) return target.ref;
  const label = typeof target?.label === "string" ? target.label : null;
  if (target?.kind === "place" && label?.trim()) return `requested-destination:${slugRequestedDestination(label)}`;
  return null;
}

function slugRequestedDestination(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 80) || "lieu-proche";
}

function failure(messageKey: string, details: Record<string, unknown> = {}): Result<never> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, details as never) };
}
