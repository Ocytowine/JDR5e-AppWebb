import { computeJsonFingerprint } from "../core";
import type { ContractAiProviderV1 } from "../ai/FakeContractAiProvider";
import { runAiPipelineCallV1 } from "../ai/pipeline";
import type { AiCallRequestV1, AiCallTelemetryV1, AiModelRouteV1, AiRetryPolicyV1, AiRoleOutputEnvelopeV1 } from "../ai/types";
import type { LoreGuidedSceneCreationBriefV1 } from "./loreGuidedSceneCreation";
import { buildSceneCreatorBriefViewV1 } from "./loreGuidedPlaceCandidateGeneration";
import type { DestinationAccessHintV1, DestinationKnownPlaceV1, DestinationMentionV1, DestinationPlausibilityDecisionV1 } from "./destinationPlausibility";

export const DESTINATION_PLAUSIBILITY_ARBITRATION_CONTRACT_V1 = "destination-plausibility-arbitration/1" as const;

export interface DestinationPlausibilityArbiterConfigV1 {
  provider: ContractAiProviderV1;
  route: AiModelRouteV1 & { role: "destination_arbiter" };
  retryPolicy: AiRetryPolicyV1 & { role: "destination_arbiter" };
}

export interface DestinationPlausibilityArbitrationPayloadV1 {
  outcome: "CREATE_LOCAL" | "CLARIFY" | "TRAVEL_REQUIRED" | "REJECT_CONTRADICTION";
  allowedParentLocationRef: string | null;
  reason: string;
  accessHint: DestinationAccessHintV1 | null;
  sourceRefs: string[];
}

export async function arbitrateDestinationPlausibilityV1(input: {
  campaignId: string;
  operationId: string;
  mention: DestinationMentionV1;
  sourceSceneId: string;
  sourceLocationRef: string;
  allowedParentLocationRefs: string[];
  knownPlaces: DestinationKnownPlaceV1[];
  brief: LoreGuidedSceneCreationBriefV1;
  config: DestinationPlausibilityArbiterConfigV1;
}): Promise<
  | { ok: true; decision: DestinationPlausibilityDecisionV1; telemetry: AiCallTelemetryV1[] }
  | { ok: false; issues: string[]; telemetry: AiCallTelemetryV1[] }
> {
  const request = await buildDestinationArbitrationRequestV1(input);
  const run = await runAiPipelineCallV1({
    provider: input.config.provider,
    route: input.config.route,
    retryPolicy: input.config.retryPolicy,
    request
  });
  if (!run.acceptedOutput) return { ok: false, issues: run.validation.issues, telemetry: run.telemetry };
  const payload = (run.acceptedOutput as AiRoleOutputEnvelopeV1<DestinationPlausibilityArbitrationPayloadV1>).payload;
  const validation = validateArbitrationPayloadV1({
    payload,
    allowedParentLocationRefs: input.allowedParentLocationRefs,
    allowedSourceRefs: input.brief.sourceRefs
  });
  if (!validation.ok) return { ok: false, issues: validation.issues, telemetry: run.telemetry };
  return {
    ok: true,
    decision: {
      schemaVersion: 1,
      contractVersion: "destination-plausibility/1",
      outcome: payload.outcome,
      code: payload.outcome === "CREATE_LOCAL"
        ? input.mention.mentionKind === "DESCRIPTIVE_REQUEST"
          ? "EXPLICIT_LOCAL_DESCRIPTION_REQUIRES_ARBITRATION"
          : "UNKNOWN_NAMED_DESTINATION_REQUIRES_ARBITRATION"
        : payload.outcome === "CLARIFY"
          ? "DESTINATION_SCOPE_UNCLEAR"
          : payload.outcome === "TRAVEL_REQUIRED"
            ? "EXPLICIT_TRAVEL_DESTINATION"
            : "LORE_CONTRADICTION",
      destinationRef: null,
      allowedParentLocationRef: payload.allowedParentLocationRef,
      candidatePlaceRefs: [],
      reason: payload.reason,
      accessHint: payload.accessHint,
      sourceRefs: [...payload.sourceRefs],
      commitAuthority: false
    },
    telemetry: run.telemetry
  };
}

export async function buildDestinationArbitrationRequestV1(input: {
  campaignId: string;
  operationId: string;
  mention: DestinationMentionV1;
  sourceSceneId: string;
  sourceLocationRef: string;
  allowedParentLocationRefs: string[];
  knownPlaces: DestinationKnownPlaceV1[];
  brief: LoreGuidedSceneCreationBriefV1;
  config: DestinationPlausibilityArbiterConfigV1;
}): Promise<AiCallRequestV1> {
  const roleContextPack = {
    schemaVersion: 1,
    authority: "DECIDE_WITHOUT_COMMIT",
    mention: structuredClone(input.mention),
    sourceSceneId: input.sourceSceneId,
    sourceLocationRef: input.sourceLocationRef,
    allowedParentLocationRefs: [...input.allowedParentLocationRefs],
    allowedSourceRefs: [...input.brief.sourceRefs],
    knownPlaces: input.knownPlaces.map(place => ({
      placeRef: place.placeRef,
      displayName: place.displayName,
      aliases: [...place.aliases],
      parentLocationRef: place.parentLocationRef,
      sourceRefs: [...place.sourceRefs]
    })),
    lore: buildSceneCreatorBriefViewV1(input.brief),
    constraints: [
      "never create content",
      "never commit",
      "use only supplied lore",
      "a distant destination is TRAVEL_REQUIRED",
      "if a requested destination may be an existing known place, return CLARIFY instead of CREATE_LOCAL",
      "an ambiguity is CLARIFY",
      "a contradiction must cite supplied sourceRefs",
      "access restrictions never change the existence outcome; return them only in accessHint",
      "accessHint must remain null unless supplied lore directly supports the restriction"
    ]
  };
  const task = { requiredOutput: DESTINATION_PLAUSIBILITY_ARBITRATION_CONTRACT_V1 };
  return {
    schemaVersion: 1,
    callId: `${input.operationId}:ai:destination-arbiter:call`,
    operationId: input.operationId,
    attemptId: `${input.operationId}:ai:destination-arbiter:attempt:1`,
    campaignId: input.campaignId,
    snapshotId: `${input.operationId}:snapshot:destination-arbiter`,
    packId: `${input.operationId}:pack:destination-arbiter`,
    role: "destination_arbiter",
    contractVersion: DESTINATION_PLAUSIBILITY_ARBITRATION_CONTRACT_V1,
    modelRouteId: input.config.route.routeId,
    contextFingerprint: await computeJsonFingerprint({ roleContextPack, task }) as `sha256:${string}`,
    idempotencyKey: `${input.operationId}:destination-arbiter`,
    input: { instructionsRef: "destination-arbiter/plausibility/v1", roleContextPack, task },
    limits: {
      inputTokenBudget: Math.min(8_000, input.config.route.inputTokenLimit),
      outputTokenBudget: Math.min(800, input.config.route.outputTokenLimit),
      timeoutMs: input.config.route.timeoutMs
    }
  };
}

function validateArbitrationPayloadV1(input: {
  payload: DestinationPlausibilityArbitrationPayloadV1;
  allowedParentLocationRefs: string[];
  allowedSourceRefs: string[];
}): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const payload = input.payload;
  if (!payload.reason?.trim()) issues.push("Arbitration reason is required.");
  if (payload.outcome === "CREATE_LOCAL" && (payload.allowedParentLocationRef === null || !input.allowedParentLocationRefs.includes(payload.allowedParentLocationRef))) issues.push("CREATE_LOCAL requires an allowed parent.");
  if (payload.outcome !== "CREATE_LOCAL" && payload.allowedParentLocationRef !== null) issues.push("Only CREATE_LOCAL may select a parent.");
  if (payload.outcome === "REJECT_CONTRADICTION" && payload.sourceRefs.length === 0) issues.push("A contradiction requires sources.");
  if (payload.accessHint !== null) {
    if (payload.accessHint.authority !== "NON_COMMITTABLE_ACCESS_HINT") issues.push("accessHint authority is invalid.");
    if (!["CONTROLLED", "BLOCKED", "UNKNOWN"].includes(payload.accessHint.state)) issues.push("accessHint state is invalid.");
    if (!payload.accessHint.ownerDomain?.trim() || !payload.accessHint.reason?.trim()) issues.push("accessHint ownerDomain and reason are required.");
    if (!Array.isArray(payload.accessHint.requirements) || payload.accessHint.requirements.some(value => typeof value !== "string" || !value.trim())) issues.push("accessHint requirements are invalid.");
    if (!Array.isArray(payload.accessHint.sourceRefs) || payload.accessHint.sourceRefs.length === 0) issues.push("accessHint requires sources.");
    if (payload.accessHint.sourceRefs.some(ref => !input.allowedSourceRefs.includes(ref))) issues.push("accessHint cited a source outside the brief.");
  }
  if (payload.sourceRefs.some(ref => !input.allowedSourceRefs.includes(ref))) issues.push("Arbitration cited a source outside the brief.");
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
