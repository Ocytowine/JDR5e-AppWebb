import assert from "node:assert/strict";
import {
  KNOWLEDGE_CLAIM_CONTRACT_V1,
  TESTIMONY_RECORD_CONTRACT_V1,
  projectSceneCreatorEpistemicContextV1,
  type EffectiveLoreInfluenceV1,
  type KnowledgeClaimV1,
  type LoreGuidedSceneCreationBriefV1,
  type TestimonyRecordV1
} from "../../src/application";

const strictLore = influence({
  sourceRef: "wiki:archives",
  effectiveText: "Les Archives occupent le centre du quartier.",
  authority: "LORE_INITIAL"
});
const campaignProjection = influence({
  sourceRef: "wiki:archives",
  effectiveText: "La galerie nord est fermée depuis l'incident.",
  authority: "CAMPAIGN_PROJECTION",
  campaignProjectionId: "archives-galerie-fermee",
  effectiveSourceRefs: ["wiki:archives", "event:incident-galerie"]
});
const brief: LoreGuidedSceneCreationBriefV1 = {
  schemaVersion: 1,
  contractVersion: "lore-guided-scene-creation-brief/1",
  briefId: "brief:cour-copistes",
  creationType: "PLACE",
  anchorEntityId: "archives",
  geographicChain: ["lysenthe", "quartier-archives"],
  strictConstraints: [strictLore, campaignProjection],
  localGuidance: [],
  regionalGuidance: [],
  unresolvedDimensions: [],
  sourceRefs: ["wiki:archives", "event:incident-galerie"],
  appliedCampaignProjectionIds: ["archives-galerie-fermee"],
  nonCommittable: true,
  version: 1
};
const claim: KnowledgeClaimV1 = {
  schemaVersion: 1,
  contractVersion: KNOWLEDGE_CLAIM_CONTRACT_V1,
  claimRef: "claim:grille-cour",
  subject: { schemaVersion: 1, subjectRef: "knowledge-subject:cour-copistes", subjectKind: "PLACE", publicLabel: "Cour des Copistes" },
  proposition: "Une grille condamnée se trouverait derrière la Cour des Copistes.",
  sourceRefs: ["utterance:clerc-grille"],
  version: 1
};
const playerTestimony = testimony("testimony:clerc-grille", ["actor:hero"]);
const privateTestimony = testimony("testimony:garde-secret", ["actor:complice"]);

const projection = projectSceneCreatorEpistemicContextV1({
  brief,
  claims: [claim],
  testimonies: [playerTestimony, privateTestimony],
  audienceActorRef: "actor:hero"
});
assert.deepEqual(projection.authoritativeTruths.map(item => item.text), [
  "Les Archives occupent le centre du quartier.",
  "La galerie nord est fermée depuis l'incident."
]);
assert.deepEqual(projection.campaignCommitments, [{
  commitmentRef: "campaign-projection:archives-galerie-fermee",
  text: "La galerie nord est fermée depuis l'incident.",
  sourceRefs: ["wiki:archives", "event:incident-galerie"]
}]);
assert.equal(projection.attributedTestimonies.length, 1);
assert.equal(projection.attributedTestimonies[0]?.testimonyRef, "testimony:clerc-grille");
assert.equal(projection.attributedTestimonies[0]?.claims[0]?.proposition, claim.proposition);
assert.equal(projection.attributedTestimonies[0]?.assertsObjectiveTruth, false);
assert.equal(JSON.stringify(projection).includes("perspective:private-grille"), false);
assert.equal(JSON.stringify(projection).includes("testimony:garde-secret"), false);

const noPlayer = projectSceneCreatorEpistemicContextV1({
  brief,
  claims: [claim],
  testimonies: [playerTestimony],
  audienceActorRef: null
});
assert.deepEqual(noPlayer.attributedTestimonies, []);

console.log("scene creator epistemic context: truths, commitments and player-heard testimonies separated.");

function influence(overrides: Partial<EffectiveLoreInfluenceV1>): EffectiveLoreInfluenceV1 {
  return {
    schemaVersion: 1,
    sourceRef: "wiki:archives",
    entityId: "archives",
    entityType: "batiment",
    fragmentId: "fragment:archives-resume",
    fieldPath: "/resume",
    knowledgeLevel: "COMMUN",
    degree: "STRICT_CANON",
    dimension: "IDENTITY",
    reason: "Identité du lieu.",
    text: "Les Archives occupent le centre du quartier.",
    initialText: "Les Archives occupent le centre du quartier.",
    effectiveText: "Les Archives occupent le centre du quartier.",
    authority: "LORE_INITIAL",
    campaignProjectionId: null,
    effectiveSourceRefs: ["wiki:archives"],
    version: 1,
    ...overrides
  };
}

function testimony(testimonyRef: string, audienceActorRefs: string[]): TestimonyRecordV1 {
  return {
    schemaVersion: 1,
    contractVersion: TESTIMONY_RECORD_CONTRACT_V1,
    testimonyRef,
    operationRef: "operation:dialogue-grille",
    sceneRef: "scene:archives",
    speakerActorRef: "actor:npc:clerc",
    audienceActorRefs,
    utteranceRef: "utterance:clerc-grille",
    claims: [{
      claimRef: claim.claimRef,
      privatePerspectiveRef: "perspective:private-grille",
      publicDelivery: "UNCERTAINTY"
    }],
    sourceRefs: ["operation:dialogue-grille"],
    authority: "ATTRIBUTED_SPEECH_ONLY",
    assertsObjectiveTruth: false,
    version: 1
  };
}
