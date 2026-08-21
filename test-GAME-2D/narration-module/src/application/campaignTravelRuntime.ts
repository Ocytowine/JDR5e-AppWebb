import {
  computeJsonFingerprint,
  opaqueId,
  type AggregateId,
  type AggregateRecord,
  type AggregateWrite,
  type CampaignRecord,
  type CampaignId,
  type CampaignRepository,
  type CommandId,
  type CommitId,
  type CommitRequest,
  type EventId,
  type JsonObject,
  type OperationRecord,
  type Result,
  type WriterLease
} from "../core";
import {
  createTravelProcessStatePayloadV1,
  prepareTemporalSegmentCommitV1,
  prepareTravelSegmentV1,
  type PrepareTravelSegmentInputV1,
  type PreparedTravelSegmentV1,
  type TemporalBatchV1,
  type TemporalResultV1,
  type TravelResourceQuantityV1
} from "../time";
import { validateProcessStatePayloadV1 } from "../time";

export const CAMPAIGN_TRAVEL_RUNTIME_CONTRACT_V1 = "campaign-travel-runtime/1" as const;

export interface TravelResourceReservationV1 {
  schemaVersion: 1;
  contractVersion: "travel-resource-reservation/1";
  consumption: TravelResourceQuantityV1[];
  inventoryWrite: AggregateWrite | null;
  sourceRefs: string[];
}

export interface PreparedCampaignTravelSegmentV1 {
  schemaVersion: 1;
  contractVersion: typeof CAMPAIGN_TRAVEL_RUNTIME_CONTRACT_V1;
  segment: PreparedTravelSegmentV1;
  batch: TemporalBatchV1;
  commit: CommitRequest;
}

function fail(path: string, issue: string): TemporalResultV1<never> {
  return { ok: false, diagnostics: [{ code: "TEMPORAL_SEGMENT_INVALID", path, details: { issue } }] };
}

function quantitiesKey(values: TravelResourceQuantityV1[]): string {
  return [...values]
    .filter(value => value.quantity > 0)
    .sort((left, right) => left.itemId.localeCompare(right.itemId))
    .map(value => `${value.itemId}:${value.quantity}`)
    .join("|");
}

export async function prepareCampaignTravelStartCommitV1(input: {
  campaign: CampaignRecord;
  operation: OperationRecord;
  writerLease: WriterLease;
  processAggregateId: AggregateId;
  positionAggregate: AggregateRecord;
  process: PrepareTravelSegmentInputV1["process"];
  eventId: EventId;
  commitId: CommitId;
  commandId: CommandId;
}): Promise<TemporalResultV1<CommitRequest>> {
  if (
    input.operation.phase !== "READY_TO_COMMIT"
    || input.operation.operationKind !== "travel.start"
    || input.operation.observedCampaignRevision !== input.campaign.campaignRevision
    || input.positionAggregate.aggregateType !== "world.position"
    || input.positionAggregate.payload.characterId !== input.process.plan.characterId
    || input.positionAggregate.payload.locationId !== input.process.plan.originLocationId
    || input.process.status !== "PLANNED"
    || input.process.checkpoint.checkpointRevision !== 0
  ) return fail("/start", "travel start is not aligned with campaign position and operation");
  const processPayload = await createTravelProcessStatePayloadV1({
    process: input.process,
    pendingDecision: null,
    lastAppliedEventId: input.eventId,
    expectedCampaignRevision: input.campaign.campaignRevision + 1
  });
  if (!processPayload.ok) return processPayload;
  return {
    ok: true,
    value: {
      campaignId: input.campaign.campaignId,
      operationId: input.operation.operationId,
      commitId: input.commitId,
      idempotencyKey: input.operation.idempotencyKey,
      requestFingerprint: input.operation.requestFingerprint,
      expectedCampaignRevision: input.campaign.campaignRevision,
      writerLease: input.writerLease,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: CAMPAIGN_TRAVEL_RUNTIME_CONTRACT_V1,
        contractVersion: 1,
        commandId: input.commandId,
        campaignId: input.campaign.campaignId,
        operationId: input.operation.operationId,
        commandType: "travel.start",
        target: { aggregateType: "process.state", aggregateId: input.processAggregateId, expectedAggregateRevision: null },
        payloadSchemaVersion: 1,
        payload: { processId: input.process.processId, planId: input.process.plan.planId },
        acceptedAtGameSecond: input.process.plan.createdAtGameSecond
      }],
      aggregateWrites: [{
        aggregateType: "process.state",
        aggregateId: input.processAggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: processPayload.value as unknown as JsonObject
      }],
      events: [{
        schemaVersion: 1,
        eventId: input.eventId,
        campaignId: input.campaign.campaignId,
        operationId: input.operation.operationId,
        eventType: "travel.started",
        origin: "PLAYER_INTENT",
        causation: { kind: "COMMAND", id: input.commandId },
        aggregateRefs: [{ aggregateType: "process.state", aggregateId: input.processAggregateId, aggregateRevision: 0 }],
        visibility: { scope: "PLAYER_VISIBLE", actorIds: input.process.plan.party?.memberActorIds ?? [input.process.plan.characterId] },
        occurredAtGameSecond: input.process.plan.createdAtGameSecond,
        payloadSchemaVersion: 1,
        payload: { processId: input.process.processId, processAggregateId: input.processAggregateId, destinationLocationId: input.process.plan.destinationLocationId }
      }],
      outboxTasks: []
    }
  };
}

export async function restoreActiveCampaignTravelV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
}): Promise<Result<PrepareTravelSegmentInputV1["process"] | null>> {
  const events = await input.repository.listEvents(input.campaignId, null, 500);
  if (!events.ok) return events;
  const starts = [...events.value].reverse().filter(event => event.eventType === "travel.started");
  for (const event of starts) {
    const aggregateId = typeof event.payload.processAggregateId === "string"
      ? opaqueId<AggregateId>(event.payload.processAggregateId)
      : null;
    if (aggregateId === null) continue;
    const aggregate = await input.repository.getAggregate(input.campaignId, "process.state", aggregateId);
    if (!aggregate.ok && aggregate.error.code === "NOT_FOUND") continue;
    if (!aggregate.ok) return aggregate;
    const payload = await validateProcessStatePayloadV1(aggregate.value.payload);
    if (!payload.ok) return { ok: false, error: importCoreValidationError(payload.diagnostics) };
    if (payload.value.processType !== "travel.process") continue;
    const process = payload.value.state as unknown as PrepareTravelSegmentInputV1["process"];
    if (["PLANNED", "ACTIVE", "INTERRUPTED"].includes(process.status)) return { ok: true, value: process };
  }
  return { ok: true, value: null };
}

function importCoreValidationError(diagnostics: { path: string; details: JsonObject }[]) {
  return {
    code: "CAMPAIGN_INTEGRITY_FAILURE" as const,
    category: "INTEGRITY" as const,
    retry: "NEVER" as const,
    messageKey: "narrative.travel.process-state-invalid",
    details: { diagnostics: diagnostics.map(value => ({ path: value.path, details: value.details })) },
    incidentId: null
  };
}

/**
 * Raccord J6 : le domaine voyage prépare le segment, mais l'inventaire fournit
 * lui-même l'écriture qui consomme les ressources. Les deux écritures, la
 * position, le checkpoint et l'horloge sont ensuite réunis dans un seul commit.
 */
export async function prepareCampaignTravelSegmentV1(input: {
  campaign: CampaignRecord;
  operation: OperationRecord;
  writerLease: WriterLease;
  clockAggregate: AggregateRecord;
  scheduleAggregate: AggregateRecord | null;
  scheduleAggregateId: AggregateId;
  simulationCursorAggregate: AggregateRecord;
  simulationCursorAggregateId: AggregateId;
  processAggregate: AggregateRecord;
  processAggregateId: AggregateId;
  positionAggregate: AggregateRecord;
  travel: Omit<PrepareTravelSegmentInputV1, "currentGameSecond" | "worldSimulatedThrough">;
  resourceReservation: TravelResourceReservationV1;
  eventId: EventId;
  commitId: CommitId;
  commandId: CommandId;
}): Promise<TemporalResultV1<PreparedCampaignTravelSegmentV1>> {
  const currentGameSecond = Number(input.clockAggregate.payload.elapsedGameSeconds);
  const worldSimulatedThrough = Number(input.simulationCursorAggregate.payload.worldSimulatedThrough);
  if (!Number.isInteger(currentGameSecond) || !Number.isInteger(worldSimulatedThrough)) {
    return fail("/campaign", "campaign clock or world cursor is invalid");
  }
  if (
    input.positionAggregate.aggregateType !== "world.position"
    || input.positionAggregate.payload.characterId !== input.travel.process.plan.characterId
    || input.positionAggregate.payload.locationId !== input.travel.process.checkpoint.currentLocationId
  ) return fail("/position", "authoritative position does not match the travel checkpoint");
  const segment = await prepareTravelSegmentV1({
    ...input.travel,
    currentGameSecond,
    worldSimulatedThrough
  });
  if (!segment.ok) return segment;
  const reservation = input.resourceReservation;
  if (
    reservation.schemaVersion !== 1
    || reservation.contractVersion !== "travel-resource-reservation/1"
    || quantitiesKey(reservation.consumption) !== quantitiesKey(segment.value.resourceConsumption)
    || reservation.sourceRefs.length === 0
  ) return fail("/resources", "inventory reservation does not match the travel segment");
  if (segment.value.resourceConsumption.length > 0 && reservation.inventoryWrite === null) {
    return fail("/resources", "inventory owner did not prepare the required consumption");
  }
  const task = {
    schemaVersion: 1 as const,
    taskId: `${input.operation.operationId}:travel-boundary`,
    taskKind: "PROCESS_BOUNDARY" as const,
    dueAtGameSecond: currentGameSecond + segment.value.timeProposal.duration.recommendedSeconds,
    boundaryPolicy: "SIMULTANEOUS" as const,
    dependsOnTaskIds: [],
    payload: {
      processId: segment.value.nextProcess.processId,
      segmentId: segment.value.nextProcess.checkpoint.activeSegment?.segmentId ?? null
    }
  };
  const batchBase = {
    schemaVersion: 1 as const,
    batchId: `${input.operation.operationId}:travel-batch`,
    currentGameSecond,
    requestedTargetGameSecond: task.dueAtGameSecond,
    effectiveAtGameSecond: task.dueAtGameSecond,
    orderedTasks: [task]
  };
  const batch: TemporalBatchV1 = {
    ...batchBase,
    batchFingerprint: await computeJsonFingerprint(batchBase) as `sha256:${string}`
  };
  if (input.operation.requestPayload.batchFingerprint !== batch.batchFingerprint) {
    return fail("/operation", "travel operation does not cite the exact temporal batch");
  }
  const processPayload = await createTravelProcessStatePayloadV1({
    process: segment.value.nextProcess,
    pendingDecision: segment.value.pendingDecision,
    lastAppliedEventId: input.eventId,
    expectedCampaignRevision: input.campaign.campaignRevision + 1
  });
  if (!processPayload.ok) return processPayload;
  const positionPayload: JsonObject = {
    ...input.positionAggregate.payload,
    characterId: segment.value.nextProcess.plan.characterId,
    locationId: segment.value.nextProcess.checkpoint.currentLocationId,
    nextLocationId: segment.value.nextProcess.checkpoint.nextLocationId,
    elapsedTravelSeconds: segment.value.nextProcess.checkpoint.elapsedTravelSeconds,
    travelProcessId: segment.value.nextProcess.processId
  };
  const additionalWrites: AggregateWrite[] = [{
    aggregateType: "world.position",
    aggregateId: input.positionAggregate.aggregateId,
    expectedAggregateRevision: input.positionAggregate.aggregateRevision,
    payloadSchemaVersion: input.positionAggregate.payloadSchemaVersion,
    payload: positionPayload
  }, ...(reservation.inventoryWrite === null ? [] : [reservation.inventoryWrite])];
  if (new Set(additionalWrites.map(write => `${write.aggregateType}:${write.aggregateId}`)).size !== additionalWrites.length) {
    return fail("/resources", "inventory reservation conflicts with the position write");
  }
  const prepared = await prepareTemporalSegmentCommitV1({
    campaign: input.campaign,
    operation: input.operation,
    writerLease: input.writerLease,
    clockAggregate: input.clockAggregate,
    scheduleAggregate: input.scheduleAggregate,
    scheduleAggregateId: input.scheduleAggregateId,
    simulationCursorAggregate: input.simulationCursorAggregate,
    simulationCursorAggregateId: input.simulationCursorAggregateId,
    processAggregate: input.processAggregate,
    processAggregateId: input.processAggregateId,
    nextProcess: processPayload.value,
    batch,
    resolutions: [{
      taskId: task.taskId,
      outcome: "RESOLVED",
      eventId: input.eventId,
      eventType: "travel.segment-advanced",
      origin: "PROCESS",
      visibility: { scope: "PLAYER_VISIBLE", actorIds: segment.value.nextProcess.plan.party?.memberActorIds ?? [] },
      payload: {
        stopReason: segment.value.stopReason,
        currentLocationId: segment.value.nextProcess.checkpoint.currentLocationId,
        nextLocationId: segment.value.nextProcess.checkpoint.nextLocationId,
        resourceConsumption: segment.value.resourceConsumption.map(resource => ({ ...resource })),
        resourceSourceRefs: reservation.sourceRefs,
        encounterDecisionId: segment.value.encounterDecision.decisionId
      }
    }],
    newEffects: [],
    additionalAggregateWrites: additionalWrites,
    commitId: input.commitId,
    commandId: input.commandId
  });
  if (!prepared.ok) return prepared;
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      contractVersion: CAMPAIGN_TRAVEL_RUNTIME_CONTRACT_V1,
      segment: segment.value,
      batch,
      commit: prepared.value
    }
  };
}

export function campaignTravelProcessAggregateIdV1(processId: string): AggregateId {
  return opaqueId<AggregateId>(`agg_travel_${processId.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(-120)}`);
}
