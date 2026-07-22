import { coreError, type CampaignRecord, type CampaignRepository, type OperationRecord, type Result, type WriterLease } from "../core";
import { validateDynamicCreationProposalV1, type DynamicCreationValidationPolicyV1 } from "../ai";
import type { NarrativeDomainCommandV1 } from "./domainCommands";
import type { NarrativeIntentInterpretationV1 } from "./intentClarification";
import type { LoreGuidedSceneCreationBriefV1 } from "./loreGuidedSceneCreation";
import {
  generateLoreGuidedPlaceCandidateV1,
  type LoreGuidedPlaceCandidateGeneratorConfigV1
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

export interface LoreGuidedDynamicPlaceCreativeContextV1 {
  brief: LoreGuidedSceneCreationBriefV1;
  dynamicCreationPolicy: DynamicCreationValidationPolicyV1;
  placeValidationPolicy: PlaceCreationValidationPolicyV1;
  topology: SceneTransitionTopologyV1;
  sourceSceneId: string;
  requestedDestinationDescription: string;
  generatorConfig: LoreGuidedPlaceCandidateGeneratorConfigV1;
}

export interface LoreGuidedDynamicPlaceCreativePreparationV1 extends DynamicPlaceEntryCreativePreparationV1 {
  context: LoreGuidedDynamicPlaceCreativeContextV1;
  proposalId: string;
}

export interface LoreGuidedDynamicPlaceContextPortV1 {
  canCreate(input: {
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<boolean> | boolean;
  buildContext(input: {
    repository: CampaignRepository;
    campaign: CampaignRecord;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
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
      const generated = await generateLoreGuidedPlaceCandidateV1({
        campaignId: request.campaign.campaignId,
        operationId: request.operation.operationId,
        brief: context.value.brief,
        sourceSceneId: context.value.sourceSceneId,
        requestedDestinationDescription: context.value.requestedDestinationDescription,
        config: context.value.generatorConfig
      });
      if (!generated.ok) return failure("narrative.dynamic-place.ai-candidate-rejected", generated.issues);
      const genericValidation = validateDynamicCreationProposalV1(generated.proposal, context.value.dynamicCreationPolicy);
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
          proposalId: generated.proposal.proposalId
        }
      };
    },
    prepareWorldCommit: request => input.worldPort.prepare(request)
  };
}

function failure(messageKey: string, issues: string[]): Result<never> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues }) };
}
