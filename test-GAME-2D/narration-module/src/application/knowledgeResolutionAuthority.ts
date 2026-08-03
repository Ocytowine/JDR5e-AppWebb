import {
  cloneJson,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CampaignRepository,
  type CommitId,
  type CommitRequest,
  type EventDraft,
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
  ACTOR_KNOWLEDGE_REGISTRY_AGGREGATE_TYPE_V1,
  loadActorKnowledgeRegistryV1,
  loadTestimonyRegistryV1,
  actorKnowledgeRegistryAggregateIdV1,
  type ActorKnowledgeRegistryV1
} from "./knowledgeAuthority";
import {
  ACTOR_KNOWLEDGE_ACQUISITION_CONTRACT_V1,
  validateActorKnowledgeAcquisitionV1,
  validateObjectiveClaimResolutionV1,
  type ActorKnowledgeAcquisitionV1,
  type ObjectiveClaimResolutionV1
} from "./knowledgeClaims";

export const CLAIM_RESOLUTION_REGISTRY_CONTRACT_V1 = "claim-resolution-registry/1" as const;
export const RECORD_OBJECTIVE_CLAIM_RESOLUTION_COMMAND_V1 = "record-objective-claim-resolution/1" as const;
export const CLAIM_RESOLUTION_REGISTRY_AGGREGATE_TYPE_V1 = "narrative.claim-resolution-registry" as const;

export interface ClaimResolutionRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof CLAIM_RESOLUTION_REGISTRY_CONTRACT_V1;
  campaignId: string;
  resolutions: ObjectiveClaimResolutionV1[];
  version: number;
}

export interface RecordObjectiveClaimResolutionCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof RECORD_OBJECTIVE_CLAIM_RESOLUTION_COMMAND_V1;
  clientRequestId: string;
  sourceOperationId: string;
  occurredAtGameSecond: number;
  resolution: ObjectiveClaimResolutionV1;
  recipientActorRefs: string[];
}

export interface ClaimOwnerDomainAuthorizationV1 extends JsonObject {
  schemaVersion: 1;
  authority: "CLAIM_OWNER_DOMAIN";
  sourceOperationId: string;
  ownerDomain: string;
  resolutionRef: string;
  claimRef: string;
  resolution: "CONFIRMED" | "REFUTED";
  factRefs: string[];
  visibility: "PLAYER_VISIBLE" | "ACTOR_SCOPED" | "SYSTEM_PRIVATE";
  permittedActorRefs: string[];
}

export interface ObjectiveClaimResolutionOwnerPortV1 {
  authorize(input: {
    campaignId: CampaignId;
    command: RecordObjectiveClaimResolutionCommandV1;
  }): Promise<
    | { ok: true; authorization: ClaimOwnerDomainAuthorizationV1 }
    | { ok: false; issues: string[] }
  >;
}

export interface RecordObjectiveClaimResolutionResultV1 extends JsonObject {
  schemaVersion: 1;
  resolutionRef: string;
  claimRef: string;
  resolution: "CONFIRMED" | "REFUTED";
  recipientActorRefs: string[];
  commitId: string;
  replayed: boolean;
}

export function claimResolutionRegistryAggregateIdV1(campaignId: CampaignId): AggregateId {
  return opaqueId<AggregateId>(`agg-claim-resolutions:${campaignId}`);
}

export async function loadClaimResolutionRegistryV1(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<{ aggregate: AggregateRecord | null; state: ClaimResolutionRegistryV1 }>> {
  const aggregate = await repository.getAggregate(
    campaignId,
    CLAIM_RESOLUTION_REGISTRY_AGGREGATE_TYPE_V1,
    claimResolutionRegistryAggregateIdV1(campaignId)
  );
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? { ok: true, value: { aggregate: null, state: emptyRegistry(campaignId) } }
      : aggregate;
  }
  const state = aggregate.value.payload as Partial<ClaimResolutionRegistryV1>;
  if (
    state.schemaVersion !== 1 ||
    state.contractVersion !== CLAIM_RESOLUTION_REGISTRY_CONTRACT_V1 ||
    state.campaignId !== campaignId ||
    !Array.isArray(state.resolutions) ||
    state.resolutions.some(resolution => !validateObjectiveClaimResolutionV1(resolution).ok)
  ) return invalid("knowledge.claim-resolution-registry-invalid", ["claim resolution registry payload is invalid"]);
  return { ok: true, value: { aggregate: aggregate.value, state: state as ClaimResolutionRegistryV1 } };
}

export async function recordObjectiveClaimResolutionV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: RecordObjectiveClaimResolutionCommandV1;
  ownerPort: ObjectiveClaimResolutionOwnerPortV1;
}): Promise<Result<RecordObjectiveClaimResolutionResultV1>> {
  const issues = validateCommand(input.command);
  if (issues.length > 0) return invalid("knowledge.claim-resolution-command-invalid", issues);
  const operationId = opaqueId<OperationId>(`record-claim-resolution:${input.command.clientRequestId}`);
  const fingerprint = await computeRequestFingerprint("knowledge.claim-resolution.record", 1, input.command);
  const existing = await input.repository.getOperation(operationId);
  if (existing.ok && existing.value.requestFingerprint !== fingerprint) {
    return { ok: false, error: coreError("IDEMPOTENCY_CONFLICT", "knowledge.claim-resolution-request-conflict") };
  }
  if (existing.ok && existing.value.phase === "COMPLETED") return restoreResult(existing.value);
  if (existing.ok) return invalid("knowledge.claim-resolution-operation-incomplete", ["operation already exists and is not completed"]);
  if (existing.error.code !== "NOT_FOUND") return existing;

  const sourceOperation = await input.repository.getOperation(opaqueId<OperationId>(input.command.sourceOperationId));
  if (!sourceOperation.ok) return sourceOperation;
  if (sourceOperation.value.campaignId !== input.campaignId || sourceOperation.value.phase !== "COMPLETED") {
    return invalid("knowledge.claim-resolution-source-operation-invalid", ["a completed owner-domain operation from the same campaign is required"]);
  }
  const ownerAuthorization = await input.ownerPort.authorize({ campaignId: input.campaignId, command: input.command });
  if (!ownerAuthorization.ok) return invalid("knowledge.claim-resolution-owner-rejected", ownerAuthorization.issues);
  const authorizationIssues = validateAuthorization(input.command, ownerAuthorization.authorization);
  if (authorizationIssues.length > 0) return invalid("knowledge.claim-resolution-owner-authorization-invalid", authorizationIssues);

  const testimonies = await loadTestimonyRegistryV1(input.repository, input.campaignId);
  if (!testimonies.ok) return testimonies;
  if (!testimonies.value.state.claims.some(claim => claim.claimRef === input.command.resolution.claimRef)) {
    return invalid("knowledge.claim-resolution-claim-unknown", [input.command.resolution.claimRef]);
  }
  const registry = await loadClaimResolutionRegistryV1(input.repository, input.campaignId);
  if (!registry.ok) return registry;
  const mergedRegistry = mergeResolution(registry.value.state, input.command.resolution);
  if (!mergedRegistry.ok) return mergedRegistry;

  const recipientActorRefs = [...new Set(input.command.recipientActorRefs)].sort();
  const loadedActors = await Promise.all(recipientActorRefs.map(actorRef =>
    loadActorKnowledgeRegistryV1(input.repository, input.campaignId, actorRef)
  ));
  const actorFailure = loadedActors.find(result => !result.ok);
  if (actorFailure !== undefined && !actorFailure.ok) return actorFailure;
  const nextActors = recipientActorRefs.map((actorRef, index) => {
    const loaded = loadedActors[index];
    if (loaded === undefined || !loaded.ok) throw new Error(`missing actor registry for ${actorRef}`);
    const acquisition = resolutionAcquisition(input.command.resolution, actorRef);
    return {
      actorRef,
      aggregate: loaded.value.aggregate,
      state: mergeActorKnowledge(loaded.value.state, acquisition)
    };
  });

  const started = await beginOperation(input.repository, input.campaignId, operationId, input.command, fingerprint);
  if (!started.ok) return started;
  const committed = await commitResolution({
    repository: input.repository,
    campaignId: input.campaignId,
    command: input.command,
    operation: started.value,
    currentRegistry: registry.value,
    nextRegistry: mergedRegistry.value,
    nextActors
  });
  if (!committed.ok) return committed;
  const result: RecordObjectiveClaimResolutionResultV1 = {
    schemaVersion: 1,
    resolutionRef: input.command.resolution.resolutionRef,
    claimRef: input.command.resolution.claimRef,
    resolution: input.command.resolution.resolution,
    recipientActorRefs,
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

function emptyRegistry(campaignId: CampaignId): ClaimResolutionRegistryV1 {
  return { schemaVersion: 1, contractVersion: CLAIM_RESOLUTION_REGISTRY_CONTRACT_V1, campaignId, resolutions: [], version: 1 };
}

function mergeResolution(current: ClaimResolutionRegistryV1, resolution: ObjectiveClaimResolutionV1): Result<ClaimResolutionRegistryV1> {
  const priorByRef = current.resolutions.find(entry => entry.resolutionRef === resolution.resolutionRef);
  if (priorByRef !== undefined && !jsonEquivalent(priorByRef, resolution)) {
    return invalid("knowledge.claim-resolution-identity-conflict", [resolution.resolutionRef]);
  }
  const priorForClaim = current.resolutions.find(entry => entry.claimRef === resolution.claimRef);
  if (priorForClaim !== undefined && priorForClaim.resolution !== resolution.resolution) {
    return invalid("knowledge.claim-resolution-truth-conflict", [resolution.claimRef, priorForClaim.resolutionRef]);
  }
  if (priorForClaim !== undefined && priorForClaim.resolutionRef !== resolution.resolutionRef) {
    return invalid("knowledge.claim-resolution-duplicate", [resolution.claimRef, priorForClaim.resolutionRef]);
  }
  const resolutions = priorByRef === undefined
    ? [...current.resolutions, cloneJson(resolution)].sort((left, right) => left.claimRef.localeCompare(right.claimRef))
    : [...current.resolutions];
  return { ok: true, value: { ...current, resolutions, version: current.version + 1 } };
}

function resolutionAcquisition(resolution: ObjectiveClaimResolutionV1, actorRef: string): ActorKnowledgeAcquisitionV1 {
  const acquisition: ActorKnowledgeAcquisitionV1 = {
    schemaVersion: 1,
    contractVersion: ACTOR_KNOWLEDGE_ACQUISITION_CONTRACT_V1,
    acquisitionRef: `knowledge-acquisition:${safeSegment(resolution.resolutionRef)}:${safeSegment(actorRef)}`,
    actorRef,
    claimRef: resolution.claimRef,
    status: resolution.resolution,
    channelRef: resolution.resolutionRef,
    sourceRefs: [...new Set([resolution.resolutionRef, ...resolution.factRefs])].sort(),
    assertsObjectiveTruth: false,
    version: 1
  };
  const validation = validateActorKnowledgeAcquisitionV1(acquisition);
  if (!validation.ok) throw new Error(validation.issues.join(" | "));
  return acquisition;
}

function mergeActorKnowledge(current: ActorKnowledgeRegistryV1, acquisition: ActorKnowledgeAcquisitionV1): ActorKnowledgeRegistryV1 {
  const acquisitions = new Map(current.acquisitions.map(entry => [entry.acquisitionRef, entry]));
  acquisitions.set(acquisition.acquisitionRef, cloneJson(acquisition));
  return {
    ...current,
    acquisitions: [...acquisitions.values()].sort((left, right) => left.acquisitionRef.localeCompare(right.acquisitionRef)),
    version: current.version + 1
  };
}

async function beginOperation(
  repository: CampaignRepository,
  campaignId: CampaignId,
  operationId: OperationId,
  command: RecordObjectiveClaimResolutionCommandV1,
  requestFingerprint: string
): Promise<Result<OperationRecord>> {
  const campaign = await repository.getCampaign(campaignId);
  if (!campaign.ok) return campaign;
  const now = new Date().toISOString();
  const received = await repository.receiveOperation({
    schemaVersion: 1,
    operationId,
    campaignId,
    clientRequestId: opaqueId<RequestId>(command.clientRequestId),
    idempotencyKey: opaqueId<IdempotencyKey>(operationId),
    requestFingerprint,
    operationKind: "knowledge.claim-resolution.record",
    requestPayloadSchemaVersion: 1,
    requestPayload: cloneJson(command),
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
  const preparing = await repository.transitionOperation(operationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) return preparing;
  return repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT");
}

async function commitResolution(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: RecordObjectiveClaimResolutionCommandV1;
  operation: OperationRecord;
  currentRegistry: { aggregate: AggregateRecord | null; state: ClaimResolutionRegistryV1 };
  nextRegistry: ClaimResolutionRegistryV1;
  nextActors: Array<{ actorRef: string; aggregate: AggregateRecord | null; state: ActorKnowledgeRegistryV1 }>;
}): Promise<Result<{ commitId: CommitId }>> {
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${input.operation.operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const registryAggregateId = claimResolutionRegistryAggregateIdV1(input.campaignId);
    const acceptedCommand: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "knowledge-resolution-authority",
      contractVersion: 1,
      commandId: opaqueId(`${input.operation.operationId}:command`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandType: "knowledge.claim-resolution.record",
      target: {
        aggregateType: CLAIM_RESOLUTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: registryAggregateId,
        expectedAggregateRevision: input.currentRegistry.aggregate?.aggregateRevision ?? null
      },
      payloadSchemaVersion: 1,
      payload: {
        resolutionRef: input.command.resolution.resolutionRef,
        claimRef: input.command.resolution.claimRef,
        ownerDomain: input.command.resolution.ownerDomain,
        recipientActorRefs: [...input.command.recipientActorRefs]
      },
      acceptedAtGameSecond: input.command.occurredAtGameSecond
    };
    const actorAggregateRefs = input.nextActors.map(actor => ({
      aggregateType: ACTOR_KNOWLEDGE_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId: actorKnowledgeRegistryAggregateIdV1(input.campaignId, actor.actorRef),
      aggregateRevision: actor.aggregate === null ? 0 : actor.aggregate.aggregateRevision + 1
    }));
    const event: EventDraft = {
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${input.operation.operationId}:event`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: "knowledge.claim-resolution.recorded",
      origin: "SYSTEM",
      causation: { kind: "OPERATION", id: input.operation.operationId },
      aggregateRefs: [{
        aggregateType: CLAIM_RESOLUTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: registryAggregateId,
        aggregateRevision: input.currentRegistry.aggregate === null ? 0 : input.currentRegistry.aggregate.aggregateRevision + 1
      }, ...actorAggregateRefs],
      visibility: input.command.resolution.visibility === "SYSTEM_PRIVATE"
        ? { scope: "SYSTEM", actorIds: [] }
        : input.command.resolution.visibility === "PLAYER_VISIBLE"
          ? { scope: "PLAYER_VISIBLE", actorIds: [] }
          : { scope: "ACTOR_SCOPED", actorIds: input.command.recipientActorRefs.map(actorIdFromRef) },
      occurredAtGameSecond: input.command.occurredAtGameSecond,
      payloadSchemaVersion: 1,
      payload: {
        resolutionRef: input.command.resolution.resolutionRef,
        claimRef: input.command.resolution.claimRef,
        resolution: input.command.resolution.resolution,
        ownerDomain: input.command.resolution.ownerDomain,
        sourceOperationId: input.command.sourceOperationId,
        recipientCount: input.command.recipientActorRefs.length
      }
    };
    const request: CommitRequest = {
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit`),
      idempotencyKey: input.operation.idempotencyKey,
      requestFingerprint: input.operation.requestFingerprint,
      expectedCampaignRevision: input.operation.observedCampaignRevision,
      writerLease: lease.value,
      acceptedCommands: [acceptedCommand],
      aggregateWrites: [{
        aggregateType: CLAIM_RESOLUTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: registryAggregateId,
        expectedAggregateRevision: input.currentRegistry.aggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.nextRegistry)
      }, ...input.nextActors.map(actor => ({
        aggregateType: ACTOR_KNOWLEDGE_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: actorKnowledgeRegistryAggregateIdV1(input.campaignId, actor.actorRef),
        expectedAggregateRevision: actor.aggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1,
        payload: cloneJson(actor.state)
      }))],
      events: [event],
      outboxTasks: []
    };
    const committed = await input.repository.commit(request);
    return committed.ok ? { ok: true, value: { commitId: committed.value.commitId } } : committed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

function validateCommand(command: RecordObjectiveClaimResolutionCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1 || command.contractVersion !== RECORD_OBJECTIVE_CLAIM_RESOLUTION_COMMAND_V1) issues.push("record objective claim resolution contract mismatch");
  if (!command.clientRequestId.trim() || !command.sourceOperationId.trim()) issues.push("clientRequestId and sourceOperationId are required");
  if (!Number.isInteger(command.occurredAtGameSecond) || command.occurredAtGameSecond < 0) issues.push("occurredAtGameSecond is invalid");
  const resolutionValidation = validateObjectiveClaimResolutionV1(command.resolution);
  if (!resolutionValidation.ok) issues.push(...resolutionValidation.issues.map(issue => `resolution: ${issue}`));
  if (!Array.isArray(command.recipientActorRefs)) issues.push("recipientActorRefs must be an array");
  else {
    command.recipientActorRefs.forEach((ref, index) => {
      if (!canonicalRef(ref) || !ref.startsWith("actor:")) issues.push(`recipientActorRefs[${index}] must be an actor ref`);
    });
    if (new Set(command.recipientActorRefs).size !== command.recipientActorRefs.length) issues.push("recipientActorRefs must not contain duplicates");
  }
  if (command.resolution.visibility === "SYSTEM_PRIVATE" && command.recipientActorRefs.length > 0) issues.push("SYSTEM_PRIVATE resolution cannot update actor knowledge");
  return issues;
}

function validateAuthorization(
  command: RecordObjectiveClaimResolutionCommandV1,
  authorization: ClaimOwnerDomainAuthorizationV1
): string[] {
  const resolution = command.resolution;
  const issues: string[] = [];
  if (authorization.schemaVersion !== 1 || authorization.authority !== "CLAIM_OWNER_DOMAIN") issues.push("owner authorization contract is invalid");
  for (const [field, actual, expected] of [
    ["sourceOperationId", authorization.sourceOperationId, command.sourceOperationId],
    ["ownerDomain", authorization.ownerDomain, resolution.ownerDomain],
    ["resolutionRef", authorization.resolutionRef, resolution.resolutionRef],
    ["claimRef", authorization.claimRef, resolution.claimRef],
    ["resolution", authorization.resolution, resolution.resolution],
    ["visibility", authorization.visibility, resolution.visibility]
  ] as const) if (actual !== expected) issues.push(`${field} does not match owner authorization`);
  if (!sameStrings(authorization.factRefs, resolution.factRefs)) issues.push("factRefs do not match owner authorization");
  const permitted = new Set(authorization.permittedActorRefs);
  command.recipientActorRefs.forEach(ref => {
    if (!permitted.has(ref)) issues.push(`recipient ${ref} is not permitted by owner authorization`);
  });
  return issues;
}

function restoreResult(operation: OperationRecord): Result<RecordObjectiveClaimResolutionResultV1> {
  const result = operation.resultPayload as Partial<RecordObjectiveClaimResolutionResultV1> | null;
  if (
    result?.schemaVersion !== 1 ||
    typeof result.resolutionRef !== "string" ||
    typeof result.claimRef !== "string" ||
    !["CONFIRMED", "REFUTED"].includes(String(result.resolution)) ||
    !Array.isArray(result.recipientActorRefs) ||
    typeof result.commitId !== "string"
  ) return invalid("knowledge.claim-resolution-result-invalid", ["completed operation result is invalid"]);
  return { ok: true, value: { ...result, replayed: true } as RecordObjectiveClaimResolutionResultV1 };
}

function safeSegment(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").replace(/[^a-zA-Z0-9_-]+/gu, "-").replace(/^-+|-+$/gu, "") || "unknown";
}

function canonicalRef(value: string): boolean {
  return /^[a-z][a-z0-9_-]*:.+/u.test(value);
}

function actorIdFromRef(actorRef: string): string {
  return actorRef.startsWith("actor:") ? actorRef.slice("actor:".length) : actorRef;
}

function sameStrings(left: string[], right: string[]): boolean {
  return [...left].sort().join("\u0000") === [...right].sort().join("\u0000");
}

function jsonEquivalent(left: JsonObject, right: JsonObject): boolean {
  return JSON.stringify(sortJson(left)) === JSON.stringify(sortJson(right));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJson(entry)]));
  }
  return value;
}

function invalid<T>(messageKey: string, issues: string[]): Result<T> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues }) };
}
