import type { CampaignId, CampaignRepository, JsonObject } from "../core";
import type { ActorClaimPerspectiveV1, ObjectiveClaimResolutionV1 } from "./knowledgeClaims";
import { loadActorPerspectiveRegistryV1 } from "./knowledgeAuthority";
import { loadClaimResolutionRegistryV1 } from "./knowledgeResolutionAuthority";
import { loadSocialActorRegistryV1, type DurableSocialBeliefV1 } from "./socialActorAuthority";
import type {
  CandidateActorKnowledgeV1,
  InformationAnswerShapeV1,
  NpcDisclosureDecisionV1,
  NpcInformationResolutionV1,
  ResolvedInformationCandidateV1
} from "./npcInformationResolution";

export const NPC_INFORMATION_DISCLOSURE_CONTRACT_V1 = "npc-information-disclosure/1" as const;

export type NpcDisclosureCauseCodeV1 =
  | "PUBLIC_FACT_KNOWN"
  | "ACTOR_BELIEF_QUALIFIED"
  | "ACTOR_UNCERTAINTY_QUALIFIED"
  | "OWNER_PROTECTED_INFORMATION"
  | "ACTOR_LACKS_KNOWLEDGE"
  | "CREDIBLE_ALTERNATIVE_AVAILABLE"
  | "NO_RESOLVED_INFORMATION";

export interface NpcCredibleInformationAlternativeV1 extends JsonObject {
  schemaVersion: 1;
  actorRef: string;
  coveredProperties: string[];
  coveredAnswerShapes: InformationAnswerShapeV1[];
  publicReasonRef: string;
}

/** Private policy input. It must never be serialized into player output. */
export interface NpcDisclosureOwnerContextV1 {
  schemaVersion: 1;
  actorRef: string;
  protectedFactRefs: string[];
  believedClaimRefs: string[];
  uncertainClaimRefs: string[];
  credibleAlternatives: NpcCredibleInformationAlternativeV1[];
  authority: "PRIVATE_DISCLOSURE_OWNER_CONTEXT";
}

export interface NpcAuthorizedDisclosureFactV1 extends JsonObject {
  schemaVersion: 1;
  candidateId: string;
  subjectRef: string | null;
  property: string;
  value: string;
  delivery: "OBJECTIVE_ASSERTION" | "QUALIFIED_BELIEF" | "QUALIFIED_UNCERTAINTY";
  sourceRefs: string[];
}

export interface NpcInformationDisclosureProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof NPC_INFORMATION_DISCLOSURE_CONTRACT_V1;
  projectionId: string;
  actorRef: string;
  decision: Exclude<NpcDisclosureDecisionV1, "UNRESOLVED">;
  cause: {
    code: NpcDisclosureCauseCodeV1;
    publicPolicyRefs: string[];
    alternativeActorRefs: string[];
  };
  authorizedFacts: NpcAuthorizedDisclosureFactV1[];
  withheldCandidateCount: number;
  unknownCandidateCount: number;
  authority: "DISCLOSURE_POLICY_PROJECTION_ONLY";
  noCommit: true;
  performerMayCreateFacts: false;
  version: 1;
}

export function buildNpcDisclosureOwnerContextV1(input: {
  actorRef: string;
  perspectives: ActorClaimPerspectiveV1[];
  legacyBeliefs: DurableSocialBeliefV1[];
  objectiveResolutions: ObjectiveClaimResolutionV1[];
  credibleAlternatives?: NpcCredibleInformationAlternativeV1[];
}): NpcDisclosureOwnerContextV1 {
  if (input.perspectives.some(perspective => perspective.actorRef !== input.actorRef)) throw new Error("Disclosure perspective belongs to another actor.");
  return {
    schemaVersion: 1,
    actorRef: input.actorRef,
    protectedFactRefs: unique(input.objectiveResolutions
      .filter(resolution => resolution.visibility !== "PLAYER_VISIBLE")
      .flatMap(resolution => resolution.factRefs)),
    believedClaimRefs: unique([
      ...input.perspectives.filter(entry => entry.stance === "BELIEVED").map(entry => entry.claimRef),
      ...input.legacyBeliefs.flatMap(entry => [
        `social-belief:${safeRefSegment(input.actorRef)}:${safeRefSegment(entry.beliefId)}`,
        ...entry.sourceRefs
      ])
    ]),
    uncertainClaimRefs: unique(input.perspectives.filter(entry => entry.stance === "UNCERTAIN").map(entry => entry.claimRef)),
    credibleAlternatives: structuredClone(input.credibleAlternatives ?? []),
    authority: "PRIVATE_DISCLOSURE_OWNER_CONTEXT"
  };
}

export async function loadNpcDisclosureOwnerContextV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  actorId: string;
  credibleAlternatives?: NpcCredibleInformationAlternativeV1[];
}): Promise<NpcDisclosureOwnerContextV1> {
  const actorRef = canonicalActorRef(input.actorId);
  const [perspectives, social, resolutions] = await Promise.all([
    loadActorPerspectiveRegistryV1(input.repository, input.campaignId, actorRef),
    loadSocialActorRegistryV1(input.repository, input.campaignId),
    loadClaimResolutionRegistryV1(input.repository, input.campaignId)
  ]);
  if (!perspectives.ok) throw new Error(perspectives.error.messageKey);
  if (!social.ok) throw new Error(social.error.messageKey);
  if (!resolutions.ok) throw new Error(resolutions.error.messageKey);
  const socialActor = social.value.state.actors.find(actor => canonicalActorRef(actor.actorId) === actorRef);
  return buildNpcDisclosureOwnerContextV1({
    actorRef,
    perspectives: perspectives.value.state.perspectives,
    legacyBeliefs: socialActor?.beliefs ?? [],
    objectiveResolutions: resolutions.value.state.resolutions,
    credibleAlternatives: input.credibleAlternatives
  });
}

export function projectNpcInformationDisclosureV1(input: {
  projectionId: string;
  resolution: NpcInformationResolutionV1;
  ownerContext: NpcDisclosureOwnerContextV1;
}): NpcInformationDisclosureProjectionV1 {
  if (!input.projectionId.trim() || input.resolution.actorRef !== input.ownerContext.actorRef) {
    throw new Error("Information disclosure input boundary is invalid.");
  }
  const knowledgeByCandidate = new Map(input.resolution.actorKnowledge.candidateKnowledge.map(entry => [entry.candidateId, entry] as const));
  const protectedRefs = new Set(input.ownerContext.protectedFactRefs);
  const believedRefs = new Set(input.ownerContext.believedClaimRefs);
  const uncertainRefs = new Set(input.ownerContext.uncertainClaimRefs);
  const authorizedFacts: NpcAuthorizedDisclosureFactV1[] = [];
  let withheldCandidateCount = 0;
  let unknownCandidateCount = 0;
  let beliefCount = 0;
  let uncertaintyCount = 0;

  for (const candidate of input.resolution.candidates) {
    const knowledge = knowledgeByCandidate.get(candidate.candidateId);
    if (knowledge?.status !== "KNOWN") {
      unknownCandidateCount += 1;
      continue;
    }
    if (candidate.visibility === "SYSTEM_PRIVATE" || candidate.sourceRefs.some(ref => protectedRefs.has(ref))) {
      withheldCandidateCount += 1;
      continue;
    }
    if (candidate.value === null) continue;
    const uncertain = knowledge.bases.includes("UNCERTAIN") || candidate.sourceRefs.some(ref => uncertainRefs.has(ref));
    const believed = knowledge.bases.includes("BELIEVED") || candidate.sourceRefs.some(ref => believedRefs.has(ref));
    const delivery = uncertain
      ? "QUALIFIED_UNCERTAINTY" as const
      : believed || candidate.authority === "TESTIMONY"
        ? "QUALIFIED_BELIEF" as const
        : "OBJECTIVE_ASSERTION" as const;
    if (delivery === "QUALIFIED_UNCERTAINTY") uncertaintyCount += 1;
    if (delivery === "QUALIFIED_BELIEF") beliefCount += 1;
    authorizedFacts.push({
      schemaVersion: 1,
      candidateId: candidate.candidateId,
      subjectRef: candidate.subjectRef,
      property: candidate.property,
      value: candidate.value,
      delivery,
      sourceRefs: candidate.sourceRefs.filter(isPublicRef)
    });
  }

  const matchingAlternativeRecords = authorizedFacts.length === 0 && withheldCandidateCount === 0
    ? matchingAlternatives(input.resolution, input.ownerContext.credibleAlternatives)
    : [];
  const alternativeActorRefs = unique(matchingAlternativeRecords.map(alternative => alternative.actorRef));
  const decisionAndCause = decide({
    authorizedFacts,
    withheldCandidateCount,
    unknownCandidateCount,
    beliefCount,
    uncertaintyCount,
    alternativeActorRefs,
    candidateCount: input.resolution.candidates.length
  });
  return {
    schemaVersion: 1,
    contractVersion: NPC_INFORMATION_DISCLOSURE_CONTRACT_V1,
    projectionId: input.projectionId,
    actorRef: input.resolution.actorRef,
    decision: decisionAndCause.decision,
    cause: {
      code: decisionAndCause.code,
      publicPolicyRefs: unique([policyRef(decisionAndCause.code), ...matchingAlternativeRecords.map(alternative => alternative.publicReasonRef)]),
      alternativeActorRefs
    },
    authorizedFacts,
    withheldCandidateCount,
    unknownCandidateCount,
    authority: "DISCLOSURE_POLICY_PROJECTION_ONLY",
    noCommit: true,
    performerMayCreateFacts: false,
    version: 1
  };
}

export function applyNpcInformationDisclosureV1(input: {
  resolution: NpcInformationResolutionV1;
  disclosure: NpcInformationDisclosureProjectionV1;
}): NpcInformationResolutionV1 {
  if (input.resolution.actorRef !== input.disclosure.actorRef) throw new Error("Disclosure projection belongs to another actor.");
  return {
    ...structuredClone(input.resolution),
    selectedCandidateIds: input.disclosure.authorizedFacts.map(fact => fact.candidateId),
    disclosure: {
      decision: input.disclosure.decision,
      reason: input.disclosure.cause.code,
      sourceRefs: [...input.disclosure.cause.publicPolicyRefs, ...input.disclosure.cause.alternativeActorRefs]
    }
  };
}

export function validateNpcInformationDisclosureProjectionV1(value: NpcInformationDisclosureProjectionV1): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (value.contractVersion !== NPC_INFORMATION_DISCLOSURE_CONTRACT_V1 || value.authority !== "DISCLOSURE_POLICY_PROJECTION_ONLY" || value.noCommit !== true || value.performerMayCreateFacts !== false) issues.push("disclosure authority boundary is invalid");
  if (value.authorizedFacts.some(fact => !fact.value.trim() || fact.sourceRefs.some(ref => !isPublicRef(ref)))) issues.push("authorized disclosure fact contains invalid or private content");
  if (value.decision === "WITHHOLD_PROTECTED" && value.authorizedFacts.length > 0) issues.push("protected withholding cannot authorize a fact");
  if (value.decision === "ACTOR_DOES_NOT_KNOW" && value.unknownCandidateCount === 0 && value.cause.code !== "NO_RESOLVED_INFORMATION") issues.push("ignorance decision lacks an unknown candidate");
  if (value.cause.publicPolicyRefs.some(ref => !ref.startsWith("policy:") || !isPublicRef(ref))) issues.push("disclosure cause must expose only public policy references");
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function decide(input: {
  authorizedFacts: NpcAuthorizedDisclosureFactV1[];
  withheldCandidateCount: number;
  unknownCandidateCount: number;
  beliefCount: number;
  uncertaintyCount: number;
  alternativeActorRefs: string[];
  candidateCount: number;
}): { decision: Exclude<NpcDisclosureDecisionV1, "UNRESOLVED">; code: NpcDisclosureCauseCodeV1 } {
  if (input.authorizedFacts.some(fact => fact.delivery === "OBJECTIVE_ASSERTION")) return { decision: "ANSWER_DIRECTLY", code: "PUBLIC_FACT_KNOWN" };
  if (input.uncertaintyCount > 0) return { decision: "ANSWER_QUALIFIED", code: "ACTOR_UNCERTAINTY_QUALIFIED" };
  if (input.beliefCount > 0) return { decision: "ANSWER_QUALIFIED", code: "ACTOR_BELIEF_QUALIFIED" };
  if (input.withheldCandidateCount > 0) return { decision: "WITHHOLD_PROTECTED", code: "OWNER_PROTECTED_INFORMATION" };
  if (input.alternativeActorRefs.length > 0) return { decision: "REDIRECT_CREDIBLY", code: "CREDIBLE_ALTERNATIVE_AVAILABLE" };
  if (input.candidateCount === 0) return { decision: "ACTOR_DOES_NOT_KNOW", code: "NO_RESOLVED_INFORMATION" };
  return { decision: "ACTOR_DOES_NOT_KNOW", code: "ACTOR_LACKS_KNOWLEDGE" };
}

function matchingAlternatives(resolution: NpcInformationResolutionV1, alternatives: NpcCredibleInformationAlternativeV1[]): NpcCredibleInformationAlternativeV1[] {
  const properties = new Set(resolution.candidates.map(candidate => candidate.property));
  return alternatives.filter(alternative =>
    alternative.coveredAnswerShapes.includes(resolution.need.requestedAnswerShape)
    && (alternative.coveredProperties.length === 0 || alternative.coveredProperties.some(property => properties.has(property)))
  ).sort((left, right) => left.actorRef.localeCompare(right.actorRef, "fr"));
}

function policyRef(code: NpcDisclosureCauseCodeV1): string {
  return `policy:disclosure:${code.toLocaleLowerCase("en-US").replaceAll("_", "-")}`;
}

function isPublicRef(ref: string): boolean {
  return /^[a-z][a-z0-9_-]*:.+/u.test(ref) && !/^(?:secret|private|hidden):/iu.test(ref);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "fr"));
}

function safeRefSegment(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").replace(/[^a-zA-Z0-9_-]+/gu, "-").replace(/^-+|-+$/gu, "") || "unknown";
}

function canonicalActorRef(value: string): string {
  return `actor:${value.trim().replace(/^actor:/u, "").replace(/^npc:/u, "")}`;
}
