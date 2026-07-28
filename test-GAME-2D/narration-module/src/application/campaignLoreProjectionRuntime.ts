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
import type {
  CampaignLoreProjectionReadRequestV1,
  CampaignLoreProjectionReadResultV1,
  CampaignLoreProjectionReaderV1,
  CampaignLoreProjectionV1
} from "./loreGuidedSceneCreation";
import type { LoreEntityV1, LoreFragmentV1 } from "../bootstrap/lore";
import type { LoreInfluencePacketV1 } from "../context";
import {
  buildPlayableSceneFromLoreLocationV1,
  type LorePlayableSceneBuildResultV1
} from "./lorePlayableScene";

export const CAMPAIGN_LORE_PROJECTION_REGISTRY_CONTRACT_V1 = "campaign-lore-projection-registry/1" as const;
export const CAMPAIGN_LORE_PROJECTION_COMMAND_V1 = "campaign-lore-projection-command/1" as const;
export const CAMPAIGN_LORE_PROJECTION_AGGREGATE_TYPE_V1 = "campaign.lore-projection-registry" as const;

export interface CampaignLoreProjectionRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof CAMPAIGN_LORE_PROJECTION_REGISTRY_CONTRACT_V1;
  campaignId: string;
  projections: CampaignLoreProjectionV1[];
  version: number;
}

export interface RecordCampaignLoreProjectionCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof CAMPAIGN_LORE_PROJECTION_COMMAND_V1;
  clientRequestId: string;
  projectionId: string;
  entityId: string;
  fieldPath: string;
  disposition: "REPLACE" | "WITHHOLD";
  replacementText: string | null;
  publicSourceRefs: string[];
}

export interface RecordCampaignLoreProjectionResultV1 extends JsonObject {
  schemaVersion: 1;
  projection: CampaignLoreProjectionV1;
  commitId: string;
  replayed: boolean;
}

export function campaignLoreProjectionAggregateIdV1(campaignId: string): AggregateId {
  return opaqueId<AggregateId>(`agg-campaign-lore-projections:${campaignId}`);
}

export async function recordCampaignLoreProjectionV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: RecordCampaignLoreProjectionCommandV1;
  occurredAtGameSecond?: number;
}): Promise<Result<RecordCampaignLoreProjectionResultV1>> {
  const issues = validateCommand(input.command);
  if (issues.length > 0) return invalid("campaign-lore.projection-invalid", issues);
  const operationId = opaqueId<OperationId>(`campaign-lore-projection:${input.command.clientRequestId}`);
  const payload = cloneJson(input.command);
  const fingerprint = await computeRequestFingerprint("campaign-lore.project", 1, payload);
  const existing = await input.repository.getOperation(operationId);
  if (existing.ok && existing.value.requestFingerprint !== fingerprint) {
    return { ok: false, error: coreError("IDEMPOTENCY_CONFLICT", "campaign-lore.request-conflict", {}) };
  }
  if (existing.ok && existing.value.phase === "COMPLETED") return restore(existing.value);
  if (!existing.ok && existing.error.code !== "NOT_FOUND") return existing;
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  let operation: OperationRecord;
  if (existing.ok) {
    operation = existing.value;
  } else {
    const now = new Date().toISOString();
    const received = await input.repository.receiveOperation({
      schemaVersion: 1,
      operationId,
      campaignId: input.campaignId,
      clientRequestId: opaqueId<RequestId>(input.command.clientRequestId),
      idempotencyKey: opaqueId<IdempotencyKey>(operationId),
      requestFingerprint: fingerprint,
      operationKind: "campaign-lore.project",
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
    const preparing = await input.repository.transitionOperation(operationId, "RECEIVED", "PREPARING");
    if (!preparing.ok) return preparing;
    operation = preparing.value;
  }
  const loaded = await loadCampaignLoreProjectionRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) return loaded;
  if (loaded.value.state.projections.some(projection => projection.projectionId === input.command.projectionId)) {
    return invalid("campaign-lore.projection-id-exists", ["projectionId must identify one immutable decision"]);
  }
  const projection: CampaignLoreProjectionV1 = {
    schemaVersion: 1,
    projectionId: input.command.projectionId,
    entityId: input.command.entityId,
    fieldPath: input.command.fieldPath,
    disposition: input.command.disposition,
    replacementText: input.command.replacementText,
    sourceRefs: unique(input.command.publicSourceRefs),
    campaignRevision: operation.observedCampaignRevision + 1,
    version: 1
  };
  const nextState: CampaignLoreProjectionRegistryV1 = {
    ...loaded.value.state,
    projections: [...loaded.value.state.projections, projection],
    version: loaded.value.state.version + 1
  };
  if (operation.phase === "PREPARING") {
    const ready = await input.repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT");
    if (!ready.ok) return ready;
    operation = ready.value;
  }
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const aggregateId = campaignLoreProjectionAggregateIdV1(input.campaignId);
    const command: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "campaign-lore-projection",
      contractVersion: 1,
      commandId: opaqueId(`${operationId}:command`),
      campaignId: input.campaignId,
      operationId,
      commandType: "campaign-lore.project",
      target: {
        aggregateType: CAMPAIGN_LORE_PROJECTION_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: loaded.value.aggregate?.aggregateRevision ?? null
      },
      payloadSchemaVersion: 1,
      payload: cloneJson(projection as unknown as JsonObject),
      acceptedAtGameSecond: input.occurredAtGameSecond ?? 0
    };
    const event: EventDraft = {
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${operationId}:event`),
      campaignId: input.campaignId,
      operationId,
      eventType: "campaign-lore.projection-recorded",
      origin: "PROCESS",
      causation: { kind: "COMMAND", id: command.commandId },
      aggregateRefs: [{
        aggregateType: CAMPAIGN_LORE_PROJECTION_AGGREGATE_TYPE_V1,
        aggregateId,
        aggregateRevision: loaded.value.aggregate === null ? 0 : loaded.value.aggregate.aggregateRevision + 1
      }],
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      occurredAtGameSecond: input.occurredAtGameSecond ?? 0,
      payloadSchemaVersion: 1,
      payload: { projectionId: projection.projectionId, entityId: projection.entityId, fieldPath: projection.fieldPath, disposition: projection.disposition }
    };
    const committed = await input.repository.commit({
      campaignId: input.campaignId,
      operationId,
      commitId: opaqueId<CommitId>(`${operationId}:commit`),
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint: operation.requestFingerprint,
      expectedCampaignRevision: operation.observedCampaignRevision,
      writerLease: lease.value,
      acceptedCommands: [command],
      aggregateWrites: [{
        aggregateType: CAMPAIGN_LORE_PROJECTION_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: loaded.value.aggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1,
        payload: cloneJson(nextState)
      }],
      events: [event],
      outboxTasks: []
    });
    if (!committed.ok) return committed;
    const result: RecordCampaignLoreProjectionResultV1 = {
      schemaVersion: 1,
      projection,
      commitId: committed.value.commitId,
      replayed: false
    };
    const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
    return completed.ok ? { ok: true, value: result } : completed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

export function createCampaignLoreProjectionReaderV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
}): CampaignLoreProjectionReaderV1 {
  return {
    async listEffectiveProjections(request) {
      return readEffectiveCampaignLoreProjectionsV1({
        repository: input.repository,
        campaignId: input.campaignId,
        request
      });
    }
  };
}

export async function buildCampaignProjectedPlayableLoreSceneV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  campaignRevision: number;
  entity: LoreEntityV1;
  fragments: LoreFragmentV1[];
  packet: LoreInfluencePacketV1;
  sceneId?: string;
}): Promise<Result<LorePlayableSceneBuildResultV1>> {
  if (input.packet.anchorEntityId !== input.entity.entityId) {
    return invalid("campaign-lore.scene-anchor-mismatch", ["packet and lore entity must share the same anchor"]);
  }
  try {
    const read = await readEffectiveCampaignLoreProjectionsV1({
      repository: input.repository,
      campaignId: input.campaignId,
      request: {
        schemaVersion: 1,
        campaignId: input.campaignId,
        campaignRevision: input.campaignRevision,
        targets: input.packet.influences.map(influence => ({
          entityId: influence.entityId,
          fieldPath: influence.fieldPath
        }))
      }
    });
    return {
      ok: true,
      value: buildPlayableSceneFromLoreLocationV1({
        entity: input.entity,
        fragments: input.fragments,
        sceneId: input.sceneId,
        campaignProjections: read.projections.filter(projection => projection.entityId === input.entity.entityId)
      })
    };
  } catch (error) {
    return {
      ok: false,
      error: coreError("PERSISTENCE_FAILURE", "campaign-lore.scene-projection-read-failed", {
        reason: error instanceof Error ? error.message : String(error)
      })
    };
  }
}

export async function readEffectiveCampaignLoreProjectionsV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  request: CampaignLoreProjectionReadRequestV1;
}): Promise<CampaignLoreProjectionReadResultV1> {
  if (input.request.campaignId !== input.campaignId || input.request.campaignRevision < 0) {
    throw new Error("Campaign lore projection request is invalid.");
  }
  const loaded = await loadCampaignLoreProjectionRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) throw new Error(loaded.error.messageKey);
  const targets = new Set(input.request.targets.map(target => key(target.entityId, target.fieldPath)));
  const latest = new Map<string, CampaignLoreProjectionV1>();
  for (const projection of loaded.value.state.projections) {
    const target = key(projection.entityId, projection.fieldPath);
    if (!targets.has(target) || projection.campaignRevision > input.request.campaignRevision) continue;
    const current = latest.get(target);
    if (
      current === undefined ||
      projection.campaignRevision > current.campaignRevision ||
      (projection.campaignRevision === current.campaignRevision && projection.projectionId.localeCompare(current.projectionId) > 0)
    ) latest.set(target, projection);
  }
  const projections = [...latest.values()].sort((left, right) =>
    left.entityId.localeCompare(right.entityId) || left.fieldPath.localeCompare(right.fieldPath)
  );
  return {
    schemaVersion: 1,
    authority: "CampaignFactDomain",
    campaignId: input.campaignId,
    campaignRevision: input.request.campaignRevision,
    projections: projections.map(cloneJson),
    sourceRefs: unique(projections.flatMap(projection => projection.sourceRefs)),
    version: 1
  };
}

export async function loadCampaignLoreProjectionRegistryV1(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<{ aggregate: AggregateRecord | null; state: CampaignLoreProjectionRegistryV1 }>> {
  const aggregate = await repository.getAggregate(
    campaignId,
    CAMPAIGN_LORE_PROJECTION_AGGREGATE_TYPE_V1,
    campaignLoreProjectionAggregateIdV1(campaignId)
  );
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? { ok: true, value: { aggregate: null, state: { schemaVersion: 1, contractVersion: CAMPAIGN_LORE_PROJECTION_REGISTRY_CONTRACT_V1, campaignId, projections: [], version: 1 } } }
      : aggregate;
  }
  const state = aggregate.value.payload as Partial<CampaignLoreProjectionRegistryV1>;
  if (state.contractVersion !== CAMPAIGN_LORE_PROJECTION_REGISTRY_CONTRACT_V1 || state.campaignId !== campaignId || !Array.isArray(state.projections)) {
    return invalid("campaign-lore.registry-invalid", ["registry contract mismatch"]);
  }
  return { ok: true, value: { aggregate: aggregate.value, state: state as CampaignLoreProjectionRegistryV1 } };
}

function validateCommand(command: RecordCampaignLoreProjectionCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1 || command.contractVersion !== CAMPAIGN_LORE_PROJECTION_COMMAND_V1) issues.push("command contract mismatch");
  if (![command.clientRequestId, command.projectionId, command.entityId, command.fieldPath].every(value => typeof value === "string" && value.trim())) issues.push("command identities are required");
  if (!command.fieldPath.startsWith("/")) issues.push("fieldPath must be an absolute lore field path");
  if (!["REPLACE", "WITHHOLD"].includes(command.disposition)) issues.push("projection disposition is invalid");
  if (command.disposition === "REPLACE" && !command.replacementText?.trim()) issues.push("replacement text is required");
  if (command.disposition === "WITHHOLD" && command.replacementText !== null) issues.push("withheld projection cannot carry text");
  if (!Array.isArray(command.publicSourceRefs) || command.publicSourceRefs.length === 0 || command.publicSourceRefs.some(ref => typeof ref !== "string" || !ref.trim())) issues.push("public source refs are required");
  if (command.publicSourceRefs.some(ref => /^(?:secret|private|hidden):/iu.test(ref))) issues.push("private source refs are forbidden");
  return issues;
}

function restore(operation: OperationRecord): Result<RecordCampaignLoreProjectionResultV1> {
  const result = operation.resultPayload as RecordCampaignLoreProjectionResultV1 | null;
  return result?.projection
    ? { ok: true, value: { ...result, replayed: true } }
    : { ok: false, error: coreError("PERSISTENCE_FAILURE", "campaign-lore.completed-result-missing", {}) };
}

function invalid<T>(messageKey: string, issues: string[]): Result<T> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues }) };
}

function key(entityId: string, fieldPath: string): string {
  return `${entityId}\u0000${fieldPath}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "fr"));
}
