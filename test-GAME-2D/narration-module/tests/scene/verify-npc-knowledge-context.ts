import assert from "node:assert/strict";
import {
  ACTOR_CLAIM_PERSPECTIVE_CONTRACT_V1,
  ACTOR_KNOWLEDGE_ACQUISITION_CONTRACT_V1,
  KNOWLEDGE_CLAIM_CONTRACT_V1,
  OBJECTIVE_CLAIM_RESOLUTION_CONTRACT_V1,
  projectNpcAuthorizedKnowledgeContextV1,
  npcAuthorizedKnowledgeSourceRefsV1,
  type ActorClaimPerspectiveV1,
  type ActorKnowledgeAcquisitionV1,
  type KnowledgeClaimV1,
  type ObjectiveClaimResolutionV1,
  type SocialActorStateV1
} from "../../src/application";

const actorRef = "actor:npc:npc-garde-archives";
const claims: KnowledgeClaimV1[] = [
  claim("claim:salle-existe", "Une salle des archives confidentielles se trouve derrière la galerie nord."),
  claim("claim:mandat", "Un mandat officiel est requis pour franchir la porte."),
  claim("claim:bruit", "Un bruit aurait été entendu sous la place."),
  claim("claim:leurre", "La clef se trouverait dans le bureau du prévôt.")
];
const perspectives: ActorClaimPerspectiveV1[] = [
  perspective("perspective:salle", "claim:salle-existe", "KNOWN", false),
  perspective("perspective:mandat", "claim:mandat", "BELIEVED", true),
  perspective("perspective:bruit", "claim:bruit", "UNCERTAIN", true),
  {
    ...perspective("perspective:leurre", "claim:leurre", "INTENDS_TO_DECEIVE", true),
    privateTruthRef: "fact:clef-cachee-ailleurs",
    deceptionCauseRef: "cause:proteger-le-prevot"
  }
];
const socialActor: SocialActorStateV1 = {
  schemaVersion: 1,
  actorId: "npc-garde-archives",
  knownFactRefs: ["fact:porte-gardee"],
  beliefs: [{
    beliefId: "rumeur-egouts",
    claim: "Les égouts du centre rejoindraient les caves des Archives.",
    confidence: "LOW",
    sourceRefs: ["event:rumeur-taverne"],
    mayBeFalse: true
  }],
  relationships: [{ targetActorId: "player", trust: -2, affinity: 0, fear: 1, debt: 0, sourceRefs: ["event:altercation"] }],
  reputationMarkers: [],
  debtsAndPromises: [],
  concerns: [{
    concernId: "proteger-secret",
    status: "ACTIVE",
    privateObjective: "Cacher l'existence de la clef.",
    publicActionHint: "Surveiller la galerie.",
    actKind: "SPEAK",
    urgency: 80,
    availableFromGameSecond: 0,
    expiresAtGameSecond: null,
    targetRefs: ["actor:player"],
    sourceRefs: ["plot:secret-clef"],
    minimumIntervalSeconds: 60,
    lastExecutedAtGameSecond: null,
    executionCount: 0
  }],
  visibilityConstraints: ["Ne jamais révéler la clef."],
  sourceEventRefs: ["event:creation-garde"],
  lastInitiativeAtGameSecond: null,
  version: 1
};

const acquisitions: ActorKnowledgeAcquisitionV1[] = [{
  schemaVersion: 1,
  contractVersion: ACTOR_KNOWLEDGE_ACQUISITION_CONTRACT_V1,
  acquisitionRef: "knowledge-acquisition:mandat-refute:garde",
  actorRef,
  claimRef: "claim:mandat",
  status: "REFUTED",
  channelRef: "claim-resolution:mandat-refute",
  sourceRefs: ["claim-resolution:mandat-refute", "fact:reglement-acces"],
  assertsObjectiveTruth: false,
  version: 1
}];
const resolutions: ObjectiveClaimResolutionV1[] = [{
  schemaVersion: 1,
  contractVersion: OBJECTIVE_CLAIM_RESOLUTION_CONTRACT_V1,
  resolutionRef: "claim-resolution:mandat-refute",
  claimRef: "claim:mandat",
  resolution: "REFUTED",
  ownerDomain: "AccessDomain",
  factRefs: ["fact:reglement-acces"],
  visibility: "ACTOR_SCOPED",
  version: 1
}];
const projection = projectNpcAuthorizedKnowledgeContextV1({
  actorRef,
  socialActor,
  perspectives,
  claims,
  acquisitions,
  resolutions
});
assert.deepEqual(projection.claimPerspectives.map(item => [item.claimRef, item.epistemicBasis]), [
  ["claim:bruit", "uncertain"],
  ["claim:salle-existe", "known"]
]);
assert.deepEqual(projection.resolvedClaims, [{
  resolutionRef: "claim-resolution:mandat-refute",
  claimRef: "claim:mandat",
  proposition: "Un mandat officiel est requis pour franchir la porte.",
  resolution: "REFUTED",
  epistemicBasis: "known"
}]);
assert.deepEqual(projection.knownFactRefs, ["fact:porte-gardee"]);
assert.equal(projection.legacyBeliefs[0]?.epistemicBasis, "believed");
assert.equal(projection.intentionalDeceptionAllowed, false);
assert.equal(projection.claimPerspectives.some(item => item.claimRef === "claim:leurre"), false);

const serialized = JSON.stringify(projection);
for (const forbidden of [
  "fact:clef-cachee-ailleurs",
  "cause:proteger-le-prevot",
  "Cacher l'existence de la clef",
  "Ne jamais révéler la clef",
  "event:altercation",
  "plot:secret-clef"
]) assert.equal(serialized.includes(forbidden), false, `private value leaked: ${forbidden}`);

assert.deepEqual(npcAuthorizedKnowledgeSourceRefsV1(projection), [
  "claim-resolution:mandat-refute",
  "claim:bruit",
  "claim:salle-existe",
  "fact:porte-gardee",
  "social-belief:actor-npc-npc-garde-archives:rumeur-egouts"
]);

console.log("NPC authorized knowledge context checks passed.");

function claim(claimRef: string, proposition: string): KnowledgeClaimV1 {
  return {
    schemaVersion: 1,
    contractVersion: KNOWLEDGE_CLAIM_CONTRACT_V1,
    claimRef,
    subject: { schemaVersion: 1, subjectRef: "knowledge-subject:salle-confidentielle", subjectKind: "PLACE", publicLabel: "Salle des archives confidentielles" },
    proposition,
    sourceRefs: ["testimony:source"],
    version: 1
  };
}

function perspective(
  perspectiveRef: string,
  claimRef: string,
  stance: ActorClaimPerspectiveV1["stance"],
  mayBeFalse: boolean
): ActorClaimPerspectiveV1 {
  return {
    schemaVersion: 1,
    contractVersion: ACTOR_CLAIM_PERSPECTIVE_CONTRACT_V1,
    perspectiveRef,
    actorRef,
    claimRef,
    stance,
    confidence: stance === "KNOWN" ? "HIGH" : stance === "UNCERTAIN" ? "LOW" : "MEDIUM",
    supportRefs: ["testimony:source"],
    mayBeFalse,
    privateTruthRef: null,
    deceptionCauseRef: null,
    visibility: "PRIVATE_TO_ACTOR_DOMAIN",
    version: 1
  };
}
