import type {
  AcceptedCommandDraft,
  AggregateId,
  CampaignId,
  CampaignRecord,
  CommandId,
  CommitId,
  CommitRequest,
  EventDraft,
  EventId,
  IdempotencyKey,
  JsonObject,
  OperationRecord,
  WriterLease
} from "../core/index";
import { opaqueId } from "../core/index";
import type {
  HandoffOutcomeEventDraftV1,
  ProcessHandoffV1,
  ProcessOutcomeV1,
  RestOutcomeV1,
  RestSeedV1
} from "./types";
import {
  HANDOFF_CONTRACT_VERSION,
  HANDOFF_PAYLOAD_SCHEMA_VERSION
} from "./types";
import {
  assertValidHandoff,
  isRestOutcomeV1,
  validateProcessHandoffV1,
  validateProcessOutcomeV1,
  validateRestOutcomeV1,
  validateRestSeedV1
} from "./validation";

function id<T extends string>(value: string): T {
  return opaqueId<T>(value);
}

function handoffAggregateId(processId: string): AggregateId {
  return id<AggregateId>(`agg_handoff_${processId}`);
}

export interface PrepareRestStartCommitInput {
  campaign: CampaignRecord;
  operation: OperationRecord;
  writerLease: WriterLease;
  seed: RestSeedV1;
  processIdempotencyKey: string;
  commitId: CommitId;
  commandId: CommandId;
  eventId: EventId;
}

export interface PrepareHandoffOutcomeIntegrationInput {
  campaign: CampaignRecord;
  operation: OperationRecord;
  writerLease: WriterLease;
  process: ProcessHandoffV1;
  processAggregateId?: AggregateId;
  processExpectedRevision: number;
  outcome: ProcessOutcomeV1;
  commitId: CommitId;
  commandId: CommandId;
  eventIdPrefix: string;
  integratedAtGameSecond: number;
}

export function createRestProcessFromSeedV1(
  seed: RestSeedV1,
  sourceOperationId: OperationRecord["operationId"],
  idempotencyKey: string
): ProcessHandoffV1 {
  assertValidHandoff(validateRestSeedV1(seed), seed);
  return {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    processId: seed.processId,
    campaignId: seed.campaignId,
    sourceOperationId,
    sourceSceneId: seed.sceneId,
    processKind: "REST",
    status: "ACTIVE",
    createdAtGameSecond: seed.startedAtGameSecond,
    sourceRefs: seed.sourceAggregateRefs,
    idempotencyKey,
    version: 1,
    integratedOutcomeId: null,
    updatedAtGameSecond: null
  };
}

export function prepareRestStartCommitV1(input: PrepareRestStartCommitInput): CommitRequest {
  assertValidHandoff(validateRestSeedV1(input.seed), input.seed);
  const process = createRestProcessFromSeedV1(input.seed, input.operation.operationId, input.processIdempotencyKey);
  const aggregateId = handoffAggregateId(input.seed.processId);
  const command: AcceptedCommandDraft = {
    schemaVersion: 1,
    contractId: "tactical-rest-handoff",
    contractVersion: 1,
    commandId: input.commandId,
    campaignId: input.campaign.campaignId,
    operationId: input.operation.operationId,
    commandType: "rest.start",
    target: {
      aggregateType: "process.handoff",
      aggregateId,
      expectedAggregateRevision: null
    },
    payloadSchemaVersion: HANDOFF_PAYLOAD_SCHEMA_VERSION,
    payload: {
      contractVersion: HANDOFF_CONTRACT_VERSION,
      seedId: input.seed.seedId,
      restKind: input.seed.restKind,
      targetDurationSeconds: input.seed.targetDurationSeconds
    },
    acceptedAtGameSecond: input.seed.startedAtGameSecond
  };
  return {
    campaignId: input.campaign.campaignId,
    operationId: input.operation.operationId,
    commitId: input.commitId,
    idempotencyKey: input.operation.idempotencyKey,
    requestFingerprint: input.operation.requestFingerprint,
    expectedCampaignRevision: input.campaign.campaignRevision,
    writerLease: input.writerLease,
    acceptedCommands: [command],
    aggregateWrites: [{
      aggregateType: "process.handoff",
      aggregateId,
      expectedAggregateRevision: null,
      payloadSchemaVersion: HANDOFF_PAYLOAD_SCHEMA_VERSION,
      payload: process
    }],
    events: [{
      schemaVersion: 1,
      eventId: input.eventId,
      campaignId: input.campaign.campaignId,
      operationId: input.operation.operationId,
      eventType: "rest_started",
      origin: "PROCESS",
      causation: { kind: "COMMAND", id: input.commandId },
      aggregateRefs: [{ aggregateType: "process.handoff", aggregateId, aggregateRevision: 0 }],
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      occurredAtGameSecond: input.seed.startedAtGameSecond,
      payloadSchemaVersion: HANDOFF_PAYLOAD_SCHEMA_VERSION,
      payload: {
        contractVersion: HANDOFF_CONTRACT_VERSION,
        processId: input.seed.processId,
        restKind: input.seed.restKind,
        messageKey: "rest.started"
      }
    }],
    outboxTasks: []
  };
}

function eventTypeForRestOutcome(outcome: RestOutcomeV1): string {
  if (outcome.status === "COMPLETED") return "rest_completed";
  if (outcome.status === "INTERRUPTED" || outcome.status === "PARTIAL") return "rest_interrupted";
  return "rest_failed";
}

function normalizeOutcomeEvents(outcome: ProcessOutcomeV1, occurredAtGameSecond: number): HandoffOutcomeEventDraftV1[] {
  if (!isRestOutcomeV1(outcome)) return outcome.eventDrafts;
  const hasRestEndEvent = outcome.eventDrafts.some(event => event.eventType.startsWith("rest_"));
  if (hasRestEndEvent) return outcome.eventDrafts;
  return [{
    eventType: eventTypeForRestOutcome(outcome),
    origin: "PROCESS",
    visibility: "PLAYER_VISIBLE",
    occurredAtGameSecond,
    payloadSchemaVersion: HANDOFF_PAYLOAD_SCHEMA_VERSION,
    payload: {
      contractVersion: HANDOFF_CONTRACT_VERSION,
      processId: outcome.processId,
      status: outcome.status,
      elapsedGameSeconds: outcome.elapsedGameSeconds,
      interruptionReason: outcome.interruptionReason,
      acquiredBenefitCount: outcome.acquiredBenefits.length
    }
  }, ...outcome.eventDrafts];
}

function eventVisibility(scope: HandoffOutcomeEventDraftV1["visibility"]): EventDraft["visibility"] {
  return { scope, actorIds: [] };
}

export function prepareHandoffOutcomeIntegrationV1(input: PrepareHandoffOutcomeIntegrationInput): CommitRequest {
  assertValidHandoff(validateProcessHandoffV1(input.process), input.process);
  assertValidHandoff(validateProcessOutcomeV1(input.outcome), input.outcome);
  if (isRestOutcomeV1(input.outcome)) assertValidHandoff(validateRestOutcomeV1(input.outcome), input.outcome);
  if (input.process.status !== "COMPLETED_PENDING_INTEGRATION") {
    throw new Error(`Process ${input.process.processId} must be COMPLETED_PENDING_INTEGRATION before outcome integration.`);
  }
  if (input.process.processId !== input.outcome.processId) throw new Error("Outcome processId does not match process.");
  if (input.process.campaignId !== input.outcome.campaignId) throw new Error("Outcome campaignId does not match process.");
  if (input.process.sourceOperationId !== input.outcome.sourceOperationId) {
    throw new Error("Outcome sourceOperationId does not match process.");
  }

  const processAggregateId = input.processAggregateId ?? handoffAggregateId(input.process.processId);
  const integratedProcess: ProcessHandoffV1 = {
    ...input.process,
    status: "INTEGRATED",
    integratedOutcomeId: input.outcome.outcomeId,
    updatedAtGameSecond: input.integratedAtGameSecond
  };
  const processRevision = input.processExpectedRevision + 1;
  const command: AcceptedCommandDraft = {
    schemaVersion: 1,
    contractId: "tactical-rest-handoff",
    contractVersion: 1,
    commandId: input.commandId,
    campaignId: input.campaign.campaignId,
    operationId: input.operation.operationId,
    commandType: "handoff.integrate_outcome",
    target: {
      aggregateType: "process.handoff",
      aggregateId: processAggregateId,
      expectedAggregateRevision: input.processExpectedRevision
    },
    payloadSchemaVersion: HANDOFF_PAYLOAD_SCHEMA_VERSION,
    payload: {
      contractVersion: HANDOFF_CONTRACT_VERSION,
      outcomeId: input.outcome.outcomeId,
      processId: input.process.processId,
      status: input.outcome.status,
      elapsedGameSeconds: input.outcome.elapsedGameSeconds
    },
    acceptedAtGameSecond: input.integratedAtGameSecond
  };
  const outcomeEvents = normalizeOutcomeEvents(input.outcome, input.integratedAtGameSecond);
  const eventAggregateRefs = [
    { aggregateType: "process.handoff", aggregateId: processAggregateId, aggregateRevision: processRevision },
    ...input.outcome.domainDeltas.map(delta => ({
      aggregateType: delta.aggregateType,
      aggregateId: delta.aggregateId,
      aggregateRevision: delta.expectedAggregateRevision === null ? 0 : delta.expectedAggregateRevision + 1
    }))
  ];
  return {
    campaignId: input.campaign.campaignId,
    operationId: input.operation.operationId,
    commitId: input.commitId,
    idempotencyKey: id<IdempotencyKey>(input.outcome.integrationIdempotencyKey),
    requestFingerprint: input.operation.requestFingerprint,
    expectedCampaignRevision: input.campaign.campaignRevision,
    writerLease: input.writerLease,
    acceptedCommands: [command],
    aggregateWrites: [{
      aggregateType: "process.handoff",
      aggregateId: processAggregateId,
      expectedAggregateRevision: input.processExpectedRevision,
      payloadSchemaVersion: HANDOFF_PAYLOAD_SCHEMA_VERSION,
      payload: integratedProcess
    }, ...input.outcome.domainDeltas.map(delta => ({
      aggregateType: delta.aggregateType,
      aggregateId: delta.aggregateId,
      expectedAggregateRevision: delta.expectedAggregateRevision,
      payloadSchemaVersion: delta.payloadSchemaVersion,
      payload: delta.payload
    }))],
    events: outcomeEvents.map((event, index): EventDraft => ({
      schemaVersion: 1,
      eventId: id<EventId>(`${input.eventIdPrefix}_${index}`),
      campaignId: input.campaign.campaignId,
      operationId: input.operation.operationId,
      eventType: event.eventType,
      origin: event.origin,
      causation: { kind: "COMMAND", id: input.commandId },
      aggregateRefs: eventAggregateRefs,
      visibility: eventVisibility(event.visibility),
      occurredAtGameSecond: event.occurredAtGameSecond,
      payloadSchemaVersion: event.payloadSchemaVersion,
      payload: event.payload
    })),
    outboxTasks: []
  };
}

export function buildPendingProcessPayloadV1(process: ProcessHandoffV1): JsonObject {
  return {
    ...process,
    status: "COMPLETED_PENDING_INTEGRATION"
  };
}
