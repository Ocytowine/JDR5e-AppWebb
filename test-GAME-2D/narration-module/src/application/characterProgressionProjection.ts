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
  CHARACTER_PROGRESSION_APPLICATION_CONTRACT_V1,
  type CharacterProgressionApplicationResultV1,
  type CharacterProgressionPublicSummaryV1
} from "./characterProgressionAuthority";
import {
  recordNarrativeDirectDisplayProjectionV1,
  type NarrativeRenderProjectionRecordResultV1
} from "./narrativeRenderProjection";

export const CHARACTER_PROGRESSION_PRESENTATION_CONTRACT_V1 =
  "character-progression-presentation/1" as const;

export interface CharacterProgressionProjectionResultV1 {
  applicationOperationId: string;
  sourceEventId: string;
  publicSummary: CharacterProgressionPublicSummaryV1;
  displayPacket: DisplayPacketV1 & JsonObject;
  projection: NarrativeRenderProjectionRecordResultV1;
}

export async function projectAndRecordCharacterProgressionV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clock: RepositoryClock;
  idPrefix: string;
  applicationOperationId: string;
  sceneId: string;
}): Promise<Result<CharacterProgressionProjectionResultV1>> {
  if (!input.applicationOperationId.trim() || !input.sceneId.trim()) {
    return {
      ok: false,
      error: coreError(
        "VALIDATION_FAILED",
        "progression.presentation.invalid-input"
      )
    };
  }
  const source = await input.repository.getOperation(
    opaqueId<OperationId>(input.applicationOperationId)
  );
  if (!source.ok) return source;
  if (
    source.value.campaignId !== input.campaignId
    || source.value.operationKind !== "character.progression.apply"
    || source.value.phase !== "COMPLETED"
    || source.value.commitId === null
  ) {
    return {
      ok: false,
      error: coreError(
        "VALIDATION_FAILED",
        "progression.presentation.source-not-committed"
      )
    };
  }
  const application =
    source.value.resultPayload as Partial<CharacterProgressionApplicationResultV1> | null;
  if (
    application === null
    || application.schemaVersion !== 1
    || application.status !== "APPLIED"
    || application.commitId !== source.value.commitId
    || application.award === null
    || typeof application.award !== "object"
    || application.award.status !== "APPLIED"
    || !isPublicText(application.award.awardId, 128)
    || application.publicSummary === null
    || !isPublicSummary(application.publicSummary)
  ) {
    return {
      ok: false,
      error: coreError(
        "CAMPAIGN_INTEGRITY_FAILURE",
        "progression.presentation.result-invalid"
      )
    };
  }
  const sourceEvent = await findPlayerLevelChangedEvent({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId: source.value.operationId
  });
  if (!sourceEvent.ok) return sourceEvent;
  if (
    sourceEvent.value === null
    || sourceEvent.value.commitId !== source.value.commitId
    || sourceEvent.value.visibility.scope !== "PLAYER_VISIBLE"
  ) {
    return {
      ok: false,
      error: coreError(
        "CAMPAIGN_INTEGRITY_FAILURE",
        "progression.presentation.public-event-missing"
      )
    };
  }
  const eventSummary = sourceEvent.value.payload as unknown;
  if (!isPublicSummary(eventSummary)) {
    return {
      ok: false,
      error: coreError(
        "CAMPAIGN_INTEGRITY_FAILURE",
        "progression.presentation.public-event-invalid"
      )
    };
  }
  const [resultFingerprint, eventFingerprint] = await Promise.all([
    computeJsonFingerprint(application.publicSummary),
    computeJsonFingerprint(eventSummary)
  ]);
  if (resultFingerprint !== eventFingerprint) {
    return {
      ok: false,
      error: coreError(
        "CAMPAIGN_INTEGRITY_FAILURE",
        "progression.presentation.summary-mismatch"
      )
    };
  }
  const appliedResult = application as CharacterProgressionApplicationResultV1;

  const displayPacket = buildCharacterProgressionDisplayPacketV1({
    operationId: input.applicationOperationId,
    sceneId: input.sceneId,
    sourceEventId: sourceEvent.value.eventId,
    summary: appliedResult.publicSummary!
  });
  const recorded = await recordNarrativeDirectDisplayProjectionV1({
    repository: input.repository,
    campaignId: input.campaignId,
    clock: input.clock,
    idPrefix: input.idPrefix,
    request: {
      schemaVersion: 1,
      clientRequestId: `${input.applicationOperationId}:presentation`,
      sourceOperationId: input.applicationOperationId,
      sourceContractVersion: CHARACTER_PROGRESSION_PRESENTATION_CONTRACT_V1,
      displayPacket,
      statusMessage: "Progression projetée depuis un résultat personnage committé et validé.",
      sourceRefs: [
        `event:${sourceEvent.value.eventId}`,
        `progression-award:${appliedResult.award.awardId}`
      ]
    }
  });
  if (!recorded.ok) return recorded;
  return {
    ok: true,
    value: {
      applicationOperationId: input.applicationOperationId,
      sourceEventId: sourceEvent.value.eventId,
      publicSummary: appliedResult.publicSummary!,
      displayPacket,
      projection: recorded.value
    }
  };
}

export function buildCharacterProgressionDisplayPacketV1(input: {
  operationId: string;
  sceneId: string;
  sourceEventId: string;
  summary: CharacterProgressionPublicSummaryV1;
}): DisplayPacketV1 & JsonObject {
  if (
    !input.operationId.trim()
    || !input.sceneId.trim()
    || !input.sourceEventId.trim()
    || !isPublicSummary(input.summary)
  ) {
    throw new Error("Invalid character progression presentation input.");
  }
  const plan: RenderPlanV1 = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: input.operationId,
    sceneId: input.sceneId,
    sourceRevision: input.summary.newGlobalLevel,
    blocks: [{
      blockId: `${input.operationId}:progression`,
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
        `character:${input.summary.characterId}`
      ],
      groundedIn: [
        input.sourceEventId,
        `character-level:${input.summary.newGlobalLevel}`
      ],
      textPolicy: "DETERMINISTIC_ONLY",
      visibility: "PLAYER_VISIBLE",
      order: 0,
      text: buildCharacterProgressionNarrationV1(input.summary)
    }],
    rhythmDecision: {
      reason: "ASK_PLAYER",
      diagnostic: "validated character progression rendered; control returns to player"
    },
    fallbackAllowed: false,
    version: 1
  };
  const validation = validateRenderPlanV1(plan);
  if (!validation.ok) {
    throw new Error(`Invalid character progression render plan: ${validation.issues.join("; ")}`);
  }
  return buildDisplayPacketFromRenderPlanV1({
    renderPlan: plan,
    rawInputAvailable: false,
    diagnosticsEnabled: false
  }) as DisplayPacketV1 & JsonObject;
}

export function buildCharacterProgressionNarrationV1(
  summary: CharacterProgressionPublicSummaryV1
): string {
  if (!isPublicSummary(summary)) {
    throw new Error("Invalid public character progression summary.");
  }
  const nameComplement = /^[aeiouyhàâäéèêëîïôöùûüÿ]/iu.test(summary.characterDisplayName)
    ? `d'${summary.characterDisplayName}`
    : `de ${summary.characterDisplayName}`;
  const opening = `L'expérience ${nameComplement} porte ses fruits : `
    + `${summary.characterDisplayName} est désormais ${summary.progressionLabel}.`;
  if (summary.grantedLabels.length === 0) return opening;
  return `${opening} ${summary.characterDisplayName} maîtrise désormais `
    + `${joinFrenchLabels(summary.grantedLabels)}.`;
}

async function findPlayerLevelChangedEvent(input: {
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
      && event.eventType === "player_level_changed"
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

function isPublicSummary(value: unknown): value is CharacterProgressionPublicSummaryV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<CharacterProgressionPublicSummaryV1>;
  return candidate.schemaVersion === 1
    && isPublicText(candidate.characterId, 128)
    && isPublicText(candidate.characterDisplayName, 80)
    && Number.isInteger(candidate.previousGlobalLevel)
    && Number.isInteger(candidate.newGlobalLevel)
    && Number(candidate.previousGlobalLevel) >= 1
    && Number(candidate.newGlobalLevel) === Number(candidate.previousGlobalLevel) + 1
    && Number(candidate.newGlobalLevel) <= 20
    && isPublicText(candidate.progressionLabel, 120)
    && Array.isArray(candidate.grantedLabels)
    && candidate.grantedLabels.length <= 20
    && candidate.grantedLabels.every(label => isPublicText(label, 120));
}

function isPublicText(value: unknown, maximumLength: number): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && value.length <= maximumLength
    && !/[\r\n\u0000-\u001f\u007f]/u.test(value);
}

function joinFrenchLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} et ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} et ${labels.at(-1)}`;
}
