import {
  buildHeardKnowledgeAcquisitionsV1,
  validateActorClaimPerspectiveV1,
  validateActorKnowledgeAcquisitionV1,
  validateKnowledgeClaimV1,
  validateObjectiveClaimResolutionV1,
  validateTestimonyRecordV1,
  type ActorClaimPerspectiveV1,
  type KnowledgeClaimV1,
  type TestimonyRecordV1
} from "../../src/application";
import { assert } from "../contracts/assertions";

const claim: KnowledgeClaimV1 = {
  schemaVersion: 1,
  contractVersion: "knowledge-claim/1",
  claimRef: "claim:central-sewer-noise",
  subject: { schemaVersion: 1, subjectRef: "place-hypothesis:central-sewer", subjectKind: "PLACE", publicLabel: "Égout du Centre" },
  proposition: "Du bruit a été entendu près de l'Égout du Centre.",
  sourceRefs: ["utterance:npc-archivist:1"],
  version: 1
};
assert.equal(validateKnowledgeClaimV1(claim).ok, true);

const perspectives: ActorClaimPerspectiveV1[] = [
  perspective("npc:archivist", "perspective:archivist-noise", "BELIEVED", true),
  perspective("npc:clerk", "perspective:clerk-noise", "UNCERTAIN", true),
  {
    ...perspective("npc:guard", "perspective:guard-noise", "INTENDS_TO_DECEIVE", true),
    privateTruthRef: "claim-resolution:central-sewer-noise:true",
    deceptionCauseRef: "plot-cause:guard-protects-smugglers"
  }
];
perspectives.forEach(value => assert.equal(validateActorClaimPerspectiveV1(value).ok, true));
assert.equal(validateActorClaimPerspectiveV1({
  ...perspectives[2]!, privateTruthRef: null
}).ok, false, "un mensonge intentionnel exige une vérité privée de référence");

const testimonies = perspectives.map((perspectiveValue, index): TestimonyRecordV1 => ({
  schemaVersion: 1,
  contractVersion: "testimony-record/1",
  testimonyRef: `testimony:central-sewer:${index + 1}`,
  operationRef: `operation:central-sewer:${index + 1}`,
  sceneRef: "scene:archives",
  speakerActorRef: perspectiveValue.actorRef,
  audienceActorRefs: ["character:aryn"],
  utteranceRef: `utterance:central-sewer:${index + 1}`,
  claims: [{
    claimRef: claim.claimRef,
    privatePerspectiveRef: perspectiveValue.perspectiveRef,
    publicDelivery: perspectiveValue.stance === "UNCERTAIN" ? "UNCERTAINTY" : "ASSERTION"
  }],
  sourceRefs: [`operation:central-sewer:${index + 1}`, `utterance:central-sewer:${index + 1}`],
  authority: "ATTRIBUTED_SPEECH_ONLY",
  assertsObjectiveTruth: false,
  version: 1
}));

const heard = testimonies.flatMap(testimony => {
  assert.equal(validateTestimonyRecordV1(testimony).ok, true);
  const result = buildHeardKnowledgeAcquisitionsV1({ actorRef: "character:aryn", testimony });
  assert.equal(result.ok, true);
  return result.ok ? result.acquisitions : [];
});
assert.equal(heard.length, 3);
assert.equal(heard.every(value => value.status === "HEARD" && value.assertsObjectiveTruth === false), true);
assert.equal(heard.every(value => validateActorKnowledgeAcquisitionV1(value).ok), true);
assert.equal(new Set(heard.map(value => value.channelRef)).size, 3, "trois témoignages restent trois sources distinctes");

assert.equal(validateActorKnowledgeAcquisitionV1({
  ...heard[0]!, status: "CONFIRMED", channelRef: testimonies[0]!.testimonyRef
}).ok, false, "un témoignage seul ne confirme pas la vérité");

assert.equal(validateObjectiveClaimResolutionV1({
  schemaVersion: 1,
  contractVersion: "objective-claim-resolution/1",
  resolutionRef: "claim-resolution:central-sewer-noise:true",
  claimRef: claim.claimRef,
  resolution: "CONFIRMED",
  ownerDomain: "CampaignFactDomain",
  factRefs: ["campaign-fact:central-sewer-noise"],
  visibility: "SYSTEM_PRIVATE",
  version: 1
}).ok, true);

console.log("knowledge claims: truth-neutral claims, private perspectives, testimonies and heard knowledge verified.");

function perspective(
  actorRef: string,
  perspectiveRef: string,
  stance: ActorClaimPerspectiveV1["stance"],
  mayBeFalse: boolean
): ActorClaimPerspectiveV1 {
  return {
    schemaVersion: 1,
    contractVersion: "actor-claim-perspective/1",
    perspectiveRef,
    actorRef,
    claimRef: claim.claimRef,
    stance,
    confidence: "MEDIUM",
    supportRefs: [`testimony-source:${actorRef.replace(/^[^:]+:/u, "")}`],
    mayBeFalse,
    privateTruthRef: null,
    deceptionCauseRef: null,
    visibility: "PRIVATE_TO_ACTOR_DOMAIN",
    version: 1
  };
}
