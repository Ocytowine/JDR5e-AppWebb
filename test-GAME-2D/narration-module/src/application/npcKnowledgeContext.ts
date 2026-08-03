import type { CampaignId, CampaignRepository, JsonObject } from "../core";
import type { ActorClaimPerspectiveV1, KnowledgeClaimV1 } from "./knowledgeClaims";
import {
  loadActorKnowledgeRegistryV1,
  loadActorPerspectiveRegistryV1,
  loadTestimonyRegistryV1
} from "./knowledgeAuthority";
import type { ActorKnowledgeAcquisitionV1, ObjectiveClaimResolutionV1 } from "./knowledgeClaims";
import { loadClaimResolutionRegistryV1 } from "./knowledgeResolutionAuthority";
import {
  loadSocialActorRegistryV1,
  type DurableSocialBeliefV1,
  type SocialActorStateV1
} from "./socialActorAuthority";

export type NpcAuthorizedEpistemicBasisV1 = "known" | "believed" | "uncertain";

export interface NpcAuthorizedClaimPerspectiveV1 extends JsonObject {
  claimRef: string;
  proposition: string;
  epistemicBasis: NpcAuthorizedEpistemicBasisV1;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  mayBeFalse: boolean;
}

export interface NpcAuthorizedLegacyBeliefV1 extends JsonObject {
  beliefRef: string;
  proposition: string;
  epistemicBasis: "believed";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  mayBeFalse: boolean;
}

export interface NpcAuthorizedResolvedClaimV1 extends JsonObject {
  resolutionRef: string;
  claimRef: string;
  proposition: string;
  resolution: "CONFIRMED" | "REFUTED";
  epistemicBasis: "known";
}

/**
 * Private, actor-scoped projection for npc_performer. It intentionally omits
 * private truth references, deception causes, support refs, relationships,
 * concerns, promises and visibility constraints.
 */
export interface NpcAuthorizedKnowledgeContextV1 extends JsonObject {
  schemaVersion: 1;
  actorRef: string;
  knownFactRefs: string[];
  resolvedClaims: NpcAuthorizedResolvedClaimV1[];
  claimPerspectives: NpcAuthorizedClaimPerspectiveV1[];
  legacyBeliefs: NpcAuthorizedLegacyBeliefV1[];
  intentionalDeceptionAllowed: false;
  authority: "PRIVATE_ACTOR_KNOWLEDGE_FOR_PERFORMANCE_ONLY";
}

export async function loadNpcAuthorizedKnowledgeContextV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  actorId: string;
}): Promise<NpcAuthorizedKnowledgeContextV1> {
  const actorRef = actorKnowledgeRefV1(input.actorId);
  const [social, perspectives, testimonies, actorKnowledge, resolutions] = await Promise.all([
    loadSocialActorRegistryV1(input.repository, input.campaignId),
    loadActorPerspectiveRegistryV1(input.repository, input.campaignId, actorRef),
    loadTestimonyRegistryV1(input.repository, input.campaignId),
    loadActorKnowledgeRegistryV1(input.repository, input.campaignId, actorRef),
    loadClaimResolutionRegistryV1(input.repository, input.campaignId)
  ]);
  const socialActor = social.ok
    ? social.value.state.actors.find(actor => sameActorId(actor.actorId, input.actorId)) ?? null
    : null;
  return projectNpcAuthorizedKnowledgeContextV1({
    actorRef,
    socialActor,
    perspectives: perspectives.ok ? perspectives.value.state.perspectives : [],
    claims: testimonies.ok ? testimonies.value.state.claims : [],
    acquisitions: actorKnowledge.ok ? actorKnowledge.value.state.acquisitions : [],
    resolutions: resolutions.ok ? resolutions.value.state.resolutions : []
  });
}

export function projectNpcAuthorizedKnowledgeContextV1(input: {
  actorRef: string;
  socialActor: SocialActorStateV1 | null;
  perspectives: ActorClaimPerspectiveV1[];
  claims: KnowledgeClaimV1[];
  acquisitions?: ActorKnowledgeAcquisitionV1[];
  resolutions?: ObjectiveClaimResolutionV1[];
}): NpcAuthorizedKnowledgeContextV1 {
  const claimByRef = new Map(input.claims.map(claim => [claim.claimRef, claim] as const));
  const resolutionByRef = new Map((input.resolutions ?? []).map(resolution => [resolution.resolutionRef, resolution] as const));
  const resolvedClaims = (input.acquisitions ?? []).flatMap(acquisition => {
    if (acquisition.status !== "CONFIRMED" && acquisition.status !== "REFUTED") return [];
    const resolution = resolutionByRef.get(acquisition.channelRef);
    const claim = claimByRef.get(acquisition.claimRef);
    if (resolution === undefined || claim === undefined || resolution.resolution !== acquisition.status) return [];
    return [{
      resolutionRef: resolution.resolutionRef,
      claimRef: claim.claimRef,
      proposition: claim.proposition,
      resolution: resolution.resolution,
      epistemicBasis: "known" as const
    }];
  }).sort((left, right) => left.claimRef.localeCompare(right.claimRef));
  const resolvedClaimRefs = new Set(resolvedClaims.map(entry => entry.claimRef));
  const claimPerspectives = input.perspectives
    .filter(perspective =>
      perspective.actorRef === input.actorRef &&
      perspective.stance !== "INTENDS_TO_DECEIVE" &&
      !resolvedClaimRefs.has(perspective.claimRef)
    )
    .flatMap(perspective => {
      const claim = claimByRef.get(perspective.claimRef);
      if (claim === undefined) return [];
      return [{
        claimRef: perspective.claimRef,
        proposition: claim.proposition,
        epistemicBasis: perspective.stance === "KNOWN"
          ? "known" as const
          : perspective.stance === "UNCERTAIN"
            ? "uncertain" as const
            : "believed" as const,
        confidence: perspective.confidence,
        mayBeFalse: perspective.mayBeFalse
      }];
    })
    .sort((left, right) => left.claimRef.localeCompare(right.claimRef));
  const legacyBeliefs = (input.socialActor?.beliefs ?? [])
    .map(belief => projectLegacyBelief(input.actorRef, belief))
    .sort((left, right) => left.beliefRef.localeCompare(right.beliefRef));
  return {
    schemaVersion: 1,
    actorRef: input.actorRef,
    knownFactRefs: uniqueSorted(input.socialActor?.knownFactRefs ?? []),
    resolvedClaims,
    claimPerspectives,
    legacyBeliefs,
    intentionalDeceptionAllowed: false,
    authority: "PRIVATE_ACTOR_KNOWLEDGE_FOR_PERFORMANCE_ONLY"
  };
}

export function npcAuthorizedKnowledgeSourceRefsV1(context: NpcAuthorizedKnowledgeContextV1): string[] {
  return uniqueSorted([
    ...context.knownFactRefs,
    ...context.resolvedClaims.map(entry => entry.resolutionRef),
    ...context.claimPerspectives.map(entry => entry.claimRef),
    ...context.legacyBeliefs.map(entry => entry.beliefRef)
  ]);
}

export function actorKnowledgeRefV1(actorId: string): string {
  return `actor:${actorId.trim().replace(/^actor:/u, "")}`;
}

function projectLegacyBelief(actorRef: string, belief: DurableSocialBeliefV1): NpcAuthorizedLegacyBeliefV1 {
  return {
    beliefRef: `social-belief:${safeRefSegment(actorRef)}:${safeRefSegment(belief.beliefId)}`,
    proposition: belief.claim,
    epistemicBasis: "believed",
    confidence: belief.confidence,
    mayBeFalse: belief.mayBeFalse
  };
}

function sameActorId(left: string, right: string): boolean {
  return normalizeActorId(left) === normalizeActorId(right);
}

function normalizeActorId(value: string): string {
  return value.trim().replace(/^actor:/u, "").replace(/^npc:/u, "");
}

function safeRefSegment(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").replace(/[^a-zA-Z0-9_-]+/gu, "-").replace(/^-+|-+$/gu, "") || "unknown";
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(value => value.trim().length > 0))].sort();
}
