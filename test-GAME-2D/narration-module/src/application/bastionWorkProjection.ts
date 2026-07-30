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
  type BastionWorkCompletionResultV1,
  type BastionWorkCompletionSummaryV1
} from "./bastionWorkAuthority";
import {
  recordNarrativeDirectDisplayProjectionV1,
  type NarrativeRenderProjectionRecordResultV1
} from "./narrativeRenderProjection";

export const BASTION_WORK_PRESENTATION_CONTRACT_V1 =
  "bastion-work-presentation/1" as const;

export interface BastionWorkProjectionResultV1 {
  completionOperationId: string;
  sourceEventId: string;
  publicSummary: BastionWorkCompletionSummaryV1;
  displayPacket: DisplayPacketV1 & JsonObject;
  projection: NarrativeRenderProjectionRecordResultV1;
}

export async function projectAndRecordBastionWorkCompletionV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clock: RepositoryClock;
  idPrefix: string;
  completionOperationId: string;
  sceneId: string;
}): Promise<Result<BastionWorkProjectionResultV1>> {
  if (!input.completionOperationId.trim() || !input.sceneId.trim()) {
    return invalid("bastion.work-presentation.invalid-input");
  }
  const operation = await input.repository.getOperation(
    opaqueId<OperationId>(input.completionOperationId)
  );
  if (!operation.ok) return operation;
  if (
    operation.value.campaignId !== input.campaignId
    || operation.value.operationKind !== "bastion.work-completion"
    || operation.value.phase !== "COMPLETED"
    || operation.value.commitId === null
  ) {
    return invalid("bastion.work-presentation.source-not-committed");
  }
  const result = operation.value.resultPayload as
    | Partial<BastionWorkCompletionResultV1>
    | null;
  if (
    result === null
    || result.schemaVersion !== 1
    || result.status !== "COMPLETED"
    || result.commitId !== operation.value.commitId
    || !isCompletionSummary(result.publicSummary)
  ) {
    return integrity("bastion.work-presentation.result-invalid");
  }
  const event = await findCompletionEvent(
    input.repository,
    input.campaignId,
    operation.value.operationId
  );
  if (!event.ok) return event;
  if (
    event.value === null
    || event.value.commitId !== operation.value.commitId
    || event.value.visibility.scope !== "PLAYER_VISIBLE"
  ) {
    return integrity("bastion.work-presentation.public-event-missing");
  }
  const eventSummary = (event.value.payload as { result?: unknown }).result;
  if (!isCompletionSummary(eventSummary)) {
    return integrity("bastion.work-presentation.public-event-invalid");
  }
  const [resultFingerprint, eventFingerprint] = await Promise.all([
    computeJsonFingerprint(result.publicSummary),
    computeJsonFingerprint(eventSummary)
  ]);
  if (resultFingerprint !== eventFingerprint) {
    return integrity("bastion.work-presentation.summary-mismatch");
  }
  const displayPacket = buildBastionWorkCompletionDisplayPacketV1({
    operationId: input.completionOperationId,
    sceneId: input.sceneId,
    sourceEventId: event.value.eventId,
    summary: eventSummary
  });
  const recorded = await recordNarrativeDirectDisplayProjectionV1({
    repository: input.repository,
    campaignId: input.campaignId,
    clock: input.clock,
    idPrefix: input.idPrefix,
    request: {
      schemaVersion: 1,
      clientRequestId: `${input.completionOperationId}:presentation`,
      sourceOperationId: input.completionOperationId,
      sourceContractVersion: BASTION_WORK_PRESENTATION_CONTRACT_V1,
      displayPacket,
      statusMessage: "Travail de bastion projeté depuis son achèvement committé.",
      sourceRefs: [
        `event:${event.value.eventId}`,
        eventSummary.bastionId,
        eventSummary.installationId
      ]
    }
  });
  if (!recorded.ok) return recorded;
  return {
    ok: true,
    value: {
      completionOperationId: input.completionOperationId,
      sourceEventId: event.value.eventId,
      publicSummary: eventSummary,
      displayPacket,
      projection: recorded.value
    }
  };
}

export function buildBastionWorkCompletionDisplayPacketV1(input: {
  operationId: string;
  sceneId: string;
  sourceEventId: string;
  summary: BastionWorkCompletionSummaryV1;
}): DisplayPacketV1 & JsonObject {
  if (
    !input.operationId.trim()
    || !input.sceneId.trim()
    || !input.sourceEventId.trim()
    || !isCompletionSummary(input.summary)
  ) {
    throw new Error("Invalid bastion work presentation input.");
  }
  const plan: RenderPlanV1 = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: input.operationId,
    sceneId: input.sceneId,
    sourceRevision: 1,
    blocks: [{
      blockId: `${input.operationId}:bastion-work`,
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
        input.summary.installationId
      ],
      groundedIn: [
        input.sourceEventId,
        input.summary.workOrderId,
        input.summary.installationId
      ],
      textPolicy: "DETERMINISTIC_ONLY",
      visibility: "PLAYER_VISIBLE",
      order: 0,
      text: input.summary.narrative
    }],
    rhythmDecision: {
      reason: "ASK_PLAYER",
      diagnostic: "catalogued bastion work completion rendered; control returns to player"
    },
    fallbackAllowed: false,
    version: 1
  };
  const validation = validateRenderPlanV1(plan);
  if (!validation.ok) {
    throw new Error(`Invalid bastion work render plan: ${validation.issues.join("; ")}`);
  }
  return buildDisplayPacketFromRenderPlanV1({
    renderPlan: plan,
    rawInputAvailable: false,
    diagnosticsEnabled: false
  }) as DisplayPacketV1 & JsonObject;
}

async function findCompletionEvent(
  repository: CampaignRepository,
  campaignId: CampaignId,
  operationId: OperationId
): Promise<Result<EventRecord | null>> {
  let cursor: { commitSequence: number; eventSequence: number } | null = null;
  while (true) {
    const page = await repository.listEvents(campaignId, cursor, 1_024);
    if (!page.ok) return page;
    const found = page.value.find(value =>
      value.operationId === operationId && value.eventType === "bastion_work_completed"
    );
    if (found !== undefined) return { ok: true, value: found };
    const last = page.value.at(-1);
    if (last === undefined || page.value.length < 1_024) return { ok: true, value: null };
    cursor = { commitSequence: last.commitSequence, eventSequence: last.eventSequence };
  }
}

function isCompletionSummary(value: unknown): value is BastionWorkCompletionSummaryV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const summary = value as Partial<BastionWorkCompletionSummaryV1>;
  return summary.schemaVersion === 1
    && publicText(summary.bastionId, 200)
    && publicText(summary.placeRef, 200)
    && publicText(summary.placeDisplayName, 120)
    && publicText(summary.workOrderId, 200)
    && publicText(summary.workDefinitionRef, 200)
    && publicText(summary.installationId, 240)
    && publicText(summary.installationDefinitionRef, 200)
    && publicText(summary.installationDisplayName, 120)
    && Number.isInteger(summary.completedAtGameSecond)
    && Number(summary.completedAtGameSecond) >= 0
    && publicText(summary.narrative, 600);
}

function publicText(value: unknown, maximumLength: number): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && value.length <= maximumLength
    && !/[\r\n\u0000-\u001f\u007f]/u.test(value);
}

function invalid(messageKey: string): Result<never> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey) };
}

function integrity(messageKey: string): Result<never> {
  return { ok: false, error: coreError("CAMPAIGN_INTEGRITY_FAILURE", messageKey) };
}
