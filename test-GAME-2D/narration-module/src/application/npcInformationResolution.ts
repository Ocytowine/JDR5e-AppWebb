import type { AiInformationNeedV8 } from "../ai/types";
import type { JsonObject } from "../core";

export const INFORMATION_NEED_CONTRACT_VERSION_V1 = "information-need/1" as const;
export const INFORMATION_NEED_CONTRACT_VERSION_V2 = "information-need/2" as const;
export const NPC_INFORMATION_RESOLUTION_CONTRACT_VERSION_V1 = "npc-information-resolution/1" as const;

export type InformationTemporalScopeV1 = "CURRENT" | "PAST" | "FUTURE" | "UNSPECIFIED";
export type InformationAnswerShapeV1 =
  | "IDENTITY"
  | "TITLE"
  | "LOCATION"
  | "PROCEDURE"
  | "DESCRIPTION"
  | "CAUSE"
  | "STATUS"
  | "OPEN";

/**
 * J10-I1 transport contract. V8 may populate it on factual questions while
 * requestedDimension deliberately remains open text.
 */
export type InformationNeedV1 = AiInformationNeedV8 & JsonObject;

export type ResolvedInformationAuthorityV1 =
  | "OWNER_STATE"
  | "CAMPAIGN_FACT"
  | "CAMPAIGN_LORE_PROJECTION"
  | "LORE_INITIAL"
  | "TESTIMONY"
  | "UNRESOLVED";

export type ActorInformationBasisV1 =
  | "COMMON_WORLD"
  | "LOCAL_FAMILIARITY"
  | "ROLE_EXPECTED"
  | "ACQUIRED"
  | "BELIEVED"
  | "UNCERTAIN";

export type NpcDisclosureDecisionV1 =
  | "ANSWER_DIRECTLY"
  | "ANSWER_QUALIFIED"
  | "REDIRECT_CREDIBLY"
  | "WITHHOLD_PROTECTED"
  | "ACTOR_DOES_NOT_KNOW"
  | "UNRESOLVED";

export interface ResolvedInformationCandidateV1 extends JsonObject {
  schemaVersion: 1;
  candidateId: string;
  subjectRef: string | null;
  property: string;
  value: string | null;
  authority: ResolvedInformationAuthorityV1;
  visibility: "PLAYER_VISIBLE" | "ACTOR_SCOPED" | "SYSTEM_PRIVATE";
  sourceKnowledgeLevel: "COMMUN" | "LOCAL" | "SPECIALISE" | "RESTREINT" | "MJ_SECRET" | null;
  scopeRefs: string[];
  sourceRefs: string[];
}

export interface CandidateActorKnowledgeV1 extends JsonObject {
  schemaVersion: 1;
  candidateId: string;
  status: "KNOWN" | "UNKNOWN_TO_ACTOR";
  bases: ActorInformationBasisV1[];
  evidenceRefs: string[];
  reason: string;
}

/**
 * Receipt separating truth lookup, actor knowledge and disclosure. It carries
 * no performance or creation authority in J10-I0.
 */
export interface NpcInformationResolutionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof NPC_INFORMATION_RESOLUTION_CONTRACT_VERSION_V1;
  resolutionId: string;
  actorRef: string;
  need: InformationNeedV1;
  candidates: ResolvedInformationCandidateV1[];
  selectedCandidateIds: string[];
  missingDimensions: string[];
  actorKnowledge: {
    status: "KNOWS" | "DOES_NOT_KNOW" | "UNRESOLVED";
    bases: ActorInformationBasisV1[];
    sourceRefs: string[];
    candidateKnowledge: CandidateActorKnowledgeV1[];
  };
  disclosure: {
    decision: NpcDisclosureDecisionV1;
    reason: string;
    sourceRefs: string[];
  };
  creation: {
    status: "NOT_NEEDED" | "REQUIRED_NOT_EXECUTED" | "EXECUTED" | "NOT_ALLOWED";
    proposalRefs: string[];
  };
  authority: "FACT_LOOKUP_AND_DISCLOSURE_RECEIPT_ONLY";
  performerMayCreateFacts: false;
  version: 1;
}

export type InformationResolutionValidationV1 =
  | { ok: true }
  | { ok: false; issues: string[] };

const TEMPORAL_SCOPES = new Set<InformationTemporalScopeV1>(["CURRENT", "PAST", "FUTURE", "UNSPECIFIED"]);
const ANSWER_SHAPES = new Set<InformationAnswerShapeV1>(["IDENTITY", "TITLE", "LOCATION", "PROCEDURE", "DESCRIPTION", "CAUSE", "STATUS", "OPEN"]);
const AUTHORITIES = new Set<ResolvedInformationAuthorityV1>(["OWNER_STATE", "CAMPAIGN_FACT", "CAMPAIGN_LORE_PROJECTION", "LORE_INITIAL", "TESTIMONY", "UNRESOLVED"]);
const KNOWLEDGE_BASES = new Set<ActorInformationBasisV1>(["COMMON_WORLD", "LOCAL_FAMILIARITY", "ROLE_EXPECTED", "ACQUIRED", "BELIEVED", "UNCERTAIN"]);
const DISCLOSURE_DECISIONS = new Set<NpcDisclosureDecisionV1>(["ANSWER_DIRECTLY", "ANSWER_QUALIFIED", "REDIRECT_CREDIBLY", "WITHHOLD_PROTECTED", "ACTOR_DOES_NOT_KNOW", "UNRESOLVED"]);

export function validateInformationNeedV1(value: InformationNeedV1): InformationResolutionValidationV1 {
  const issues: string[] = [];
  if (value.schemaVersion !== 1 || ![
    INFORMATION_NEED_CONTRACT_VERSION_V1,
    INFORMATION_NEED_CONTRACT_VERSION_V2
  ].includes(value.contractVersion)) {
    issues.push("information need contract version is invalid");
  }
  requireText(value.subjectMention, "subjectMention", issues);
  if (value.proposedSubjectRef !== null) requireRef(value.proposedSubjectRef, "proposedSubjectRef", issues);
  requireText(value.requestedDimension, "requestedDimension", issues);
  if (!TEMPORAL_SCOPES.has(value.temporalScope)) issues.push("temporalScope is invalid");
  if (!ANSWER_SHAPES.has(value.requestedAnswerShape)) issues.push("requestedAnswerShape is invalid");
  requireText(value.sourceComponentId, "sourceComponentId", issues);
  if (value.contractVersion === INFORMATION_NEED_CONTRACT_VERSION_V2) {
    requireUniqueRefs(value.proposedScopeRefs, "proposedScopeRefs", issues, false);
    requireUniqueRefs(value.proposedPropertyRefs, "proposedPropertyRefs", issues, false);
    requireUniqueRefs(value.proposedRelationRefs, "proposedRelationRefs", issues, false);
    requireUniqueRefs(value.completionPropertyRefs, "completionPropertyRefs", issues, false);
  }
  return validation(issues);
}

export function validateNpcInformationResolutionV1(
  value: NpcInformationResolutionV1
): InformationResolutionValidationV1 {
  const issues: string[] = [];
  if (value.schemaVersion !== 1 || value.contractVersion !== NPC_INFORMATION_RESOLUTION_CONTRACT_VERSION_V1 || value.version !== 1) {
    issues.push("npc information resolution contract version is invalid");
  }
  requireRef(value.resolutionId, "resolutionId", issues);
  requireRef(value.actorRef, "actorRef", issues);
  const needValidation = validateInformationNeedV1(value.need);
  if (!needValidation.ok) issues.push(...needValidation.issues.map(issue => `need.${issue}`));
  const candidateIds = new Set<string>();
  for (const [index, candidate] of value.candidates.entries()) {
    const path = `candidates[${index}]`;
    requireRef(candidate.candidateId, `${path}.candidateId`, issues);
    if (candidateIds.has(candidate.candidateId)) issues.push(`${path}.candidateId is duplicated`);
    candidateIds.add(candidate.candidateId);
    if (candidate.subjectRef !== null) requireRef(candidate.subjectRef, `${path}.subjectRef`, issues);
    requireText(candidate.property, `${path}.property`, issues);
    if (candidate.value !== null) requireText(candidate.value, `${path}.value`, issues);
    if (!AUTHORITIES.has(candidate.authority)) issues.push(`${path}.authority is invalid`);
    if (!["PLAYER_VISIBLE", "ACTOR_SCOPED", "SYSTEM_PRIVATE"].includes(candidate.visibility)) {
      issues.push(`${path}.visibility is invalid`);
    }
    if (candidate.sourceKnowledgeLevel !== null && !["COMMUN", "LOCAL", "SPECIALISE", "RESTREINT", "MJ_SECRET"].includes(candidate.sourceKnowledgeLevel)) {
      issues.push(`${path}.sourceKnowledgeLevel is invalid`);
    }
    requireUniqueRefs(candidate.scopeRefs, `${path}.scopeRefs`, issues, candidate.authority !== "UNRESOLVED");
    requireUniqueRefs(candidate.sourceRefs, `${path}.sourceRefs`, issues, candidate.authority !== "UNRESOLVED");
    if (candidate.authority === "UNRESOLVED" && candidate.value !== null) {
      issues.push(`${path}.value must be null when authority is UNRESOLVED`);
    }
  }
  requireUniqueText(value.selectedCandidateIds, "selectedCandidateIds", issues);
  for (const selected of value.selectedCandidateIds) {
    if (!candidateIds.has(selected)) issues.push(`selectedCandidateIds contains unknown candidate ${selected}`);
  }
  requireUniqueText(value.missingDimensions, "missingDimensions", issues);
  if (!["KNOWS", "DOES_NOT_KNOW", "UNRESOLVED"].includes(value.actorKnowledge.status)) {
    issues.push("actorKnowledge.status is invalid");
  }
  if (value.actorKnowledge.bases.some(basis => !KNOWLEDGE_BASES.has(basis))) {
    issues.push("actorKnowledge.bases contains an invalid basis");
  }
  if (new Set(value.actorKnowledge.bases).size !== value.actorKnowledge.bases.length) {
    issues.push("actorKnowledge.bases must not contain duplicates");
  }
  requireUniqueRefs(value.actorKnowledge.sourceRefs, "actorKnowledge.sourceRefs", issues, false);
  const candidateKnowledgeIds = new Set<string>();
  for (const [index, entry] of value.actorKnowledge.candidateKnowledge.entries()) {
    const path = `actorKnowledge.candidateKnowledge[${index}]`;
    if (!candidateIds.has(entry.candidateId)) issues.push(`${path}.candidateId is unknown`);
    if (candidateKnowledgeIds.has(entry.candidateId)) issues.push(`${path}.candidateId is duplicated`);
    candidateKnowledgeIds.add(entry.candidateId);
    if (!["KNOWN", "UNKNOWN_TO_ACTOR"].includes(entry.status)) issues.push(`${path}.status is invalid`);
    if (entry.bases.some(basis => !KNOWLEDGE_BASES.has(basis))) issues.push(`${path}.bases contains an invalid basis`);
    if ((entry.status === "KNOWN") !== (entry.bases.length > 0)) issues.push(`${path}.status and bases disagree`);
    requireUniqueRefs(entry.evidenceRefs, `${path}.evidenceRefs`, issues, false);
    requireText(entry.reason, `${path}.reason`, issues);
  }
  if (candidateKnowledgeIds.size !== candidateIds.size) issues.push("actorKnowledge.candidateKnowledge must cover every candidate");
  const knownCount = value.actorKnowledge.candidateKnowledge.filter(entry => entry.status === "KNOWN").length;
  if (value.actorKnowledge.status === "KNOWS" && knownCount === 0) issues.push("actorKnowledge.KNOWS requires a known candidate");
  if (value.actorKnowledge.status === "DOES_NOT_KNOW" && (knownCount > 0 || candidateIds.size === 0)) issues.push("actorKnowledge.DOES_NOT_KNOW contradicts candidate knowledge");
  if (!DISCLOSURE_DECISIONS.has(value.disclosure.decision)) issues.push("disclosure.decision is invalid");
  requireText(value.disclosure.reason, "disclosure.reason", issues);
  requireUniqueRefs(value.disclosure.sourceRefs, "disclosure.sourceRefs", issues, false);
  if (!["NOT_NEEDED", "REQUIRED_NOT_EXECUTED", "EXECUTED", "NOT_ALLOWED"].includes(value.creation.status)) {
    issues.push("creation.status is invalid");
  }
  requireUniqueRefs(value.creation.proposalRefs, "creation.proposalRefs", issues, false);
  if (value.creation.status === "REQUIRED_NOT_EXECUTED" && value.creation.proposalRefs.length > 0) {
    issues.push("creation.proposalRefs must stay empty before creation is executed");
  }
  if (value.creation.status === "EXECUTED" && value.creation.proposalRefs.length === 0) {
    issues.push("creation.proposalRefs must identify an executed creation");
  }
  if (value.authority !== "FACT_LOOKUP_AND_DISCLOSURE_RECEIPT_ONLY") issues.push("authority is invalid");
  if (value.performerMayCreateFacts !== false) issues.push("performerMayCreateFacts must be false");
  return validation(issues);
}

function requireRef(value: string, path: string, issues: string[]): void {
  if (!/^[a-z][a-z0-9_-]*:.+/u.test(value)) issues.push(`${path} must be a canonical ref`);
}

function requireText(value: string, path: string, issues: string[]): void {
  if (typeof value !== "string" || value.trim().length === 0) issues.push(`${path} must be non-empty`);
}

function requireUniqueText(values: string[], path: string, issues: string[]): void {
  if (!Array.isArray(values)) {
    issues.push(`${path} must be an array`);
    return;
  }
  values.forEach((value, index) => requireText(value, `${path}[${index}]`, issues));
  if (new Set(values).size !== values.length) issues.push(`${path} must not contain duplicates`);
}

function requireUniqueRefs(values: string[], path: string, issues: string[], required: boolean): void {
  if (!Array.isArray(values)) {
    issues.push(`${path} must be an array`);
    return;
  }
  if (required && values.length === 0) issues.push(`${path} must not be empty`);
  values.forEach((value, index) => requireRef(value, `${path}[${index}]`, issues));
  if (new Set(values).size !== values.length) issues.push(`${path} must not contain duplicates`);
}

function validation(issues: string[]): InformationResolutionValidationV1 {
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
