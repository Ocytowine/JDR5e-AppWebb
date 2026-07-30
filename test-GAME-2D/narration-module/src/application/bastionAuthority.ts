import {
  cloneJson,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CampaignRecord,
  type CampaignRepository,
  type CommitId,
  type EventDraft,
  type EventId,
  type EventRecord,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../core";

export const BASTION_REGISTRY_CONTRACT_V1 = "bastion-registry/1" as const;
export const BASTION_ESTABLISHMENT_CONTRACT_V1 = "bastion-establishment/1" as const;
export const BASTION_REGISTRY_AGGREGATE_TYPE_V1 = "bastion.registry" as const;

export type BastionStatusV1 = "ACTIVE" | "SUSPENDED" | "LOST";

export interface BastionRecordV1 extends JsonObject {
  schemaVersion: 1;
  bastionId: string;
  placeRef: string;
  placeDisplayName: string;
  ownerRef: string;
  ownerDisplayName: string;
  status: BastionStatusV1;
  sourceOperationId: string;
  sourceEventId: string;
  acquisitionPolicyRef: string;
  placeSourceRefs: string[];
  establishedAtGameSecond: number;
  installations: BastionInstallationV1[];
  workOrders: BastionWorkOrderV1[];
  occupantAssignments: BastionOccupantAssignmentV1[];
  occupantActivities: BastionOccupantActivityV1[];
  incidents: BastionIncidentV1[];
  version: number;
}

export interface BastionIncidentV1 extends JsonObject {
  schemaVersion: 1;
  incidentId: string;
  incidentDefinitionRef: string;
  incidentDisplayName: string;
  kind: "OPPORTUNITY" | "INSTALLATION_CONSEQUENCE" | "TACTICAL_DEFENSE";
  status: "OPEN" | "APPLIED" | "HANDOFF_ACTIVE";
  sourceOperationId: string;
  sourceEventId: string;
  policyRef: string;
  catalogRef: string;
  affectedInstallationId: string | null;
  tacticalProcessId: string | null;
  occurredAtGameSecond: number;
  publicNarrative: string;
  version: number;
}

export interface BastionOccupantAssignmentV1 extends JsonObject {
  schemaVersion: 1;
  assignmentId: string;
  campaignNpcId: string;
  actorId: string;
  actorDisplayName: string;
  roleDefinitionRef: string;
  roleDisplayName: string;
  roleCatalogRef: string;
  authorityRef: string;
  authorityProofRefs: string[];
  status: "ACTIVE" | "ENDED";
  assignedAtGameSecond: number;
  endedAtGameSecond: number | null;
  lastActivityAtGameSecond: number | null;
  activityCount: number;
  version: number;
}

export interface BastionOccupantActivityV1 extends JsonObject {
  schemaVersion: 1;
  activityId: string;
  assignmentId: string;
  campaignNpcId: string;
  activityDefinitionRef: string;
  activityDisplayName: string;
  authorityRef: string;
  authorityProofRefs: string[];
  occurredAtGameSecond: number;
  publicNarrative: string;
  version: number;
}

export interface BastionInstallationV1 extends JsonObject {
  schemaVersion: 1;
  installationId: string;
  installationDefinitionRef: string;
  displayName: string;
  status: "ACTIVE" | "DAMAGED" | "DISABLED";
  sourceWorkOrderId: string;
  installedAtGameSecond: number;
  version: number;
}

export interface BastionWorkOrderV1 extends JsonObject {
  schemaVersion: 1;
  workOrderId: string;
  workDefinitionRef: string;
  workDisplayName: string;
  catalogRef: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  scheduledEffectId: string;
  prerequisiteProofRefs: string[];
  installationDefinitionRef: string;
  installationDisplayName: string;
  completionNarrative: string;
  startedAtGameSecond: number;
  dueAtGameSecond: number;
  completedAtGameSecond: number | null;
  version: number;
}

export interface BastionRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_REGISTRY_CONTRACT_V1;
  campaignId: string;
  bastions: BastionRecordV1[];
  version: number;
}

export interface EstablishBastionCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_ESTABLISHMENT_CONTRACT_V1;
  clientRequestId: string;
  sourceOperationId: string;
  sourceEventId: string;
}

export interface BastionAcquisitionDecisionV1 extends JsonObject {
  schemaVersion: 1;
  eligible: boolean;
  reasonCode: string;
  placeRef: string | null;
  ownerRef: string | null;
  ownerDisplayName: string | null;
}

export interface BastionAcquisitionPolicyV1 {
  readonly policyRef: string;
  evaluate(input: {
    campaign: CampaignRecord;
    sourceEvent: EventRecord;
  }): BastionAcquisitionDecisionV1 | Promise<BastionAcquisitionDecisionV1>;
}

export interface BastionPlaceResolutionV1 extends JsonObject {
  schemaVersion: 1;
  exists: boolean;
  placeRef: string;
  placeDisplayName: string | null;
  publicSourceRefs: string[];
}

export interface BastionPlaceResolverV1 {
  readonly resolverRef: string;
  resolve(input: {
    campaign: CampaignRecord;
    placeRef: string;
  }): BastionPlaceResolutionV1 | Promise<BastionPlaceResolutionV1>;
}

export interface BastionPublicSummaryV1 extends JsonObject {
  schemaVersion: 1;
  bastionId: string;
  placeRef: string;
  placeDisplayName: string;
  ownerRef: string;
  ownerDisplayName: string;
  status: "ACTIVE";
  establishedAtGameSecond: number;
}

export interface BastionEstablishmentResultV1 extends JsonObject {
  schemaVersion: 1;
  status: "INELIGIBLE" | "ESTABLISHED" | "ALREADY_ESTABLISHED";
  reasonCode: string;
  bastion: BastionRecordV1 | null;
  publicSummary: BastionPublicSummaryV1 | null;
  commitId: string | null;
  replayed: boolean;
}

export function bastionRegistryAggregateIdV1(campaignId: string): AggregateId {
  return opaqueId<AggregateId>(`bastion-registry:${campaignId}`);
}

export function createEmptyBastionRegistryV1(campaignId: string): BastionRegistryV1 {
  return {
    schemaVersion: 1,
    contractVersion: BASTION_REGISTRY_CONTRACT_V1,
    campaignId,
    bastions: [],
    version: 1
  };
}

export async function loadBastionRegistryV1(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<{ aggregate: AggregateRecord | null; state: BastionRegistryV1 }>> {
  const aggregate = await repository.getAggregate(
    campaignId,
    BASTION_REGISTRY_AGGREGATE_TYPE_V1,
    bastionRegistryAggregateIdV1(campaignId)
  );
  if (!aggregate.ok && aggregate.error.code === "NOT_FOUND") {
    return {
      ok: true,
      value: {
        aggregate: null,
        state: createEmptyBastionRegistryV1(campaignId)
      }
    };
  }
  if (!aggregate.ok) return aggregate;
  const state = aggregate.value.payload as unknown as BastionRegistryV1;
  if (
    state.schemaVersion !== 1
    || state.contractVersion !== BASTION_REGISTRY_CONTRACT_V1
    || state.campaignId !== campaignId
    || !Array.isArray(state.bastions)
    || state.bastions.some(bastion =>
      !Array.isArray(bastion.installations)
      || !Array.isArray(bastion.workOrders)
      || !Array.isArray(bastion.occupantAssignments)
      || !Array.isArray(bastion.occupantActivities)
      || !Array.isArray(bastion.incidents)
    )
  ) {
    return invalid("bastion.registry-invalid", ["registry payload is invalid"]);
  }
  return { ok: true, value: { aggregate: aggregate.value, state } };
}

export async function establishBastionV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: EstablishBastionCommandV1;
  acquisitionPolicy: BastionAcquisitionPolicyV1 | null;
  placeResolver: BastionPlaceResolverV1 | null;
}): Promise<Result<BastionEstablishmentResultV1>> {
  const commandIssues = validateCommand(input.command);
  if (commandIssues.length > 0) {
    return invalid("bastion.establishment-command-invalid", commandIssues);
  }
  if (input.acquisitionPolicy === null || !nonEmpty(input.acquisitionPolicy.policyRef)) {
    return invalid("bastion.acquisition-policy-required", [
      "an explicit acquisition policy is required"
    ]);
  }
  if (input.placeResolver === null || !nonEmpty(input.placeResolver.resolverRef)) {
    return invalid("bastion.place-resolver-required", [
      "an explicit place resolver is required"
    ]);
  }
  const operationId = opaqueId<OperationId>(
    `bastion-establishment:${input.command.clientRequestId}`
  );
  const requestFingerprint = await computeRequestFingerprint(
    "bastion.establish",
    1,
    input.command
  );
  const existing = await input.repository.getOperation(operationId);
  if (existing.ok && existing.value.requestFingerprint !== requestFingerprint) {
    return {
      ok: false,
      error: coreError("IDEMPOTENCY_CONFLICT", "bastion.establishment-request-conflict")
    };
  }
  if (existing.ok && existing.value.phase === "COMPLETED") {
    return restoreResult(existing.value);
  }
  if (existing.ok) {
    return invalid("bastion.establishment-operation-incomplete", [
      "operation already exists and is not completed"
    ]);
  }
  if (existing.error.code !== "NOT_FOUND") return existing;

  const [campaign, sourceOperation, registry] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    input.repository.getOperation(opaqueId<OperationId>(input.command.sourceOperationId)),
    loadBastionRegistryV1(input.repository, input.campaignId)
  ]);
  if (!campaign.ok) return campaign;
  if (!sourceOperation.ok) return sourceOperation;
  if (!registry.ok) return registry;
  if (
    sourceOperation.value.campaignId !== input.campaignId
    || sourceOperation.value.commitId === null
    || !["COMMITTED_PENDING_RENDER", "COMPLETED"].includes(sourceOperation.value.phase)
  ) {
    return invalid("bastion.source-operation-not-committed", [
      "source operation must belong to the campaign and be committed"
    ]);
  }
  const sourceEvent = await findCommittedSourceEvent({
    repository: input.repository,
    campaignId: input.campaignId,
    sourceOperationId: sourceOperation.value.operationId,
    sourceEventId: input.command.sourceEventId,
    sourceCommitId: sourceOperation.value.commitId
  });
  if (!sourceEvent.ok) return sourceEvent;
  if (sourceEvent.value === null) {
    return invalid("bastion.source-event-not-committed", [
      "source event must belong to the committed source operation"
    ]);
  }
  const decision = await input.acquisitionPolicy.evaluate({
    campaign: campaign.value,
    sourceEvent: cloneJson(sourceEvent.value)
  });
  const decisionIssues = validateDecision(decision);
  if (decisionIssues.length > 0) {
    return invalid("bastion.acquisition-decision-invalid", decisionIssues);
  }
  if (
    !decision.eligible
    || decision.placeRef === null
    || decision.ownerRef === null
    || decision.ownerDisplayName === null
  ) {
    const result: BastionEstablishmentResultV1 = {
      schemaVersion: 1,
      status: "INELIGIBLE",
      reasonCode: decision.reasonCode,
      bastion: null,
      publicSummary: null,
      commitId: null,
      replayed: false
    };
    const started = await beginOperation({
      repository: input.repository,
      campaignId: input.campaignId,
      operationId,
      clientRequestId: input.command.clientRequestId,
      requestFingerprint,
      payload: cloneJson(input.command)
    });
    if (!started.ok) return started;
    const completed = await input.repository.completeWithoutCommit(operationId, 1, result);
    return completed.ok ? { ok: true, value: result } : completed;
  }
  const resolvedPlace = await input.placeResolver.resolve({
    campaign: campaign.value,
    placeRef: decision.placeRef
  });
  const placeIssues = validatePlaceResolution(resolvedPlace, decision.placeRef);
  if (placeIssues.length > 0) {
    return invalid("bastion.place-resolution-invalid", placeIssues);
  }
  if (!resolvedPlace.exists || resolvedPlace.placeDisplayName === null) {
    const result: BastionEstablishmentResultV1 = {
      schemaVersion: 1,
      status: "INELIGIBLE",
      reasonCode: "PLACE_NOT_FOUND",
      bastion: null,
      publicSummary: null,
      commitId: null,
      replayed: false
    };
    const started = await beginOperation({
      repository: input.repository,
      campaignId: input.campaignId,
      operationId,
      clientRequestId: input.command.clientRequestId,
      requestFingerprint,
      payload: cloneJson(input.command)
    });
    if (!started.ok) return started;
    const completed = await input.repository.completeWithoutCommit(operationId, 1, result);
    return completed.ok ? { ok: true, value: result } : completed;
  }
  const alreadyEstablished = registry.value.state.bastions.find(bastion =>
    bastion.status !== "LOST"
    && (bastion.placeRef === decision.placeRef
      || bastion.sourceEventId === sourceEvent.value!.eventId)
  );
  if (alreadyEstablished !== undefined) {
    const result: BastionEstablishmentResultV1 = {
      schemaVersion: 1,
      status: "ALREADY_ESTABLISHED",
      reasonCode: alreadyEstablished.ownerRef === decision.ownerRef
        ? "BASTION_ALREADY_ESTABLISHED"
        : "PLACE_ALREADY_ASSIGNED",
      bastion: cloneJson(alreadyEstablished),
      publicSummary: publicSummary(alreadyEstablished),
      commitId: null,
      replayed: false
    };
    const started = await beginOperation({
      repository: input.repository,
      campaignId: input.campaignId,
      operationId,
      clientRequestId: input.command.clientRequestId,
      requestFingerprint,
      payload: cloneJson(input.command)
    });
    if (!started.ok) return started;
    const completed = await input.repository.completeWithoutCommit(operationId, 1, result);
    return completed.ok ? { ok: true, value: result } : completed;
  }
  const clock = await input.repository.getAggregate(
    input.campaignId,
    "world.clock",
    campaign.value.clockAggregateId
  );
  if (!clock.ok) return clock;
  const establishedAtGameSecond = Number(clock.value.payload.elapsedGameSeconds);
  if (
    !Number.isInteger(establishedAtGameSecond)
    || establishedAtGameSecond < sourceEvent.value.occurredAtGameSecond
  ) {
    return invalid("bastion.campaign-clock-invalid", [
      "campaign clock must not precede the acquisition event"
    ]);
  }
  const bastion: BastionRecordV1 = {
    schemaVersion: 1,
    bastionId: `bastion:${decision.placeRef}`,
    placeRef: decision.placeRef,
    placeDisplayName: resolvedPlace.placeDisplayName,
    ownerRef: decision.ownerRef,
    ownerDisplayName: decision.ownerDisplayName,
    status: "ACTIVE",
    sourceOperationId: sourceOperation.value.operationId,
    sourceEventId: sourceEvent.value.eventId,
    acquisitionPolicyRef: input.acquisitionPolicy.policyRef,
    placeSourceRefs: [...new Set(resolvedPlace.publicSourceRefs)].sort(),
    establishedAtGameSecond,
    installations: [],
    workOrders: [],
    occupantAssignments: [],
    occupantActivities: [],
    incidents: [],
    version: 1
  };
  const nextRegistry: BastionRegistryV1 = {
    ...registry.value.state,
    bastions: [...registry.value.state.bastions, bastion]
      .sort((left, right) => left.bastionId.localeCompare(right.bastionId)),
    version: registry.value.state.version + 1
  };
  const summary = publicSummary(bastion);
  const started = await beginOperation({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId,
    clientRequestId: input.command.clientRequestId,
    requestFingerprint,
    payload: cloneJson(input.command)
  });
  if (!started.ok) return started;
  const committed = await commitEstablishment({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: started.value,
    currentAggregate: registry.value.aggregate,
    nextRegistry,
    bastion,
    summary
  });
  if (!committed.ok) return committed;
  const result: BastionEstablishmentResultV1 = {
    schemaVersion: 1,
    status: "ESTABLISHED",
    reasonCode: decision.reasonCode,
    bastion,
    publicSummary: summary,
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
}

async function beginOperation(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operationId: OperationId;
  clientRequestId: string;
  requestFingerprint: string;
  payload: JsonObject;
}): Promise<Result<OperationRecord>> {
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const now = new Date().toISOString();
  return input.repository.receiveOperation({
    schemaVersion: 1,
    operationId: input.operationId,
    campaignId: input.campaignId,
    clientRequestId: opaqueId<RequestId>(input.clientRequestId),
    idempotencyKey: opaqueId<IdempotencyKey>(input.operationId),
    requestFingerprint: input.requestFingerprint,
    operationKind: "bastion.establish",
    requestPayloadSchemaVersion: 1,
    requestPayload: input.payload,
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
}

async function commitEstablishment(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  currentAggregate: AggregateRecord | null;
  nextRegistry: BastionRegistryV1;
  bastion: BastionRecordV1;
  summary: BastionPublicSummaryV1;
}): Promise<Result<{ commitId: CommitId }>> {
  const preparing = await input.repository.transitionOperation(
    input.operation.operationId,
    "RECEIVED",
    "PREPARING"
  );
  if (!preparing.ok) return preparing;
  const ready = await input.repository.transitionOperation(
    input.operation.operationId,
    "PREPARING",
    "READY_TO_COMMIT"
  );
  if (!ready.ok) return ready;
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${input.operation.operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const aggregateId = bastionRegistryAggregateIdV1(input.campaignId);
    const nextRevision = input.currentAggregate === null
      ? 0
      : input.currentAggregate.aggregateRevision + 1;
    const command: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "bastion-authority",
      contractVersion: 1,
      commandId: opaqueId(`${input.operation.operationId}:command`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandType: "bastion.establish",
      target: {
        aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: input.currentAggregate?.aggregateRevision ?? null
      },
      payloadSchemaVersion: 1,
      payload: {
        bastionId: input.bastion.bastionId,
        placeRef: input.bastion.placeRef,
        ownerRef: input.bastion.ownerRef,
        sourceEventId: input.bastion.sourceEventId,
        acquisitionPolicyRef: input.bastion.acquisitionPolicyRef
      },
      acceptedAtGameSecond: input.bastion.establishedAtGameSecond
    };
    const event: EventDraft = {
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${input.operation.operationId}:bastion-established`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: "bastion_established",
      origin: "RULE",
      causation: { kind: "COMMAND", id: command.commandId },
      aggregateRefs: [{
        aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        aggregateRevision: nextRevision
      }],
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      occurredAtGameSecond: input.bastion.establishedAtGameSecond,
      payloadSchemaVersion: 1,
      payload: input.summary
    };
    const commit = await input.repository.commit({
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit`),
      idempotencyKey: input.operation.idempotencyKey,
      requestFingerprint: input.operation.requestFingerprint,
      expectedCampaignRevision: input.operation.observedCampaignRevision,
      writerLease: lease.value,
      acceptedCommands: [command],
      aggregateWrites: [{
        aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: input.currentAggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1,
        payload: input.nextRegistry
      }],
      events: [event],
      outboxTasks: []
    });
    if (!commit.ok && commit.error.code === "PERSISTENCE_FAILURE") {
      const recovered = await input.repository.getCommitByIdempotencyKey(
        input.campaignId,
        input.operation.idempotencyKey
      );
      return recovered.ok && recovered.value.requestFingerprint === input.operation.requestFingerprint
        ? { ok: true, value: { commitId: recovered.value.commitId } }
        : commit;
    }
    return commit.ok
      ? { ok: true, value: { commitId: commit.value.commitId } }
      : commit;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

async function findCommittedSourceEvent(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  sourceOperationId: OperationId;
  sourceEventId: string;
  sourceCommitId: CommitId;
}): Promise<Result<EventRecord | null>> {
  let cursor: { commitSequence: number; eventSequence: number } | null = null;
  while (true) {
    const page = await input.repository.listEvents(input.campaignId, cursor, 1_024);
    if (!page.ok) return page;
    const found = page.value.find(event =>
      event.eventId === input.sourceEventId
      && event.operationId === input.sourceOperationId
      && event.commitId === input.sourceCommitId
    );
    if (found !== undefined) return { ok: true, value: found };
    const last = page.value.at(-1);
    if (last === undefined || page.value.length < 1_024) {
      return { ok: true, value: null };
    }
    cursor = {
      commitSequence: last.commitSequence,
      eventSequence: last.eventSequence
    };
  }
}

function publicSummary(bastion: BastionRecordV1): BastionPublicSummaryV1 {
  return {
    schemaVersion: 1,
    bastionId: bastion.bastionId,
    placeRef: bastion.placeRef,
    placeDisplayName: bastion.placeDisplayName,
    ownerRef: bastion.ownerRef,
    ownerDisplayName: bastion.ownerDisplayName,
    status: "ACTIVE",
    establishedAtGameSecond: bastion.establishedAtGameSecond
  };
}

function validateCommand(command: EstablishBastionCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (command.contractVersion !== BASTION_ESTABLISHMENT_CONTRACT_V1) {
    issues.push("contractVersion is invalid");
  }
  ["clientRequestId", "sourceOperationId", "sourceEventId"].forEach(key => {
    if (!nonEmpty(command[key as keyof EstablishBastionCommandV1])) {
      issues.push(`${key} is required`);
    }
  });
  return issues;
}

function validateDecision(decision: BastionAcquisitionDecisionV1): string[] {
  const issues: string[] = [];
  if (decision.schemaVersion !== 1) issues.push("decision schemaVersion must be 1");
  if (typeof decision.eligible !== "boolean") issues.push("eligible must be boolean");
  if (!nonEmpty(decision.reasonCode)) issues.push("reasonCode is required");
  if (decision.eligible) {
    if (!nonEmpty(decision.placeRef)) issues.push("eligible decision requires placeRef");
    if (!nonEmpty(decision.ownerRef)) issues.push("eligible decision requires ownerRef");
    if (!publicText(decision.ownerDisplayName, 80)) {
      issues.push("eligible decision requires a public ownerDisplayName");
    }
  } else if (
    decision.placeRef !== null
    || decision.ownerRef !== null
    || decision.ownerDisplayName !== null
  ) {
    issues.push("ineligible decision must not expose acquisition details");
  }
  return issues;
}

function validatePlaceResolution(
  resolution: BastionPlaceResolutionV1,
  expectedPlaceRef: string
): string[] {
  const issues: string[] = [];
  if (resolution.schemaVersion !== 1) issues.push("place resolution schemaVersion must be 1");
  if (typeof resolution.exists !== "boolean") issues.push("place exists must be boolean");
  if (resolution.placeRef !== expectedPlaceRef) issues.push("placeRef mismatch");
  if (!Array.isArray(resolution.publicSourceRefs)
    || resolution.publicSourceRefs.some(ref => !nonEmpty(ref))) {
    issues.push("publicSourceRefs must contain valid references");
  }
  if (resolution.exists && !publicText(resolution.placeDisplayName, 120)) {
    issues.push("existing place requires a public display name");
  }
  if (!resolution.exists && resolution.placeDisplayName !== null) {
    issues.push("missing place must not have a display name");
  }
  return issues;
}

function restoreResult(operation: OperationRecord): Result<BastionEstablishmentResultV1> {
  const result = operation.resultPayload as unknown as BastionEstablishmentResultV1 | null;
  if (
    result === null
    || result.schemaVersion !== 1
    || !["INELIGIBLE", "ESTABLISHED", "ALREADY_ESTABLISHED"].includes(result.status)
  ) {
    return invalid("bastion.establishment-result-invalid", [
      "completed operation result is invalid"
    ]);
  }
  return { ok: true, value: { ...cloneJson(result), replayed: true } };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function publicText(value: unknown, maximumLength: number): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && value.length <= maximumLength
    && !/[\r\n\u0000-\u001f\u007f]/u.test(value);
}

function invalid(messageKey: string, issues: string[]): Result<never> {
  return {
    ok: false,
    error: coreError("VALIDATION_FAILED", messageKey, { issues })
  };
}
