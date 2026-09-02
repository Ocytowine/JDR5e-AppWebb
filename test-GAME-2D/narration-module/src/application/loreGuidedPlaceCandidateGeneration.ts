import { computeJsonFingerprint } from "../core";
import type { ContractAiProviderV1 } from "../ai/FakeContractAiProvider";
import { runAiPipelineCallV1 } from "../ai/pipeline";
import type { AiCallRequestV1, AiCallTelemetryV1, AiModelRouteV1, AiRetryPolicyV1, AiRoleOutputEnvelopeV1, DynamicCreationProposalV1 } from "../ai/types";
import {
  buildDynamicPlaceCreationProposalV1,
  buildDynamicPlaceCreationProposalV2,
  type LoreGuidedPlaceCandidateV1,
  type LoreGuidedPlaceCandidateV2,
  type LoreGuidedSceneCreationBriefV1
} from "./loreGuidedSceneCreation";
import type { SceneCreatorEpistemicContextV1 } from "./sceneCreatorEpistemicContext";
import { prepareNarrativeRoleContextV1 } from "./narrativeContextManifest";

export const LORE_GUIDED_PLACE_CANDIDATE_CONTRACT_V1 = "lore-guided-place-candidate/1" as const;
export const LORE_GUIDED_PLACE_CANDIDATE_CONTRACT_V2 = "lore-guided-place-candidate/2" as const;

export interface LoreGuidedPlaceCandidateGeneratorConfigV1 {
  provider: ContractAiProviderV1;
  route: AiModelRouteV1 & { role: "scene_creator" };
  retryPolicy: AiRetryPolicyV1 & { role: "scene_creator" };
}

export interface LoreGuidedPlaceCandidateGeneratorConfigV2 {
  provider: ContractAiProviderV1;
  route: AiModelRouteV1 & { role: "scene_creator" };
  retryPolicy: AiRetryPolicyV1 & { role: "scene_creator" };
}

export type LoreGuidedPlaceCandidateGenerationResultV1 =
  | { ok: true; candidate: LoreGuidedPlaceCandidateV1; proposal: DynamicCreationProposalV1; telemetry: AiCallTelemetryV1[] }
  | { ok: false; code: "AI_CANDIDATE_REJECTED"; issues: string[]; telemetry: AiCallTelemetryV1[] };

/** AI proposes creative material only; conversion to a proposal is still non-committable. */
export async function generateLoreGuidedPlaceCandidateV1(input: {
  campaignId: string;
  operationId: string;
  brief: LoreGuidedSceneCreationBriefV1;
  sourceSceneId: string;
  sourceBoundaryRef: string;
  allowedParentLocationRefs: string[];
  allowedPersistenceDepths: Array<"LIGHT_REFERENCE" | "FULL_ENTITY">;
  requestedDestinationDescription: string;
  requestedDestinationName?: string | null;
  epistemicContext?: SceneCreatorEpistemicContextV1;
  config: LoreGuidedPlaceCandidateGeneratorConfigV1;
}): Promise<LoreGuidedPlaceCandidateGenerationResultV1> {
  const request = await buildRequest(input);
  const run = await runAiPipelineCallV1({
    provider: input.config.provider,
    route: input.config.route,
    retryPolicy: input.config.retryPolicy,
    request
  });
  const telemetry = run.telemetry;
  if (!run.acceptedOutput) return { ok: false, code: "AI_CANDIDATE_REJECTED", issues: run.validation.issues, telemetry };
  const candidate = (run.acceptedOutput as AiRoleOutputEnvelopeV1<LoreGuidedPlaceCandidateV1>).payload;
  const built = buildDynamicPlaceCreationProposalV1({ brief: input.brief, candidate });
  return built.ok
    ? { ok: true, candidate, proposal: built.proposal, telemetry }
    : { ok: false, code: "AI_CANDIDATE_REJECTED", issues: built.issues, telemetry };
}

export async function generateLoreGuidedPlaceCandidateV2(input: {
  campaignId: string;
  operationId: string;
  brief: LoreGuidedSceneCreationBriefV1;
  sourceSceneId: string;
  sourceBoundaryRef: string;
  allowedParentLocationRefs: string[];
  allowedPersistenceDepths: Array<"LIGHT_REFERENCE" | "FULL_ENTITY">;
  requestedDestinationDescription: string;
  requestedDestinationName?: string | null;
  epistemicContext?: SceneCreatorEpistemicContextV1;
  config: LoreGuidedPlaceCandidateGeneratorConfigV2;
}): Promise<
  | { ok: true; candidate: LoreGuidedPlaceCandidateV2; proposal: DynamicCreationProposalV1; telemetry: AiCallTelemetryV1[] }
  | { ok: false; code: "AI_CANDIDATE_REJECTED"; issues: string[]; telemetry: AiCallTelemetryV1[] }
> {
  const request = await buildRequest(input, LORE_GUIDED_PLACE_CANDIDATE_CONTRACT_V2);
  const startedAt = Date.now();
  const run = await runAiPipelineCallV1({
    request,
    route: input.config.route,
    retryPolicy: input.config.retryPolicy,
    provider: input.config.provider
  });
  const telemetry: AiCallTelemetryV1[] = run.telemetry.length > 0
    ? run.telemetry
    : [{
        schemaVersion: 1,
        providerId: input.config.route.providerId,
        modelId: input.config.route.modelId,
        reasoningEffort: null,
        role: "scene_creator",
        attemptId: request.attemptId,
        latencyMs: Date.now() - startedAt,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        finishReason: "provider_metrics_missing",
        inputTokenBudget: request.limits.inputTokenBudget,
        outputTokenBudget: request.limits.outputTokenBudget,
        contextChars: JSON.stringify(request.input).length,
        schemaChars: null
      }];
  if (!run.acceptedOutput) return { ok: false, code: "AI_CANDIDATE_REJECTED", issues: run.validation.issues, telemetry };
  const candidate = (run.acceptedOutput as AiRoleOutputEnvelopeV1<LoreGuidedPlaceCandidateV2>).payload;
  const built = buildDynamicPlaceCreationProposalV2({ brief: input.brief, candidate });
  return built.ok
    ? { ok: true, candidate, proposal: built.proposal, telemetry }
    : { ok: false, code: "AI_CANDIDATE_REJECTED", issues: built.issues, telemetry };
}

async function buildRequest(input: {
  campaignId: string;
  operationId: string;
  brief: LoreGuidedSceneCreationBriefV1;
  sourceSceneId: string;
  sourceBoundaryRef: string;
  allowedParentLocationRefs: string[];
  allowedPersistenceDepths: Array<"LIGHT_REFERENCE" | "FULL_ENTITY">;
  requestedDestinationDescription: string;
  requestedDestinationName?: string | null;
  epistemicContext?: SceneCreatorEpistemicContextV1;
  config: LoreGuidedPlaceCandidateGeneratorConfigV1 | LoreGuidedPlaceCandidateGeneratorConfigV2;
}, contractVersion: typeof LORE_GUIDED_PLACE_CANDIDATE_CONTRACT_V1 | typeof LORE_GUIDED_PLACE_CANDIDATE_CONTRACT_V2 = LORE_GUIDED_PLACE_CANDIDATE_CONTRACT_V1): Promise<AiCallRequestV1> {
  const context = {
    schemaVersion: 1,
    authority: "PROPOSE_ONLY",
    brief: buildSceneCreatorBriefViewV1(input.brief),
    epistemicContext: input.epistemicContext ?? {
      schemaVersion: 1,
      authoritativeTruths: [],
      campaignCommitments: [],
      attributedTestimonies: [],
      testimonyPolicy: "ATTRIBUTED_SPEECH_NEVER_OBJECTIVE_TRUTH",
      authority: "SEPARATED_SCENE_CREATION_CONTEXT"
    },
    sourceSceneId: input.sourceSceneId,
    sourceBoundaryRef: input.sourceBoundaryRef,
    allowedParentLocationRefs: [...input.allowedParentLocationRefs],
    allowedPersistenceDepths: [...input.allowedPersistenceDepths],
    requestedDestinationDescription: input.requestedDestinationDescription,
    requestedDestinationName: input.requestedDestinationName ?? null,
    constraints: contractVersion === LORE_GUIDED_PLACE_CANDIDATE_CONTRACT_V2
      ? ["no commit", "no secret reveal", "populationRoles must be short singular role labels without actions or descriptions", "no durable NPC materialization", "no topology proposal", "requestedDepth must be one of allowedPersistenceDepths", "parentLocationRef must be one of allowedParentLocationRefs"]
      : ["no commit", "no secret reveal", "populationRoles must be short singular role labels without actions or descriptions", "no durable NPC materialization", "sourceRefs required on topology", "requestedDepth must be one of allowedPersistenceDepths", "parentLocationRef must be one of allowedParentLocationRefs", "the incoming connection must use sourceSceneId and sourceBoundaryRef exactly"]
  };
  const task = { context, requiredOutput: contractVersion };
  const snapshotId = `${input.operationId}:snapshot:scene-creator`;
  const preparedContext = prepareNarrativeRoleContextV1({
    manifestId: `${input.operationId}:context-manifest:scene-creator`,
    operationId: input.operationId,
    campaignId: input.campaignId,
    snapshot: { snapshotId, campaignRevision: null, sceneId: null, sceneVersion: null },
    role: "scene_creator",
    profileId: `${input.operationId}:lore-guided-place-creation`,
    purpose: "Proposer un lieu dans les seules frontières et influences autorisées.",
    taskContextRef: "task.context",
    authority: "PROPOSE_ONLY",
    projections: [{
      projectionKey: "creation-brief",
      kind: "CREATION_BRIEF",
      payload: {
        brief: context.brief,
        sourceSceneId: context.sourceSceneId,
        sourceBoundaryRef: context.sourceBoundaryRef,
        requestedDestinationDescription: context.requestedDestinationDescription,
        requestedDestinationName: context.requestedDestinationName
      },
      ownerId: "application/lore-guided-scene-creation",
      sourceRefs: input.brief.sourceRefs,
      sourceVersion: input.brief.contractVersion,
      required: true
    }, {
      projectionKey: "lore-influences",
      kind: "LORE_INFLUENCES",
      payload: { brief: context.brief, epistemicContext: context.epistemicContext },
      ownerId: "application/campaign-lore-projection",
      sourceRefs: input.brief.sourceRefs,
      sourceVersion: "scene-creator-epistemic-context/1",
      required: true
    }, {
      projectionKey: "creation-policy",
      kind: "CREATION_POLICY",
      payload: {
        allowedParentLocationRefs: context.allowedParentLocationRefs,
        allowedPersistenceDepths: context.allowedPersistenceDepths,
        constraints: context.constraints
      },
      ownerId: "application/place-creation-runtime",
      sourceRefs: [input.sourceBoundaryRef, ...input.allowedParentLocationRefs],
      sourceVersion: "place-creation-policy/1",
      required: true
    }]
  });
  const roleContextPack = preparedContext.roleContextPack;
  return {
    schemaVersion: 1,
    callId: `${input.operationId}:ai:scene-creator:call`,
    operationId: input.operationId,
    attemptId: `${input.operationId}:ai:scene-creator:attempt:1`,
    campaignId: input.campaignId,
    snapshotId,
    packId: `${input.operationId}:pack:scene-creator`,
    role: "scene_creator",
    contractVersion,
    modelRouteId: input.config.route.routeId,
    contextFingerprint: await computeJsonFingerprint({ contextManifest: preparedContext.manifest, task }) as `sha256:${string}`,
    idempotencyKey: `${input.operationId}:scene-creator`,
    input: { instructionsRef: contractVersion === LORE_GUIDED_PLACE_CANDIDATE_CONTRACT_V2 ? "scene-creator/lore-guided-place/v2" : "scene-creator/lore-guided-place/v1", roleContextPack, task },
    limits: { inputTokenBudget: input.config.route.inputTokenLimit, outputTokenBudget: Math.min(2_000, input.config.route.outputTokenLimit), timeoutMs: input.config.route.timeoutMs }
  };
}

/** Actor-specific view: authority stays in the full local brief; the model receives only useful lore and allowed refs. */
export function buildSceneCreatorBriefViewV1(brief: LoreGuidedSceneCreationBriefV1) {
  const compact = (values: LoreGuidedSceneCreationBriefV1["strictConstraints"]) => values.map(value => ({
    fieldPath: value.fieldPath,
    text: value.effectiveText,
    sourceRefs: value.effectiveSourceRefs
  }));
  return {
    contractVersion: brief.contractVersion,
    creationType: brief.creationType,
    anchorEntityId: brief.anchorEntityId,
    geographicChain: brief.geographicChain,
    strictConstraints: compact(brief.strictConstraints),
    localGuidance: compact(brief.localGuidance),
    regionalGuidance: compact(brief.regionalGuidance),
    unresolvedDimensions: brief.unresolvedDimensions,
    allowedSourceRefs: brief.sourceRefs
  };
}
