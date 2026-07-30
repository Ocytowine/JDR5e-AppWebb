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
  type BastionOccupantActivityResultV1,
  type BastionOccupantActivitySummaryV1,
  type BastionOccupantAssignmentResultV1,
  type BastionOccupantAssignmentSummaryV1
} from "./bastionOccupantAuthority";
import {
  recordNarrativeDirectDisplayProjectionV1,
  type NarrativeRenderProjectionRecordResultV1
} from "./narrativeRenderProjection";

export const BASTION_OCCUPANT_ASSIGNMENT_PRESENTATION_V1 =
  "bastion-occupant-assignment-presentation/1" as const;
export const BASTION_OCCUPANT_ACTIVITY_PRESENTATION_V1 =
  "bastion-occupant-activity-presentation/1" as const;

export interface BastionOccupantProjectionResultV1<TSummary extends JsonObject> {
  sourceOperationId: string;
  sourceEventId: string;
  publicSummary: TSummary;
  displayPacket: DisplayPacketV1 & JsonObject;
  projection: NarrativeRenderProjectionRecordResultV1;
}

export async function projectAndRecordBastionOccupantAssignmentV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clock: RepositoryClock;
  idPrefix: string;
  assignmentOperationId: string;
  sceneId: string;
}): Promise<Result<BastionOccupantProjectionResultV1<BastionOccupantAssignmentSummaryV1>>> {
  const loaded = await loadProjectionSource<BastionOccupantAssignmentResultV1>({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId: input.assignmentOperationId,
    operationKind: "bastion.occupant-assignment",
    resultStatus: "ASSIGNED",
    eventType: "bastion_occupant_assigned",
    summaryValidator: isAssignmentSummary
  });
  if (!loaded.ok) return loaded;
  const summary = loaded.value.summary as BastionOccupantAssignmentSummaryV1;
  const packet = buildPacket({
    operationId: input.assignmentOperationId,
    sceneId: input.sceneId,
    sourceEventId: loaded.value.event.eventId,
    sourceRefs: [summary.bastionId, summary.assignmentId, summary.campaignNpcId],
    groundedIn: [loaded.value.event.eventId, summary.assignmentId, summary.campaignNpcId],
    text: `${summary.actorDisplayName} exerce désormais le rôle « `
      + `${summary.roleDisplayName} » à ${summary.placeDisplayName}. L’affectation `
      + "est établie ; ses décisions et ses initiatives restent les siennes."
  });
  const recorded = await recordNarrativeDirectDisplayProjectionV1({
    repository: input.repository,
    campaignId: input.campaignId,
    clock: input.clock,
    idPrefix: input.idPrefix,
    request: {
      schemaVersion: 1,
      clientRequestId: `${input.assignmentOperationId}:presentation`,
      sourceOperationId: input.assignmentOperationId,
      sourceContractVersion: BASTION_OCCUPANT_ASSIGNMENT_PRESENTATION_V1,
      displayPacket: packet,
      statusMessage: "Affectation de bastion projetée depuis une décision propriétaire committée.",
      sourceRefs: [`event:${loaded.value.event.eventId}`, summary.assignmentId]
    }
  });
  if (!recorded.ok) return recorded;
  return {
    ok: true,
    value: {
      sourceOperationId: input.assignmentOperationId,
      sourceEventId: loaded.value.event.eventId,
      publicSummary: summary,
      displayPacket: packet,
      projection: recorded.value
    }
  };
}

export async function projectAndRecordBastionOccupantActivityV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clock: RepositoryClock;
  idPrefix: string;
  activityOperationId: string;
  sceneId: string;
}): Promise<Result<BastionOccupantProjectionResultV1<BastionOccupantActivitySummaryV1>>> {
  const loaded = await loadProjectionSource<BastionOccupantActivityResultV1>({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId: input.activityOperationId,
    operationKind: "bastion.occupant-activity",
    resultStatus: "ACTIVITY_COMMITTED",
    eventType: "bastion_occupant_activity_completed",
    summaryValidator: isActivitySummary
  });
  if (!loaded.ok) return loaded;
  const summary = loaded.value.summary as BastionOccupantActivitySummaryV1;
  const packet = buildPacket({
    operationId: input.activityOperationId,
    sceneId: input.sceneId,
    sourceEventId: loaded.value.event.eventId,
    sourceRefs: [
      summary.bastionId,
      summary.assignmentId,
      summary.campaignNpcId,
      summary.activityId
    ],
    groundedIn: [loaded.value.event.eventId, summary.assignmentId, summary.activityId],
    text: summary.narrative
  });
  const recorded = await recordNarrativeDirectDisplayProjectionV1({
    repository: input.repository,
    campaignId: input.campaignId,
    clock: input.clock,
    idPrefix: input.idPrefix,
    request: {
      schemaVersion: 1,
      clientRequestId: `${input.activityOperationId}:presentation`,
      sourceOperationId: input.activityOperationId,
      sourceContractVersion: BASTION_OCCUPANT_ACTIVITY_PRESENTATION_V1,
      displayPacket: packet,
      statusMessage: "Activité autonome de bastion projetée depuis son événement committé.",
      sourceRefs: [`event:${loaded.value.event.eventId}`, summary.activityId]
    }
  });
  if (!recorded.ok) return recorded;
  return {
    ok: true,
    value: {
      sourceOperationId: input.activityOperationId,
      sourceEventId: loaded.value.event.eventId,
      publicSummary: summary,
      displayPacket: packet,
      projection: recorded.value
    }
  };
}

async function loadProjectionSource<TResult extends JsonObject>(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operationId: string;
  operationKind: string;
  resultStatus: string;
  eventType: string;
  summaryValidator(value: unknown): boolean;
}): Promise<Result<{ event: EventRecord; summary: JsonObject }>> {
  if (!input.operationId.trim()) return invalid("bastion.occupant-presentation.invalid-input");
  const operation = await input.repository.getOperation(opaqueId<OperationId>(input.operationId));
  if (!operation.ok) return operation;
  if (
    operation.value.campaignId !== input.campaignId
    || operation.value.operationKind !== input.operationKind
    || operation.value.phase !== "COMPLETED"
    || operation.value.commitId === null
  ) return invalid("bastion.occupant-presentation.source-not-committed");
  const result = operation.value.resultPayload as TResult | null;
  const candidate = result as (TResult & {
    status?: string;
    commitId?: string | null;
    publicSummary?: unknown;
  }) | null;
  if (
    candidate === null
    || candidate.status !== input.resultStatus
    || candidate.commitId !== operation.value.commitId
    || !input.summaryValidator(candidate.publicSummary)
  ) return integrity("bastion.occupant-presentation.result-invalid");
  const event = await findEvent(
    input.repository,
    input.campaignId,
    operation.value.operationId,
    input.eventType
  );
  if (
    !event.ok
    || event.value === null
    || event.value.commitId !== operation.value.commitId
    || event.value.visibility.scope !== "PLAYER_VISIBLE"
  ) return event.ok
    ? integrity("bastion.occupant-presentation.public-event-missing")
    : event;
  if (!input.summaryValidator(event.value.payload)) {
    return integrity("bastion.occupant-presentation.public-event-invalid");
  }
  const [resultFingerprint, eventFingerprint] = await Promise.all([
    computeJsonFingerprint(candidate.publicSummary),
    computeJsonFingerprint(event.value.payload)
  ]);
  if (resultFingerprint !== eventFingerprint) {
    return integrity("bastion.occupant-presentation.summary-mismatch");
  }
  return {
    ok: true,
    value: {
      event: event.value,
      summary: event.value.payload
    }
  };
}

function buildPacket(input: {
  operationId: string;
  sceneId: string;
  sourceEventId: string;
  sourceRefs: string[];
  groundedIn: string[];
  text: string;
}): DisplayPacketV1 & JsonObject {
  const plan: RenderPlanV1 = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: input.operationId,
    sceneId: input.sceneId,
    sourceRevision: 1,
    blocks: [{
      blockId: `${input.operationId}:bastion-occupant`,
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
      sourceRefs: [`event:${input.sourceEventId}`, ...input.sourceRefs],
      groundedIn: input.groundedIn,
      textPolicy: "DETERMINISTIC_ONLY",
      visibility: "PLAYER_VISIBLE",
      order: 0,
      text: input.text
    }],
    rhythmDecision: {
      reason: "ASK_PLAYER",
      diagnostic: "committed bastion occupant state rendered; control returns to player"
    },
    fallbackAllowed: false,
    version: 1
  };
  const validation = validateRenderPlanV1(plan);
  if (!validation.ok) {
    throw new Error(`Invalid bastion occupant render plan: ${validation.issues.join("; ")}`);
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

function isAssignmentSummary(value: unknown): value is BastionOccupantAssignmentSummaryV1 {
  if (!object(value)) return false;
  const summary = value as Partial<BastionOccupantAssignmentSummaryV1>;
  return summary.schemaVersion === 1
    && allText([
      summary.bastionId,
      summary.placeRef,
      summary.placeDisplayName,
      summary.assignmentId,
      summary.campaignNpcId,
      summary.actorDisplayName,
      summary.roleDefinitionRef,
      summary.roleDisplayName
    ])
    && nonNegativeInteger(summary.assignedAtGameSecond);
}

function isActivitySummary(value: unknown): value is BastionOccupantActivitySummaryV1 {
  if (!object(value)) return false;
  const summary = value as Partial<BastionOccupantActivitySummaryV1>;
  return summary.schemaVersion === 1
    && allText([
      summary.bastionId,
      summary.placeRef,
      summary.placeDisplayName,
      summary.assignmentId,
      summary.campaignNpcId,
      summary.actorDisplayName,
      summary.roleDisplayName,
      summary.activityId,
      summary.activityDefinitionRef,
      summary.activityDisplayName,
      summary.narrative
    ])
    && nonNegativeInteger(summary.occurredAtGameSecond);
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function allText(values: unknown[]): boolean {
  return values.every(value =>
    typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && value.length <= 600
    && !/[\r\n\u0000-\u001f\u007f]/u.test(value)
  );
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function invalid(messageKey: string): Result<never> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey) };
}

function integrity(messageKey: string): Result<never> {
  return { ok: false, error: coreError("CAMPAIGN_INTEGRITY_FAILURE", messageKey) };
}
