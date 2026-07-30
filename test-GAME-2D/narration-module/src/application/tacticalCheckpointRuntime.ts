import {
  computeJsonFingerprint,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AggregateId,
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
  HANDOFF_CONTRACT_VERSION,
  validateProcessHandoffV1,
  type ProcessCheckpointV1,
  type ProcessHandoffV1
} from "../handoff";
import { bastionTacticalHandoffAggregateIdV1 } from "./bastionIncidentAuthority";

export const TACTICAL_CHECKPOINT_AGGREGATE_TYPE_V1 =
  "tactical.checkpoint" as const;
export const TACTICAL_CHECKPOINT_OWNER_CONTRACT_V1 =
  "game-board-tactical-state/1" as const;

export function tacticalCheckpointAggregateIdV1(
  processId: string
): AggregateId {
  return opaqueId<AggregateId>(`agg_tactical_checkpoint_${processId}`);
}

export async function restoreTacticalCheckpointV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  processId: string;
}): Promise<Result<ProcessCheckpointV1 | null>> {
  const aggregate = await input.repository.getAggregate(
    input.campaignId,
    TACTICAL_CHECKPOINT_AGGREGATE_TYPE_V1,
    tacticalCheckpointAggregateIdV1(input.processId)
  );
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? { ok: true, value: null }
      : aggregate;
  }
  const checkpoint = aggregate.value.payload as ProcessCheckpointV1;
  const issues = checkpointIssues(checkpoint, input.processId);
  if (issues.length > 0) {
    return {
      ok: false,
      error: coreError(
        "CAMPAIGN_INTEGRITY_FAILURE",
        "tactical.checkpoint.invalid",
        { issues }
      )
    };
  }
  const expectedFingerprint = await checkpointFingerprint(checkpoint);
  if (checkpoint.stateFingerprint !== expectedFingerprint) {
    return {
      ok: false,
      error: coreError(
        "CAMPAIGN_INTEGRITY_FAILURE",
        "tactical.checkpoint.fingerprint-mismatch"
      )
    };
  }
  return { ok: true, value: checkpoint };
}

export async function saveTacticalCheckpointV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  processId: string;
  clientRequestId: string;
  lastAppliedTurnId: string;
  ownerState: JsonObject;
  technicalTimestamp: string;
}): Promise<Result<ProcessCheckpointV1>> {
  const inputIssues = [
    ["processId", input.processId],
    ["clientRequestId", input.clientRequestId],
    ["lastAppliedTurnId", input.lastAppliedTurnId],
    ["technicalTimestamp", input.technicalTimestamp]
  ].filter(([, value]) => !nonEmpty(value)).map(([name]) => `${name} is required`);
  if (
    inputIssues.length > 0
    || input.ownerState.contractVersion !== TACTICAL_CHECKPOINT_OWNER_CONTRACT_V1
  ) {
    return {
      ok: false,
      error: coreError(
        "VALIDATION_FAILED",
        "tactical.checkpoint.input-invalid",
        { issues: inputIssues }
      )
    };
  }
  const [campaign, processAggregate, previous] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    input.repository.getAggregate(
      input.campaignId,
      "process.handoff",
      bastionTacticalHandoffAggregateIdV1(input.processId)
    ),
    input.repository.getAggregate(
      input.campaignId,
      TACTICAL_CHECKPOINT_AGGREGATE_TYPE_V1,
      tacticalCheckpointAggregateIdV1(input.processId)
    )
  ]);
  if (!campaign.ok) return campaign;
  if (!processAggregate.ok) return processAggregate;
  if (!previous.ok && previous.error.code !== "NOT_FOUND") return previous;
  const process = processAggregate.value.payload as ProcessHandoffV1;
  const processValidation = validateProcessHandoffV1(process);
  if (
    !processValidation.valid
    || process.processKind !== "TACTICAL_ENCOUNTER"
    || process.processId !== input.processId
    || process.campaignId !== input.campaignId
    || process.status !== "ACTIVE"
  ) {
    return {
      ok: false,
      error: coreError(
        "VALIDATION_FAILED",
        "tactical.checkpoint.process-not-active"
      )
    };
  }
  const checkpointIdentity = await computeJsonFingerprint({
    processId: input.processId,
    lastAppliedTurnId: input.lastAppliedTurnId,
    ownerState: input.ownerState
  });
  const checkpointToken = checkpointIdentity
    .replace(/^sha256:/, "")
    .slice(0, 48);
  const checkpointBase: ProcessCheckpointV1 = {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    checkpointId: `checkpoint:${checkpointToken}`,
    processId: input.processId,
    lastAppliedEventOrTurnId: input.lastAppliedTurnId,
    ownerState: input.ownerState,
    stateFingerprint: "",
    technicalTimestamp: input.technicalTimestamp,
    sourceRefs: [
      { kind: "process.handoff", id: input.processId },
      { kind: "tactical.seed", id: String(input.ownerState.seedId ?? "") }
    ],
    version: 1
  };
  const checkpoint: ProcessCheckpointV1 = {
    ...checkpointBase,
    stateFingerprint: await checkpointFingerprint(checkpointBase)
  };
  const operationId = opaqueId<OperationId>(
    `tactical-checkpoint:${checkpointToken}`
  );
  const idempotencyKey = opaqueId<IdempotencyKey>(
    `tactical-checkpoint:${checkpointToken}`
  );
  const replay = await input.repository.getOperation(operationId);
  if (replay.ok) {
    if (
      replay.value.phase === "COMPLETED"
      && replay.value.resultPayload?.stateFingerprint === checkpoint.stateFingerprint
    ) return { ok: true, value: checkpoint };
    return {
      ok: false,
      error: coreError(
        "IDEMPOTENCY_CONFLICT",
        "tactical.checkpoint.operation-conflict"
      )
    };
  }
  const requestPayload = {
    processId: input.processId,
    checkpointId: checkpoint.checkpointId,
    stateFingerprint: checkpoint.stateFingerprint
  };
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId: input.campaignId,
    clientRequestId: opaqueId<RequestId>(input.clientRequestId),
    idempotencyKey,
    requestFingerprint: await computeRequestFingerprint(
      "tactical.save-checkpoint",
      1,
      requestPayload
    ),
    operationKind: "tactical.save-checkpoint",
    requestPayloadSchemaVersion: 1,
    requestPayload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: input.technicalTimestamp,
    updatedAt: input.technicalTimestamp
  };
  const received = await input.repository.receiveOperation(operation);
  if (!received.ok) return received;
  const preparing = await input.repository.transitionOperation(
    operationId,
    "RECEIVED",
    "PREPARING"
  );
  if (!preparing.ok) return preparing;
  const ready = await input.repository.transitionOperation(
    operationId,
    "PREPARING",
    "READY_TO_COMMIT"
  );
  if (!ready.ok) return ready;
  const writerLease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`writer:tactical-checkpoint:${input.processId}`),
    30_000
  );
  if (!writerLease.ok) return writerLease;
  try {
    const aggregateId = tacticalCheckpointAggregateIdV1(input.processId);
    const expectedRevision = previous.ok
      ? previous.value.aggregateRevision
      : null;
    const commit = await input.repository.commit({
      campaignId: input.campaignId,
      operationId,
      commitId: opaqueId<CommitId>(
        `commit:tactical-checkpoint:${checkpointToken}`
      ),
      idempotencyKey,
      requestFingerprint: operation.requestFingerprint,
      expectedCampaignRevision: campaign.value.campaignRevision,
      writerLease: writerLease.value,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "tactical-rest-handoff",
        contractVersion: 1,
        commandId: opaqueId<CommandId>(
          `command:tactical-checkpoint:${checkpointToken}`
        ),
        campaignId: input.campaignId,
        operationId,
        commandType: "tactical.save_checkpoint",
        target: {
          aggregateType: TACTICAL_CHECKPOINT_AGGREGATE_TYPE_V1,
          aggregateId,
          expectedAggregateRevision: expectedRevision
        },
        payloadSchemaVersion: 1,
        payload: {
          processId: input.processId,
          checkpointId: checkpoint.checkpointId,
          stateFingerprint: checkpoint.stateFingerprint
        },
        acceptedAtGameSecond: process.createdAtGameSecond
      }],
      aggregateWrites: [{
        aggregateType: TACTICAL_CHECKPOINT_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: expectedRevision,
        payloadSchemaVersion: 1,
        payload: checkpoint
      }],
      events: [{
        schemaVersion: 1,
        eventId: opaqueId<EventId>(
          `event:tactical-checkpoint:${checkpointToken}`
        ),
        campaignId: input.campaignId,
        operationId,
        eventType: "tactical_checkpoint_saved",
        origin: "PROCESS",
        causation: {
          kind: "COMMAND",
          id: `command:tactical-checkpoint:${checkpointToken}`
        },
        aggregateRefs: [{
          aggregateType: TACTICAL_CHECKPOINT_AGGREGATE_TYPE_V1,
          aggregateId,
          aggregateRevision: expectedRevision === null ? 0 : expectedRevision + 1
        }],
        visibility: { scope: "SYSTEM", actorIds: [] },
        occurredAtGameSecond: process.createdAtGameSecond,
        payloadSchemaVersion: 1,
        payload: {
          processId: input.processId,
          checkpointId: checkpoint.checkpointId,
          lastAppliedTurnId: input.lastAppliedTurnId,
          stateFingerprint: checkpoint.stateFingerprint
        }
      }],
      outboxTasks: []
    });
    if (!commit.ok) return commit;
    const completed = await input.repository.completePresentation(
      operationId,
      "COMMITTED_RENDERED",
      1,
      checkpoint
    );
    return completed.ok ? { ok: true, value: checkpoint } : completed;
  } finally {
    await input.repository.releaseWriterLease(writerLease.value);
  }
}

async function checkpointFingerprint(
  checkpoint: ProcessCheckpointV1
): Promise<string> {
  return computeJsonFingerprint({
    ...checkpoint,
    stateFingerprint: null
  });
}

function checkpointIssues(
  value: ProcessCheckpointV1,
  processId: string
): string[] {
  const issues: string[] = [];
  if (
    value.schemaVersion !== 1
    || value.contractVersion !== HANDOFF_CONTRACT_VERSION
  ) issues.push("checkpoint contract is invalid");
  if (value.processId !== processId) issues.push("checkpoint processId mismatch");
  if (!nonEmpty(value.checkpointId)) issues.push("checkpointId is required");
  if (!nonEmpty(value.lastAppliedEventOrTurnId)) {
    issues.push("lastAppliedEventOrTurnId is required");
  }
  if (
    value.ownerState === null
    || typeof value.ownerState !== "object"
    || Array.isArray(value.ownerState)
    || value.ownerState.contractVersion !== TACTICAL_CHECKPOINT_OWNER_CONTRACT_V1
  ) issues.push("ownerState contract is invalid");
  if (!nonEmpty(value.stateFingerprint)) issues.push("stateFingerprint is required");
  if (!nonEmpty(value.technicalTimestamp)) issues.push("technicalTimestamp is required");
  return issues;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0;
}
