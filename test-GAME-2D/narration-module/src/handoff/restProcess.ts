import { cloneJson, computeJsonFingerprint, opaqueId } from "../core/index";
import type {
  AggregateId,
  AggregateRecord,
  CampaignId,
  CampaignRecord,
  CommandId,
  CommitId,
  EventId,
  JsonObject,
  OperationRecord,
  OutboxTaskDraft,
  TaskId,
  WriterLease
} from "../core/index";
import {
  ORCHESTRATION_EVENT_ROUTER_CONTRACT_VERSION_V1,
  ORCHESTRATION_EVENT_TASK_TYPE_V1,
  type OrchestrationEventEnvelopeV1
} from "../orchestration/index";
import { prepareTemporalSegmentCommitV1, type TemporalBatchV1 } from "../time/index";
import type { RestSeedV1 } from "./types";
import { HANDOFF_CONTRACT_VERSION, HANDOFF_PAYLOAD_SCHEMA_VERSION } from "./types";
import { assertValidHandoff, validateRestSeedV1 } from "./validation";

export type RestProcessStatusV1 = "ACTIVE" | "COMPLETED_PENDING_BENEFITS" | "COMPLETED" | "INTERRUPTED" | "FAILED";

export interface RestInterruptionStateV1 extends JsonObject {
  interrupted: boolean;
  reason: string | null;
  segmentIndex: number | null;
  checkFingerprint: string | null;
}

export interface RestProcessStateV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof HANDOFF_CONTRACT_VERSION;
  processId: string;
  campaignId: CampaignId;
  restKind: string;
  status: RestProcessStatusV1;
  startedAtGameSecond: number;
  targetDurationSeconds: number;
  elapsedRestSeconds: number;
  currentSegmentIndex: number;
  segmentSeconds: number;
  participants: JsonObject[];
  availableActivities: JsonObject[];
  completedActivities: JsonObject[];
  safetyProfile: JsonObject;
  availableSupplies: JsonObject[];
  acquiredBenefits: JsonObject[];
  remainingBenefits: JsonObject[];
  consumptions: JsonObject[];
  interruption: RestInterruptionStateV1;
  checkpointFingerprint: string;
  version: 1;
}

export interface PreparedRestSegmentV1 {
  schemaVersion: 1;
  processId: string;
  segmentIndex: number;
  startedAtGameSecond: number;
  durationSeconds: number;
  completedAtGameSecond: number;
  interrupted: boolean;
  interruptionReason: string | null;
  activity: RestSegmentActivityV1;
  nextProcess: RestProcessStateV1;
  segmentFingerprint: string;
}

export interface RestSegmentActivityV1 extends JsonObject {
  schemaVersion: 1;
  activityKind: "PASSIVE_REST" | "CHARACTER_PROGRESSION";
  characterId: string | null;
  progressionAwardId: string | null;
}

function id<T extends string>(value: string): T {
  return opaqueId<T>(value);
}

function stablePercentFromFingerprint(fingerprint: string): number {
  const hex = fingerprint.replace("sha256:", "").slice(0, 8);
  return Number.parseInt(hex, 16) % 100;
}

function dangerPercent(safetyProfile: JsonObject): number {
  const raw = safetyProfile.interruptionPercent;
  return typeof raw === "number" && Number.isFinite(raw)
    ? Math.max(0, Math.min(100, Math.trunc(raw)))
    : 0;
}

async function withFingerprint(process: Omit<RestProcessStateV1, "checkpointFingerprint">): Promise<RestProcessStateV1> {
  const checkpointFingerprint = await computeJsonFingerprint(process);
  return { ...(process as RestProcessStateV1), checkpointFingerprint };
}

export async function createRestProcessStateFromSeedV1(input: {
  seed: RestSeedV1;
  segmentSeconds: number;
}): Promise<RestProcessStateV1> {
  assertValidHandoff(validateRestSeedV1(input.seed), input.seed);
  if (!Number.isInteger(input.segmentSeconds) || input.segmentSeconds <= 0) {
    throw new Error("segmentSeconds must be a positive integer.");
  }
  const remainingBenefits = input.seed.restKind === "LONG_REST"
    ? [{ benefitId: "long_rest_recovery", requiresElapsedSeconds: input.seed.targetDurationSeconds }]
    : [{ benefitId: "short_rest_recovery", requiresElapsedSeconds: input.seed.targetDurationSeconds }];
  return withFingerprint({
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    processId: input.seed.processId,
    campaignId: input.seed.campaignId,
    restKind: input.seed.restKind,
    status: "ACTIVE",
    startedAtGameSecond: input.seed.startedAtGameSecond,
    targetDurationSeconds: input.seed.targetDurationSeconds,
    elapsedRestSeconds: 0,
    currentSegmentIndex: 0,
    segmentSeconds: input.segmentSeconds,
    participants: cloneJson(input.seed.participants),
    availableActivities: cloneJson(input.seed.availableActivities),
    completedActivities: [],
    safetyProfile: cloneJson(input.seed.safetyProfile),
    availableSupplies: cloneJson(input.seed.availableSupplies),
    acquiredBenefits: [],
    remainingBenefits,
    consumptions: [],
    interruption: {
      interrupted: false,
      reason: null,
      segmentIndex: null,
      checkFingerprint: null
    },
    version: 1
  });
}

export async function prepareNextRestSegmentV1(input: {
  process: RestProcessStateV1;
  currentGameSecond: number;
  deterministicSeed: string;
  allowInterruption: boolean;
  activity?: RestSegmentActivityV1 | null;
}): Promise<PreparedRestSegmentV1> {
  if (input.process.status !== "ACTIVE") throw new Error("Only an ACTIVE rest process can advance.");
  if (!Number.isInteger(input.currentGameSecond) || input.currentGameSecond < 0) {
    throw new Error("currentGameSecond must be a non-negative integer.");
  }
  const remaining = input.process.targetDurationSeconds - input.process.elapsedRestSeconds;
  if (remaining <= 0) throw new Error("Rest process has no remaining duration.");
  const activity = normalizeRestSegmentActivity(input.activity ?? null);
  const durationSeconds = Math.min(input.process.segmentSeconds, remaining);
  const completedAtGameSecond = input.currentGameSecond + durationSeconds;
  const checkBase = {
    contractVersion: HANDOFF_CONTRACT_VERSION,
    processId: input.process.processId,
    segmentIndex: input.process.currentSegmentIndex,
    deterministicSeed: input.deterministicSeed,
    checkpointFingerprint: input.process.checkpointFingerprint,
    dangerPercent: dangerPercent(input.process.safetyProfile)
  };
  const checkFingerprint = await computeJsonFingerprint(checkBase);
  const interrupted = input.allowInterruption &&
    input.process.currentSegmentIndex > 0 &&
    stablePercentFromFingerprint(checkFingerprint) < dangerPercent(input.process.safetyProfile);
  const elapsedRestSeconds = input.process.elapsedRestSeconds + durationSeconds;
  const completed = !interrupted && elapsedRestSeconds >= input.process.targetDurationSeconds;
  const acquiredBenefits = cloneJson(input.process.acquiredBenefits);
  const remainingBenefits = cloneJson(input.process.remainingBenefits);
  const consumptions = input.process.currentSegmentIndex === 0 && input.process.availableSupplies.length > 0
    ? [...cloneJson(input.process.consumptions), { segmentIndex: 0, consumed: cloneJson(input.process.availableSupplies) }]
    : cloneJson(input.process.consumptions);
  const previousCompletedActivities = Array.isArray(input.process.completedActivities)
    ? cloneJson(input.process.completedActivities)
    : [];
  const completedActivities = interrupted
    ? previousCompletedActivities
    : [
        ...previousCompletedActivities,
        {
          ...cloneJson(activity),
          segmentIndex: input.process.currentSegmentIndex,
          completedAtGameSecond
        }
      ];
  const nextBase: Omit<RestProcessStateV1, "checkpointFingerprint"> = {
    ...cloneJson(input.process),
    status: interrupted ? "INTERRUPTED" : completed ? "COMPLETED_PENDING_BENEFITS" : "ACTIVE",
    elapsedRestSeconds,
    currentSegmentIndex: input.process.currentSegmentIndex + 1,
    acquiredBenefits,
    remainingBenefits,
    consumptions,
    completedActivities,
    interruption: {
      interrupted,
      reason: interrupted ? "deterministic_rest_interruption" : null,
      segmentIndex: interrupted ? input.process.currentSegmentIndex : null,
      checkFingerprint: interrupted ? checkFingerprint : null
    }
  };
  const nextProcess = await withFingerprint(nextBase);
  const segmentFingerprint = await computeJsonFingerprint({
    processId: input.process.processId,
    segmentIndex: input.process.currentSegmentIndex,
    durationSeconds,
    completedAtGameSecond,
    interrupted,
    activity,
    nextCheckpointFingerprint: nextProcess.checkpointFingerprint
  });
  return {
    schemaVersion: 1,
    processId: input.process.processId,
    segmentIndex: input.process.currentSegmentIndex,
    startedAtGameSecond: input.currentGameSecond,
    durationSeconds,
    completedAtGameSecond,
    interrupted,
    interruptionReason: interrupted ? "deterministic_rest_interruption" : null,
    activity,
    nextProcess,
    segmentFingerprint
  };
}

export async function createRestSegmentTemporalBatchV1(input: {
  batchId: string;
  taskId: string;
  segment: PreparedRestSegmentV1;
}): Promise<TemporalBatchV1> {
  const base = {
    schemaVersion: 1 as const,
    batchId: input.batchId,
    currentGameSecond: input.segment.startedAtGameSecond,
    requestedTargetGameSecond: input.segment.completedAtGameSecond,
    effectiveAtGameSecond: input.segment.completedAtGameSecond,
    orderedTasks: [{
      schemaVersion: 1 as const,
      taskId: input.taskId,
      taskKind: "PROCESS_BOUNDARY" as const,
      dueAtGameSecond: input.segment.completedAtGameSecond,
      boundaryPolicy: "SIMULTANEOUS" as const,
      dependsOnTaskIds: [],
      payload: {
        contractVersion: HANDOFF_CONTRACT_VERSION,
        processId: input.segment.processId,
        segmentIndex: input.segment.segmentIndex,
        segmentFingerprint: input.segment.segmentFingerprint
      }
    }]
  };
  return { ...base, batchFingerprint: await computeJsonFingerprint(base) as `sha256:${string}` };
}

export async function prepareRestSegmentCommitV1(input: {
  campaign: CampaignRecord;
  operation: OperationRecord;
  writerLease: WriterLease;
  clockAggregate: AggregateRecord;
  scheduleAggregate: AggregateRecord | null;
  scheduleAggregateId: AggregateId;
  simulationCursorAggregate: AggregateRecord | null;
  simulationCursorAggregateId: AggregateId;
  restProcessAggregateId: AggregateId;
  restProcessExpectedRevision: number | null;
  segment: PreparedRestSegmentV1;
  batch: TemporalBatchV1;
  eventId: EventId;
  commitId: CommitId;
  commandId: CommandId;
}): ReturnType<typeof prepareTemporalSegmentCommitV1> {
  if (input.operation.operationKind !== "time.segment") throw new Error("Rest segment commit requires a time.segment operation.");
  if (input.batch.orderedTasks.length !== 1 ||
      input.batch.orderedTasks[0].payload.processId !== input.segment.processId ||
      input.batch.orderedTasks[0].payload.segmentFingerprint !== input.segment.segmentFingerprint) {
    throw new Error("Temporal batch does not match rest segment.");
  }
  const eventType = input.segment.interrupted
    ? "rest_interrupted"
    : input.segment.nextProcess.status === "COMPLETED_PENDING_BENEFITS"
      ? "rest_completed_pending_benefits"
      : "rest_segment_completed";
  const prepared = await prepareTemporalSegmentCommitV1({
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
      eventType,
      origin: "PROCESS",
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      payload: {
        contractVersion: HANDOFF_CONTRACT_VERSION,
        processId: input.segment.processId,
        segmentIndex: input.segment.segmentIndex,
        durationSeconds: input.segment.durationSeconds,
        restKind: input.segment.nextProcess.restKind,
        activity: cloneJson(input.segment.activity),
        status: input.segment.nextProcess.status,
        checkpointFingerprint: input.segment.nextProcess.checkpointFingerprint,
        acquiredBenefits: cloneJson(input.segment.nextProcess.acquiredBenefits),
        remainingBenefits: cloneJson(input.segment.nextProcess.remainingBenefits),
        interruption: cloneJson(input.segment.nextProcess.interruption)
      }
    }],
    newEffects: [],
    additionalAggregateWrites: [{
      aggregateType: "rest.process",
      aggregateId: input.restProcessAggregateId,
      expectedAggregateRevision: input.restProcessExpectedRevision,
      payloadSchemaVersion: HANDOFF_PAYLOAD_SCHEMA_VERSION,
      payload: input.segment.nextProcess
    }],
    commitId: input.commitId,
    commandId: input.commandId
  });
  if (!prepared.ok || eventType === "rest_segment_completed") return prepared;
  return {
    ok: true,
    value: {
      ...prepared.value,
      outboxTasks: [
        ...prepared.value.outboxTasks,
        createRestTerminalOrchestrationTaskV1(input.eventId, eventType, input.segment.nextProcess)
      ]
    }
  };
}

function normalizeRestSegmentActivity(
  activity: RestSegmentActivityV1 | null
): RestSegmentActivityV1 {
  if (activity === null) {
    return {
      schemaVersion: 1,
      activityKind: "PASSIVE_REST",
      characterId: null,
      progressionAwardId: null
    };
  }
  if (
    activity.schemaVersion !== 1
    || !["PASSIVE_REST", "CHARACTER_PROGRESSION"].includes(activity.activityKind)
  ) {
    throw new Error("Rest segment activity is invalid.");
  }
  if (
    activity.activityKind === "PASSIVE_REST"
    && (activity.characterId !== null || activity.progressionAwardId !== null)
  ) {
    throw new Error("Passive rest cannot target a progression award.");
  }
  if (
    activity.activityKind === "CHARACTER_PROGRESSION"
    && (
      typeof activity.characterId !== "string"
      || !activity.characterId.trim()
      || typeof activity.progressionAwardId !== "string"
      || !activity.progressionAwardId.trim()
    )
  ) {
    throw new Error("Character progression activity requires character and award ids.");
  }
  return cloneJson(activity);
}

export function restProcessAggregateId(processId: string): AggregateId {
  return id<AggregateId>(`agg_rest_process_${processId}`);
}

function createRestTerminalOrchestrationTaskV1(
  eventId: EventId,
  eventType: "rest_interrupted" | "rest_completed_pending_benefits",
  process: RestProcessStateV1
): OutboxTaskDraft {
  if (process.status !== "INTERRUPTED" && process.status !== "COMPLETED_PENDING_BENEFITS") {
    throw new Error("Only a terminal rest state can emit an orchestration task.");
  }
  const payload: OrchestrationEventEnvelopeV1 = {
    schemaVersion: 1,
    contractVersion: ORCHESTRATION_EVENT_ROUTER_CONTRACT_VERSION_V1,
    sourceEventId: eventId,
    eventType,
    sourceDomain: "REST",
    processId: process.processId,
    processStatus: process.status,
    elapsedRestSeconds: process.elapsedRestSeconds,
    checkpointFingerprint: process.checkpointFingerprint,
    pendingBenefitCount: process.remainingBenefits.length,
    interruption: {
      interrupted: process.interruption.interrupted,
      reason: process.interruption.reason,
      segmentIndex: process.interruption.segmentIndex
    }
  };
  return {
    schemaVersion: 1,
    taskId: id<TaskId>(`task_orchestration_${eventId}`),
    taskType: ORCHESTRATION_EVENT_TASK_TYPE_V1,
    sourceEventIds: [eventId],
    payloadSchemaVersion: 1,
    payload
  };
}
