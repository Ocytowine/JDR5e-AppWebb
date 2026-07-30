import {
  computeJsonFingerprint,
  coreError,
  opaqueId,
  type CampaignId,
  type CampaignRepository,
  type EventRecord,
  type JsonObject,
  type OperationId,
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
  type BastionIncidentPublicSummaryV1,
  type BastionIncidentResultV1
} from "./bastionIncidentAuthority";
import {
  recordNarrativeDirectDisplayProjectionV1,
  type NarrativeRenderProjectionRecordResultV1
} from "./narrativeRenderProjection";

export const BASTION_INCIDENT_PRESENTATION_V1 =
  "bastion-incident-presentation/1" as const;

export interface BastionIncidentProjectionResultV1 {
  sourceOperationId: string;
  sourceEventId: string;
  publicSummary: BastionIncidentPublicSummaryV1;
  displayPacket: DisplayPacketV1 & JsonObject;
  projection: NarrativeRenderProjectionRecordResultV1;
}

export async function projectAndRecordBastionIncidentV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clock: RepositoryClock;
  idPrefix: string;
  incidentOperationId: string;
  sceneId: string;
}): Promise<Result<BastionIncidentProjectionResultV1>> {
  if (!input.incidentOperationId.trim()) return invalid("bastion.incident-presentation.invalid-input");
  const operation = await input.repository.getOperation(
    opaqueId<OperationId>(input.incidentOperationId)
  );
  if (
    !operation.ok
    || operation.value.campaignId !== input.campaignId
    || operation.value.operationKind !== "bastion.handle-incident"
    || operation.value.phase !== "COMPLETED"
    || operation.value.commitId === null
  ) return operation.ok
    ? invalid("bastion.incident-presentation.source-not-committed")
    : operation;

  const result = operation.value.resultPayload as BastionIncidentResultV1 | null;
  if (
    result === null
    || !["RECORDED", "CONSEQUENCE_APPLIED", "HANDOFF_CREATED"].includes(result.status)
    || result.commitId !== operation.value.commitId
    || !isSummary(result.publicSummary)
  ) return integrity("bastion.incident-presentation.result-invalid");

  const expectedEventType = result.status === "HANDOFF_CREATED"
    ? "bastion_defense_handoff_started"
    : "bastion_incident_handled";
  const event = await findEvent(
    input.repository,
    input.campaignId,
    operation.value.operationId,
    expectedEventType
  );
  if (
    !event.ok
    || event.value === null
    || event.value.commitId !== operation.value.commitId
    || event.value.visibility.scope !== "PLAYER_VISIBLE"
    || !isSummary(event.value.payload)
  ) return event.ok
    ? integrity("bastion.incident-presentation.public-event-invalid")
    : event;

  const [resultFingerprint, eventFingerprint] = await Promise.all([
    computeJsonFingerprint(result.publicSummary),
    computeJsonFingerprint(event.value.payload)
  ]);
  if (resultFingerprint !== eventFingerprint) {
    return integrity("bastion.incident-presentation.summary-mismatch");
  }

  const summary = event.value.payload;
  const packet = buildPacket({
    operationId: input.incidentOperationId,
    sceneId: input.sceneId,
    sourceEventId: event.value.eventId,
    summary
  });
  const recorded = await recordNarrativeDirectDisplayProjectionV1({
    repository: input.repository,
    campaignId: input.campaignId,
    clock: input.clock,
    idPrefix: input.idPrefix,
    request: {
      schemaVersion: 1,
      clientRequestId: `${input.incidentOperationId}:presentation`,
      sourceOperationId: input.incidentOperationId,
      sourceContractVersion: BASTION_INCIDENT_PRESENTATION_V1,
      displayPacket: packet,
      statusMessage: summary.status === "HANDOFF_ACTIVE"
        ? "Défense de bastion transmise au propriétaire tactique ; issue encore ouverte."
        : "Incident de bastion projeté depuis son résultat propriétaire committé.",
      sourceRefs: [`event:${event.value.eventId}`, summary.incidentId]
    }
  });
  if (!recorded.ok) return recorded;
  return {
    ok: true,
    value: {
      sourceOperationId: input.incidentOperationId,
      sourceEventId: event.value.eventId,
      publicSummary: summary,
      displayPacket: packet,
      projection: recorded.value
    }
  };
}

function buildPacket(input: {
  operationId: string;
  sceneId: string;
  sourceEventId: string;
  summary: BastionIncidentPublicSummaryV1;
}): DisplayPacketV1 & JsonObject {
  const plan: RenderPlanV1 = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: input.operationId,
    sceneId: input.sceneId,
    sourceRevision: 1,
    blocks: [{
      blockId: `${input.operationId}:bastion-incident`,
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
      sourceRefs: [
        `event:${input.sourceEventId}`,
        input.summary.bastionId,
        input.summary.incidentId,
        ...(input.summary.tacticalProcessId === null
          ? []
          : [input.summary.tacticalProcessId])
      ],
      groundedIn: [
        input.sourceEventId,
        input.summary.bastionId,
        input.summary.incidentId
      ],
      textPolicy: "DETERMINISTIC_ONLY",
      visibility: "PLAYER_VISIBLE",
      order: 0,
      text: input.summary.narrative
    }],
    rhythmDecision: {
      reason: "ASK_PLAYER",
      diagnostic: input.summary.status === "HANDOFF_ACTIVE"
        ? "bastion defense committed and handed off; tactical outcome remains pending"
        : "committed bastion incident rendered; control returns to player"
    },
    fallbackAllowed: false,
    version: 1
  };
  const validation = validateRenderPlanV1(plan);
  if (!validation.ok) {
    throw new Error(`Invalid bastion incident render plan: ${validation.issues.join("; ")}`);
  }
  return buildDisplayPacketFromRenderPlanV1({
    renderPlan: plan,
    rawInputAvailable: false,
    diagnosticsEnabled: false
  }) as DisplayPacketV1 & JsonObject;
}

async function findEvent(
  repository: CampaignRepository,
  campaignId: CampaignId,
  operationId: OperationId,
  eventType: string
): Promise<Result<EventRecord | null>> {
  let cursor: { commitSequence: number; eventSequence: number } | null = null;
  while (true) {
    const page = await repository.listEvents(campaignId, cursor, 1_024);
    if (!page.ok) return page;
    const found = page.value.find(value =>
      value.operationId === operationId && value.eventType === eventType
    );
    if (found !== undefined) return { ok: true, value: found };
    const last = page.value.at(-1);
    if (last === undefined || page.value.length < 1_024) return { ok: true, value: null };
    cursor = { commitSequence: last.commitSequence, eventSequence: last.eventSequence };
  }
}

function isSummary(value: unknown): value is BastionIncidentPublicSummaryV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const summary = value as Partial<BastionIncidentPublicSummaryV1>;
  return summary.schemaVersion === 1
    && [
      summary.bastionId,
      summary.placeRef,
      summary.placeDisplayName,
      summary.incidentId,
      summary.incidentDefinitionRef,
      summary.incidentDisplayName,
      summary.kind,
      summary.status,
      summary.narrative
    ].every(nonEmpty)
    && (
      summary.affectedInstallationDisplayName === null
      || nonEmpty(summary.affectedInstallationDisplayName)
    )
    && (summary.tacticalProcessId === null || nonEmpty(summary.tacticalProcessId))
    && Number.isInteger(summary.occurredAtGameSecond)
    && Number(summary.occurredAtGameSecond) >= 0;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && !/[\r\n\u0000-\u001f\u007f]/u.test(value);
}

function invalid(messageKey: string): Result<never> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey) };
}

function integrity(messageKey: string): Result<never> {
  return { ok: false, error: coreError("CAMPAIGN_INTEGRITY_FAILURE", messageKey) };
}
