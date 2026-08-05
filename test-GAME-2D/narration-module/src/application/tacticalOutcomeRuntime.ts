import {
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
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../core";
import {
  validateProcessHandoffV1,
  validateTacticalOutcomeV1,
  type ProcessHandoffV1,
  type TacticalOutcomeV1
} from "../handoff";
import { tacticalHandoffAggregateIdV1 } from "./bastionIncidentAuthority";
import { restoreTacticalCheckpointV1 } from "./tacticalCheckpointRuntime";

export const TACTICAL_OUTCOME_AGGREGATE_TYPE_V1 =
  "tactical.outcome" as const;

export function tacticalOutcomeAggregateIdV1(processId: string): AggregateId {
  return opaqueId<AggregateId>(`agg_tactical_outcome_${processId}`);
}

export async function restorePendingTacticalOutcomeV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  processId: string;
}): Promise<Result<TacticalOutcomeV1 | null>> {
  const aggregate = await input.repository.getAggregate(
    input.campaignId,
    TACTICAL_OUTCOME_AGGREGATE_TYPE_V1,
    tacticalOutcomeAggregateIdV1(input.processId)
  );
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? { ok: true, value: null }
      : aggregate;
  }
  const outcome = aggregate.value.payload as TacticalOutcomeV1;
  const validation = validateTacticalOutcomeV1(outcome);
  if (
    !validation.valid
    || outcome.processId !== input.processId
    || outcome.campaignId !== input.campaignId
  ) {
    return {
      ok: false,
      error: coreError(
        "CAMPAIGN_INTEGRITY_FAILURE",
        "tactical.outcome.persisted-invalid",
        { issues: validation.issues }
      )
    };
  }
  return { ok: true, value: outcome };
}

/**
 * Persiste d'abord le constat terminal et ferme le processus en attente.
 * Les domainDeltas doivent rester vides : 7C-C les produira après validation
 * explicite des consequenceCandidates par leurs propriétaires.
 */
export async function recordPendingTacticalOutcomeV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clientRequestId: string;
  outcome: TacticalOutcomeV1;
  technicalTimestamp: string;
}): Promise<Result<TacticalOutcomeV1>> {
  const validation = validateTacticalOutcomeV1(input.outcome);
  if (!validation.valid || input.outcome.domainDeltas.length > 0) {
    return {
      ok: false,
      error: coreError(
        "VALIDATION_FAILED",
        "tactical.outcome.raw-invalid",
        {
          issues: [
            ...validation.issues,
            ...(input.outcome.domainDeltas.length > 0
              ? ["raw outcome must not contain unvalidated domain deltas"]
              : [])
          ]
        }
      )
    };
  }
  if (input.outcome.campaignId !== input.campaignId) {
    return {
      ok: false,
      error: coreError("VALIDATION_FAILED", "tactical.outcome.campaign-mismatch")
    };
  }
  const processAggregateId = tacticalHandoffAggregateIdV1(
    input.outcome.processId
  );
  const [campaign, processAggregate, checkpoint, existingOutcome] =
    await Promise.all([
      input.repository.getCampaign(input.campaignId),
      input.repository.getAggregate(
        input.campaignId,
        "process.handoff",
        processAggregateId
      ),
      restoreTacticalCheckpointV1({
        repository: input.repository,
        campaignId: input.campaignId,
        processId: input.outcome.processId
      }),
      restorePendingTacticalOutcomeV1({
        repository: input.repository,
        campaignId: input.campaignId,
        processId: input.outcome.processId
      })
    ]);
  if (!campaign.ok) return campaign;
  if (!processAggregate.ok) return processAggregate;
  if (!checkpoint.ok) return checkpoint;
  if (!existingOutcome.ok) return existingOutcome;
  const process = processAggregate.value.payload as ProcessHandoffV1;
  const processValidation = validateProcessHandoffV1(process);
  if (
    !processValidation.valid
    || process.processKind !== "TACTICAL_ENCOUNTER"
    || process.processId !== input.outcome.processId
    || process.campaignId !== input.campaignId
    || process.sourceOperationId !== input.outcome.sourceOperationId
  ) {
    return {
      ok: false,
      error: coreError(
        "CAMPAIGN_INTEGRITY_FAILURE",
        "tactical.outcome.process-mismatch"
      )
    };
  }
  if (
    checkpoint.value === null
    || !input.outcome.checkpointRefs.some(
      ref => ref.id === checkpoint.value?.checkpointId
    )
  ) {
    return {
      ok: false,
      error: coreError(
        "VALIDATION_FAILED",
        "tactical.outcome.terminal-checkpoint-missing"
      )
    };
  }
  if (process.status === "COMPLETED_PENDING_INTEGRATION") {
    return existingOutcome.value?.finalStateFingerprint
      === input.outcome.finalStateFingerprint
      ? { ok: true, value: existingOutcome.value }
      : {
          ok: false,
          error: coreError(
            "IDEMPOTENCY_CONFLICT",
            "tactical.outcome.already-recorded-differently"
          )
        };
  }
  if (process.status !== "ACTIVE" || existingOutcome.value !== null) {
    return {
      ok: false,
      error: coreError(
        "INVALID_TRANSITION",
        "tactical.outcome.process-not-active"
      )
    };
  }
  const requestPayload = {
    processId: input.outcome.processId,
    outcomeId: input.outcome.outcomeId,
    finalStateFingerprint: input.outcome.finalStateFingerprint
  };
  const operationId = opaqueId<OperationId>(
    `tactical-outcome:${input.outcome.processId}`
  );
  const outcomeToken = input.outcome.finalStateFingerprint
    .replace(/^sha256:/, "")
    .slice(0, 48);
  const idempotencyKey = opaqueId<IdempotencyKey>(
    `tactical-outcome:${outcomeToken}`
  );
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId: input.campaignId,
    clientRequestId: opaqueId<RequestId>(input.clientRequestId),
    idempotencyKey,
    requestFingerprint: await computeRequestFingerprint(
      "tactical.record-outcome",
      1,
      requestPayload
    ),
    operationKind: "tactical.record-outcome",
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
    opaqueId<WriterId>(`writer:tactical-outcome:${input.outcome.processId}`),
    30_000
  );
  if (!writerLease.ok) return writerLease;
  try {
    const recordedAt = process.createdAtGameSecond;
    const pendingProcess: ProcessHandoffV1 = {
      ...process,
      status: "COMPLETED_PENDING_INTEGRATION",
      updatedAtGameSecond: recordedAt
    };
    const outcomeAggregateId = tacticalOutcomeAggregateIdV1(
      input.outcome.processId
    );
    const processRevision = processAggregate.value.aggregateRevision + 1;
    const outcomeEvents = input.outcome.eventDrafts.length > 0
      ? input.outcome.eventDrafts
      : [{
          eventType: "tactical_outcome_recorded_pending_integration",
          origin: "PROCESS" as const,
          visibility: "PLAYER_VISIBLE" as const,
          occurredAtGameSecond: recordedAt,
          payloadSchemaVersion: 1,
          payload: requestPayload
        }];
    const commandId = opaqueId<CommandId>(
      `command:tactical-outcome:${input.outcome.processId}`
    );
    const commit = await input.repository.commit({
      campaignId: input.campaignId,
      operationId,
      commitId: opaqueId<CommitId>(
        `commit:tactical-outcome:${input.outcome.processId}`
      ),
      idempotencyKey,
      requestFingerprint: operation.requestFingerprint,
      expectedCampaignRevision: campaign.value.campaignRevision,
      writerLease: writerLease.value,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "tactical-rest-handoff",
        contractVersion: 1,
        commandId,
        campaignId: input.campaignId,
        operationId,
        commandType: "tactical.record_outcome_pending_integration",
        target: {
          aggregateType: "process.handoff",
          aggregateId: processAggregateId,
          expectedAggregateRevision: processAggregate.value.aggregateRevision
        },
        payloadSchemaVersion: 1,
        payload: requestPayload,
        acceptedAtGameSecond: recordedAt
      }],
      aggregateWrites: [{
        aggregateType: "process.handoff",
        aggregateId: processAggregateId,
        expectedAggregateRevision: processAggregate.value.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: pendingProcess
      }, {
        aggregateType: TACTICAL_OUTCOME_AGGREGATE_TYPE_V1,
        aggregateId: outcomeAggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: input.outcome
      }],
      events: outcomeEvents.map((event, index) => ({
        schemaVersion: 1,
        eventId: opaqueId<EventId>(
          `event:tactical-outcome:${input.outcome.processId}:${index}`
        ),
        campaignId: input.campaignId,
        operationId,
        eventType: event.eventType,
        origin: event.origin,
        causation: { kind: "COMMAND", id: commandId },
        aggregateRefs: [{
          aggregateType: "process.handoff",
          aggregateId: processAggregateId,
          aggregateRevision: processRevision
        }, {
          aggregateType: TACTICAL_OUTCOME_AGGREGATE_TYPE_V1,
          aggregateId: outcomeAggregateId,
          aggregateRevision: 0
        }],
        visibility: { scope: event.visibility, actorIds: [] },
        occurredAtGameSecond: recordedAt,
        payloadSchemaVersion: event.payloadSchemaVersion,
        payload: event.payload
      })),
      outboxTasks: []
    });
    if (!commit.ok) return commit;
    const completed = await input.repository.completePresentation(
      operationId,
      "COMMITTED_RENDERED",
      1,
      input.outcome
    );
    return completed.ok ? { ok: true, value: input.outcome } : completed;
  } finally {
    await input.repository.releaseWriterLease(writerLease.value);
  }
}
