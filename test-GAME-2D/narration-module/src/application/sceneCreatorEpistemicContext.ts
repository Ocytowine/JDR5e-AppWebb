import type { CampaignId, CampaignRepository, JsonObject } from "../core";
import { loadTestimonyRegistryV1 } from "./knowledgeAuthority";
import type { KnowledgeClaimV1, TestimonyRecordV1 } from "./knowledgeClaims";
import type { LoreGuidedSceneCreationBriefV1 } from "./loreGuidedSceneCreation";

export interface SceneCreatorAuthoritativeTruthV1 extends JsonObject {
  text: string;
  sourceRefs: string[];
  authority: "LORE_INITIAL" | "CAMPAIGN_PROJECTION";
}

export interface SceneCreatorCampaignCommitmentV1 extends JsonObject {
  commitmentRef: string;
  text: string;
  sourceRefs: string[];
}

export interface SceneCreatorAttributedClaimV1 extends JsonObject {
  claimRef: string;
  proposition: string;
  publicDelivery: "ASSERTION" | "QUALIFIED_BELIEF" | "UNCERTAINTY";
}

export interface SceneCreatorAttributedTestimonyV1 extends JsonObject {
  testimonyRef: string;
  speakerActorRef: string;
  sceneRef: string;
  utteranceRef: string;
  claims: SceneCreatorAttributedClaimV1[];
  assertsObjectiveTruth: false;
}

export interface SceneCreatorEpistemicContextV1 extends JsonObject {
  schemaVersion: 1;
  authoritativeTruths: SceneCreatorAuthoritativeTruthV1[];
  campaignCommitments: SceneCreatorCampaignCommitmentV1[];
  attributedTestimonies: SceneCreatorAttributedTestimonyV1[];
  testimonyPolicy: "ATTRIBUTED_SPEECH_NEVER_OBJECTIVE_TRUTH";
  authority: "SEPARATED_SCENE_CREATION_CONTEXT";
}

export async function buildSceneCreatorEpistemicContextV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  brief: LoreGuidedSceneCreationBriefV1;
  audienceActorRef: string | null;
  maximumTestimonies?: number;
}): Promise<SceneCreatorEpistemicContextV1> {
  if (typeof (input.repository as unknown as { getAggregate?: unknown }).getAggregate !== "function") {
    return projectSceneCreatorEpistemicContextV1({
      brief: input.brief,
      claims: [],
      testimonies: [],
      audienceActorRef: input.audienceActorRef,
      maximumTestimonies: input.maximumTestimonies
    });
  }
  const testimonyRegistry = await loadTestimonyRegistryV1(input.repository, input.campaignId);
  const claims = testimonyRegistry.ok ? testimonyRegistry.value.state.claims : [];
  const testimonies = testimonyRegistry.ok ? testimonyRegistry.value.state.testimonies : [];
  return projectSceneCreatorEpistemicContextV1({
    brief: input.brief,
    claims,
    testimonies,
    audienceActorRef: input.audienceActorRef,
    maximumTestimonies: input.maximumTestimonies
  });
}

export function projectSceneCreatorEpistemicContextV1(input: {
  brief: LoreGuidedSceneCreationBriefV1;
  claims: KnowledgeClaimV1[];
  testimonies: TestimonyRecordV1[];
  audienceActorRef: string | null;
  maximumTestimonies?: number;
}): SceneCreatorEpistemicContextV1 {
  const claimByRef = new Map(input.claims.map(claim => [claim.claimRef, claim] as const));
  const maximumTestimonies = Math.max(0, Math.min(input.maximumTestimonies ?? 8, 12));
  const audienceTestimonies = input.audienceActorRef === null
    ? []
    : input.testimonies.filter(testimony => testimony.audienceActorRefs.includes(input.audienceActorRef as string));
  return {
    schemaVersion: 1,
    authoritativeTruths: input.brief.strictConstraints.map(influence => ({
      text: influence.effectiveText,
      sourceRefs: [...influence.effectiveSourceRefs],
      authority: influence.authority
    })),
    campaignCommitments: [
      ...input.brief.strictConstraints,
      ...input.brief.localGuidance,
      ...input.brief.regionalGuidance
    ].filter(influence => influence.authority === "CAMPAIGN_PROJECTION" && influence.campaignProjectionId !== null)
      .map(influence => ({
        commitmentRef: `campaign-projection:${influence.campaignProjectionId}`,
        text: influence.effectiveText,
        sourceRefs: [...influence.effectiveSourceRefs]
      })),
    attributedTestimonies: audienceTestimonies.slice(-maximumTestimonies).flatMap(testimony => {
      const attributedClaims = testimony.claims.flatMap(link => {
        const claim = claimByRef.get(link.claimRef);
        return claim === undefined ? [] : [{
          claimRef: claim.claimRef,
          proposition: claim.proposition,
          publicDelivery: link.publicDelivery
        }];
      });
      if (attributedClaims.length === 0) return [];
      return [{
        testimonyRef: testimony.testimonyRef,
        speakerActorRef: testimony.speakerActorRef,
        sceneRef: testimony.sceneRef,
        utteranceRef: testimony.utteranceRef,
        claims: attributedClaims,
        assertsObjectiveTruth: false as const
      }];
    }),
    testimonyPolicy: "ATTRIBUTED_SPEECH_NEVER_OBJECTIVE_TRUTH",
    authority: "SEPARATED_SCENE_CREATION_CONTEXT"
  };
}
