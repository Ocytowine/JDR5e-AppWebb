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
  WriterLease
} from "../core/index";
import { prepareTemporalSegmentCommitV1, type TemporalBatchV1 } from "../time/index";
import type { RestSeedV1 } from "./types";
import { HANDOFF_CONTRACT_VERSION, HANDOFF_PAYLOAD_SCHEMA_VERSION } from "./types";
import { assertValidHandoff, validateRestSeedV1 } from "./validation";

export type RestProcessStatusV1 = "ACTIVE" | "COMPLETED" | "INTERRUPTED" | "FAILED";

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
  nextProcess: RestProcessStateV1;
  segmentFingerprint: string;
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
}): Promise<PreparedRestSegmentV1> {
  if (input.process.status !== "ACTIVE") throw new Error("Only an ACTIVE rest process can advance.");
  if (!Number.isInteger(input.currentGameSecond) || input.currentGameSecond < 0) {
    throw new Error("currentGameSecond must be a non-negative integer.");
  }
  const remaining = input.process.targetDurationSeconds - input.process.elapsedRestSeconds;
  if (remaining <= 0) throw new Error("Rest process has no remaining duration.");
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
  const acquiredBenefits = completed ? cloneJson(input.process.remainingBenefits) : cloneJson(input.process.acquiredBenefits);
  const remainingBenefits = completed ? [] : cloneJson(input.process.remainingBenefits);
  const consumptions = input.process.currentSegmentIndex === 0 && input.process.availableSupplies.length > 0
    ? [...cloneJson(input.process.consumptions), { segmentIndex: 0, consumed: cloneJson(input.process.availableSupplies) }]
    : cloneJson(input.process.consumptions);
  const nextBase: Omit<RestProcessStateV1, "checkpointFingerprint"> = {
    ...cloneJson(input.process),
    status: interrupted ? "INTERRUPTED" : completed ? "COMPLETED" : "ACTIVE",
    elapsedRestSeconds,
    currentSegmentIndex: input.process.currentSegmentIndex + 1,
    acquiredBenefits,
    remainingBenefits,
    consumptions,
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
    : input.segment.nextProcess.status === "COMPLETED"
      ? "rest_completed"
      : "rest_segment_completed";
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
      eventType,
      origin: "PROCESS",
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      payload: {
        contractVersion: HANDOFF_CONTRACT_VERSION,
        processId: input.segment.processId,
        segmentIndex: input.segment.segmentIndex,
        durationSeconds: input.segment.durationSeconds,
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
}

export function restProcessAggregateId(processId: string): AggregateId {
  return id<AggregateId>(`agg_rest_process_${processId}`);
}
