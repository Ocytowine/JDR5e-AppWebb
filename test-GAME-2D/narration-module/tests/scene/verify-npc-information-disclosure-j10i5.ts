import assert from "node:assert/strict";
import {
  buildNpcDisclosureOwnerContextV1,
  projectNpcInformationDisclosureV1,
  applyNpcInformationDisclosureV1,
  validateNpcInformationDisclosureProjectionV1,
  validateNpcInformationResolutionV1,
  type ActorInformationBasisV1,
  type ActorClaimPerspectiveV1,
  type NpcCredibleInformationAlternativeV1,
  type NpcInformationResolutionV1,
  type ObjectiveClaimResolutionV1,
  type ResolvedInformationCandidateV1
} from "../../src/application";

const actorRef = "actor:npc-garde-archives";

function main(): void {
  const ownerContext = buildNpcDisclosureOwnerContextV1({
    actorRef,
    perspectives: perspectives(),
    legacyBeliefs: [],
    objectiveResolutions: [secretResolution()],
    credibleAlternatives: [archiveAlternative]
  });

  const publicFact = candidate({
    candidateId: "candidate:public-ruler",
    property: "/current_ruler_personal_identity",
    value: "Aveline de Sorne",
    authority: "CAMPAIGN_FACT",
    sourceRefs: ["campaign-fact:tharque-aveline"],
    visibility: "PLAYER_VISIBLE"
  });
  const publicResolution = resolution([publicFact], [[publicFact.candidateId, "KNOWN", ["LOCAL_FAMILIARITY"]]]);
  const publicDisclosure = projectNpcInformationDisclosureV1({ projectionId: "disclosure:public", resolution: publicResolution, ownerContext });
  assert.equal(publicDisclosure.decision, "ANSWER_DIRECTLY");
  assert.equal(publicDisclosure.cause.code, "PUBLIC_FACT_KNOWN");
  assert.equal(publicDisclosure.authorizedFacts[0]?.value, "Aveline de Sorne");
  assert.equal(publicDisclosure.authorizedFacts[0]?.delivery, "OBJECTIVE_ASSERTION");
  assert.deepEqual(validateNpcInformationDisclosureProjectionV1(publicDisclosure), { ok: true });
  const applied = applyNpcInformationDisclosureV1({ resolution: publicResolution, disclosure: publicDisclosure });
  assert.equal(applied.disclosure.decision, "ANSWER_DIRECTLY");
  assert.deepEqual(validateNpcInformationResolutionV1(applied), { ok: true });

  // A known public fact stays answerable even when no role policy granted the
  // knowledge: role limitations cannot become generic refusal policies.
  const acquiredOnly = resolution([publicFact], [[publicFact.candidateId, "KNOWN", ["ACQUIRED"]]]);
  assert.equal(projectNpcInformationDisclosureV1({ projectionId: "disclosure:acquired", resolution: acquiredOnly, ownerContext }).decision, "ANSWER_DIRECTLY");

  const rumor = candidate({
    candidateId: "candidate:rumor",
    property: "/rumeurs/egouts",
    value: "Les égouts rejoindraient les caves des Archives.",
    authority: "TESTIMONY",
    sourceRefs: ["claim:rumor-egouts"],
    visibility: "ACTOR_SCOPED"
  });
  const rumorDisclosure = projectNpcInformationDisclosureV1({
    projectionId: "disclosure:rumor",
    resolution: resolution([rumor], [[rumor.candidateId, "KNOWN", ["BELIEVED"]]]),
    ownerContext
  });
  assert.equal(rumorDisclosure.decision, "ANSWER_QUALIFIED");
  assert.equal(rumorDisclosure.cause.code, "ACTOR_BELIEF_QUALIFIED");
  assert.equal(rumorDisclosure.authorizedFacts[0]?.delivery, "QUALIFIED_BELIEF");

  const uncertainty = candidate({
    candidateId: "candidate:uncertain",
    property: "/bruit_souterrain",
    value: "Un bruit aurait été entendu sous la place.",
    authority: "TESTIMONY",
    sourceRefs: ["claim:uncertain-noise"],
    visibility: "ACTOR_SCOPED"
  });
  const uncertainDisclosure = projectNpcInformationDisclosureV1({
    projectionId: "disclosure:uncertain",
    resolution: resolution([uncertainty], [[uncertainty.candidateId, "KNOWN", ["UNCERTAIN"]]]),
    ownerContext
  });
  assert.equal(uncertainDisclosure.cause.code, "ACTOR_UNCERTAINTY_QUALIFIED");
  assert.equal(uncertainDisclosure.authorizedFacts[0]?.delivery, "QUALIFIED_UNCERTAINTY");

  const secret = candidate({
    candidateId: "candidate:protected",
    property: "/protected_key_location",
    value: "La clef est derrière le troisième registre.",
    authority: "OWNER_STATE",
    sourceRefs: ["fact:protected-key-location", "private:owner-proof"],
    visibility: "SYSTEM_PRIVATE"
  });
  const protectedDisclosure = projectNpcInformationDisclosureV1({
    projectionId: "disclosure:protected",
    resolution: resolution([secret], [[secret.candidateId, "KNOWN", ["ACQUIRED"]]]),
    ownerContext
  });
  assert.equal(protectedDisclosure.decision, "WITHHOLD_PROTECTED");
  assert.equal(protectedDisclosure.cause.code, "OWNER_PROTECTED_INFORMATION");
  assert.equal(protectedDisclosure.withheldCandidateCount, 1);
  assert.deepEqual(protectedDisclosure.authorizedFacts, []);
  const protectedSerialized = JSON.stringify(protectedDisclosure);
  assert.doesNotMatch(protectedSerialized, /troisième registre|protected-key-location|private:owner-proof/iu);
  assert.deepEqual(validateNpcInformationDisclosureProjectionV1(protectedDisclosure), { ok: true });

  const procedure = candidate({
    candidateId: "candidate:unknown-procedure",
    property: "/procedure_consultation",
    value: "Le formulaire dépend du registre demandé.",
    authority: "LORE_INITIAL",
    sourceRefs: ["lore-fact:fact.archives_de_lysenthe.procedure_consultation"],
    visibility: "PLAYER_VISIBLE"
  });
  const redirected = projectNpcInformationDisclosureV1({
    projectionId: "disclosure:redirect",
    resolution: resolution([procedure], [[procedure.candidateId, "UNKNOWN_TO_ACTOR", []]], "PROCEDURE"),
    ownerContext
  });
  assert.equal(redirected.decision, "REDIRECT_CREDIBLY");
  assert.equal(redirected.cause.code, "CREDIBLE_ALTERNATIVE_AVAILABLE");
  assert.deepEqual(redirected.cause.alternativeActorRefs, ["actor:npc-archiviste-archives"]);
  assert.ok(redirected.cause.publicPolicyRefs.includes("policy:archives:public-consultation-owner"));

  const ignorance = projectNpcInformationDisclosureV1({
    projectionId: "disclosure:ignorance",
    resolution: resolution([publicFact], [[publicFact.candidateId, "UNKNOWN_TO_ACTOR", []]]),
    ownerContext: { ...ownerContext, credibleAlternatives: [] }
  });
  assert.equal(ignorance.decision, "ACTOR_DOES_NOT_KNOW");
  assert.equal(ignorance.cause.code, "ACTOR_LACKS_KNOWLEDGE");

  const unresolved = projectNpcInformationDisclosureV1({
    projectionId: "disclosure:no-fact",
    resolution: resolution([], []),
    ownerContext: { ...ownerContext, credibleAlternatives: [] }
  });
  assert.equal(unresolved.decision, "ACTOR_DOES_NOT_KNOW");
  assert.equal(unresolved.cause.code, "NO_RESOLVED_INFORMATION");

  console.log("npc-information-disclosure/J10-I5: OK (public answer, qualified rumor/uncertainty, protected secret, real ignorance, credible redirect, no generic role refusal)");
}

function perspectives(): ActorClaimPerspectiveV1[] {
  return [
    perspective("perspective:rumor-egouts", "claim:rumor-egouts", "BELIEVED", "MEDIUM"),
    perspective("perspective:uncertain-noise", "claim:uncertain-noise", "UNCERTAIN", "LOW")
  ];
}

function perspective(perspectiveRef: string, claimRef: string, stance: ActorClaimPerspectiveV1["stance"], confidence: ActorClaimPerspectiveV1["confidence"]): ActorClaimPerspectiveV1 {
  return {
    schemaVersion: 1,
    contractVersion: "actor-claim-perspective/1",
    perspectiveRef,
    actorRef,
    claimRef,
    stance,
    confidence,
    supportRefs: ["testimony:archives-local"],
    mayBeFalse: true,
    privateTruthRef: null,
    deceptionCauseRef: null,
    visibility: "PRIVATE_TO_ACTOR_DOMAIN",
    version: 1
  };
}

function secretResolution(): ObjectiveClaimResolutionV1 {
  return {
    schemaVersion: 1,
    contractVersion: "objective-claim-resolution/1",
    resolutionRef: "claim-resolution:protected-key",
    claimRef: "claim:protected-key",
    resolution: "CONFIRMED",
    ownerDomain: "PlotDomain",
    factRefs: ["fact:protected-key-location"],
    visibility: "SYSTEM_PRIVATE",
    version: 1
  };
}

const archiveAlternative: NpcCredibleInformationAlternativeV1 = {
  schemaVersion: 1,
  actorRef: "actor:npc-archiviste-archives",
  coveredProperties: ["/procedure_consultation"],
  coveredAnswerShapes: ["PROCEDURE"],
  publicReasonRef: "policy:archives:public-consultation-owner"
};

function candidate(input: Pick<ResolvedInformationCandidateV1, "candidateId" | "property" | "value" | "authority" | "sourceRefs" | "visibility">): ResolvedInformationCandidateV1 {
  return {
    schemaVersion: 1,
    candidateId: input.candidateId,
    subjectRef: "lore-entity:lysenthe",
    property: input.property,
    value: input.value,
    authority: input.authority,
    visibility: input.visibility,
    sourceKnowledgeLevel: input.visibility === "PLAYER_VISIBLE" ? "LOCAL" : "RESTREINT",
    scopeRefs: ["lore-entity:lysenthe"],
    sourceRefs: input.sourceRefs
  };
}

function resolution(
  candidates: ResolvedInformationCandidateV1[],
  knowledge: Array<[string, "KNOWN" | "UNKNOWN_TO_ACTOR", ActorInformationBasisV1[]]>,
  requestedAnswerShape: NpcInformationResolutionV1["need"]["requestedAnswerShape"] = "IDENTITY"
): NpcInformationResolutionV1 {
  return {
    schemaVersion: 1,
    contractVersion: "npc-information-resolution/1",
    resolutionId: `resolution:${candidates[0]?.candidateId ?? "empty"}`,
    actorRef,
    need: { schemaVersion: 1, contractVersion: "information-need/1", subjectMention: "Lysenthe", proposedSubjectRef: "lore-entity:lysenthe", requestedDimension: candidates[0]?.property ?? "information absente", temporalScope: "CURRENT", requestedAnswerShape, sourceComponentId: "component:j10i5" },
    candidates,
    selectedCandidateIds: candidates.map(entry => entry.candidateId),
    missingDimensions: candidates.length === 0 ? ["information absente"] : [],
    actorKnowledge: {
      status: candidates.length === 0 ? "UNRESOLVED" : knowledge.some(([, status]) => status === "KNOWN") ? "KNOWS" : "DOES_NOT_KNOW",
      bases: [...new Set(knowledge.flatMap(([, , bases]) => bases))],
      sourceRefs: [],
      candidateKnowledge: knowledge.map(([candidateId, status, bases]) => ({ schemaVersion: 1, candidateId, status, bases, evidenceRefs: [], reason: status === "KNOWN" ? "Base propriétaire établie." : "Aucune base propriétaire." }))
    },
    disclosure: { decision: "UNRESOLVED", reason: "J10-I5 non projeté.", sourceRefs: [] },
    creation: { status: candidates.length === 0 ? "REQUIRED_NOT_EXECUTED" : "NOT_NEEDED", proposalRefs: [] },
    authority: "FACT_LOOKUP_AND_DISCLOSURE_RECEIPT_ONLY",
    performerMayCreateFacts: false,
    version: 1
  };
}

main();
