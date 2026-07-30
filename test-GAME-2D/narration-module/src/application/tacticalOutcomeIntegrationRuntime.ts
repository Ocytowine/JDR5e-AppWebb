import {
  cloneJson,
  computeJsonFingerprint,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CampaignRepository,
  type CampaignClockPayload,
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
  createHandoffOutcomeTemporalBatchV1,
  prepareTimedHandoffOutcomeIntegrationV1,
  validateProcessHandoffV1,
  validateTacticalOutcomeV1,
  type HandoffDomainDeltaV1,
  type ProcessHandoffV1,
  type TacticalOutcomeV1
} from "../handoff";
import {
  bastionTacticalHandoffAggregateIdV1
} from "./bastionIncidentAuthority";
import type { CampaignRuntimeBindingsV1 } from
  "./campaignRuntimeBindings";
import {
  restorePendingTacticalOutcomeV1,
  tacticalOutcomeAggregateIdV1,
  TACTICAL_OUTCOME_AGGREGATE_TYPE_V1
} from "./tacticalOutcomeRuntime";

export const TACTICAL_OUTCOME_INTEGRATION_CONTRACT_V1 =
  "tactical-outcome-integration/1" as const;

export interface TacticalConsequenceValidationV1 {
  schemaVersion: 1;
  authorityRef: string;
  candidateId: string;
  ownerDomain: string;
  deltas: HandoffDomainDeltaV1[];
  resolutionCode: string;
  publicNarrative: string | null;
}

export interface TacticalConsequenceAuthorityV1 {
  readonly ownerDomain: string;
  readonly authorityRef: string;
  validate(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    process: ProcessHandoffV1;
    outcome: TacticalOutcomeV1;
    candidate: JsonObject;
    integratedAtGameSecond: number;
  }): Promise<Result<TacticalConsequenceValidationV1>>;
}

export interface TacticalOutcomeIntegrationResultV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof TACTICAL_OUTCOME_INTEGRATION_CONTRACT_V1;
  processId: string;
  outcomeId: string;
  status: "INTEGRATED";
  integratedAtGameSecond: number;
  elapsedGameSeconds: number;
  validationRefs: string[];
  appliedDeltaIds: string[];
  narrative: string;
  commitId: string;
  replayed: boolean;
}

export async function integratePendingTacticalOutcomeV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  processId: string;
  clientRequestId: string;
  authorities: readonly TacticalConsequenceAuthorityV1[];
  technicalTimestamp: string;
  runtimeBindings?: CampaignRuntimeBindingsV1;
}): Promise<Result<TacticalOutcomeIntegrationResultV1>> {
  const authorityIssues = validateAuthorities(input.authorities);
  if (authorityIssues.length > 0) {
    return invalid("tactical.integration.authorities-invalid", authorityIssues);
  }
  const operationToken = await stableToken({
    campaignId: input.campaignId,
    processId: input.processId
  });
  const operationId = opaqueId<OperationId>(
    `tactical-integrate:${operationToken}`
  );
  const existingOperation = await input.repository.getOperation(operationId);
  if (existingOperation.ok) {
    if (
      existingOperation.value.phase === "COMPLETED"
      && existingOperation.value.resultPayload !== null
    ) {
      const restored = readIntegrationResult(existingOperation.value);
      return restored.ok
        ? { ok: true, value: { ...restored.value, replayed: true } }
        : restored;
    }
    return invalid("tactical.integration.operation-incomplete", [
      "the deterministic integration operation already exists but is incomplete"
    ]);
  }
  if (existingOperation.error.code !== "NOT_FOUND") return existingOperation;

  const [campaign, processAggregate, pendingOutcome] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    input.repository.getAggregate(
      input.campaignId,
      "process.handoff",
      bastionTacticalHandoffAggregateIdV1(input.processId)
    ),
    restorePendingTacticalOutcomeV1({
      repository: input.repository,
      campaignId: input.campaignId,
      processId: input.processId
    })
  ]);
  if (!campaign.ok) return campaign;
  if (!processAggregate.ok) return processAggregate;
  if (!pendingOutcome.ok) return pendingOutcome;
  if (pendingOutcome.value === null) {
    return invalid("tactical.integration.outcome-missing", [
      "a persisted raw outcome is required"
    ]);
  }
  const process = processAggregate.value.payload as ProcessHandoffV1;
  const processValidation = validateProcessHandoffV1(process);
  const rawOutcome = pendingOutcome.value;
  if (
    !processValidation.valid
    || process.processKind !== "TACTICAL_ENCOUNTER"
    || process.processId !== input.processId
    || process.campaignId !== input.campaignId
    || process.status !== "COMPLETED_PENDING_INTEGRATION"
    || rawOutcome.domainDeltas.length !== 0
  ) {
    return invalid("tactical.integration.pending-state-invalid", [
      ...processValidation.issues,
      "process and raw outcome must form an unintegrated tactical result"
    ]);
  }

  const clockAggregate = await input.repository.getAggregate(
    input.campaignId,
    "world.clock",
    campaign.value.clockAggregateId
  );
  if (!clockAggregate.ok) return clockAggregate;
  const currentGameSecond = Number(
    (clockAggregate.value.payload as CampaignClockPayload).elapsedGameSeconds
  );
  if (!Number.isInteger(currentGameSecond) || currentGameSecond < 0) {
    return invalid("tactical.integration.clock-invalid", [
      "campaign clock must contain a non-negative integer"
    ]);
  }
  const integratedAtGameSecond =
    currentGameSecond + rawOutcome.elapsedGameSeconds;
  const candidateResult = await validateCandidates({
    repository: input.repository,
    campaignId: input.campaignId,
    process,
    outcome: rawOutcome,
    authorities: input.authorities,
    integratedAtGameSecond
  });
  if (!candidateResult.ok) return candidateResult;
  const deltas = candidateResult.value.flatMap(value => value.deltas);
  const deltaIssues = await validateDeltas(
    input.repository,
    input.campaignId,
    deltas
  );
  if (deltaIssues.length > 0) {
    return invalid("tactical.integration.owner-deltas-invalid", deltaIssues);
  }
  const publicNarratives = candidateResult.value
    .map(value => value.publicNarrative)
    .filter((value): value is string => value !== null);
  const narrative = publicNarratives.length > 0
    ? publicNarratives.join(" ")
    : "Le combat s’achève. Ses conséquences validées sont désormais inscrites dans la campagne.";
  const integratedOutcome: TacticalOutcomeV1 = {
    ...cloneJson(rawOutcome),
    domainDeltas: cloneJson(deltas),
    eventDrafts: [{
      eventType: "bastion_defense_resolved",
      origin: "RULE",
      visibility: "PLAYER_VISIBLE",
      occurredAtGameSecond: integratedAtGameSecond,
      payloadSchemaVersion: 1,
      payload: {
        contractVersion: TACTICAL_OUTCOME_INTEGRATION_CONTRACT_V1,
        processId: rawOutcome.processId,
        outcomeId: rawOutcome.outcomeId,
        endCondition: rawOutcome.endCondition,
        validationRefs: candidateResult.value.map(value => value.authorityRef),
        resolutionCodes: candidateResult.value.map(value => value.resolutionCode),
        narrative
      }
    }],
    narrativeProjection: {
      contractVersion: TACTICAL_OUTCOME_INTEGRATION_CONTRACT_V1,
      messageKey: "tactical.outcome-integrated",
      narrative,
      endCondition: rawOutcome.endCondition
    },
    uiNotifications: [{
      kind: "tactical_outcome_integrated",
      narrative
    }]
  };
  const integratedValidation = validateTacticalOutcomeV1(integratedOutcome);
  if (!integratedValidation.valid) {
    return invalid(
      "tactical.integration.validated-outcome-invalid",
      integratedValidation.issues
    );
  }

  const batch = await createHandoffOutcomeTemporalBatchV1({
    batchId: `batch:${operationToken}`,
    taskId: `boundary:${operationToken}`,
    currentGameSecond,
    elapsedGameSeconds: integratedOutcome.elapsedGameSeconds,
    processId: input.processId,
    outcomeId: integratedOutcome.outcomeId
  });
  const requestPayload = {
    processId: input.processId,
    outcomeId: integratedOutcome.outcomeId,
    finalStateFingerprint: integratedOutcome.finalStateFingerprint,
    batchFingerprint: batch.batchFingerprint,
    validationRefs: candidateResult.value.map(value => value.authorityRef),
    deltaIds: deltas.map(delta => delta.deltaId)
  };
  const requestFingerprint = await computeRequestFingerprint(
    "time.segment",
    1,
    requestPayload
  );
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId: input.campaignId,
    clientRequestId: opaqueId<RequestId>(input.clientRequestId),
    idempotencyKey: opaqueId<IdempotencyKey>(
      integratedOutcome.integrationIdempotencyKey
    ),
    requestFingerprint,
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
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`writer:tactical-integrate:${operationToken}`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const scheduleAggregateId =
      input.runtimeBindings?.scheduleAggregateId
      ?? opaqueId<AggregateId>(
        `agg:tactical-schedule:${operationToken}`
      );
    const cursorAggregateId =
      input.runtimeBindings?.simulationCursorAggregateId
      ?? opaqueId<AggregateId>(
        `agg:tactical-cursor:${operationToken}`
      );
    const [schedule, cursor, outcomeAggregate] = await Promise.all([
      optionalAggregate(
        input.repository,
        input.campaignId,
        "world.schedule",
        scheduleAggregateId
      ),
      optionalAggregate(
        input.repository,
        input.campaignId,
        "world.simulation-cursor",
        cursorAggregateId
      ),
      input.repository.getAggregate(
        input.campaignId,
        TACTICAL_OUTCOME_AGGREGATE_TYPE_V1,
        tacticalOutcomeAggregateIdV1(input.processId)
      )
    ]);
    if (!schedule.ok) return schedule;
    if (!cursor.ok) return cursor;
    if (!outcomeAggregate.ok) return outcomeAggregate;
    const prepared = await prepareTimedHandoffOutcomeIntegrationV1({
      campaign: campaign.value,
      operation: ready.value,
      writerLease: lease.value,
      clockAggregate: clockAggregate.value,
      scheduleAggregate: schedule.value,
      scheduleAggregateId,
      simulationCursorAggregate: cursor.value,
      simulationCursorAggregateId: cursorAggregateId,
      process,
      processAggregateId: processAggregate.value.aggregateId,
      processExpectedRevision: processAggregate.value.aggregateRevision,
      outcome: integratedOutcome,
      batch,
      eventId: opaqueId<EventId>(`event:tactical-integrate:${operationToken}`),
      commitId: opaqueId<CommitId>(`commit:tactical-integrate:${operationToken}`),
      commandId: opaqueId<CommandId>(`command:tactical-integrate:${operationToken}`)
    });
    if (!prepared.ok) {
      return invalid(
        "tactical.integration.temporal-commit-invalid",
        prepared.diagnostics.map(value => `${value.code}:${value.path}`)
      );
    }
    prepared.value.aggregateWrites.push({
      aggregateType: TACTICAL_OUTCOME_AGGREGATE_TYPE_V1,
      aggregateId: outcomeAggregate.value.aggregateId,
      expectedAggregateRevision: outcomeAggregate.value.aggregateRevision,
      payloadSchemaVersion: 1,
      payload: integratedOutcome
    });
    for (const event of prepared.value.events) {
      event.aggregateRefs.push({
        aggregateType: TACTICAL_OUTCOME_AGGREGATE_TYPE_V1,
        aggregateId: outcomeAggregate.value.aggregateId,
        aggregateRevision: outcomeAggregate.value.aggregateRevision + 1
      });
    }
    const committed = await input.repository.commit(prepared.value);
    if (!committed.ok) return committed;
    const result: TacticalOutcomeIntegrationResultV1 = {
      schemaVersion: 1,
      contractVersion: TACTICAL_OUTCOME_INTEGRATION_CONTRACT_V1,
      processId: input.processId,
      outcomeId: integratedOutcome.outcomeId,
      status: "INTEGRATED",
      integratedAtGameSecond,
      elapsedGameSeconds: integratedOutcome.elapsedGameSeconds,
      validationRefs: candidateResult.value.map(value => value.authorityRef),
      appliedDeltaIds: deltas.map(delta => delta.deltaId),
      narrative,
      commitId: committed.value.commitId,
      replayed: false
    };
    const completed = await input.repository.completePresentation(
      operationId,
      "COMMITTED_RENDERED",
      1,
      result
    );
    return completed.ok ? { ok: true, value: result } : completed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

async function validateCandidates(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  process: ProcessHandoffV1;
  outcome: TacticalOutcomeV1;
  authorities: readonly TacticalConsequenceAuthorityV1[];
  integratedAtGameSecond: number;
}): Promise<Result<TacticalConsequenceValidationV1[]>> {
  const candidates = input.outcome.consequenceCandidates;
  if (candidates.length === 0) {
    return invalid("tactical.integration.candidates-required", [
      "a completed tactical encounter must declare owner candidates"
    ]);
  }
  const seen = new Set<string>();
  const validations: TacticalConsequenceValidationV1[] = [];
  for (const candidate of candidates) {
    const candidateId = stringField(candidate, "candidateId");
    const ownerDomain = stringField(candidate, "ownerDomain");
    if (candidateId === null || ownerDomain === null || seen.has(candidateId)) {
      return invalid("tactical.integration.candidate-invalid", [
        "candidateId and ownerDomain must be unique non-empty strings"
      ]);
    }
    seen.add(candidateId);
    const authority = input.authorities.find(
      value => value.ownerDomain === ownerDomain
    );
    if (authority === undefined) {
      return invalid("tactical.integration.authority-missing", [
        `no owner authority is registered for ${ownerDomain}`
      ]);
    }
    const validation = await authority.validate({
      repository: input.repository,
      campaignId: input.campaignId,
      process: input.process,
      outcome: input.outcome,
      candidate,
      integratedAtGameSecond: input.integratedAtGameSecond
    });
    if (!validation.ok) return validation;
    if (
      validation.value.schemaVersion !== 1
      || validation.value.authorityRef !== authority.authorityRef
      || validation.value.candidateId !== candidateId
      || validation.value.ownerDomain !== ownerDomain
      || !nonEmpty(validation.value.resolutionCode)
    ) {
      return invalid("tactical.integration.authority-response-invalid", [
        `invalid response from ${authority.authorityRef}`
      ]);
    }
    validations.push(cloneJson(validation.value));
  }
  return { ok: true, value: validations };
}

async function validateDeltas(
  repository: CampaignRepository,
  campaignId: CampaignId,
  deltas: HandoffDomainDeltaV1[]
): Promise<string[]> {
  const issues: string[] = [];
  const deltaIds = new Set<string>();
  const targets = new Set<string>();
  for (const delta of deltas) {
    const target = `${delta.aggregateType}:${delta.aggregateId}`;
    if (!nonEmpty(delta.deltaId) || deltaIds.has(delta.deltaId)) {
      issues.push("delta identifiers must be unique");
    }
    if (!nonEmpty(delta.aggregateType) || !nonEmpty(delta.aggregateId)) {
      issues.push(`delta ${delta.deltaId} has no aggregate target`);
    }
    if (targets.has(target)) {
      issues.push(`multiple owner deltas target ${target}`);
    }
    deltaIds.add(delta.deltaId);
    targets.add(target);
    const current = await repository.getAggregate(
      campaignId,
      delta.aggregateType,
      delta.aggregateId
    );
    if (!current.ok) {
      issues.push(`owner aggregate ${target} is unavailable`);
    } else if (current.value.aggregateRevision !== delta.expectedAggregateRevision) {
      issues.push(`owner aggregate ${target} revision changed`);
    }
  }
  return issues;
}

function validateAuthorities(
  authorities: readonly TacticalConsequenceAuthorityV1[]
): string[] {
  const issues: string[] = [];
  const domains = new Set<string>();
  for (const authority of authorities) {
    if (!nonEmpty(authority.ownerDomain) || !nonEmpty(authority.authorityRef)) {
      issues.push("ownerDomain and authorityRef are required");
    }
    if (domains.has(authority.ownerDomain)) {
      issues.push(`multiple authorities own ${authority.ownerDomain}`);
    }
    domains.add(authority.ownerDomain);
  }
  return issues;
}

async function optionalAggregate(
  repository: CampaignRepository,
  campaignId: CampaignId,
  aggregateType: string,
  aggregateId: AggregateId
): Promise<Result<AggregateRecord | null>> {
  const aggregate = await repository.getAggregate(
    campaignId,
    aggregateType,
    aggregateId
  );
  return !aggregate.ok && aggregate.error.code === "NOT_FOUND"
    ? { ok: true, value: null }
    : aggregate;
}

function readIntegrationResult(
  operation: OperationRecord
): Result<TacticalOutcomeIntegrationResultV1> {
  const value = operation.resultPayload as
    | TacticalOutcomeIntegrationResultV1
    | null;
  return value !== null
    && value.schemaVersion === 1
    && value.contractVersion === TACTICAL_OUTCOME_INTEGRATION_CONTRACT_V1
    && value.status === "INTEGRATED"
    ? { ok: true, value: cloneJson(value) }
    : invalid("tactical.integration.result-invalid", [
        "completed integration result is invalid"
      ]);
}

async function stableToken(value: JsonObject): Promise<string> {
  return (await computeJsonFingerprint(value))
    .replace(/^sha256:/u, "")
    .slice(0, 40);
}

function stringField(value: JsonObject, key: string): string | null {
  const candidate = value[key];
  return nonEmpty(candidate) ? candidate : null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0;
}

function invalid(messageKey: string, issues: string[]): Result<never> {
  return {
    ok: false,
    error: coreError("VALIDATION_FAILED", messageKey, { issues })
  };
}
