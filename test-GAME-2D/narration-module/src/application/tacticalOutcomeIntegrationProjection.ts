import {
  coreError,
  type CampaignId,
  type CampaignRepository,
  type EventRecord,
  type JsonObject,
  type RepositoryClock,
  type Result
} from "../core";
import {
  buildDisplayPacketFromRenderPlanV1,
  SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
  validateRenderPlanV1,
  type DisplayPacketV1,
  type RenderPlanV1
} from "../scene";
import {
  recordNarrativeDirectDisplayProjectionV1,
  type NarrativeRenderProjectionRecordResultV1
} from "./narrativeRenderProjection";

export const TACTICAL_OUTCOME_PRESENTATION_V1 =
  "tactical-outcome-presentation/1" as const;

export interface TacticalOutcomeProjectionResultV1 {
  sourceOperationId: string;
  sourceEventId: string;
  displayPacket: DisplayPacketV1 & JsonObject;
  projection: NarrativeRenderProjectionRecordResultV1;
}

export async function projectAndRecordTacticalOutcomeIntegrationV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clock: RepositoryClock;
  idPrefix: string;
  processId: string;
  sceneId: string;
}): Promise<Result<TacticalOutcomeProjectionResultV1>> {
  const event = await findResolutionEvent(
    input.repository,
    input.campaignId,
    input.processId
  );
  if (!event.ok) return event;
  if (
    event.value === null
    || event.value.visibility.scope !== "PLAYER_VISIBLE"
    || event.value.commitId === null
    || integrationResult(event.value.payload)?.processId !== input.processId
  ) {
    return invalid("tactical.presentation.resolution-event-missing");
  }
  const narrative = publicNarrative(integrationResult(event.value.payload));
  if (narrative === null) {
    return invalid("tactical.presentation.narrative-invalid");
  }
  const packet = buildPacket({
    operationId: event.value.operationId,
    sceneId: input.sceneId,
    sourceEventId: event.value.eventId,
    processId: input.processId,
    narrative
  });
  const recorded = await recordNarrativeDirectDisplayProjectionV1({
    repository: input.repository,
    campaignId: input.campaignId,
    clock: input.clock,
    idPrefix: input.idPrefix,
    request: {
      schemaVersion: 1,
      clientRequestId: `${input.processId}:tactical-continuation`,
      sourceOperationId: event.value.operationId,
      sourceContractVersion: TACTICAL_OUTCOME_PRESENTATION_V1,
      displayPacket: packet,
      statusMessage:
        "Résultat tactique validé et intégré une seule fois ; la narration reprend.",
      sourceRefs: [
        `event:${event.value.eventId}`,
        `process:${input.processId}`
      ]
    }
  });
  if (!recorded.ok) return recorded;
  return {
    ok: true,
    value: {
      sourceOperationId: event.value.operationId,
      sourceEventId: event.value.eventId,
      displayPacket: packet,
      projection: recorded.value
    }
  };
}

function buildPacket(input: {
  operationId: string;
  sceneId: string;
  sourceEventId: string;
  processId: string;
  narrative: string;
}): DisplayPacketV1 & JsonObject {
  const plan: RenderPlanV1 = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: input.operationId,
    sceneId: input.sceneId,
    sourceRevision: 1,
    blocks: [{
      blockId: `${input.operationId}:tactical-continuation`,
      kind: "GM_NARRATION",
      speakerRef: {
        schemaVersion: 1,
        kind: "GM",
        speakerId: "speaker-gm",
        actorRef: null,
        displayName: "MJ",
        knownNameStatus: "KNOWN",
        roleLabel: "Narration",
        accessibilityLabel: "Maître du jeu",
        visualToken: "speaker-gm"
      },
      sourceRefs: [`event:${input.sourceEventId}`, input.processId],
      groundedIn: [input.sourceEventId, input.processId],
      textPolicy: "DETERMINISTIC_ONLY",
      visibility: "PLAYER_VISIBLE",
      order: 0,
      text: input.narrative
    }],
    rhythmDecision: {
      reason: "ASK_PLAYER",
      diagnostic:
        "committed tactical outcome integrated; control returns to player"
    },
    fallbackAllowed: false,
    version: 1
  };
  const validation = validateRenderPlanV1(plan);
  if (!validation.ok) {
    throw new Error(
      `Invalid tactical continuation render plan: ${validation.issues.join("; ")}`
    );
  }
  return buildDisplayPacketFromRenderPlanV1({
    renderPlan: plan,
    rawInputAvailable: false,
    diagnosticsEnabled: false
  }) as DisplayPacketV1 & JsonObject;
}

async function findResolutionEvent(
  repository: CampaignRepository,
  campaignId: CampaignId,
  processId: string
): Promise<Result<EventRecord | null>> {
  let cursor: { commitSequence: number; eventSequence: number } | null = null;
  while (true) {
    const page = await repository.listEvents(campaignId, cursor, 1_024);
    if (!page.ok) return page;
    const found = page.value.find(event =>
      event.eventType === "bastion_defense_resolved"
      && integrationResult(event.payload)?.processId === processId
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

function integrationResult(value: JsonObject): JsonObject | null {
  const result = value.result;
  return result !== null
    && typeof result === "object"
    && !Array.isArray(result)
    ? result
    : null;
}

function publicNarrative(value: JsonObject | null): string | null {
  if (value === null) return null;
  const projection = value.narrativeProjection;
  const candidate = projection !== null
    && typeof projection === "object"
    && !Array.isArray(projection)
    ? projection.narrative
    : null;
  return typeof candidate === "string"
    && candidate.trim() === candidate
    && candidate.length > 0
    && candidate.length <= 1_000
    ? candidate
    : null;
}

function invalid(messageKey: string): Result<never> {
  return {
    ok: false,
    error: coreError("VALIDATION_FAILED", messageKey)
  };
}
