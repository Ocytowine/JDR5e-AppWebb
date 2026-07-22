import { computeJsonFingerprint } from "../core";
import type { ContractAiProviderV1 } from "../ai/FakeContractAiProvider";
import { runAiPipelineCallV1 } from "../ai/pipeline";
import type { AiCallRequestV1, AiCallTelemetryV1, AiModelRouteV1, AiRetryPolicyV1, AiRoleOutputEnvelopeV1, DynamicCreationProposalV1 } from "../ai/types";
import {
  buildDynamicPlaceCreationProposalV1,
  type LoreGuidedPlaceCandidateV1,
  type LoreGuidedSceneCreationBriefV1
} from "./loreGuidedSceneCreation";

export const LORE_GUIDED_PLACE_CANDIDATE_CONTRACT_V1 = "lore-guided-place-candidate/1" as const;

export interface LoreGuidedPlaceCandidateGeneratorConfigV1 {
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
  requestedDestinationDescription: string;
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

async function buildRequest(input: {
  campaignId: string;
  operationId: string;
  brief: LoreGuidedSceneCreationBriefV1;
  sourceSceneId: string;
  sourceBoundaryRef: string;
  requestedDestinationDescription: string;
  config: LoreGuidedPlaceCandidateGeneratorConfigV1;
}): Promise<AiCallRequestV1> {
  const roleContextPack = {
    schemaVersion: 1,
    authority: "PROPOSE_ONLY",
    brief: input.brief,
    sourceSceneId: input.sourceSceneId,
    sourceBoundaryRef: input.sourceBoundaryRef,
    requestedDestinationDescription: input.requestedDestinationDescription,
    constraints: ["no commit", "no secret reveal", "no durable NPC materialization", "sourceRefs required on topology", "the incoming connection must use sourceSceneId and sourceBoundaryRef exactly"]
  };
  const task = { requiredOutput: LORE_GUIDED_PLACE_CANDIDATE_CONTRACT_V1 };
  return {
    schemaVersion: 1,
    callId: `${input.operationId}:ai:scene-creator:call`,
    operationId: input.operationId,
    attemptId: `${input.operationId}:ai:scene-creator:attempt:1`,
    campaignId: input.campaignId,
    snapshotId: `${input.operationId}:snapshot:scene-creator`,
    packId: `${input.operationId}:pack:scene-creator`,
    role: "scene_creator",
    contractVersion: LORE_GUIDED_PLACE_CANDIDATE_CONTRACT_V1,
    modelRouteId: input.config.route.routeId,
    contextFingerprint: await computeJsonFingerprint({ roleContextPack, task }) as `sha256:${string}`,
    idempotencyKey: `${input.operationId}:scene-creator`,
    input: { instructionsRef: "scene-creator/lore-guided-place/v1", roleContextPack, task },
    limits: { inputTokenBudget: Math.min(2_000, input.config.route.inputTokenLimit), outputTokenBudget: Math.min(1_500, input.config.route.outputTokenLimit), timeoutMs: input.config.route.timeoutMs }
  };
}
