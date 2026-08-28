import {
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AggregateRecord,
  type CampaignId,
  type CampaignRepository,
  type CommitId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../core";
import {
  CAMPAIGN_FACT_REGISTRY_AGGREGATE_TYPE_V1,
  CAMPAIGN_FACT_REGISTRY_CONTRACT_VERSION_V1,
  NARRATIVE_ACTOR_REGISTRY_AGGREGATE_TYPE_V1,
  NARRATIVE_ACTOR_REGISTRY_CONTRACT_VERSION_V1,
  campaignFactRegistryAggregateIdV1,
  createEmptyCampaignFactRegistryV1,
  createEmptyNarrativeActorRegistryV1,
  narrativeActorRegistryAggregateIdV1,
  prepareCampaignFactMutationCommitV1,
  prepareCampaignFactMutationV1,
  type CampaignFactMutationCommandV1,
  type CampaignFactLoreAnchorValidatorV1,
  type CampaignFactInformationReaderV1,
  type CampaignFactRecordV1,
  type CampaignFactRegistryV1,
  type NarrativeActorLightReferenceV1,
  type NarrativeActorRegistryV1
} from "./campaignFactAuthority";

export interface CampaignFactMutationResultV1 extends JsonObject {
  schemaVersion: 1;
  fact: CampaignFactRecordV1 | null;
  identity: NarrativeActorLightReferenceV1 | null;
  commitId: string | null;
  replayed: boolean;
  outcome: "ASSERTED" | "REPLACED" | "INVALIDATED" | "ALREADY_CURRENT";
}

export async function mutateCampaignFactV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: CampaignFactMutationCommandV1;
  anchorValidator: CampaignFactLoreAnchorValidatorV1;
  occurredAtGameSecond?: number;
}): Promise<Result<CampaignFactMutationResultV1>> {
  const anchorIssues = input.anchorValidator.validate(input.command);
  if (anchorIssues.length > 0) {
    return { ok: false, error: coreError("VALIDATION_FAILED", "campaign-fact.lore-anchor-invalid", { issues: anchorIssues }) };
  }
  const operationId = opaqueId<OperationId>(`campaign-fact-mutation:${input.command.clientRequestId}`);
  const idempotencyKey = opaqueId<IdempotencyKey>(`campaign-fact-mutation:${input.command.clientRequestId}`);
  const payload = mutationFingerprintPayload(input.command);
  const fingerprint = await computeRequestFingerprint("campaign.fact.mutate", 1, payload);
  const existing = await input.repository.getOperation(operationId);
  if (existing.ok && existing.value.requestFingerprint !== fingerprint) {
    return { ok: false, error: coreError("IDEMPOTENCY_CONFLICT", "campaign-fact.mutation-request-conflict", { clientRequestId: input.command.clientRequestId }) };
  }
  if (existing.ok && existing.value.phase === "COMPLETED") return restoreCompleted(existing.value);
  if (!existing.ok && existing.error.code !== "NOT_FOUND") return existing;

  const lease = await input.repository.acquireWriterLease(input.campaignId, opaqueId<WriterId>(`${operationId}:writer`), 120_000);
  if (!lease.ok) return lease;
  try {
    const campaign = await input.repository.getCampaign(input.campaignId);
    if (!campaign.ok) return campaign;
    const facts = await loadCampaignFactRegistryV1(input.repository, input.campaignId);
    if (!facts.ok) return facts;
    const actors = await loadNarrativeActorRegistryV1(input.repository, input.campaignId);
    if (!actors.ok) return actors;

    // Preparation, including public-source validation, runs while the writer
    // lease is held. Reuse therefore cannot race with a second creation.
    const occurredAtGameSecond = input.occurredAtGameSecond ?? 0;
    const prepared = prepareCampaignFactMutationV1({
      campaignId: input.campaignId,
      operationId,
      occurredAtGameSecond,
      resultingCampaignRevision: campaign.value.campaignRevision + 1,
      command: input.command,
      facts: facts.value.state,
      actors: actors.value.state
    });
    if (!prepared.ok) return { ok: false, error: coreError("VALIDATION_FAILED", "campaign-fact.mutation-rejected", { issues: prepared.issues }) };
    if (prepared.status === "ALREADY_CURRENT") {
      return { ok: true, value: { schemaVersion: 1, fact: prepared.fact, identity: prepared.identity, commitId: null, replayed: true, outcome: "ALREADY_CURRENT" } };
    }

    let operation: OperationRecord;
    if (existing.ok) operation = existing.value;
    else {
      const now = new Date().toISOString();
      const received = await input.repository.receiveOperation({
        schemaVersion: 1,
        operationId,
        campaignId: input.campaignId,
        clientRequestId: opaqueId<RequestId>(input.command.clientRequestId),
        idempotencyKey,
        requestFingerprint: fingerprint,
        operationKind: "campaign.fact.mutate",
        requestPayloadSchemaVersion: 1,
        requestPayload: payload,
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
      const transitioned = await input.repository.transitionOperation(operationId, "RECEIVED", "PREPARING");
      if (!transitioned.ok) return transitioned;
      operation = transitioned.value;
    }
    if (operation.phase === "PREPARING") {
      const transitioned = await input.repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT");
      if (!transitioned.ok) return transitioned;
      operation = transitioned.value;
    }
    const atomic = prepareCampaignFactMutationCommitV1({
      campaignId: input.campaignId,
      operationId,
      idempotencyKey,
      requestFingerprint: fingerprint,
      expectedCampaignRevision: operation.observedCampaignRevision,
      factAggregate: facts.value.aggregate,
      actorAggregate: actors.value.aggregate,
      prepared,
      command: input.command,
      writerLease: lease.value,
      commitId: opaqueId<CommitId>(`${operationId}:commit`),
      occurredAtGameSecond
    });
    if (!atomic.ok) return { ok: false, error: coreError("VALIDATION_FAILED", "campaign-fact.commit-rejected", { issues: atomic.issues }) };
    const committed = await input.repository.commit(atomic.value);
    if (!committed.ok) return committed;
    const result: CampaignFactMutationResultV1 = {
      schemaVersion: 1,
      fact: prepared.fact,
      identity: prepared.identity,
      commitId: committed.value.commitId,
      replayed: false,
      outcome: input.command.mutationKind === "ASSERT" ? "ASSERTED" : input.command.mutationKind === "REPLACE" ? "REPLACED" : "INVALIDATED"
    };
    const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
    return completed.ok ? { ok: true, value: result } : completed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

export function createCampaignFactInformationReaderV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
}): CampaignFactInformationReaderV1 {
  return {
    async listEffectiveFacts(request) {
      if (request.schemaVersion !== 1 || request.campaignId !== input.campaignId) throw new Error("Campaign fact information request is invalid.");
      if (!Number.isInteger(request.campaignRevision) || request.campaignRevision < 0) throw new Error("Campaign fact information revision is invalid.");
      if (!["CURRENT", "UNSPECIFIED"].includes(request.temporalScope)) return [];
      const loaded = await loadCampaignFactRegistryV1(input.repository, input.campaignId);
      if (!loaded.ok) throw new Error(loaded.error.messageKey);
      const subjects = new Set(request.subjectRefs);
      return loaded.value.state.facts
        .filter(fact => fact.visibility === "PUBLIC" && subjects.has(fact.subjectRef) && fact.assertedCampaignRevision <= request.campaignRevision && (fact.closedAtCampaignRevision === null || fact.closedAtCampaignRevision > request.campaignRevision))
        .map(fact => structuredClone(fact));
    }
  };
}

export async function loadCampaignFactRegistryV1(repository: CampaignRepository, campaignId: CampaignId): Promise<Result<{ aggregate: AggregateRecord | null; state: CampaignFactRegistryV1 }>> {
  const aggregate = await repository.getAggregate(campaignId, CAMPAIGN_FACT_REGISTRY_AGGREGATE_TYPE_V1, campaignFactRegistryAggregateIdV1(campaignId));
  if (!aggregate.ok) return aggregate.error.code === "NOT_FOUND" ? { ok: true, value: { aggregate: null, state: createEmptyCampaignFactRegistryV1(campaignId) } } : aggregate;
  const state = aggregate.value.payload as CampaignFactRegistryV1;
  return state.contractVersion === CAMPAIGN_FACT_REGISTRY_CONTRACT_VERSION_V1 && state.campaignId === campaignId && Array.isArray(state.facts)
    ? { ok: true, value: { aggregate: aggregate.value, state } }
    : { ok: false, error: coreError("VALIDATION_FAILED", "campaign-fact.registry-invalid", {}) };
}

export async function loadNarrativeActorRegistryV1(repository: CampaignRepository, campaignId: CampaignId): Promise<Result<{ aggregate: AggregateRecord | null; state: NarrativeActorRegistryV1 }>> {
  const aggregate = await repository.getAggregate(campaignId, NARRATIVE_ACTOR_REGISTRY_AGGREGATE_TYPE_V1, narrativeActorRegistryAggregateIdV1(campaignId));
  if (!aggregate.ok) return aggregate.error.code === "NOT_FOUND" ? { ok: true, value: { aggregate: null, state: createEmptyNarrativeActorRegistryV1(campaignId) } } : aggregate;
  const state = aggregate.value.payload as NarrativeActorRegistryV1;
  return state.contractVersion === NARRATIVE_ACTOR_REGISTRY_CONTRACT_VERSION_V1 && state.campaignId === campaignId && Array.isArray(state.actors)
    ? { ok: true, value: { aggregate: aggregate.value, state } }
    : { ok: false, error: coreError("VALIDATION_FAILED", "narrative-actor.registry-invalid", {}) };
}

function mutationFingerprintPayload(command: CampaignFactMutationCommandV1): JsonObject {
  return {
    contractVersion: command.contractVersion,
    mutationKind: command.mutationKind,
    subjectRef: command.subjectRef,
    predicate: command.predicate,
    objectText: command.objectText,
    proposedIdentity: command.proposedIdentity,
    expectedCurrentFactId: command.expectedCurrentFactId,
    knowledgeLevel: command.knowledgeLevel,
    sourceRefs: command.sourceRefs,
    validatorDomains: command.validatorDomains
  };
}

function restoreCompleted(operation: OperationRecord): Result<CampaignFactMutationResultV1> {
  const result = operation.resultPayload as CampaignFactMutationResultV1 | null;
  return result?.schemaVersion === 1 && typeof result.outcome === "string"
    ? { ok: true, value: { ...result, replayed: true } }
    : { ok: false, error: coreError("PERSISTENCE_FAILURE", "campaign-fact.completed-result-missing", {}) };
}
