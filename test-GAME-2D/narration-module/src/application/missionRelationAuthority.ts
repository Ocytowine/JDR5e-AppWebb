import {
  canonicalizeJson,
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
import type { CampaignNpcPromotionCauseV1 } from "./campaignNpcPromotion";
import {
  DURABLE_NPC_CAUSE_CONFIRMATION_VERSION_V1,
  type DurableNpcCauseConfirmationV1
} from "./durableNpcCauseConfirmation";

export const MISSION_RELATION_REGISTRY_CONTRACT_V1 = "mission-relation-registry/1" as const;
export const MISSION_RELATION_PROPOSAL_COMMAND_V1 = "mission-relation-proposal-command/1" as const;
export const MISSION_RELATION_RESOLUTION_COMMAND_V1 = "mission-relation-resolution-command/1" as const;
export const MISSION_RELATION_REGISTRY_AGGREGATE_TYPE_V1 = "mission-relation.registry" as const;

export type MissionRelationEngagementKindV1 = "MISSION" | "RELATION";
export type MissionRelationDispositionV1 = "ACCEPTED" | "REFUSED" | "CONDITIONAL" | "UNCERTAIN";
export type MissionRelationAuthorityV1 = "QUEST" | "SOCIAL";

export interface MissionRelationResolutionV1 extends JsonObject {
  schemaVersion: 1;
  disposition: MissionRelationDispositionV1;
  authority: MissionRelationAuthorityV1;
  evidenceKind: "QUEST_RESOLUTION" | "SOCIAL_RESOLUTION";
  authorityOperationId: string;
  publicSourceRefs: string[];
  conditions: string[];
  version: 1;
}

export interface MissionRelationEngagementV1 extends JsonObject {
  schemaVersion: 1;
  engagementId: string;
  engagementKind: MissionRelationEngagementKindV1;
  sceneId: string;
  sceneActorId: string;
  durableRef: string;
  summary: string;
  proposedBy: "PLAYER" | "NPC" | "WORLD" | "SYSTEM";
  proposalOperationId: string;
  proposalSourceRefs: string[];
  status: "PROPOSED" | MissionRelationDispositionV1;
  resolution: MissionRelationResolutionV1 | null;
  resolutionOperationId: string | null;
  version: 1;
}

export interface MissionRelationRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof MISSION_RELATION_REGISTRY_CONTRACT_V1;
  campaignId: string;
  engagements: MissionRelationEngagementV1[];
  version: number;
}

export interface ProposeMissionRelationEngagementCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof MISSION_RELATION_PROPOSAL_COMMAND_V1;
  clientRequestId: string;
  engagementId: string;
  engagementKind: MissionRelationEngagementKindV1;
  sceneId: string;
  sceneActorId: string;
  durableRef: string;
  summary: string;
  proposedBy: "PLAYER" | "NPC" | "WORLD" | "SYSTEM";
  publicSourceRefs: string[];
}

export interface ResolveMissionRelationEngagementCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof MISSION_RELATION_RESOLUTION_COMMAND_V1;
  clientRequestId: string;
  engagementId: string;
  resolution: MissionRelationResolutionV1;
}

export interface MissionRelationEngagementResultV1 extends JsonObject {
  schemaVersion: 1;
  engagement: MissionRelationEngagementV1;
  ownerConfirmation: DurableNpcCauseConfirmationV1 | null;
  commitId: string;
  replayed: boolean;
}

export function missionRelationRegistryAggregateIdV1(campaignId: string): AggregateId {
  return opaqueId<AggregateId>(`agg-mission-relations:${campaignId}`);
}

export function createEmptyMissionRelationRegistryV1(campaignId: string): MissionRelationRegistryV1 {
  return {
    schemaVersion: 1,
    contractVersion: MISSION_RELATION_REGISTRY_CONTRACT_V1,
    campaignId,
    engagements: [],
    version: 1
  };
}

export async function proposeMissionRelationEngagementV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: ProposeMissionRelationEngagementCommandV1;
  occurredAtGameSecond?: number;
}): Promise<Result<MissionRelationEngagementResultV1>> {
  const issues = validateProposal(input.command);
  if (issues.length > 0) return invalid("mission-relation.proposal-invalid", issues);
  const operationKind = "mission-relation.propose";
  const operationId = opaqueId<OperationId>(`mission-relation-proposal:${input.command.clientRequestId}`);
  const payload = cloneJson(input.command);
  const started = await beginOperation({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId,
    clientRequestId: input.command.clientRequestId,
    operationKind,
    payload
  });
  if (!started.ok) return started;
  if (started.value.phase === "COMPLETED") return restoreResult(started.value);

  const loaded = await loadMissionRelationRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) return loaded;
  const existing = loaded.value.state.engagements.find(entry => entry.engagementId === input.command.engagementId);
  if (existing !== undefined) {
    return invalid("mission-relation.engagement-already-exists", ["engagementId already exists"]);
  }
  const engagement: MissionRelationEngagementV1 = {
    schemaVersion: 1,
    engagementId: input.command.engagementId,
    engagementKind: input.command.engagementKind,
    sceneId: input.command.sceneId,
    sceneActorId: input.command.sceneActorId,
    durableRef: input.command.durableRef,
    summary: input.command.summary,
    proposedBy: input.command.proposedBy,
    proposalOperationId: operationId,
    proposalSourceRefs: unique(input.command.publicSourceRefs),
    status: "PROPOSED",
    resolution: null,
    resolutionOperationId: null,
    version: 1
  };
  const nextRegistry: MissionRelationRegistryV1 = {
    ...loaded.value.state,
    engagements: [...loaded.value.state.engagements, engagement],
    version: loaded.value.state.version + 1
  };
  const committed = await commitRegistryMutation({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: started.value,
    currentAggregate: loaded.value.aggregate,
    nextRegistry,
    commandType: operationKind,
    commandPayload: { engagementId: engagement.engagementId, durableRef: engagement.durableRef },
    eventType: "mission-relation.proposed",
    eventPayload: { engagementId: engagement.engagementId, engagementKind: engagement.engagementKind, durableRef: engagement.durableRef, summary: engagement.summary },
    occurredAtGameSecond: input.occurredAtGameSecond ?? 0
  });
  if (!committed.ok) return committed;
  const result: MissionRelationEngagementResultV1 = {
    schemaVersion: 1,
    engagement,
    ownerConfirmation: null,
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

export async function resolveMissionRelationEngagementV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: ResolveMissionRelationEngagementCommandV1;
  occurredAtGameSecond?: number;
}): Promise<Result<MissionRelationEngagementResultV1>> {
  const issues = validateResolution(input.command.resolution);
  if (issues.length > 0) return invalid("mission-relation.resolution-invalid", issues);
  const operationKind = "mission-relation.resolve";
  const operationId = opaqueId<OperationId>(`mission-relation-resolution:${input.command.clientRequestId}`);
  const payload = cloneJson(input.command);
  const started = await beginOperation({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId,
    clientRequestId: input.command.clientRequestId,
    operationKind,
    payload
  });
  if (!started.ok) return started;
  if (started.value.phase === "COMPLETED") return restoreResult(started.value);

  const loaded = await loadMissionRelationRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) return loaded;
  const index = loaded.value.state.engagements.findIndex(entry => entry.engagementId === input.command.engagementId);
  if (index < 0) return invalid("mission-relation.engagement-not-found", ["proposal must exist before resolution"]);
  const current = loaded.value.state.engagements[index]!;
  if (current.status !== "PROPOSED") return invalid("mission-relation.already-resolved", ["engagement is already resolved"]);
  if (!authorityMatches(current.engagementKind, input.command.resolution)) {
    return invalid("mission-relation.authority-mismatch", ["resolution authority does not own this engagement kind"]);
  }
  const engagement: MissionRelationEngagementV1 = {
    ...current,
    status: input.command.resolution.disposition,
    resolution: cloneJson(input.command.resolution),
    resolutionOperationId: operationId
  };
  const engagements = [...loaded.value.state.engagements];
  engagements[index] = engagement;
  const nextRegistry: MissionRelationRegistryV1 = {
    ...loaded.value.state,
    engagements,
    version: loaded.value.state.version + 1
  };
  const committed = await commitRegistryMutation({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: started.value,
    currentAggregate: loaded.value.aggregate,
    nextRegistry,
    commandType: operationKind,
    commandPayload: { engagementId: engagement.engagementId, disposition: engagement.status, authorityOperationId: input.command.resolution.authorityOperationId },
    eventType: `mission-relation.${engagement.status.toLowerCase()}`,
    eventPayload: {
      engagementId: engagement.engagementId,
      engagementKind: engagement.engagementKind,
      durableRef: engagement.durableRef,
      disposition: engagement.status,
      conditions: [...input.command.resolution.conditions]
    },
    occurredAtGameSecond: input.occurredAtGameSecond ?? 0
  });
  if (!committed.ok) return committed;
  const ownerConfirmation = engagement.status === "ACCEPTED"
    ? buildConfirmation(engagement)
    : null;
  const result: MissionRelationEngagementResultV1 = {
    schemaVersion: 1,
    engagement,
    ownerConfirmation,
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

export async function verifyDurableNpcCauseConfirmationV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  sceneId: string;
  sceneActorId: string;
  confirmation: DurableNpcCauseConfirmationV1;
}): Promise<Result<MissionRelationEngagementV1>> {
  const loaded = await loadMissionRelationRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) return loaded;
  const engagement = loaded.value.state.engagements.find(entry => entry.engagementId === input.confirmation.engagementId);
  if (
    engagement === undefined ||
    engagement.status !== "ACCEPTED" ||
    engagement.sceneId !== input.sceneId ||
    engagement.sceneActorId !== input.sceneActorId ||
    engagement.resolutionOperationId !== input.confirmation.ownerCommandId
  ) return invalid("mission-relation.confirmation-not-owned", ["accepted owner record does not match the promotion"]);
  const expected = buildConfirmation(engagement);
  if (canonicalizeJson(expected) !== canonicalizeJson(input.confirmation)) {
    return invalid("mission-relation.confirmation-mismatch", ["confirmation differs from the persisted owner record"]);
  }
  return { ok: true, value: engagement };
}

export async function loadMissionRelationRegistryV1(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<{ aggregate: AggregateRecord | null; state: MissionRelationRegistryV1 }>> {
  const aggregate = await repository.getAggregate(
    campaignId,
    MISSION_RELATION_REGISTRY_AGGREGATE_TYPE_V1,
    missionRelationRegistryAggregateIdV1(campaignId)
  );
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? { ok: true, value: { aggregate: null, state: createEmptyMissionRelationRegistryV1(campaignId) } }
      : aggregate;
  }
  const state = aggregate.value.payload as Partial<MissionRelationRegistryV1>;
  if (
    state.contractVersion !== MISSION_RELATION_REGISTRY_CONTRACT_V1 ||
    state.campaignId !== campaignId ||
    !Array.isArray(state.engagements)
  ) return invalid("mission-relation.registry-invalid", ["registry payload is invalid"]);
  return { ok: true, value: { aggregate: aggregate.value, state: state as MissionRelationRegistryV1 } };
}

function buildConfirmation(engagement: MissionRelationEngagementV1): DurableNpcCauseConfirmationV1 {
  const resolution = engagement.resolution!;
  const cause: CampaignNpcPromotionCauseV1 = {
    schemaVersion: 1,
    causeKind: engagement.engagementKind === "MISSION" ? "ONGOING_COMMITMENT" : "RELATION_CONFIRMED",
    authority: engagement.engagementKind === "MISSION" ? "QUEST" : "SOCIAL",
    durableRef: engagement.durableRef,
    publicSourceRefs: unique([
      ...engagement.proposalSourceRefs,
      ...resolution.publicSourceRefs,
      `mission-relation:${engagement.engagementId}`
    ]),
    version: 1
  };
  return {
    schemaVersion: 1,
    contractVersion: DURABLE_NPC_CAUSE_CONFIRMATION_VERSION_V1,
    engagementId: engagement.engagementId,
    ownerCommandId: engagement.resolutionOperationId!,
    ownerAuthority: true,
    cause
  };
}

async function beginOperation(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operationId: OperationId;
  clientRequestId: string;
  operationKind: string;
  payload: JsonObject;
}): Promise<Result<OperationRecord>> {
  const fingerprint = await computeRequestFingerprint(input.operationKind, 1, input.payload);
  const existing = await input.repository.getOperation(input.operationId);
  if (existing.ok) {
    return existing.value.requestFingerprint === fingerprint
      ? existing
      : { ok: false, error: coreError("IDEMPOTENCY_CONFLICT", "mission-relation.request-conflict", {}) };
  }
  if (existing.error.code !== "NOT_FOUND") return existing;
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const now = new Date().toISOString();
  const received = await input.repository.receiveOperation({
    schemaVersion: 1,
    operationId: input.operationId,
    campaignId: input.campaignId,
    clientRequestId: opaqueId<RequestId>(input.clientRequestId),
    idempotencyKey: opaqueId<IdempotencyKey>(input.operationId),
    requestFingerprint: fingerprint,
    operationKind: input.operationKind,
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
  if (!received.ok) return received;
  const preparing = await input.repository.transitionOperation(input.operationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) return preparing;
  return input.repository.transitionOperation(input.operationId, "PREPARING", "READY_TO_COMMIT");
}

async function commitRegistryMutation(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  currentAggregate: AggregateRecord | null;
  nextRegistry: MissionRelationRegistryV1;
  commandType: string;
  commandPayload: JsonObject;
  eventType: string;
  eventPayload: JsonObject;
  occurredAtGameSecond: number;
}): Promise<Result<{ commitId: CommitId }>> {
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${input.operation.operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const aggregateId = missionRelationRegistryAggregateIdV1(input.campaignId);
    const nextRevision = input.currentAggregate === null ? 0 : input.currentAggregate.aggregateRevision + 1;
    const command: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "mission-relation-authority",
      contractVersion: 1,
      commandId: opaqueId(`${input.operation.operationId}:command`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandType: input.commandType,
      target: {
        aggregateType: MISSION_RELATION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: input.currentAggregate?.aggregateRevision ?? null
      },
      payloadSchemaVersion: 1,
      payload: input.commandPayload,
      acceptedAtGameSecond: input.occurredAtGameSecond
    };
    const event: EventDraft = {
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${input.operation.operationId}:event`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: input.eventType,
      origin: "PROCESS",
      causation: { kind: "COMMAND", id: command.commandId },
      aggregateRefs: [{
        aggregateType: MISSION_RELATION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        aggregateRevision: nextRevision
      }],
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      occurredAtGameSecond: input.occurredAtGameSecond,
      payloadSchemaVersion: 1,
      payload: input.eventPayload
    };
    const commit: CommitRequest = {
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit`),
      idempotencyKey: input.operation.idempotencyKey,
      requestFingerprint: input.operation.requestFingerprint,
      expectedCampaignRevision: input.operation.observedCampaignRevision,
      writerLease: lease.value,
      acceptedCommands: [command],
      aggregateWrites: [{
        aggregateType: MISSION_RELATION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: input.currentAggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.nextRegistry)
      }],
      events: [event],
      outboxTasks: []
    };
    const committed = await input.repository.commit(commit);
    return committed.ok ? { ok: true, value: { commitId: committed.value.commitId } } : committed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

function validateProposal(command: ProposeMissionRelationEngagementCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1) issues.push("proposal schema mismatch");
  if (command.contractVersion !== MISSION_RELATION_PROPOSAL_COMMAND_V1) issues.push("proposal contract mismatch");
  if (![command.clientRequestId, command.engagementId, command.sceneId, command.sceneActorId, command.durableRef, command.summary].every(
    value => typeof value === "string" && value.trim().length > 0
  )) {
    issues.push("proposal identities and summary are required");
  }
  if (!["MISSION", "RELATION"].includes(command.engagementKind)) issues.push("engagement kind is invalid");
  if (!["PLAYER", "NPC", "WORLD", "SYSTEM"].includes(command.proposedBy)) issues.push("proposal origin is invalid");
  issues.push(...validatePublicSources(command.publicSourceRefs));
  return issues;
}

function validateResolution(resolution: MissionRelationResolutionV1): string[] {
  const issues: string[] = [];
  if (resolution.schemaVersion !== 1 || resolution.version !== 1) issues.push("resolution schema mismatch");
  if (typeof resolution.authorityOperationId !== "string" || !resolution.authorityOperationId.trim()) {
    issues.push("authority operation id is required");
  }
  if (!["ACCEPTED", "REFUSED", "CONDITIONAL", "UNCERTAIN"].includes(resolution.disposition)) {
    issues.push("resolution disposition is invalid");
  }
  if (!["QUEST", "SOCIAL"].includes(resolution.authority)) issues.push("resolution authority is invalid");
  if (!["QUEST_RESOLUTION", "SOCIAL_RESOLUTION"].includes(resolution.evidenceKind)) {
    issues.push("resolution evidence kind is invalid");
  }
  if (
    (resolution.authority === "QUEST" && resolution.evidenceKind !== "QUEST_RESOLUTION") ||
    (resolution.authority === "SOCIAL" && resolution.evidenceKind !== "SOCIAL_RESOLUTION")
  ) issues.push("resolution evidence does not match authority");
  if (!Array.isArray(resolution.conditions) || resolution.conditions.some(condition => typeof condition !== "string" || !condition.trim())) {
    issues.push("resolution conditions must be non-empty strings");
  } else {
    if (resolution.disposition === "CONDITIONAL" && resolution.conditions.length === 0) issues.push("conditional resolution requires conditions");
    if (resolution.disposition !== "CONDITIONAL" && resolution.conditions.length > 0) issues.push("only conditional resolution may carry unresolved conditions");
  }
  issues.push(...validatePublicSources(resolution.publicSourceRefs));
  return issues;
}

function authorityMatches(kind: MissionRelationEngagementKindV1, resolution: MissionRelationResolutionV1): boolean {
  return kind === "MISSION"
    ? resolution.authority === "QUEST" && resolution.evidenceKind === "QUEST_RESOLUTION"
    : resolution.authority === "SOCIAL" && resolution.evidenceKind === "SOCIAL_RESOLUTION";
}

function validatePublicSources(sourceRefs: unknown): string[] {
  if (
    !Array.isArray(sourceRefs) ||
    sourceRefs.length === 0 ||
    sourceRefs.some(ref => typeof ref !== "string" || !ref.trim())
  ) return ["public source refs are required"];
  return sourceRefs.some(ref => /^(?:secret|private|hidden):/iu.test(ref))
    ? ["private or hidden source refs are forbidden"]
    : [];
}

function restoreResult(operation: OperationRecord): Result<MissionRelationEngagementResultV1> {
  const result = operation.resultPayload as MissionRelationEngagementResultV1 | null;
  return result?.schemaVersion === 1 && result.engagement !== undefined
    ? { ok: true, value: { ...result, replayed: true } }
    : { ok: false, error: coreError("PERSISTENCE_FAILURE", "mission-relation.completed-result-missing", {}) };
}

function invalid<T>(messageKey: string, issues: string[]): Result<T> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues }) };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
