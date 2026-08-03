import { coreError, type CampaignRecord, type CampaignRepository, type OperationRecord, type Result, type WriterLease } from "../core";
import { validateDynamicCreationProposalV1 } from "../ai/validation";
import type { AiCallTelemetryV1, DynamicCreationValidationPolicyV1 } from "../ai/types";
import type { NarrativeDomainCommandV1 } from "./domainCommands";
import type { NarrativeIntentInterpretationV1 } from "./intentClarification";
import type { LoreGuidedSceneCreationBriefV1 } from "./loreGuidedSceneCreation";
import {
  generateLoreGuidedPlaceCandidateV2,
  type LoreGuidedPlaceCandidateGeneratorConfigV2
} from "./loreGuidedPlaceCandidateGeneration";
import {
  type DynamicPlaceEntryCreativePreparationV1,
  type DynamicPlaceEntryPreparationPortV1,
  type DynamicPlaceEntryPreparationV1
} from "./dynamicPlaceEntryRuntime";
import {
  validatePlaceCreationProposalV1,
  type PlaceCreationValidationPolicyV1
} from "./placeCreationValidation";
import type { PlayableSceneStateV1 } from "./playableScene";
import type { SceneTransitionTopologyV1 } from "./sceneTransition";
import type { DestinationPlausibilityDecisionV1 } from "./destinationPlausibility";
import { buildSceneCreatorEpistemicContextV1 } from "./sceneCreatorEpistemicContext";
import { loadActiveCampaignCharacterProfileV1 } from "../bootstrap";

export interface LoreGuidedDynamicPlaceCreativeContextV1 {
  brief: LoreGuidedSceneCreationBriefV1;
  dynamicCreationPolicy: DynamicCreationValidationPolicyV1;
  placeValidationPolicy: PlaceCreationValidationPolicyV1;
  topology: SceneTransitionTopologyV1;
  sourceSceneId: string;
  sourceLocationRef: string;
  sourceBoundaryRef: string;
  requestedDestinationDescription: string;
  requestedDestinationName?: string | null;
  destinationDecision?: DestinationPlausibilityDecisionV1;
  generatorConfig: LoreGuidedPlaceCandidateGeneratorConfigV2;
}

export interface LoreGuidedDynamicPlaceCreativePreparationV1 extends DynamicPlaceEntryCreativePreparationV1 {
  context: LoreGuidedDynamicPlaceCreativeContextV1;
  proposalId: string;
  aiTelemetry: AiCallTelemetryV1[];
}

export interface LoreGuidedDynamicPlaceContextPortV1 {
  canCreate(input: {
    repository: CampaignRepository;
    campaignId: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
    destinationDecision?: DestinationPlausibilityDecisionV1;
  }): Promise<boolean> | boolean;
  buildContext(input: {
    repository: CampaignRepository;
    campaign: CampaignRecord;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
    destinationDecision?: DestinationPlausibilityDecisionV1;
  }): Promise<Result<LoreGuidedDynamicPlaceCreativeContextV1>>;
}

export interface LoreGuidedDynamicPlaceWorldPortV1 {
  prepare(input: {
    repository: CampaignRepository;
    campaign: CampaignRecord;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
    creative: LoreGuidedDynamicPlaceCreativePreparationV1;
    writerLease: WriterLease;
  }): Promise<Result<DynamicPlaceEntryPreparationV1>>;
}

/** Production adapter: lore/context -> AI proposal -> generic gates -> world preparation. */
export function createLoreGuidedDynamicPlacePreparationPortV1(input: {
  contextPort: LoreGuidedDynamicPlaceContextPortV1;
  worldPort: LoreGuidedDynamicPlaceWorldPortV1;
}): DynamicPlaceEntryPreparationPortV1<LoreGuidedDynamicPlaceCreativePreparationV1> {
  return {
    canHandle: request => input.contextPort.canCreate(request),
    async prepareCreative(request) {
      const context = await input.contextPort.buildContext(request);
      if (!context.ok) return context;
      const canLoadActiveProfile = typeof (request.repository as unknown as { getCampaign?: unknown }).getCampaign === "function";
      const activeProfile = canLoadActiveProfile
        ? await loadActiveCampaignCharacterProfileV1({
            repository: request.repository,
            campaignId: request.campaign.campaignId
          })
        : null;
      if (activeProfile !== null && !activeProfile.ok && activeProfile.error.code !== "NOT_FOUND") return activeProfile;
      const epistemicContext = await buildSceneCreatorEpistemicContextV1({
        repository: request.repository,
        campaignId: request.campaign.campaignId,
        brief: context.value.brief,
        audienceActorRef: activeProfile?.ok ? `actor:${activeProfile.value.actorId}` : null
      });
      const generated = await generateLoreGuidedPlaceCandidateV2({
        campaignId: request.campaign.campaignId,
        operationId: request.operation.operationId,
        brief: context.value.brief,
        sourceSceneId: context.value.sourceSceneId,
        sourceBoundaryRef: context.value.sourceBoundaryRef,
        allowedParentLocationRefs: context.value.placeValidationPolicy.allowedParentLocationRefs,
        allowedPersistenceDepths: context.value.placeValidationPolicy.allowedPersistenceDepths.filter((depth): depth is "LIGHT_REFERENCE" | "FULL_ENTITY" => depth !== "SCENE_EPHEMERAL"),
        requestedDestinationDescription: context.value.requestedDestinationDescription,
        requestedDestinationName: context.value.requestedDestinationName ?? null,
        epistemicContext,
        config: context.value.generatorConfig
      });
      if (!generated.ok) return failure("narrative.dynamic-place.ai-candidate-rejected", generated.issues, {
        aiTelemetry: generated.telemetry.map(metric => ({
          role: metric.role,
          modelId: metric.modelId,
          latencyMs: metric.latencyMs,
          inputTokens: metric.inputTokens,
          outputTokens: metric.outputTokens,
          finishReason: metric.finishReason,
          inputTokenBudget: metric.inputTokenBudget,
          outputTokenBudget: metric.outputTokenBudget,
          contextChars: metric.contextChars,
          schemaChars: metric.schemaChars
        }))
      });
      if (
        context.value.requestedDestinationName
        && normalizeDestinationName(generated.candidate.displayName)
          !== normalizeDestinationName(context.value.requestedDestinationName)
      ) {
        return failure("narrative.dynamic-place.requested-destination-identity-mismatch", [
          `The generated place "${generated.candidate.displayName}" does not preserve the requested visible destination "${context.value.requestedDestinationName}".`
        ]);
      }
      const proposal = completeRequiredPlaceConnectionsV1({
        proposal: generated.proposal,
        sourceSceneId: context.value.sourceSceneId,
        sourceLocationRef: context.value.sourceLocationRef,
        sourceBoundaryRef: context.value.sourceBoundaryRef,
        loreAnchorEntityId: context.value.brief.anchorEntityId,
        loreGeographicChain: context.value.brief.geographicChain
      });
      const genericValidation = validateDynamicCreationProposalV1(proposal, context.value.dynamicCreationPolicy);
      if (!genericValidation.ok) return failure("narrative.dynamic-place.generic-gate-rejected", genericValidation.issues);
      const placeValidation = validatePlaceCreationProposalV1({
        proposal: genericValidation.proposal,
        topology: context.value.topology,
        policy: context.value.placeValidationPolicy
      });
      if (!placeValidation.ok) return failure("narrative.dynamic-place.place-gate-rejected", placeValidation.issues);
      return {
        ok: true,
        value: {
          validation: placeValidation,
          context: context.value,
          proposalId: generated.proposal.proposalId,
          aiTelemetry: generated.telemetry
        }
      };
    },
    prepareWorldCommit: request => input.worldPort.prepare(request)
  };
}

/** Mechanical V1 topology belongs to the runtime; unmaterialized AI exits must never enter the world graph. */
function completeRequiredPlaceConnectionsV1(input: {
  proposal: import("../ai/types").DynamicCreationProposalV1;
  sourceSceneId: string;
  sourceLocationRef: string;
  sourceBoundaryRef: string;
  loreAnchorEntityId: string;
  loreGeographicChain: string[];
}): import("../ai/types").DynamicCreationProposalV1 {
  const properties = structuredClone(input.proposal.proposedProperties);
  const proposedPlaceRef = typeof properties.proposedPlaceRef === "string" ? properties.proposedPlaceRef : "";
  const arrivalSceneId = typeof properties.arrivalSceneId === "string" ? properties.arrivalSceneId : "";
  const sourceRefs = input.proposal.existingFactRefsUsed.length > 0
    ? [...input.proposal.existingFactRefsUsed]
    : [`proposal:${input.proposal.proposalId}`];
  const connections = [
    { sourceSceneId: input.sourceSceneId, boundaryRef: input.sourceBoundaryRef, destinationRef: proposedPlaceRef, scale: "LOCAL", sourceRefs },
    { sourceSceneId: arrivalSceneId, boundaryRef: "poi:return-to-source", destinationRef: input.sourceLocationRef, scale: "LOCAL", sourceRefs }
  ];
  return {
    ...structuredClone(input.proposal),
    proposedProperties: {
      ...properties,
      loreAnchorEntityId: input.loreAnchorEntityId,
      loreGeographicChain: [...input.loreGeographicChain],
      connectionIntents: connections
    }
  };
}

function normalizeDestinationName(value: string): string {
  return value.trim().toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function failure(messageKey: string, issues: string[], details: Record<string, unknown> = {}): Result<never> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues, ...details } as never) };
}
