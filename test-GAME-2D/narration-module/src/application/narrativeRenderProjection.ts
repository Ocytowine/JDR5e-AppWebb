import {
  cloneJson,
  computeJsonFingerprint,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type CampaignId,
  type CampaignRepository,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RepositoryClock,
  type RequestId,
  type Result
} from "../core";
import type { AiIncidentRecordV1 } from "../ai/types";
import type { DisplayPacketV1 } from "../scene";
import type { AiNarrativeEnhancementResultV1 } from "./aiNarrativeEnhancement";
import type { NarrativeTurnControllerOutputV1 } from "./NarrativeTurnController";
import { npcSpeakerIdForActorV1 } from "./npcActorIdentity";

export const NARRATIVE_RENDER_PROJECTION_CONTRACT_VERSION_V1 = "narrative-render-projection/1" as const;

export type NarrativeRenderEnhancementModeV1 = "local" | "openai";

export interface PersistedAiIncidentSummaryV1 extends JsonObject {
  schemaVersion: 1;
  incidentId: string;
  operationId: string;
  callId: string | null;
  attemptIds: string[];
  role: string | null;
  category: string;
  severity: string;
  stage: string;
  commitState: string;
  redacted: boolean;
  redactedFields: string[];
  safeDetails: JsonObject;
  outcome: string;
}

export interface NarrativeRenderedProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof NARRATIVE_RENDER_PROJECTION_CONTRACT_VERSION_V1;
  sourceOperationId: string;
  sourceContractVersion: string;
  renderOperationId: string;
  clientRequestId: string;
  mode: NarrativeRenderEnhancementModeV1;
  authority: "PRESENTATION_ONLY";
  noGameTime: true;
  displayPacket: JsonObject;
  displayPacketFingerprint: string;
  ai: {
    schemaVersion: 1;
    finalEnhanced: boolean;
    finalUsedFallback: boolean;
    fallbackAttempted: boolean;
    statusMessage: string;
    safetyNotes: string[];
    incidentIds: string[];
  };
  incidents: PersistedAiIncidentSummaryV1[];
  sourceRefs: string[];
  recordedAt: string;
  version: 1;
}

export interface NarrativeRenderProjectionInputV1 {
  schemaVersion: 1;
  clientRequestId: string;
  sourceOutput: NarrativeTurnControllerOutputV1;
  mode: NarrativeRenderEnhancementModeV1;
  finalEnhancement: AiNarrativeEnhancementResultV1;
  attemptedEnhancement: AiNarrativeEnhancementResultV1 | null;
  statusMessage: string;
}

export interface NarrativeRenderProjectionRecordResultV1 {
  operation: OperationRecord;
  projection: NarrativeRenderedProjectionV1;
}

export interface RestoredNarrativeThreadV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "narrative-rendered-thread/1";
  campaignId: string;
  displayPackets: (DisplayPacketV1 & JsonObject)[];
  projections: NarrativeRenderedProjectionV1[];
  restoredFromOperationIds: string[];
  skippedOperationIds: string[];
  version: 1;
}

export interface ReconstructedNpcUtteranceV1 extends JsonObject {
  schemaVersion: 1;
  actorId: string;
  speakerId: string;
  text: string;
  playerExpressionText: string | null;
  sourceOperationId: string;
  renderOperationId: string;
  displayPacketFingerprint: string;
  recordedAt: string;
}

export async function recordNarrativeRenderedProjectionV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clock: RepositoryClock;
  idPrefix: string;
  request: NarrativeRenderProjectionInputV1;
}): Promise<Result<NarrativeRenderProjectionRecordResultV1>> {
  const validation = validateRenderProjectionInput(input.request);
  if (!validation.ok) {
    return {
      ok: false,
      error: coreError("VALIDATION_FAILED", "narrative.render-projection.invalid-input", { issues: validation.issues })
    };
  }

  const sourceOperationId = input.request.sourceOutput.operationId;
  const sourceOperation = await input.repository.getOperation(opaqueId<OperationId>(sourceOperationId));
  if (!sourceOperation.ok) return sourceOperation;
  if (sourceOperation.value.campaignId !== input.campaignId) {
    return {
      ok: false,
      error: coreError("VALIDATION_FAILED", "narrative.render-projection.campaign-mismatch", {
        sourceOperationId
      })
    };
  }

  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;

  const suffix = normalizeIdSuffix(`${sourceOperationId}-${input.request.mode}`);
  const renderOperationId = opaqueId<OperationId>(`${input.idPrefix}-render-op-${suffix}`);
  const renderClientRequestId = opaqueId<RequestId>(`${normalizeIdSuffix(input.request.clientRequestId)}.render.${input.request.mode}`);
  const idempotencyKey = opaqueId<IdempotencyKey>(`${input.idPrefix}-render-idem-${suffix}`);
  const displayPacket = cloneJson(input.request.finalEnhancement.displayPacket) as JsonObject;
  const displayPacketFingerprint = await computeJsonFingerprint(displayPacket);
  const projection = buildNarrativeRenderedProjectionV1({
    request: input.request,
    renderOperationId,
    displayPacket,
    displayPacketFingerprint,
    recordedAt: input.clock.now().toISOString()
  });
  const requestPayload = buildRenderProjectionRequestPayload(input.request, displayPacketFingerprint);
  const operationKind = "narrative.render.projection";
  const requestPayloadSchemaVersion = 1;
  const requestFingerprint = await computeRequestFingerprint(operationKind, requestPayloadSchemaVersion, requestPayload);
  const now = input.clock.now().toISOString();
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId: renderOperationId,
    campaignId: input.campaignId,
    clientRequestId: renderClientRequestId,
    idempotencyKey,
    requestFingerprint,
    operationKind,
    requestPayloadSchemaVersion,
    requestPayload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  };

  const received = await input.repository.receiveOperation(operation);
  if (!received.ok) return received;
  if (received.value.phase === "COMPLETED" && received.value.resultPayload !== null) {
    return {
      ok: true,
      value: {
        operation: received.value,
        projection: received.value.resultPayload as NarrativeRenderedProjectionV1
      }
    };
  }

  const completed = await input.repository.completeWithoutCommit(renderOperationId, 1, projection);
  if (!completed.ok) return completed;
  return {
    ok: true,
    value: {
      operation: completed.value,
      projection
    }
  };
}

export async function restoreNarrativeRenderedThreadV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  limit: number;
}): Promise<Result<RestoredNarrativeThreadV1>> {
  const operations = await input.repository.listOperations(input.campaignId, "narrative.render.projection", input.limit);
  if (!operations.ok) return operations;

  const projections: NarrativeRenderedProjectionV1[] = [];
  const skippedOperationIds: string[] = [];
  for (const operation of operations.value) {
    if (operation.phase !== "COMPLETED" || operation.resultPayload === null) {
      skippedOperationIds.push(operation.operationId);
      continue;
    }
    const candidate = operation.resultPayload as Partial<NarrativeRenderedProjectionV1>;
    if (
      candidate.schemaVersion !== 1 ||
      candidate.contractVersion !== NARRATIVE_RENDER_PROJECTION_CONTRACT_VERSION_V1 ||
      candidate.authority !== "PRESENTATION_ONLY" ||
      candidate.noGameTime !== true ||
      typeof candidate.recordedAt !== "string"
    ) {
      skippedOperationIds.push(operation.operationId);
      continue;
    }
    projections.push(cloneJson(candidate) as NarrativeRenderedProjectionV1);
  }
  projections.sort((left, right) => {
    const byRecordedAt = left.recordedAt.localeCompare(right.recordedAt);
    return byRecordedAt !== 0 ? byRecordedAt : left.renderOperationId.localeCompare(right.renderOperationId);
  });

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      contractVersion: "narrative-rendered-thread/1",
      campaignId: input.campaignId,
      displayPackets: projections.map(projection => cloneJson(projection.displayPacket) as DisplayPacketV1 & JsonObject),
      projections,
      restoredFromOperationIds: projections.map(projection => projection.renderOperationId),
      skippedOperationIds,
      version: 1
    }
  };
}

export async function reconstructRenderedNpcUtterancesV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  actorId: string;
  limit: number;
}): Promise<Result<ReconstructedNpcUtteranceV1[]>> {
  const restored = await restoreNarrativeRenderedThreadV1({
    repository: input.repository,
    campaignId: input.campaignId,
    limit: input.limit
  });
  if (!restored.ok) return restored;
  const speakerId = npcSpeakerIdForActorV1(input.actorId);
  if (speakerId === null) return { ok: true, value: [] };
  const utterances: ReconstructedNpcUtteranceV1[] = [];
  for (const projection of restored.value.projections) {
    const packet = projection.displayPacket as unknown as Partial<DisplayPacketV1>;
    if (!Array.isArray(packet.displayBlocks)) continue;
    const playerExpressionText = packet.displayBlocks.find(block =>
      block.kind === "PLAYER_EXPRESSION" && block.text.trim().length > 0
    )?.text ?? null;
    for (const block of packet.displayBlocks) {
      if (
        block.kind !== "NPC_SPEECH" ||
        block.speaker.speakerId !== speakerId ||
        block.text.trim().length === 0
      ) continue;
      utterances.push({
        schemaVersion: 1,
        actorId: input.actorId,
        speakerId,
        text: block.text,
        playerExpressionText,
        sourceOperationId: projection.sourceOperationId,
        renderOperationId: projection.renderOperationId,
        displayPacketFingerprint: projection.displayPacketFingerprint,
        recordedAt: projection.recordedAt
      });
    }
  }
  return { ok: true, value: utterances.slice(-5) };
}


function buildNarrativeRenderedProjectionV1(input: {
  request: NarrativeRenderProjectionInputV1;
  renderOperationId: OperationId;
  displayPacket: JsonObject;
  displayPacketFingerprint: string;
  recordedAt: string;
}): NarrativeRenderedProjectionV1 {
  const incidents = collectIncidentSummaries(input.request);
  return {
    schemaVersion: 1,
    contractVersion: NARRATIVE_RENDER_PROJECTION_CONTRACT_VERSION_V1,
    sourceOperationId: input.request.sourceOutput.operationId,
    sourceContractVersion: input.request.sourceOutput.contractVersion,
    renderOperationId: input.renderOperationId,
    clientRequestId: input.request.clientRequestId,
    mode: input.request.mode,
    authority: "PRESENTATION_ONLY",
    noGameTime: true,
    displayPacket: input.displayPacket,
    displayPacketFingerprint: input.displayPacketFingerprint,
    ai: {
      schemaVersion: 1,
      finalEnhanced: input.request.finalEnhancement.enhanced,
      finalUsedFallback: input.request.finalEnhancement.usedFallback,
      fallbackAttempted: input.request.attemptedEnhancement !== null,
      statusMessage: input.request.statusMessage,
      safetyNotes: input.request.finalEnhancement.safetyNotes.slice(),
      incidentIds: incidents.map(incident => incident.incidentId)
    },
    incidents,
    sourceRefs: [
      `operation:${input.request.sourceOutput.operationId}`,
      `display:${input.displayPacketFingerprint}`
    ],
    recordedAt: input.recordedAt,
    version: 1
  };
}

function buildRenderProjectionRequestPayload(
  request: NarrativeRenderProjectionInputV1,
  displayPacketFingerprint: string
): JsonObject {
  return {
    schemaVersion: 1,
    sourceOperationId: request.sourceOutput.operationId,
    sourceContractVersion: request.sourceOutput.contractVersion,
    mode: request.mode,
    displayPacketFingerprint,
    finalEnhanced: request.finalEnhancement.enhanced,
    finalUsedFallback: request.finalEnhancement.usedFallback,
    fallbackAttempted: request.attemptedEnhancement !== null,
    noGameTime: true,
    authority: "PRESENTATION_ONLY"
  };
}

function collectIncidentSummaries(request: NarrativeRenderProjectionInputV1): PersistedAiIncidentSummaryV1[] {
  const byId = new Map<string, PersistedAiIncidentSummaryV1>();
  for (const incident of [
    ...(request.attemptedEnhancement?.incidents ?? []),
    ...request.finalEnhancement.incidents
  ]) {
    byId.set(incident.incidentId, summarizeIncident(incident));
  }
  return [...byId.values()].sort((left, right) => left.incidentId.localeCompare(right.incidentId));
}

function summarizeIncident(incident: AiIncidentRecordV1): PersistedAiIncidentSummaryV1 {
  return {
    schemaVersion: 1,
    incidentId: incident.incidentId,
    operationId: incident.operationId,
    callId: incident.callId,
    attemptIds: incident.attemptIds.slice(),
    role: incident.role,
    category: incident.category,
    severity: incident.severity,
    stage: incident.stage,
    commitState: incident.commitState,
    redacted: incident.redacted,
    redactedFields: incident.redactedFields.slice(),
    safeDetails: cloneJson(incident.safeDetails) as JsonObject,
    outcome: incident.outcome
  };
}

function validateRenderProjectionInput(input: NarrativeRenderProjectionInputV1): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (input.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (!/^[a-z][a-z0-9._:-]{2,127}$/u.test(input.clientRequestId)) {
    issues.push("clientRequestId must be a core-compatible opaque id.");
  }
  if (input.mode !== "local" && input.mode !== "openai") issues.push("mode must be local or openai.");
  if (!input.sourceOutput || input.sourceOutput.schemaVersion !== 1) issues.push("sourceOutput must be a V1 controller output.");
  if (input.finalEnhancement.schemaVersion !== 1) issues.push("finalEnhancement must be V1.");
  if (input.attemptedEnhancement !== null && input.attemptedEnhancement.schemaVersion !== 1) {
    issues.push("attemptedEnhancement must be null or V1.");
  }
  if (input.finalEnhancement.displayPacket.operationId !== input.sourceOutput.operationId) {
    issues.push("final display packet must target the source operation.");
  }
  if (typeof input.statusMessage !== "string" || input.statusMessage.trim().length === 0) {
    issues.push("statusMessage must be non-empty.");
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function normalizeIdSuffix(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9.:-]/gu, "-").replace(/^-+/u, "r");
  return normalized.slice(0, 96) || "render";
}
