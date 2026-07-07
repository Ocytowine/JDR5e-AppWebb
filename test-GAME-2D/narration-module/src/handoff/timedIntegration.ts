import { cloneJson, computeJsonFingerprint, opaqueId } from "../core/index";
import type {
  AggregateId,
  AggregateRecord,
  CampaignRecord,
  CommandId,
  CommitId,
  CommitRequest,
  EventId,
  EventOrigin,
  EventVisibility,
  IdempotencyKey,
  JsonObject,
  OperationRecord,
  WriterLease
} from "../core/index";
import { prepareTemporalSegmentCommitV1, type TemporalBatchV1 } from "../time/index";
import type {
  HandoffOutcomeEventDraftV1,
  ProcessHandoffV1,
  ProcessOutcomeV1,
  RestOutcomeV1
} from "./types";
import { HANDOFF_CONTRACT_VERSION, HANDOFF_PAYLOAD_SCHEMA_VERSION } from "./types";
import {
  assertValidHandoff,
  isRestOutcomeV1,
  validateProcessHandoffV1,
  validateProcessOutcomeV1,
  validateRestOutcomeV1
} from "./validation";

function id<T extends string>(value: string): T {
  return opaqueId<T>(value);
}

function handoffAggregateId(processId: string): AggregateId {
  return id<AggregateId>(`agg_handoff_${processId}`);
}

function eventTypeForRestOutcome(outcome: RestOutcomeV1): string {
  if (outcome.status === "COMPLETED") return "rest_completed";
  if (outcome.status === "INTERRUPTED" || outcome.status === "PARTIAL") return "rest_interrupted";
  return "rest_failed";
}

function primaryOutcomeEvent(outcome: ProcessOutcomeV1): HandoffOutcomeEventDraftV1 {
  if (outcome.eventDrafts.length > 0) return outcome.eventDrafts[0];
  if (isRestOutcomeV1(outcome)) {
    return {
      eventType: eventTypeForRestOutcome(outcome),
      origin: "PROCESS",
      visibility: "PLAYER_VISIBLE",
      occurredAtGameSecond: 0,
      payloadSchemaVersion: HANDOFF_PAYLOAD_SCHEMA_VERSION,
      payload: {
        contractVersion: HANDOFF_CONTRACT_VERSION,
        processId: outcome.processId,
        status: outcome.status,
        elapsedGameSeconds: outcome.elapsedGameSeconds,
        interruptionReason: outcome.interruptionReason,
        acquiredBenefitCount: outcome.acquiredBenefits.length
      }
    };
  }
  return {
    eventType: "handoff_outcome_integrated",
    origin: "PROCESS",
    visibility: "PLAYER_VISIBLE",
    occurredAtGameSecond: 0,
    payloadSchemaVersion: HANDOFF_PAYLOAD_SCHEMA_VERSION,
    payload: {
      contractVersion: HANDOFF_CONTRACT_VERSION,
      processId: outcome.processId,
      outcomeId: outcome.outcomeId,
      status: outcome.status,
      elapsedGameSeconds: outcome.elapsedGameSeconds
    }
  };
}

function eventVisibility(scope: HandoffOutcomeEventDraftV1["visibility"]): EventVisibility {
  return { scope, actorIds: [] };
}

export interface CreateHandoffOutcomeTemporalBatchInput {
  batchId: string;
  taskId: string;
  currentGameSecond: number;
  elapsedGameSeconds: number;
  processId: string;
  outcomeId: string;
}

export async function createHandoffOutcomeTemporalBatchV1(
  input: CreateHandoffOutcomeTemporalBatchInput
): Promise<TemporalBatchV1> {
  if (!Number.isInteger(input.currentGameSecond) || input.currentGameSecond < 0) {
    throw new Error("currentGameSecond must be a non-negative integer.");
  }
  if (!Number.isInteger(input.elapsedGameSeconds) || input.elapsedGameSeconds < 0) {
    throw new Error("elapsedGameSeconds must be a non-negative integer.");
  }
  const target = input.currentGameSecond + input.elapsedGameSeconds;
  const base = {
    schemaVersion: 1 as const,
    batchId: input.batchId,
    currentGameSecond: input.currentGameSecond,
    requestedTargetGameSecond: target,
    effectiveAtGameSecond: target,
    orderedTasks: [{
      schemaVersion: 1 as const,
      taskId: input.taskId,
      taskKind: "PROCESS_BOUNDARY" as const,
      dueAtGameSecond: target,
      boundaryPolicy: "SIMULTANEOUS" as const,
      dependsOnTaskIds: [],
      payload: {
        contractVersion: HANDOFF_CONTRACT_VERSION,
        processId: input.processId,
        outcomeId: input.outcomeId,
        elapsedGameSeconds: input.elapsedGameSeconds
      }
    }]
  };
  return { ...base, batchFingerprint: await computeJsonFingerprint(base) as `sha256:${string}` };
}

export interface PrepareTimedHandoffOutcomeIntegrationInput {
  campaign: CampaignRecord;
  operation: OperationRecord;
  writerLease: WriterLease;
  clockAggregate: AggregateRecord;
  scheduleAggregate: AggregateRecord | null;
  scheduleAggregateId: AggregateId;
  simulationCursorAggregate: AggregateRecord | null;
  simulationCursorAggregateId: AggregateId;
  process: ProcessHandoffV1;
  processAggregateId?: AggregateId;
  processExpectedRevision: number;
  outcome: ProcessOutcomeV1;
  batch: TemporalBatchV1;
  eventId: EventId;
  commitId: CommitId;
  commandId: CommandId;
}

export async function prepareTimedHandoffOutcomeIntegrationV1(
  input: PrepareTimedHandoffOutcomeIntegrationInput
): Promise<ReturnType<typeof prepareTemporalSegmentCommitV1>> {
  assertValidHandoff(validateProcessHandoffV1(input.process), input.process);
  assertValidHandoff(validateProcessOutcomeV1(input.outcome), input.outcome);
  if (isRestOutcomeV1(input.outcome)) assertValidHandoff(validateRestOutcomeV1(input.outcome), input.outcome);
  if (input.operation.operationKind !== "time.segment") {
    throw new Error("Timed handoff integration must be prepared from a time.segment operation.");
  }
  if (input.operation.idempotencyKey !== id<IdempotencyKey>(input.outcome.integrationIdempotencyKey)) {
    throw new Error("Operation idempotencyKey must match outcome.integrationIdempotencyKey.");
  }
  if (input.process.status !== "COMPLETED_PENDING_INTEGRATION") {
    throw new Error(`Process ${input.process.processId} must be COMPLETED_PENDING_INTEGRATION before outcome integration.`);
  }
  if (input.process.processId !== input.outcome.processId) throw new Error("Outcome processId does not match process.");
  if (input.process.campaignId !== input.outcome.campaignId) throw new Error("Outcome campaignId does not match process.");
  if (input.process.sourceOperationId !== input.outcome.sourceOperationId) {
    throw new Error("Outcome sourceOperationId does not match process.");
  }
  if (input.batch.orderedTasks.length !== 1 ||
      input.batch.orderedTasks[0].taskKind !== "PROCESS_BOUNDARY" ||
      input.batch.orderedTasks[0].payload.processId !== input.outcome.processId ||
      input.batch.orderedTasks[0].payload.outcomeId !== input.outcome.outcomeId ||
      input.batch.effectiveAtGameSecond - input.batch.currentGameSecond !== input.outcome.elapsedGameSeconds) {
    throw new Error("Temporal batch does not match handoff outcome.");
  }

  const processAggregateId = input.processAggregateId ?? handoffAggregateId(input.process.processId);
  const integratedProcess: ProcessHandoffV1 = {
    ...input.process,
    status: "INTEGRATED",
    integratedOutcomeId: input.outcome.outcomeId,
    updatedAtGameSecond: input.batch.effectiveAtGameSecond
  };
  const primaryEvent = primaryOutcomeEvent(input.outcome);
  const resultPayload: JsonObject = {
    contractVersion: HANDOFF_CONTRACT_VERSION,
    processId: input.outcome.processId,
    outcomeId: input.outcome.outcomeId,
    outcomeStatus: input.outcome.status,
    elapsedGameSeconds: input.outcome.elapsedGameSeconds,
    narrativeProjection: cloneJson(input.outcome.narrativeProjection),
    uiNotifications: cloneJson(input.outcome.uiNotifications),
    memoryCandidates: cloneJson(input.outcome.memoryCandidates),
    primaryPayload: cloneJson(primaryEvent.payload)
  };

  return prepareTemporalSegmentCommitV1({
    campaign: input.campaign,
    operation: input.operation,
    writerLease: input.writerLease,
    clockAggregate: input.clockAggregate,
    scheduleAggregate: input.scheduleAggregate,
    scheduleAggregateId: input.scheduleAggregateId,
    simulationCursorAggregate: input.simulationCursorAggregate,
    simulationCursorAggregateId: input.simulationCursorAggregateId,
    processAggregate: null,
    processAggregateId: null,
    nextProcess: null,
    batch: input.batch,
    resolutions: [{
      taskId: input.batch.orderedTasks[0].taskId,
      outcome: "RESOLVED",
      eventId: input.eventId,
      eventType: primaryEvent.eventType,
      origin: primaryEvent.origin as EventOrigin,
      visibility: eventVisibility(primaryEvent.visibility),
      payload: resultPayload
    }],
    newEffects: [],
    additionalAggregateWrites: [{
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
    commitId: input.commitId,
    commandId: input.commandId
  }) as ReturnType<typeof prepareTemporalSegmentCommitV1>;
}
