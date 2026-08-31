import assert from "node:assert/strict";
import generatedNarrativeLoreCatalog from "../../../src/narration-ui/generated/narrativeLoreCatalog.generated.json";
import type { AiInformationNeedV8 } from "../../src/ai";
import {
  createTargetedLoreInformationReaderV1,
  composeNpcInformationResolutionV1,
  buildNpcInformationActorContextV1,
  projectNpcContextualKnowledgeV1,
  roleRefsFromPublicRoleV1,
  validateNpcContextualKnowledgeProjectionV1,
  validateNpcInformationResolutionV1,
  type NpcInformationActorContextV1,
  type ResolvedInformationCandidateV1
} from "../../src/application";
import {
  assertNarrativeLoreBuildCatalogV1,
  type NarrativeLoreBuildCatalogV1
} from "../../src/context";
import { buildArchiveLorePilotV1 } from "../../../src/narration-ui/archiveLorePilot";

async function main(): Promise<void> {
  assertNarrativeLoreBuildCatalogV1(generatedNarrativeLoreCatalog);
  const catalog: NarrativeLoreBuildCatalogV1 = generatedNarrativeLoreCatalog;
  const archive = await buildArchiveLorePilotV1();
  const guard = archive.scene.ambientPopulation.find(actor => /garde/iu.test(actor.publicRole));
  assert.ok(guard);
  const need = informationNeed({
    subjectMention: "cette ville",
    requestedDimension: "dirigeant actuel",
    requestedAnswerShape: "IDENTITY"
  });
  const lookup = await createTargetedLoreInformationReaderV1({ catalog }).lookup({
    schemaVersion: 1,
    lookupId: "j10i3-governance",
    campaignId: "campaign:j10i3",
    campaignRevision: 1,
    anchorEntityId: "archives_de_lysenthe",
    need,
    knowledgeRefs: [...guard.knowledgeRefs],
    allowedKnowledgeLevels: ["COMMUN", "LOCAL"]
  });
  const localities = archive.influencePacket.geographicChain.map(entityId => `lore-entity:${entityId}`);
  const guardProjection = projectNpcContextualKnowledgeV1({
    projectionId: "knowledge-projection:j10i3-guard",
    actor: buildNpcInformationActorContextV1({
      actorRef: `npc:${guard.actorId}`,
      publicRole: guard.publicRole,
      localityRefs: localities,
      visibleKnowledgeRefs: guard.knowledgeRefs,
      authorizedKnowledge: null
    }),
    need,
    candidates: lookup.candidates
  });
  assert.deepEqual(validateNpcContextualKnowledgeProjectionV1(guardProjection), { ok: true });
  assert.equal(guardProjection.noDisclosureDecision, true);
  assert.equal(guardProjection.noCommit, true);
  const ruler = candidateByProperty(lookup.candidates, "/proprietaire_principal");
  const seat = candidateByProperty(lookup.candidates, "/siege_pouvoir");
  const government = candidateByProperty(lookup.candidates, "/type_gouvernance");
  assertKnowledge(guardProjection, ruler.candidateId, "LOCAL_FAMILIARITY", "ROLE_EXPECTED");
  assertKnowledge(guardProjection, seat.candidateId, "LOCAL_FAMILIARITY", "ROLE_EXPECTED");
  assertKnowledge(guardProjection, government.candidateId, "COMMON_WORLD", "ROLE_EXPECTED");
  const guardResolution = composeNpcInformationResolutionV1({
    resolutionId: "information-resolution:j10i3-guard",
    actorRef: `npc:${guard.actorId}`,
    lookup,
    knowledge: guardProjection
  });
  assert.deepEqual(validateNpcInformationResolutionV1(guardResolution), { ok: true });
  assert.equal(guardResolution.actorKnowledge.status, "KNOWS");
  assert.equal(guardResolution.disclosure.decision, "UNRESOLVED");
  assert.equal(guardResolution.performerMayCreateFacts, false);

  const travelerContext = actor({
    actorRef: "npc:traveler",
    roleRefs: ["role:voyageur"],
    localityRefs: ["lore-entity:bourg_des_forges"]
  });
  const travelerProjection = projectNpcContextualKnowledgeV1({
    projectionId: "knowledge-projection:j10i3-traveler",
    actor: travelerContext,
    need,
    candidates: lookup.candidates
  });
  assert.equal(statusOf(travelerProjection, ruler.candidateId), "UNKNOWN_TO_ACTOR");
  assert.equal(statusOf(travelerProjection, seat.candidateId), "UNKNOWN_TO_ACTOR");
  assertKnowledge(travelerProjection, government.candidateId, "COMMON_WORLD");
  const travelerResolution = composeNpcInformationResolutionV1({
    resolutionId: "information-resolution:j10i3-traveler",
    actorRef: travelerContext.actorRef,
    lookup,
    knowledge: travelerProjection
  });
  assert.equal(
    travelerResolution.actorKnowledge.candidateKnowledge.find(entry => entry.candidateId === ruler.candidateId)?.status,
    "UNKNOWN_TO_ACTOR"
  );
  assert.equal(travelerResolution.disclosure.decision, "UNRESOLVED");

  const acquiredProjection = projectNpcContextualKnowledgeV1({
    projectionId: "knowledge-projection:j10i3-traveler-acquired",
    actor: buildNpcInformationActorContextV1({
      actorRef: travelerContext.actorRef,
      publicRole: "Voyageur",
      localityRefs: travelerContext.localityRefs,
      visibleKnowledgeRefs: [],
      authorizedKnowledge: {
        schemaVersion: 1,
        actorRef: travelerContext.actorRef,
        knownFactRefs: [ruler.sourceRefs[0]!],
        resolvedClaims: [],
        claimPerspectives: [],
        legacyBeliefs: [],
        intentionalDeceptionAllowed: false,
        authority: "PRIVATE_ACTOR_KNOWLEDGE_FOR_PERFORMANCE_ONLY"
      }
    }),
    need,
    candidates: lookup.candidates
  });
  assertKnowledge(acquiredProjection, ruler.candidateId, "ACQUIRED");

  const procedureNeed = informationNeed({
    subjectMention: "un acte public",
    requestedDimension: "procédure publique de consultation",
    requestedAnswerShape: "PROCEDURE"
  });
  const procedureCandidate: ResolvedInformationCandidateV1 = {
    schemaVersion: 1,
    candidateId: "information-candidate:archive-public-consultation",
    subjectRef: "lore-entity:archives_de_lysenthe",
    property: "/procedure_consultation",
    value: "La consultation d'un acte public passe par le guichet des clercs des Archives.",
    authority: "OWNER_STATE",
    visibility: "PLAYER_VISIBLE",
    sourceKnowledgeLevel: "LOCAL",
    scopeRefs: ["lore-entity:archives_de_lysenthe", "lore-entity:lysenthe"],
    sourceRefs: ["owner-fact:archives-public-consultation"]
  };
  const archivistProjection = projectNpcContextualKnowledgeV1({
    projectionId: "knowledge-projection:j10i3-archivist",
    actor: actor({
      actorRef: "npc:archive-archivist",
      roleRefs: roleRefsFromPublicRoleV1("Archiviste"),
      localityRefs: ["lore-entity:archives_de_lysenthe", "lore-entity:lysenthe"]
    }),
    need: procedureNeed,
    candidates: [procedureCandidate]
  });
  assertKnowledge(archivistProjection, procedureCandidate.candidateId, "LOCAL_FAMILIARITY", "ROLE_EXPECTED");
  const nonLocalArchivist = projectNpcContextualKnowledgeV1({
    projectionId: "knowledge-projection:j10i3-non-local-archivist",
    actor: actor({ actorRef: "npc:visiting-archivist", roleRefs: ["role:archiviste"], localityRefs: ["lore-entity:ardherne"] }),
    need: procedureNeed,
    candidates: [procedureCandidate]
  });
  assert.equal(statusOf(nonLocalArchivist, procedureCandidate.candidateId), "UNKNOWN_TO_ACTOR");

  const restrictedProcedure = { ...procedureCandidate, candidateId: "information-candidate:restricted-procedure", sourceKnowledgeLevel: "RESTREINT" as const };
  const restrictedProjection = projectNpcContextualKnowledgeV1({
    projectionId: "knowledge-projection:j10i3-restricted",
    actor: actor({ actorRef: "npc:archive-archivist-restricted", roleRefs: ["role:archiviste"], localityRefs: ["lore-entity:lysenthe"] }),
    need: procedureNeed,
    candidates: [restrictedProcedure]
  });
  assert.equal(statusOf(restrictedProjection, restrictedProcedure.candidateId), "UNKNOWN_TO_ACTOR", "le rôle seul ne doit jamais ouvrir un fait restreint");

  console.log("npc-contextual-knowledge/J10-I3: OK (common, local, role, acquired, traveler ignorance, restricted boundary, no disclosure)");
}

function informationNeed(input: {
  subjectMention: string;
  requestedDimension: string;
  requestedAnswerShape: AiInformationNeedV8["requestedAnswerShape"];
}): AiInformationNeedV8 {
  return {
    schemaVersion: 1,
    contractVersion: "information-need/2",
    subjectMention: input.subjectMention,
    proposedSubjectRef: null,
    proposedScopeRefs: ["lore-entity:lysenthe"],
    proposedPropertyRefs: [
      "lore-property:lysenthe:type_gouvernance",
      "lore-property:lysenthe:siege_pouvoir",
      "lore-property:chateau_tharqual:proprietaire_principal"
    ],
    proposedRelationRefs: ["lore-edge:lysenthe:siege_pouvoir:chateau_tharqual"],
    completionPropertyRefs: [
      "lore-property:lysenthe:type_gouvernance",
      "lore-property:lysenthe:siege_pouvoir",
      "lore-property:chateau_tharqual:proprietaire_principal"
    ],
    requestedDimension: input.requestedDimension,
    temporalScope: "CURRENT",
    requestedAnswerShape: input.requestedAnswerShape,
    sourceComponentId: "component:j10i3"
  };
}

function actor(overrides: {
  actorRef: string;
  roleRefs?: string[];
  localityRefs?: string[];
  acquiredFactRefs?: string[];
  knowledgeRefs?: string[];
}): NpcInformationActorContextV1 {
  return {
    schemaVersion: 1,
    actorRef: overrides.actorRef,
    roleRefs: overrides.roleRefs ?? [],
    localityRefs: overrides.localityRefs ?? [],
    acquiredFactRefs: overrides.acquiredFactRefs ?? [],
    knowledgeRefs: overrides.knowledgeRefs ?? []
  };
}

function candidateByProperty(candidates: ResolvedInformationCandidateV1[], property: string): ResolvedInformationCandidateV1 {
  const candidate = candidates.find(entry => entry.property === property);
  assert.ok(candidate, `candidate ${property} absent`);
  return candidate;
}

function statusOf(projection: ReturnType<typeof projectNpcContextualKnowledgeV1>, candidateId: string): "KNOWN" | "UNKNOWN_TO_ACTOR" {
  const entry = projection.candidateKnowledge.find(candidate => candidate.candidateId === candidateId);
  assert.ok(entry);
  return entry.status;
}

function assertKnowledge(
  projection: ReturnType<typeof projectNpcContextualKnowledgeV1>,
  candidateId: string,
  ...bases: Array<"COMMON_WORLD" | "LOCAL_FAMILIARITY" | "ROLE_EXPECTED" | "ACQUIRED">
): void {
  const entry = projection.candidateKnowledge.find(candidate => candidate.candidateId === candidateId);
  assert.ok(entry);
  assert.equal(entry.status, "KNOWN");
  for (const basis of bases) assert.ok(entry.bases.includes(basis), `${candidateId} doit inclure ${basis}`);
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
