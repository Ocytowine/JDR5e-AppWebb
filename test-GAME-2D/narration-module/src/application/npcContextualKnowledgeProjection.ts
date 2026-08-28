import type { JsonObject } from "../core";
import type {
  ActorInformationBasisV1,
  CandidateActorKnowledgeV1,
  InformationAnswerShapeV1,
  InformationNeedV1,
  NpcInformationResolutionV1,
  ResolvedInformationCandidateV1
} from "./npcInformationResolution";
import type { TargetedLoreInformationLookupResultV1 } from "./targetedLoreInformationLookup";
import type { NpcAuthorizedKnowledgeContextV1 } from "./npcKnowledgeContext";

export const NPC_CONTEXTUAL_KNOWLEDGE_PROJECTION_CONTRACT_V1 = "npc-contextual-knowledge-projection/1" as const;

export interface NpcInformationActorContextV1 extends JsonObject {
  schemaVersion: 1;
  actorRef: string;
  roleRefs: string[];
  localityRefs: string[];
  acquiredFactRefs: string[];
  knowledgeRefs: string[];
}

export interface RoleExpectedKnowledgeRuleV1 extends JsonObject {
  schemaVersion: 1;
  ruleId: string;
  roleRefs: string[];
  properties: string[];
  answerShapes: InformationAnswerShapeV1[];
  localityRequired: boolean;
  sourceRefs: string[];
}

export interface NpcContextualKnowledgeProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof NPC_CONTEXTUAL_KNOWLEDGE_PROJECTION_CONTRACT_V1;
  projectionId: string;
  actorRef: string;
  need: InformationNeedV1;
  candidateKnowledge: CandidateActorKnowledgeV1[];
  knownCandidateIds: string[];
  unknownCandidateIds: string[];
  aggregateBases: ActorInformationBasisV1[];
  sourceRefs: string[];
  authority: "ACTOR_KNOWLEDGE_PROJECTION_ONLY";
  noDisclosureDecision: true;
  noCommit: true;
  version: 1;
}

export const DEFAULT_ROLE_EXPECTED_KNOWLEDGE_RULES_V1: readonly RoleExpectedKnowledgeRuleV1[] = [
  {
    schemaVersion: 1,
    ruleId: "role-knowledge:local-guard-governance",
    roleRefs: ["role:garde"],
    properties: ["/type_gouvernance", "/siege_pouvoir", "/proprietaire_principal"],
    answerShapes: ["IDENTITY", "TITLE", "LOCATION", "OPEN"],
    localityRequired: true,
    sourceRefs: ["policy:role-knowledge:local-guard-governance"]
  },
  {
    schemaVersion: 1,
    ruleId: "role-knowledge:archive-public-procedure",
    roleRefs: ["role:archiviste", "role:clerc"],
    properties: ["/fonction_principale", "/procedure_consultation", "/proprietaire_principal"],
    answerShapes: ["PROCEDURE", "DESCRIPTION", "OPEN"],
    localityRequired: true,
    sourceRefs: ["policy:role-knowledge:archive-public-procedure"]
  }
] as const;

export function projectNpcContextualKnowledgeV1(input: {
  projectionId: string;
  actor: NpcInformationActorContextV1;
  need: InformationNeedV1;
  candidates: ResolvedInformationCandidateV1[];
  roleRules?: readonly RoleExpectedKnowledgeRuleV1[];
}): NpcContextualKnowledgeProjectionV1 {
  validateInput(input);
  const roleRules = input.roleRules ?? DEFAULT_ROLE_EXPECTED_KNOWLEDGE_RULES_V1;
  const actorRoles = new Set(input.actor.roleRefs);
  const actorLocalities = new Set(input.actor.localityRefs);
  const acquired = new Set([...input.actor.acquiredFactRefs, ...input.actor.knowledgeRefs]);
  const candidateKnowledge = input.candidates.map(candidate => {
    const bases: ActorInformationBasisV1[] = [];
    const evidenceRefs: string[] = [];
    const isLocal = candidate.scopeRefs.some(ref => actorLocalities.has(ref));
    if (candidate.sourceKnowledgeLevel === "COMMUN") {
      bases.push("COMMON_WORLD");
      evidenceRefs.push(...candidate.sourceRefs);
    }
    if (candidate.sourceKnowledgeLevel === "LOCAL" && isLocal) {
      bases.push("LOCAL_FAMILIARITY");
      evidenceRefs.push(...candidate.scopeRefs.filter(ref => actorLocalities.has(ref)));
    }
    for (const rule of roleRules) {
      if (
        rule.roleRefs.some(ref => actorRoles.has(ref))
        && rule.properties.includes(candidate.property)
        && rule.answerShapes.includes(input.need.requestedAnswerShape)
        && (candidate.sourceKnowledgeLevel === "COMMUN" || candidate.sourceKnowledgeLevel === "LOCAL")
        && (!rule.localityRequired || isLocal)
      ) {
        bases.push("ROLE_EXPECTED");
        evidenceRefs.push(rule.ruleId, ...rule.sourceRefs, ...rule.roleRefs.filter(ref => actorRoles.has(ref)));
      }
    }
    if (acquired.has(candidate.candidateId) || candidate.sourceRefs.some(ref => acquired.has(ref))) {
      bases.push("ACQUIRED");
      evidenceRefs.push(...candidate.sourceRefs.filter(ref => acquired.has(ref)));
    }
    const uniqueBases = unique(bases);
    return {
      schemaVersion: 1 as const,
      candidateId: candidate.candidateId,
      status: uniqueBases.length > 0 ? "KNOWN" as const : "UNKNOWN_TO_ACTOR" as const,
      bases: uniqueBases,
      evidenceRefs: unique(evidenceRefs),
      reason: uniqueBases.length > 0
        ? `Connaissance établie par ${uniqueBases.join(", ")}.`
        : "Aucune base commune, locale, professionnelle ou acquise ne relie ce fait à l'acteur."
    };
  });
  const knownCandidateIds = candidateKnowledge.filter(entry => entry.status === "KNOWN").map(entry => entry.candidateId);
  const unknownCandidateIds = candidateKnowledge.filter(entry => entry.status === "UNKNOWN_TO_ACTOR").map(entry => entry.candidateId);
  return {
    schemaVersion: 1,
    contractVersion: NPC_CONTEXTUAL_KNOWLEDGE_PROJECTION_CONTRACT_V1,
    projectionId: input.projectionId,
    actorRef: input.actor.actorRef,
    need: structuredClone(input.need),
    candidateKnowledge,
    knownCandidateIds,
    unknownCandidateIds,
    aggregateBases: unique(candidateKnowledge.flatMap(entry => entry.bases)),
    sourceRefs: unique(candidateKnowledge.flatMap(entry => entry.evidenceRefs)),
    authority: "ACTOR_KNOWLEDGE_PROJECTION_ONLY",
    noDisclosureDecision: true,
    noCommit: true,
    version: 1
  };
}

export function roleRefsFromPublicRoleV1(publicRole: string): string[] {
  const normalized = publicRole.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("fr");
  const refs: string[] = [];
  if (/\bgardes?\b/u.test(normalized)) refs.push("role:garde");
  if (/\barchivistes?\b/u.test(normalized)) refs.push("role:archiviste");
  if (/\bclercs?\b/u.test(normalized)) refs.push("role:clerc");
  if (/\bvoyageu(?:r|se)s?\b/u.test(normalized)) refs.push("role:voyageur");
  return unique(refs);
}

export function buildNpcInformationActorContextV1(input: {
  actorRef: string;
  publicRole: string;
  localityRefs: string[];
  visibleKnowledgeRefs: string[];
  authorizedKnowledge: NpcAuthorizedKnowledgeContextV1 | null;
}): NpcInformationActorContextV1 {
  if (input.authorizedKnowledge !== null && input.authorizedKnowledge.actorRef !== input.actorRef) {
    throw new Error("Authorized actor knowledge belongs to another actor.");
  }
  return {
    schemaVersion: 1,
    actorRef: input.actorRef,
    roleRefs: roleRefsFromPublicRoleV1(input.publicRole),
    localityRefs: unique(input.localityRefs),
    acquiredFactRefs: unique(input.authorizedKnowledge?.knownFactRefs ?? []),
    knowledgeRefs: unique(input.visibleKnowledgeRefs)
  };
}

export function composeNpcInformationResolutionV1(input: {
  resolutionId: string;
  actorRef: string;
  lookup: TargetedLoreInformationLookupResultV1;
  knowledge: NpcContextualKnowledgeProjectionV1;
}): NpcInformationResolutionV1 {
  if (input.knowledge.actorRef !== input.actorRef || input.knowledge.need.sourceComponentId !== input.lookup.need.sourceComponentId) {
    throw new Error("Fact lookup and actor knowledge projection do not share the same actor/need boundary.");
  }
  const status = input.lookup.candidates.length === 0
    ? "UNRESOLVED" as const
    : input.knowledge.knownCandidateIds.length > 0
      ? "KNOWS" as const
      : "DOES_NOT_KNOW" as const;
  return {
    schemaVersion: 1,
    contractVersion: "npc-information-resolution/1",
    resolutionId: input.resolutionId,
    actorRef: input.actorRef,
    need: structuredClone(input.lookup.need),
    candidates: structuredClone(input.lookup.candidates),
    selectedCandidateIds: input.lookup.candidates.map(candidate => candidate.candidateId),
    missingDimensions: [...input.lookup.missingDimensions],
    actorKnowledge: {
      status,
      bases: [...input.knowledge.aggregateBases],
      sourceRefs: [...input.knowledge.sourceRefs],
      candidateKnowledge: structuredClone(input.knowledge.candidateKnowledge)
    },
    disclosure: {
      decision: "UNRESOLVED",
      reason: "J10-I3 établit la connaissance de l'acteur sans décider ce qu'il accepte de révéler.",
      sourceRefs: []
    },
    creation: {
      status: input.lookup.missingDimensions.length > 0 ? "REQUIRED_NOT_EXECUTED" : "NOT_NEEDED",
      proposalRefs: []
    },
    authority: "FACT_LOOKUP_AND_DISCLOSURE_RECEIPT_ONLY",
    performerMayCreateFacts: false,
    version: 1
  };
}

export type NpcContextualKnowledgeValidationV1 = { ok: true } | { ok: false; issues: string[] };

export function validateNpcContextualKnowledgeProjectionV1(value: NpcContextualKnowledgeProjectionV1): NpcContextualKnowledgeValidationV1 {
  const issues: string[] = [];
  if (value.schemaVersion !== 1 || value.contractVersion !== NPC_CONTEXTUAL_KNOWLEDGE_PROJECTION_CONTRACT_V1 || value.version !== 1) issues.push("projection contract is invalid");
  if (value.authority !== "ACTOR_KNOWLEDGE_PROJECTION_ONLY" || value.noDisclosureDecision !== true || value.noCommit !== true) issues.push("projection authority boundary is invalid");
  const ids = value.candidateKnowledge.map(entry => entry.candidateId);
  if (new Set(ids).size !== ids.length) issues.push("candidate knowledge ids are not unique");
  if (value.knownCandidateIds.some(id => !ids.includes(id)) || value.unknownCandidateIds.some(id => !ids.includes(id))) issues.push("projection references an unknown candidate");
  if (value.knownCandidateIds.some(id => value.unknownCandidateIds.includes(id))) issues.push("candidate cannot be both known and unknown");
  if (value.candidateKnowledge.some(entry => entry.status === "KNOWN" ? entry.bases.length === 0 : entry.bases.length > 0)) issues.push("knowledge status and bases disagree");
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function validateInput(input: {
  projectionId: string;
  actor: NpcInformationActorContextV1;
  need: InformationNeedV1;
  candidates: ResolvedInformationCandidateV1[];
  roleRules?: readonly RoleExpectedKnowledgeRuleV1[];
}): void {
  if (!input.projectionId.trim() || input.actor.schemaVersion !== 1 || !/^actor:|^npc:/u.test(input.actor.actorRef)) throw new Error("NPC contextual knowledge input is invalid.");
  for (const values of [input.actor.roleRefs, input.actor.localityRefs, input.actor.acquiredFactRefs, input.actor.knowledgeRefs]) {
    if (!Array.isArray(values) || values.some(value => !/^[a-z][a-z0-9_-]*:.+/u.test(value))) throw new Error("NPC contextual knowledge references are invalid.");
  }
}

function unique<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "fr"));
}
