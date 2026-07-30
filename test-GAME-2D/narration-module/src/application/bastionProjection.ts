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
  BASTION_ESTABLISHMENT_CONTRACT_V1,
  type BastionEstablishmentResultV1,
  type BastionPublicSummaryV1
} from "./bastionAuthority";
import {
  recordNarrativeDirectDisplayProjectionV1,
  type NarrativeRenderProjectionRecordResultV1
} from "./narrativeRenderProjection";

export const BASTION_PRESENTATION_CONTRACT_V1 = "bastion-presentation/1" as const;

export interface BastionProjectionResultV1 {
  establishmentOperationId: string;
  sourceEventId: string;
  publicSummary: BastionPublicSummaryV1;
  displayPacket: DisplayPacketV1 & JsonObject;
  projection: NarrativeRenderProjectionRecordResultV1;
}

export async function projectAndRecordBastionEstablishmentV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clock: RepositoryClock;
  idPrefix: string;
  establishmentOperationId: string;
  sceneId: string;
}): Promise<Result<BastionProjectionResultV1>> {
  if (!input.establishmentOperationId.trim() || !input.sceneId.trim()) {
    return {
      ok: false,
      error: coreError("VALIDATION_FAILED", "bastion.presentation.invalid-input")
    };
  }
  const source = await input.repository.getOperation(
    opaqueId<OperationId>(input.establishmentOperationId)
  );
  if (!source.ok) return source;
  if (
    source.value.campaignId !== input.campaignId
    || source.value.operationKind !== "bastion.establish"
    || source.value.phase !== "COMPLETED"
    || source.value.commitId === null
  ) {
    return {
      ok: false,
      error: coreError(
        "VALIDATION_FAILED",
        "bastion.presentation.source-not-committed"
      )
    };
  }
  const establishment =
    source.value.resultPayload as Partial<BastionEstablishmentResultV1> | null;
  if (
    establishment === null
    || establishment.schemaVersion !== 1
    || establishment.status !== "ESTABLISHED"
    || establishment.commitId !== source.value.commitId
    || establishment.publicSummary === null
    || !isPublicSummary(establishment.publicSummary)
  ) {
    return {
      ok: false,
      error: coreError(
        "CAMPAIGN_INTEGRITY_FAILURE",
        "bastion.presentation.result-invalid"
      )
    };
  }
  const publicEvent = await findBastionEstablishedEvent({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId: source.value.operationId
  });
  if (!publicEvent.ok) return publicEvent;
  if (
    publicEvent.value === null
    || publicEvent.value.commitId !== source.value.commitId
    || publicEvent.value.visibility.scope !== "PLAYER_VISIBLE"
  ) {
    return {
      ok: false,
      error: coreError(
        "CAMPAIGN_INTEGRITY_FAILURE",
        "bastion.presentation.public-event-missing"
      )
    };
  }
  const eventSummary = publicEvent.value.payload as unknown;
  if (!isPublicSummary(eventSummary)) {
    return {
      ok: false,
      error: coreError(
        "CAMPAIGN_INTEGRITY_FAILURE",
        "bastion.presentation.public-event-invalid"
      )
    };
  }
  const [resultFingerprint, eventFingerprint] = await Promise.all([
    computeJsonFingerprint(establishment.publicSummary),
    computeJsonFingerprint(eventSummary)
  ]);
  if (resultFingerprint !== eventFingerprint) {
    return {
      ok: false,
      error: coreError(
        "CAMPAIGN_INTEGRITY_FAILURE",
        "bastion.presentation.summary-mismatch"
      )
    };
  }
  const summary = establishment.publicSummary as BastionPublicSummaryV1;
  const displayPacket = buildBastionEstablishmentDisplayPacketV1({
    operationId: input.establishmentOperationId,
    sceneId: input.sceneId,
    sourceEventId: publicEvent.value.eventId,
    summary
  });
  const recorded = await recordNarrativeDirectDisplayProjectionV1({
    repository: input.repository,
    campaignId: input.campaignId,
    clock: input.clock,
    idPrefix: input.idPrefix,
    request: {
      schemaVersion: 1,
      clientRequestId: `${input.establishmentOperationId}:presentation`,
      sourceOperationId: input.establishmentOperationId,
      sourceContractVersion: BASTION_PRESENTATION_CONTRACT_V1,
      displayPacket,
      statusMessage: "Bastion projeté depuis une acquisition committée et validée.",
      sourceRefs: [
        `event:${publicEvent.value.eventId}`,
        summary.bastionId
      ]
    }
  });
  if (!recorded.ok) return recorded;
  return {
    ok: true,
    value: {
      establishmentOperationId: input.establishmentOperationId,
      sourceEventId: publicEvent.value.eventId,
      publicSummary: summary,
      displayPacket,
      projection: recorded.value
    }
  };
}

export function buildBastionEstablishmentDisplayPacketV1(input: {
  operationId: string;
  sceneId: string;
  sourceEventId: string;
  summary: BastionPublicSummaryV1;
}): DisplayPacketV1 & JsonObject {
  if (
    !input.operationId.trim()
    || !input.sceneId.trim()
    || !input.sourceEventId.trim()
    || !isPublicSummary(input.summary)
  ) {
    throw new Error("Invalid bastion presentation input.");
  }
  const plan: RenderPlanV1 = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: input.operationId,
    sceneId: input.sceneId,
    sourceRevision: 1,
    blocks: [{
      blockId: `${input.operationId}:bastion`,
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
        `place:${input.summary.placeRef}`
      ],
      groundedIn: [
        input.sourceEventId,
        input.summary.bastionId,
        input.summary.placeRef
      ],
      textPolicy: "DETERMINISTIC_ONLY",
      visibility: "PLAYER_VISIBLE",
      order: 0,
      text: buildBastionEstablishmentNarrationV1(input.summary)
    }],
    rhythmDecision: {
      reason: "ASK_PLAYER",
      diagnostic: "validated bastion establishment rendered; control returns to player"
    },
    fallbackAllowed: false,
    version: 1
  };
  const validation = validateRenderPlanV1(plan);
  if (!validation.ok) {
    throw new Error(
      `Invalid bastion establishment render plan: ${validation.issues.join("; ")}`
    );
  }
  return buildDisplayPacketFromRenderPlanV1({
    renderPlan: plan,
    rawInputAvailable: false,
    diagnosticsEnabled: false
  }) as DisplayPacketV1 & JsonObject;
}

export function buildBastionEstablishmentNarrationV1(
  summary: BastionPublicSummaryV1
): string {
  if (!isPublicSummary(summary)) {
    throw new Error("Invalid public bastion summary.");
  }
  return `${summary.placeDisplayName} appartient désormais à ${summary.ownerDisplayName} `
    + "et devient son point d’ancrage. Le lieu reste pour l’instant tel qu’il est : "
    + "aucun aménagement ni occupant supplémentaire n’est encore établi.";
}

async function findBastionEstablishedEvent(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operationId: OperationId;
}): Promise<Result<EventRecord | null>> {
  let cursor: { commitSequence: number; eventSequence: number } | null = null;
  while (true) {
    const page = await input.repository.listEvents(input.campaignId, cursor, 1_024);
    if (!page.ok) return page;
    const found = page.value.find(event =>
      event.operationId === input.operationId
      && event.eventType === "bastion_established"
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

function isPublicSummary(value: unknown): value is BastionPublicSummaryV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<BastionPublicSummaryV1>;
  return candidate.schemaVersion === 1
    && publicText(candidate.bastionId, 160)
    && publicText(candidate.placeRef, 160)
    && publicText(candidate.placeDisplayName, 120)
    && publicText(candidate.ownerRef, 160)
    && publicText(candidate.ownerDisplayName, 80)
    && candidate.status === "ACTIVE"
    && Number.isInteger(candidate.establishedAtGameSecond)
    && Number(candidate.establishedAtGameSecond) >= 0;
}

function publicText(value: unknown, maximumLength: number): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && value.length <= maximumLength
    && !/[\r\n\u0000-\u001f\u007f]/u.test(value);
}
