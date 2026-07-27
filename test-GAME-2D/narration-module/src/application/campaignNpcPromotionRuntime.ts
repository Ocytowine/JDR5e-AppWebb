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
  CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
  CAMPAIGN_NPC_REGISTRY_CONTRACT_VERSION_V1,
  campaignNpcRegistryAggregateIdV1,
  createEmptyCampaignNpcRegistryV1,
  prepareCampaignNpcPromotionCommitV1,
  prepareCampaignNpcPromotionV1,
  type CampaignNpcPromotionCauseV1,
  type CampaignNpcRecordV1,
  type CampaignNpcRegistryV1
} from "./campaignNpcPromotion";
import { loadSceneActorRegistryV1 } from "./sceneActorRegistry";

export const DURABLE_NPC_CAUSE_CONFIRMATION_VERSION_V1 = "durable-npc-cause-confirmation/1" as const;

export interface PromoteSceneActorCommandV1 extends JsonObject {
  schemaVersion: 1;
  clientRequestId: string;
  sceneId: string;
  sceneActorId: string;
  ownerConfirmation: {
    schemaVersion: 1;
    contractVersion: typeof DURABLE_NPC_CAUSE_CONFIRMATION_VERSION_V1;
    ownerCommandId: string;
    ownerAuthority: true;
    cause: CampaignNpcPromotionCauseV1;
  };
}

export interface PromoteSceneActorResultV1 extends JsonObject {
  schemaVersion: 1;
  campaignNpc: CampaignNpcRecordV1;
  commitId: string | null;
  replayed: boolean;
}

export async function promoteSceneActorToCampaignNpcV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: PromoteSceneActorCommandV1;
  occurredAtGameSecond?: number;
}): Promise<Result<PromoteSceneActorResultV1>> {
  const validation = validateCommand(input.command);
  if (validation.length > 0) {
    return { ok: false, error: coreError("VALIDATION_FAILED", "campaign-npc.owner-confirmation-invalid", { issues: validation }) };
  }
  const payload = {
    sceneId: input.command.sceneId,
    sceneActorId: input.command.sceneActorId,
    ownerCommandId: input.command.ownerConfirmation.ownerCommandId,
    cause: input.command.ownerConfirmation.cause
  };
  const fingerprint = await computeRequestFingerprint("campaign.promote-scene-actor", 1, payload);
  const operationId = opaqueId<OperationId>(`campaign-npc-promotion:${input.command.clientRequestId}`);
  const idempotencyKey = opaqueId<IdempotencyKey>(`campaign-npc-promotion:${input.command.clientRequestId}`);
  const existingOperation = await input.repository.getOperation(operationId);
  if (existingOperation.ok && existingOperation.value.requestFingerprint !== fingerprint) {
    return {
      ok: false,
      error: coreError("IDEMPOTENCY_CONFLICT", "campaign-npc.promotion-request-conflict", {
        clientRequestId: input.command.clientRequestId
      })
    };
  }
  if (existingOperation.ok && existingOperation.value.phase === "COMPLETED") {
    return restoreCompleted(existingOperation.value);
  }
  if (!existingOperation.ok && existingOperation.error.code !== "NOT_FOUND") return existingOperation;

  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const now = new Date().toISOString();
  let operation: OperationRecord;
  if (existingOperation.ok) {
    operation = existingOperation.value;
  } else {
    const received = await input.repository.receiveOperation({
      schemaVersion: 1,
      operationId,
      campaignId: input.campaignId,
      clientRequestId: opaqueId<RequestId>(input.command.clientRequestId),
      idempotencyKey,
      requestFingerprint: fingerprint,
      operationKind: "campaign.promote-scene-actor",
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
  if (operation.phase === "COMPLETED") return restoreCompleted(operation);
  if (operation.phase === "RECEIVED") {
    const next = await input.repository.transitionOperation(operation.operationId, "RECEIVED", "PREPARING");
    if (!next.ok) return next;
    operation = next.value;
  }

  const sceneActors = await loadSceneActorRegistryV1({
    repository: input.repository,
    campaignId: input.campaignId,
    sceneId: input.command.sceneId
  });
  if (!sceneActors.ok) return sceneActors;
  const actor = sceneActors.value.state.actors.find(candidate => candidate.actorId === input.command.sceneActorId);
  if (actor === undefined) {
    return { ok: false, error: coreError("VALIDATION_FAILED", "campaign-npc.scene-actor-not-found", {}) };
  }
  const loadedCampaignRegistry = await loadCampaignNpcRegistry(input.repository, input.campaignId);
  if (!loadedCampaignRegistry.ok) return loadedCampaignRegistry;
  const prepared = prepareCampaignNpcPromotionV1({
    campaignId: input.campaignId,
    operationId,
    commandId: `${operationId}:command`,
    idempotencyKey,
    sceneActor: actor,
    cause: input.command.ownerConfirmation.cause,
    registry: loadedCampaignRegistry.value.state,
    registryRevision: loadedCampaignRegistry.value.aggregate?.aggregateRevision ?? null
  });
  if (!prepared.ok) {
    return { ok: false, error: coreError("VALIDATION_FAILED", "campaign-npc.promotion-preparation-rejected", { issues: prepared.issues }) };
  }
  if (prepared.status === "ALREADY_PROMOTED") {
    const result: PromoteSceneActorResultV1 = { schemaVersion: 1, campaignNpc: prepared.npc, commitId: null, replayed: true };
    const completed = await input.repository.completeWithoutCommit(operation.operationId, 1, result);
    return completed.ok ? { ok: true, value: result } : completed;
  }
  if (operation.phase === "PREPARING") {
    const next = await input.repository.transitionOperation(operation.operationId, "PREPARING", "READY_TO_COMMIT");
    if (!next.ok) return next;
    operation = next.value;
  }
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const atomic = prepareCampaignNpcPromotionCommitV1({
      prepared,
      currentRegistryAggregate: loadedCampaignRegistry.value.aggregate,
      expectedCampaignRevision: operation.observedCampaignRevision,
      requestFingerprint: operation.requestFingerprint,
      commitId: opaqueId<CommitId>(`${operationId}:commit`),
      writerLease: lease.value,
      occurredAtGameSecond: input.occurredAtGameSecond ?? 0
    });
    if (!atomic.ok) {
      return { ok: false, error: coreError("VALIDATION_FAILED", "campaign-npc.commit-preparation-rejected", { issues: atomic.issues }) };
    }
    const committed = await input.repository.commit(atomic.value);
    if (!committed.ok) return committed;
    const result: PromoteSceneActorResultV1 = {
      schemaVersion: 1,
      campaignNpc: prepared.npc,
      commitId: committed.value.commitId,
      replayed: false
    };
    const completed = await input.repository.completePresentation(operation.operationId, "COMMITTED_RENDERED", 1, result);
    return completed.ok ? { ok: true, value: result } : completed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

function validateCommand(command: PromoteSceneActorCommandV1): string[] {
  const issues: string[] = [];
  if (!command.clientRequestId.trim() || !command.sceneId.trim() || !command.sceneActorId.trim()) issues.push("command identities are required");
  if (command.ownerConfirmation.contractVersion !== DURABLE_NPC_CAUSE_CONFIRMATION_VERSION_V1) issues.push("owner confirmation contract mismatch");
  if (command.ownerConfirmation.ownerAuthority !== true) issues.push("owner authority is required");
  if (!command.ownerConfirmation.ownerCommandId.trim()) issues.push("owner command id is required");
  return issues;
}

async function loadCampaignNpcRegistry(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<{ aggregate: AggregateRecord | null; state: CampaignNpcRegistryV1 }>> {
  const aggregate = await repository.getAggregate(
    campaignId,
    CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
    campaignNpcRegistryAggregateIdV1(campaignId)
  );
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? { ok: true, value: { aggregate: null, state: createEmptyCampaignNpcRegistryV1(campaignId) } }
      : aggregate;
  }
  const state = aggregate.value.payload as CampaignNpcRegistryV1;
  if (state.contractVersion !== CAMPAIGN_NPC_REGISTRY_CONTRACT_VERSION_V1 || state.campaignId !== campaignId || !Array.isArray(state.npcs)) {
    return { ok: false, error: coreError("VALIDATION_FAILED", "campaign-npc.registry-invalid", {}) };
  }
  return { ok: true, value: { aggregate: aggregate.value, state } };
}

function restoreCompleted(operation: OperationRecord): Result<PromoteSceneActorResultV1> {
  const result = operation.resultPayload as PromoteSceneActorResultV1 | null;
  return result?.schemaVersion === 1 && result.campaignNpc !== undefined
    ? { ok: true, value: { ...result, replayed: true } }
    : { ok: false, error: coreError("PERSISTENCE_FAILURE", "campaign-npc.completed-result-missing", {}) };
}
