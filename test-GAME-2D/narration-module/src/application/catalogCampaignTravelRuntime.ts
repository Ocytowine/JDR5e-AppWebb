import {
  computeRequestFingerprint,
  computeJsonFingerprint,
  coreError,
  opaqueId,
  type CampaignId,
  type CampaignRepository,
  type CommandId,
  type CommitId,
  type EventId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../core";
import {
  buildTravelProcessFromRouteCatalogV1,
  prepareTravelSegmentV1,
  validateProcessStatePayloadV1,
  type TravelEncounterCandidateV1,
  type TravelPartySnapshotV1,
  type TravelProcessStateV1,
  type WorldTravelRouteCatalogV1
} from "../time";
import type { NarrativeIntentInterpretationV1 } from "./intentClarification";
import type { NarrativeDomainCommandV1 } from "./domainCommands";
import type { PlayableSceneStateV1 } from "./playableScene";
import {
  campaignTravelProcessAggregateIdV1,
  prepareCampaignTravelInterruptionResolutionCommitV1,
  prepareCampaignTravelSegmentV1,
  prepareCampaignTravelStartCommitV1,
  restoreActiveCampaignTravelV1,
  type TravelInterruptionApproachV1
} from "./campaignTravelRuntime";
import type { CampaignRuntimeBindingsV1 } from "./campaignRuntimeBindings";
import { readOptionalPrototypeAggregateV1 } from
  "./prototypeSceneTransitionRuntime";

export interface NarrativeTravelAdvanceResultV1 {
  schemaVersion: 1;
  process: TravelProcessStateV1;
  stopReason: "NO_GAME_TIME" | "WORLD_BOUNDARY" | "ENCOUNTER" | "ARRIVAL" | "INTERRUPTION" | "SEGMENT_LIMIT";
  commitId: string;
  arrivalSceneId: string | null;
  replayed: boolean;
  presentation: NarrativeTravelPresentationV1;
}

export interface PlayerTravelInterruptionProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "player-travel-interruption/1";
  processId: string;
  checkpointRevision: number;
  locationLabel: string;
  perceptibleSign: string;
  status: "AWAITING_PLAYER" | "RESOLVED";
  availableApproaches: TravelInterruptionApproachV1[];
  sourceRefs: string[];
}

export interface NarrativeTravelPresentationV1 extends JsonObject {
  schemaVersion: 1;
  kind: "DEPARTURE" | "PROGRESS" | "INTERRUPTION" | "INTERRUPTION_RESOLVED" | "ARRIVAL";
  playerFacingText: string;
  sourceRefs: string[];
  interruption: PlayerTravelInterruptionProjectionV1 | null;
}

export interface NarrativeTravelRuntimeV1 {
  canHandle(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<boolean>;
  start(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    sourceOperation: OperationRecord;
    interpretation: NarrativeIntentInterpretationV1;
    activeScene: PlayableSceneStateV1;
  }): Promise<Result<{ process: TravelProcessStateV1; commitId: string; replayed: boolean; presentation: NarrativeTravelPresentationV1 }>>;
  advance(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    clientRequestId: string;
    activeScene: PlayableSceneStateV1;
  }): Promise<Result<NarrativeTravelAdvanceResultV1>>;
  respondToInterruption(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    sourceOperation: OperationRecord;
    interpretation: NarrativeIntentInterpretationV1;
    activeScene: PlayableSceneStateV1;
  }): Promise<Result<{
    process: TravelProcessStateV1;
    commitId: string;
    replayed: boolean;
    presentation: NarrativeTravelPresentationV1;
  }>>;
  restoreActive(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
  }): ReturnType<typeof restoreActiveCampaignTravelV1>;
}

export function createCatalogCampaignTravelRuntimeV1(input: {
  catalog: WorldTravelRouteCatalogV1;
  runtimeBindings: CampaignRuntimeBindingsV1;
  destinationAliases?: Readonly<Record<string, string>>;
  locationLabels?: Readonly<Record<string, string>>;
  encounterCandidates?: readonly TravelEncounterCandidateV1[];
  worldPressure?: number;
  maxSegmentSeconds?: number;
  interruptions?: readonly {
    checkpointRevision: number;
    afterSeconds: number;
    reasonRef: string;
    perceptibleSign: string;
    sourceRefs: readonly string[];
  }[];
  resolveEncounter?: (request: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    process: TravelProcessStateV1;
    pendingDecision: JsonObject;
    approach: TravelInterruptionApproachV1;
    interpretation: NarrativeIntentInterpretationV1;
  }) => Promise<Result<{
    resolved: true;
    playerFacingText: string;
    sourceRefs: string[];
  }>> | Result<{
    resolved: true;
    playerFacingText: string;
    sourceRefs: string[];
  }>;
  resolveParty?: (request: {
    repository: CampaignRepository;
    characterId: string;
    campaignId: CampaignId;
    scene: PlayableSceneStateV1;
  }) => Promise<Result<TravelPartySnapshotV1>> | Result<TravelPartySnapshotV1>;
  resolveArrival?: (destinationLocationId: string) => {
    sceneId: string;
    locationRef: string;
  } | null;
  onArrival?: (request: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    process: TravelProcessStateV1;
    destinationSceneId: string;
    commitId: string;
    occurredAtGameSecond: number;
  }) => Promise<Result<unknown>>;
}): NarrativeTravelRuntimeV1 {
  const destination = (interpretation: NarrativeIntentInterpretationV1) => {
    const ref = interpretation.referentResolution?.resolvedTarget?.ref
      ?? interpretation.semanticIntent.target?.ref
      ?? null;
    if (ref !== null) return input.destinationAliases?.[ref]
      ?? ref.replace(/^(?:location|place):/u, "");
    const label = interpretation.referentResolution?.resolvedTarget?.label
      ?? interpretation.semanticIntent.target?.label
      ?? null;
    if (label === null) return null;
    const normalizedLabel = normalizeDestinationLabel(label);
    return input.catalog.anchors.find(anchor =>
      normalizeDestinationLabel(anchor.locationId) === normalizedLabel
    )?.locationId ?? null;
  };
  const locationLabel = (locationId: string) =>
    input.locationLabels?.[locationId]
      ?? locationId.replace(/_/gu, " ");
  const interruptionDefinition = (process: TravelProcessStateV1) =>
    input.interruptions?.find(candidate =>
      candidate.checkpointRevision === process.checkpoint.checkpointRevision
    ) ?? null;
  const interruptionProjection = (
    process: TravelProcessStateV1,
    status: PlayerTravelInterruptionProjectionV1["status"],
    definition: NonNullable<typeof input.interruptions>[number] | null
  ): PlayerTravelInterruptionProjectionV1 | null => {
    if (definition === null) return null;
    return {
      schemaVersion: 1,
      contractVersion: "player-travel-interruption/1",
      processId: process.processId,
      checkpointRevision: process.checkpoint.checkpointRevision,
      locationLabel: locationLabel(process.checkpoint.currentLocationId),
      perceptibleSign: definition.perceptibleSign,
      status,
      availableApproaches: ["OBSERVE", "AVOID", "APPROACH"],
      sourceRefs: [...definition.sourceRefs]
    };
  };
  return {
    async canHandle(request) {
      if (
        request.interpretation.semanticIntent.kind !== "traverse_visible_boundary"
        || request.interpretation.runtimeDecision.requiredDomain !== "world"
      ) return false;
      const activeTravel = await restoreActiveCampaignTravelV1({
        repository: request.repository,
        campaignId: request.campaignId
      });
      if (!activeTravel.ok) return false;
      if (
        activeTravel.value !== null
        && ["PLANNED", "ACTIVE", "INTERRUPTED"].includes(activeTravel.value.status)
        && request.interpretation.semanticIntent.commitment === "committed"
        && !request.interpretation.requiresClarification
      ) return true;
      const destinationId = destination(request.interpretation);
      if (destinationId === null) return false;
      const position = await request.repository.getAggregate(
        request.campaignId,
        "world.position",
        input.runtimeBindings.positionAggregateId
      );
      if (!position.ok) return false;
      const originId = String(position.value.payload.locationId ?? "");
      return input.catalog.routes.some(route => route.status === "OPEN" && (
        route.fromLocationId === originId && route.toLocationId === destinationId
        || route.direction === "BIDIRECTIONAL"
          && route.toLocationId === originId
          && route.fromLocationId === destinationId
      ));
    },
    async start(request) {
      const destinationId = destination(request.interpretation);
      if (destinationId === null) return invalid("narrative.travel.destination-missing");
      const [campaign, position] = await Promise.all([
        request.repository.getCampaign(request.campaignId),
        request.repository.getAggregate(
          request.campaignId,
          "world.position",
          input.runtimeBindings.positionAggregateId
        )
      ]);
      if (!campaign.ok) return campaign;
      if (!position.ok) return position;
      const clock = await request.repository.getAggregate(
        request.campaignId,
        "world.clock",
        campaign.value.clockAggregateId
      );
      if (!clock.ok) return clock;
      const characterId = String(position.value.payload.characterId ?? "");
      const originLocationId = String(position.value.payload.locationId ?? "");
      const resolvedParty = input.resolveParty === undefined
        ? { ok: true as const, value: {
            schemaVersion: 1 as const,
            partyId: `party:${request.campaignId}:${characterId}`,
            partyRevision: 0,
            leaderActorId: characterId,
            memberActorIds: [characterId],
            sourceRefs: [`world-position:${position.value.aggregateId}:${position.value.aggregateRevision}`]
          } }
        : await input.resolveParty({
            repository: request.repository,
            characterId,
            campaignId: request.campaignId,
            scene: request.activeScene
          });
      if (!resolvedParty.ok) return resolvedParty;
      const party = resolvedParty.value;
      const process = buildTravelProcessFromRouteCatalogV1({
        campaignId: request.campaignId,
        characterId,
        originLocationId,
        destinationLocationId: destinationId,
        mode: "WALK",
        createdAtGameSecond: Number(clock.value.payload.elapsedGameSeconds),
        source: {
          kind: "PLAYER_INTENT",
          id: request.sourceOperation.operationId,
          version: 1
        },
        catalog: input.catalog,
        party
      });
      if (!process.ok) return invalid("narrative.travel.plan-invalid", {
        diagnostics: process.diagnostics.map(value => ({
          code: value.code,
          path: value.path,
          details: value.details
        }))
      });
      const operationId = opaqueId<OperationId>(
        `travel-start:${request.sourceOperation.operationId}`
      );
      const requestPayload = {
        processId: process.value.processId,
        destinationLocationId: destinationId
      };
      const fingerprint = await computeRequestFingerprint(
        "travel.start",
        1,
        requestPayload
      );
      const existing = await request.repository.getOperation(operationId);
      if (existing.ok && existing.value.phase === "COMPLETED") {
        const presentation = departurePresentation(
          process.value,
          locationLabel
        );
        return {
          ok: true,
          value: {
            process: process.value,
            commitId: existing.value.commitId ?? "",
            replayed: true,
            presentation
          }
        };
      }
      if (!existing.ok && existing.error.code !== "NOT_FOUND") return existing;
      let operation = existing.ok ? existing.value : null;
      if (operation === null) {
        const now = new Date().toISOString();
        const received = await request.repository.receiveOperation({
          schemaVersion: 1,
          operationId,
          campaignId: request.campaignId,
          clientRequestId: opaqueId<RequestId>(
            `${request.sourceOperation.clientRequestId}:travel-start`
          ),
          idempotencyKey: opaqueId<IdempotencyKey>(
            `travel-start:${request.sourceOperation.idempotencyKey}`
          ),
          requestFingerprint: fingerprint,
          operationKind: "travel.start",
          requestPayloadSchemaVersion: 1,
          requestPayload,
          phase: "RECEIVED",
          observedCampaignRevision: campaign.value.campaignRevision,
          commitId: null,
          completionMode: null,
          resultPayloadSchemaVersion: null,
          resultPayload: null,
          failure: null,
          receivedAt: now,
          updatedAt: now
        });
        if (!received.ok) return received;
        operation = received.value;
      }
      if (operation.phase === "RECEIVED") {
        const preparing = await request.repository.transitionOperation(
          operation.operationId,
          "RECEIVED",
          "PREPARING"
        );
        if (!preparing.ok) return preparing;
        operation = preparing.value;
      }
      if (operation.phase === "PREPARING") {
        const ready = await request.repository.transitionOperation(
          operation.operationId,
          "PREPARING",
          "READY_TO_COMMIT"
        );
        if (!ready.ok) return ready;
        operation = ready.value;
      }
      const lease = await request.repository.acquireWriterLease(
        request.campaignId,
        opaqueId<WriterId>(`${operationId}:writer`),
        120_000
      );
      if (!lease.ok) return lease;
      try {
        const prepared = await prepareCampaignTravelStartCommitV1({
          campaign: campaign.value,
          operation,
          writerLease: lease.value,
          processAggregateId: campaignTravelProcessAggregateIdV1(
            process.value.processId
          ),
          positionAggregate: position.value,
          process: process.value,
          eventId: opaqueId<EventId>(`${operationId}:event`),
          commitId: opaqueId<CommitId>(`${operationId}:commit`),
          commandId: opaqueId<CommandId>(`${operationId}:command`)
        });
        if (!prepared.ok) return invalid("narrative.travel.start-invalid", {
          diagnostics: prepared.diagnostics.map(value => ({
            code: value.code,
            path: value.path,
            details: value.details
          }))
        });
        const committed = await request.repository.commit(prepared.value);
        if (!committed.ok) return committed;
        const result = {
          process: process.value,
          commitId: committed.value.commitId,
          replayed: false,
          presentation: departurePresentation(process.value, locationLabel)
        };
        const completed = await request.repository.completePresentation(
          operationId,
          "COMMITTED_RENDERED",
          1,
          { schemaVersion: 1, ...result } as unknown as JsonObject
        );
        return completed.ok ? { ok: true, value: result } : completed;
      } finally {
        await request.repository.releaseWriterLease(lease.value);
      }
    },
    async advance(request) {
      if (!request.clientRequestId.trim()) {
        return invalid("narrative.travel.advance-request-invalid");
      }
      const operationId = opaqueId<OperationId>(
        `travel-segment:${request.clientRequestId.replace(/[^a-zA-Z0-9:_-]+/g, "-")}`
      );
      const existing = await request.repository.getOperation(operationId);
      if (
        existing.ok
        && existing.value.phase === "COMPLETED"
        && existing.value.resultPayload !== null
      ) {
        const stored = existing.value.resultPayload as unknown as
          NarrativeTravelAdvanceResultV1;
        const replayed = {
          ...stored,
          replayed: true,
          presentation: stored.presentation
            ?? travelAdvancePresentation(stored, locationLabel, input.interruptions ?? [])
        };
        const finalized = await finalizeArrival(input, request, replayed);
        return finalized.ok ? { ok: true, value: replayed } : finalized;
      }
      if (!existing.ok && existing.error.code !== "NOT_FOUND") return existing;
      if (existing.ok) return invalid("narrative.travel.advance-incomplete");
      const active = await restoreActiveCampaignTravelV1({
        repository: request.repository,
        campaignId: request.campaignId
      });
      if (!active.ok) return active;
      if (active.value === null) {
        return invalid("narrative.travel.active-process-missing");
      }
      const process = active.value;
      const processAggregateId = campaignTravelProcessAggregateIdV1(
        process.processId
      );

      const [campaign, processAggregate, position, schedule, cursor, lifecycle] =
        await Promise.all([
          request.repository.getCampaign(request.campaignId),
          request.repository.getAggregate(
            request.campaignId,
            "process.state",
            processAggregateId
          ),
          request.repository.getAggregate(
            request.campaignId,
            "world.position",
            input.runtimeBindings.positionAggregateId
          ),
          readOptionalPrototypeAggregateV1(
            request.repository,
            request.campaignId,
            "world.schedule",
            input.runtimeBindings.scheduleAggregateId
          ),
          request.repository.getAggregate(
            request.campaignId,
            "world.simulation-cursor",
            input.runtimeBindings.simulationCursorAggregateId
          ),
          request.repository.getAggregate(
            request.campaignId,
            "scene.lifecycle",
            input.runtimeBindings.sceneLifecycleAggregateId
          )
        ]);
      if (!campaign.ok) return campaign;
      if (!processAggregate.ok) return processAggregate;
      if (!position.ok) return position;
      if (!schedule.ok) return schedule;
      if (!cursor.ok) return cursor;
      if (!lifecycle.ok) return lifecycle;
      const clock = await request.repository.getAggregate(
        request.campaignId,
        "world.clock",
        campaign.value.clockAggregateId
      );
      if (!clock.ok) return clock;
      const resolvedParty = input.resolveParty === undefined
        ? { ok: true as const, value: process.plan.party! }
        : await input.resolveParty({
            repository: request.repository,
            characterId: process.plan.characterId,
            campaignId: request.campaignId,
            scene: request.activeScene
          });
      if (!resolvedParty.ok) return resolvedParty;
      const party = resolvedParty.value;
      const authoredInterruption = interruptionDefinition(process);
      const travelInput = {
        process,
        secondsPerWorldBoundary: Number(
          cursor.value.payload.secondsPerMicroTick ?? 3_600
        ),
        maxSegmentSeconds: input.maxSegmentSeconds ?? 3_600,
        contentPackageId: campaign.value.dependencies.contentPackageId,
        contentPackageVersion:
          campaign.value.dependencies.contentPackageVersion,
        rulesetId: campaign.value.dependencies.rulesetId,
        rulesetVersion: campaign.value.dependencies.rulesetVersion,
        encounterCandidates: [...(input.encounterCandidates ?? [])],
        worldPressure: input.worldPressure ?? 0,
        interruption: authoredInterruption === null ? null : {
          interruptAtGameSecond:
            Number(clock.value.payload.elapsedGameSeconds)
            + authoredInterruption.afterSeconds,
          reason: authoredInterruption.reasonRef
        },
        partySnapshot: party,
        availableResources: []
      };
      const preflight = await prepareTravelSegmentV1({
        ...travelInput,
        currentGameSecond: Number(clock.value.payload.elapsedGameSeconds),
        worldSimulatedThrough:
          Number(cursor.value.payload.worldSimulatedThrough)
      });
      if (!preflight.ok) return invalid("narrative.travel.segment-invalid", {
        diagnostics: jsonDiagnostics(preflight.diagnostics)
      });
      const task = {
        schemaVersion: 1 as const,
        taskId: `${operationId}:travel-boundary`,
        taskKind: "PROCESS_BOUNDARY" as const,
        dueAtGameSecond:
          Number(clock.value.payload.elapsedGameSeconds)
          + preflight.value.timeProposal.duration.recommendedSeconds,
        boundaryPolicy: "SIMULTANEOUS" as const,
        dependsOnTaskIds: [],
        payload: {
          processId: preflight.value.nextProcess.processId,
          segmentId:
            preflight.value.nextProcess.checkpoint.activeSegment?.segmentId
            ?? null
        }
      };
      const batchBase = {
        schemaVersion: 1 as const,
        batchId: `${operationId}:travel-batch`,
        currentGameSecond: Number(clock.value.payload.elapsedGameSeconds),
        requestedTargetGameSecond: task.dueAtGameSecond,
        effectiveAtGameSecond: task.dueAtGameSecond,
        orderedTasks: [task]
      };
      const batchFingerprint = await computeJsonFingerprint(batchBase);
      const requestPayload = { batchFingerprint };
      const fingerprint = await computeRequestFingerprint(
        "time.segment",
        1,
        requestPayload
      );
      const now = new Date().toISOString();
      const received = await request.repository.receiveOperation({
        schemaVersion: 1,
        operationId,
        campaignId: request.campaignId,
        clientRequestId: opaqueId<RequestId>(request.clientRequestId),
        idempotencyKey: opaqueId<IdempotencyKey>(
          `travel-segment:${request.clientRequestId}`
        ),
        requestFingerprint: fingerprint,
        operationKind: "time.segment",
        requestPayloadSchemaVersion: 1,
        requestPayload,
        phase: "RECEIVED",
        observedCampaignRevision: campaign.value.campaignRevision,
        commitId: null,
        completionMode: null,
        resultPayloadSchemaVersion: null,
        resultPayload: null,
        failure: null,
        receivedAt: now,
        updatedAt: now
      });
      if (!received.ok) return received;
      const preparing = await request.repository.transitionOperation(
        operationId,
        "RECEIVED",
        "PREPARING"
      );
      if (!preparing.ok) return preparing;
      const ready = await request.repository.transitionOperation(
        operationId,
        "PREPARING",
        "READY_TO_COMMIT"
      );
      if (!ready.ok) return ready;
      const lease = await request.repository.acquireWriterLease(
        request.campaignId,
        opaqueId<WriterId>(`${operationId}:writer`),
        120_000
      );
      if (!lease.ok) return lease;
      let committedResult: NarrativeTravelAdvanceResultV1 | null = null;
      try {
        const arrival = preflight.value.nextProcess.status === "ARRIVED"
          ? input.resolveArrival?.(
              preflight.value.nextProcess.plan.destinationLocationId
            ) ?? null
          : null;
        const prepared = await prepareCampaignTravelSegmentV1({
          campaign: campaign.value,
          operation: ready.value,
          writerLease: lease.value,
          clockAggregate: clock.value,
          scheduleAggregate: schedule.value,
          scheduleAggregateId: input.runtimeBindings.scheduleAggregateId,
          simulationCursorAggregate: cursor.value,
          simulationCursorAggregateId:
            input.runtimeBindings.simulationCursorAggregateId,
          processAggregate: processAggregate.value,
          processAggregateId,
          positionAggregate: position.value,
          arrivalProjection: arrival === null ? null : {
            sceneLifecycleAggregate: lifecycle.value,
            ...arrival
          },
          travel: travelInput,
          resourceReservation: {
            schemaVersion: 1,
            contractVersion: "travel-resource-reservation/1",
            consumption: preflight.value.resourceConsumption,
            inventoryWrite: null,
            sourceRefs: [
              ...process.plan.route.flatMap(step => step.environmentTags),
              `travel-process:${process.processId}`
            ]
          },
          eventId: opaqueId<EventId>(`${operationId}:event`),
          commitId: opaqueId<CommitId>(`${operationId}:commit`),
          commandId: opaqueId<CommandId>(`${operationId}:command`)
        });
        if (!prepared.ok) return invalid("narrative.travel.segment-invalid", {
          diagnostics: jsonDiagnostics(prepared.diagnostics)
        });
        const committed = await request.repository.commit(prepared.value.commit);
        if (!committed.ok) return committed;
        const result: NarrativeTravelAdvanceResultV1 = {
          schemaVersion: 1,
          process: prepared.value.segment.nextProcess,
          stopReason: prepared.value.segment.stopReason,
          commitId: committed.value.commitId,
          arrivalSceneId: arrival?.sceneId ?? null,
          replayed: false,
          presentation: travelAdvancePresentation({
            schemaVersion: 1,
            process: prepared.value.segment.nextProcess,
            stopReason: prepared.value.segment.stopReason,
            commitId: committed.value.commitId,
            arrivalSceneId: arrival?.sceneId ?? null,
            replayed: false
          }, locationLabel, input.interruptions ?? [])
        };
        const completed = await request.repository.completePresentation(
          operationId,
          "COMMITTED_RENDERED",
          1,
          result as unknown as JsonObject
        );
        if (!completed.ok) return completed;
        committedResult = result;
      } finally {
        await request.repository.releaseWriterLease(lease.value);
      }
      if (committedResult === null) {
        return invalid("narrative.travel.segment-result-missing");
      }
      const finalized = await finalizeArrival(input, request, committedResult);
      return finalized.ok
        ? { ok: true, value: committedResult }
        : finalized;
    },
    async respondToInterruption(request) {
      const approach = travelInterruptionApproachV1(request.interpretation);
      if (approach === null) {
        return invalid("narrative.travel.interruption-response-invalid");
      }
      const active = await restoreActiveCampaignTravelV1({
        repository: request.repository,
        campaignId: request.campaignId
      });
      if (!active.ok) return active;
      if (active.value === null || active.value.status !== "INTERRUPTED") {
        return invalid("narrative.travel.interruption-missing");
      }
      const process = active.value;
      const processAggregateId = campaignTravelProcessAggregateIdV1(process.processId);
      const processAggregate = await request.repository.getAggregate(
        request.campaignId,
        "process.state",
        processAggregateId
      );
      if (!processAggregate.ok) return processAggregate;
      const processPayload = await validateProcessStatePayloadV1(
        processAggregate.value.payload
      );
      if (!processPayload.ok) {
        return invalid("narrative.travel.process-state-invalid", {
          diagnostics: jsonDiagnostics(processPayload.diagnostics)
        });
      }
      if (processPayload.value.pendingDecision === null) {
        return invalid("narrative.travel.pending-decision-missing");
      }
      const pendingKind = String(processPayload.value.pendingDecision.kind ?? "");
      const encounterResolution = pendingKind === "TRAVEL_ENCOUNTER_DECISION"
        ? input.resolveEncounter === undefined
          ? null
          : await input.resolveEncounter({
              repository: request.repository,
              campaignId: request.campaignId,
              process,
              pendingDecision: processPayload.value.pendingDecision,
              approach,
              interpretation: request.interpretation
            })
        : null;
      if (pendingKind === "TRAVEL_ENCOUNTER_DECISION" && encounterResolution === null) {
        return invalid("narrative.travel.encounter-owner-missing");
      }
      if (encounterResolution !== null && !encounterResolution.ok) {
        return encounterResolution;
      }
      if (
        encounterResolution?.ok
        && (
          !encounterResolution.value.playerFacingText.trim()
          || encounterResolution.value.sourceRefs.length === 0
        )
      ) return invalid("narrative.travel.encounter-owner-result-invalid");
      const decisionId = String(
        processPayload.value.pendingDecision.encounterDecisionId
          ?? processPayload.value.pendingDecision.interruptionDecisionId
          ?? ""
      );
      if (!decisionId) return invalid("narrative.travel.pending-decision-invalid");
      const operationId = opaqueId<OperationId>(
        `travel-interruption:${request.sourceOperation.operationId}`
      );
      const requestPayload = {
        processId: process.processId,
        decisionId,
        approach
      };
      const fingerprint = await computeRequestFingerprint(
        "travel.interruption.resolve",
        1,
        requestPayload
      );
      const existing = await request.repository.getOperation(operationId);
      if (
        existing.ok
        && existing.value.phase === "COMPLETED"
        && existing.value.resultPayload !== null
      ) {
        const stored = existing.value.resultPayload as unknown as {
          process: TravelProcessStateV1;
          commitId: string;
          presentation: NarrativeTravelPresentationV1;
        };
        return { ok: true, value: { ...stored, replayed: true } };
      }
      if (!existing.ok && existing.error.code !== "NOT_FOUND") return existing;
      if (existing.ok) return invalid("narrative.travel.interruption-resolution-incomplete");
      const campaign = await request.repository.getCampaign(request.campaignId);
      if (!campaign.ok) return campaign;
      const clock = await request.repository.getAggregate(
        request.campaignId,
        "world.clock",
        campaign.value.clockAggregateId
      );
      if (!clock.ok) return clock;
      const now = new Date().toISOString();
      const received = await request.repository.receiveOperation({
        schemaVersion: 1,
        operationId,
        campaignId: request.campaignId,
        clientRequestId: opaqueId<RequestId>(
          `${request.sourceOperation.clientRequestId}:travel-interruption`
        ),
        idempotencyKey: opaqueId<IdempotencyKey>(
          `travel-interruption:${request.sourceOperation.idempotencyKey}`
        ),
        requestFingerprint: fingerprint,
        operationKind: "travel.interruption.resolve",
        requestPayloadSchemaVersion: 1,
        requestPayload,
        phase: "RECEIVED",
        observedCampaignRevision: campaign.value.campaignRevision,
        commitId: null,
        completionMode: null,
        resultPayloadSchemaVersion: null,
        resultPayload: null,
        failure: null,
        receivedAt: now,
        updatedAt: now
      });
      if (!received.ok) return received;
      const preparing = await request.repository.transitionOperation(
        operationId,
        "RECEIVED",
        "PREPARING"
      );
      if (!preparing.ok) return preparing;
      const ready = await request.repository.transitionOperation(
        operationId,
        "PREPARING",
        "READY_TO_COMMIT"
      );
      if (!ready.ok) return ready;
      const lease = await request.repository.acquireWriterLease(
        request.campaignId,
        opaqueId<WriterId>(`${operationId}:writer`),
        120_000
      );
      if (!lease.ok) return lease;
      try {
        const eventId = opaqueId<EventId>(`${operationId}:event`);
        const prepared = await prepareCampaignTravelInterruptionResolutionCommitV1({
          campaign: campaign.value,
          operation: ready.value,
          writerLease: lease.value,
          processAggregate: processAggregate.value,
          processAggregateId,
          process,
          pendingDecision: processPayload.value.pendingDecision,
          approach,
          occurredAtGameSecond: Number(clock.value.payload.elapsedGameSeconds),
          eventId,
          commitId: opaqueId<CommitId>(`${operationId}:commit`),
          commandId: opaqueId<CommandId>(`${operationId}:command`)
        });
        if (!prepared.ok) return invalid(
          "narrative.travel.interruption-resolution-invalid",
          { diagnostics: jsonDiagnostics(prepared.diagnostics) }
        );
        const committed = await request.repository.commit(prepared.value);
        if (!committed.ok) return committed;
        const resolvedProcess = {
          ...process,
          status: "ACTIVE" as const,
          checkpoint: {
            ...process.checkpoint,
            checkpointId:
              `${process.checkpoint.checkpointId}:resolved:${approach.toLowerCase()}`,
            checkpointRevision: process.checkpoint.checkpointRevision + 1,
            status: "ACTIVE" as const
          }
        };
        const definition = input.interruptions?.find(candidate =>
          candidate.reasonRef === processPayload.value.pendingDecision?.reasonRef
        ) ?? input.interruptions?.find(candidate =>
          candidate.checkpointRevision === process.checkpoint.checkpointRevision - 1
        ) ?? null;
        const projection = interruptionProjection(
          resolvedProcess,
          "RESOLVED",
          definition
        );
        const presentation: NarrativeTravelPresentationV1 = {
          schemaVersion: 1,
          kind: "INTERRUPTION_RESOLVED",
          playerFacingText: encounterResolution?.ok
            ? encounterResolution.value.playerFacingText
            : interruptionResolutionText(approach),
          sourceRefs: [
            `commit:${committed.value.commitId}`,
            `travel-process:${process.processId}`,
            ...(projection?.sourceRefs ?? []),
            ...(encounterResolution?.ok
              ? encounterResolution.value.sourceRefs
              : [])
          ],
          interruption: projection
        };
        const result = {
          process: resolvedProcess,
          commitId: committed.value.commitId,
          replayed: false,
          presentation
        };
        const completed = await request.repository.completePresentation(
          operationId,
          "COMMITTED_RENDERED",
          1,
          { schemaVersion: 1, ...result } as unknown as JsonObject
        );
        return completed.ok ? { ok: true, value: result } : completed;
      } finally {
        await request.repository.releaseWriterLease(lease.value);
      }
    },
    restoreActive: restoreActiveCampaignTravelV1
  };
}

async function finalizeArrival(
  config: Parameters<typeof createCatalogCampaignTravelRuntimeV1>[0],
  request: {
    repository: CampaignRepository;
    campaignId: CampaignId;
  },
  result: NarrativeTravelAdvanceResultV1
): Promise<Result<unknown>> {
  if (
    result.process.status !== "ARRIVED"
    || result.arrivalSceneId === null
    || config.onArrival === undefined
  ) return { ok: true, value: null };
  return config.onArrival({
    repository: request.repository,
    campaignId: request.campaignId,
    process: result.process,
    destinationSceneId: result.arrivalSceneId,
    commitId: result.commitId,
    occurredAtGameSecond:
      result.process.plan.createdAtGameSecond
      + result.process.checkpoint.elapsedTravelSeconds
  });
}

function jsonDiagnostics(values: Array<{
  code: string;
  path: string;
  details: JsonObject;
}>): JsonObject[] {
  return values.map(value => ({
    code: value.code,
    path: value.path,
    details: value.details
  }));
}

function invalid(messageKey: string, details: JsonObject = {}): Result<never> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, details) };
}

function normalizeDestinationLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/^[\s]*(?:l['’]|le\s+|la\s+|les\s+)/u, "")
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

export function travelInterruptionApproachV1(
  interpretation: NarrativeIntentInterpretationV1
): TravelInterruptionApproachV1 | null {
  if (
    interpretation.requiresClarification
    || !["committed", "conditional"].includes(
      interpretation.semanticIntent.commitment
    )
  ) return null;
  switch (interpretation.semanticIntent.kind) {
    case "observe_environment":
      return "OBSERVE";
    case "traverse_visible_boundary":
      return "AVOID";
    case "move_near_visible_actor":
    case "manipulate_visible_object":
    case "address_visible_actor":
    case "nonverbal_signal":
      return "APPROACH";
    default:
      return null;
  }
}

function departurePresentation(
  process: TravelProcessStateV1,
  label: (locationId: string) => string
): NarrativeTravelPresentationV1 {
  return {
    schemaVersion: 1,
    kind: "DEPARTURE",
    playerFacingText:
      `Vous quittez ${label(process.plan.originLocationId)} et prenez la route vers ${label(process.plan.destinationLocationId)}.`,
    sourceRefs: [
      `travel-process:${process.processId}`,
      `travel-plan:${process.plan.planId}`
    ],
    interruption: null
  };
}

function travelAdvancePresentation(
  result: Omit<NarrativeTravelAdvanceResultV1, "presentation">,
  label: (locationId: string) => string,
  interruptions: NonNullable<Parameters<typeof createCatalogCampaignTravelRuntimeV1>[0]["interruptions"]>
): NarrativeTravelPresentationV1 {
  const baseRefs = [
    `commit:${result.commitId}`,
    `travel-process:${result.process.processId}`,
    `travel-checkpoint:${result.process.checkpoint.checkpointId}`
  ];
  if (result.process.status === "ARRIVED") return {
    schemaVersion: 1,
    kind: "ARRIVAL",
    playerFacingText:
      `Le trajet s'achève : vous atteignez ${label(result.process.plan.destinationLocationId)}.`,
    sourceRefs: baseRefs,
    interruption: null
  };
  if (result.process.status === "INTERRUPTED") {
    const definition = interruptions.find(candidate =>
      candidate.checkpointRevision
        === result.process.checkpoint.checkpointRevision - 1
    ) ?? null;
    const perceptibleSign = definition?.perceptibleSign
      ?? "Quelque chose, sur la route, exige votre attention avant d'aller plus loin.";
    const projection: PlayerTravelInterruptionProjectionV1 = {
      schemaVersion: 1,
      contractVersion: "player-travel-interruption/1",
      processId: result.process.processId,
      checkpointRevision: result.process.checkpoint.checkpointRevision,
      locationLabel: label(result.process.checkpoint.currentLocationId),
      perceptibleSign,
      status: "AWAITING_PLAYER",
      availableApproaches: ["OBSERVE", "AVOID", "APPROACH"],
      sourceRefs: [...(definition?.sourceRefs ?? [
        `travel-encounter:${result.process.checkpoint.lastEncounterDecision?.candidateRef?.id ?? "unknown"}`
      ])]
    };
    return {
      schemaVersion: 1,
      kind: "INTERRUPTION",
      playerFacingText: perceptibleSign,
      sourceRefs: [...baseRefs, ...projection.sourceRefs],
      interruption: projection
    };
  }
  return {
    schemaVersion: 1,
    kind: "PROGRESS",
    playerFacingText: "Vous poursuivez votre route jusqu'à ce que le voyage impose une nouvelle pause.",
    sourceRefs: baseRefs,
    interruption: null
  };
}

function interruptionResolutionText(
  approach: TravelInterruptionApproachV1
): string {
  if (approach === "OBSERVE") {
    return "Vous prenez le temps d'observer la situation. Ce que vous percevez vous permet de reprendre la route sans précipitation.";
  }
  if (approach === "AVOID") {
    return "Vous choisissez de contourner la difficulté. Une fois l'obstacle laissé derrière vous, la route redevient praticable.";
  }
  return "Vous allez au-devant de la situation et la traversez. Le passage est de nouveau libre.";
}
