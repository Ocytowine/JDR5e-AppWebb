import assert from "node:assert/strict";
import type { AiStructuredSemanticIntentV1 } from "../../src/ai/types";
import {
  buildLocalIntentPayload,
  buildPerceptionSkillCheckOutcomePolicyV1,
  buildSceneReferentRegistryV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  resolvePerceptionV1
} from "../../src/application";
import {
  applyInstalledAccessPerceptionCatalogV1,
  buildTharqualBarracksAccessControlV1
} from "../../../src/narration-ui/playableCampaignAccessCatalog";

const boundaryRef = "poi:caserne_centrale:poi:2";
const scene = applyInstalledAccessPerceptionCatalogV1({
  ...REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  sceneId: "wiki-location:caserne_centrale",
  locationName: "Caserne centrale",
  pointsOfInterest: [{
    schemaVersion: 1,
    pointId: "caserne_centrale:poi:2",
    label: "Château Tharqual",
    visibleDescription: "Le passage gardé mène vers le Château Tharqual.",
    keywords: ["passage", "garde", "château", "tharqual"],
    destinationAliases: ["Château Tharqual", "chateau tharqual"],
    version: 1
  }],
  perceptionClues: []
});

assert.equal(scene.perceptionClues.length, 3);
assert.equal(buildTharqualBarracksAccessControlV1().approachDomains.includes("perception"), true);

const direct = resolvePerceptionV1({
  semanticIntent: observation("GLANCE", "observer le passage"),
  targetRef: boundaryRef,
  scene
});
assert.equal(direct?.status, "AUTOMATIC_RESULT");
assert.deepEqual(direct?.revealedClueRefs, ["tharqual-threshold:visible-control"]);
assert.match(direct?.revealedTexts[0] ?? "", /gardé en permanence.*contrôle formel/u);

const contradiction = resolvePerceptionV1({
  semanticIntent: observation("FOCUSED", "vérifier la porte latérale supposée"),
  targetRef: boundaryRef,
  scene
});
assert.equal(contradiction?.status, "AUTOMATIC_RESULT");
assert.match(contradiction?.revealedTexts[0] ?? "", /aucune ouverture secondaire visible/u);
assert.match(contradiction?.revealedTexts[0] ?? "", /n'est pas confirmée/u);

const search = resolvePerceptionV1({
  semanticIntent: observation("SEARCH", "chercher une autre entrée"),
  targetRef: boundaryRef,
  scene
});
assert.equal(search?.status, "CHECK_REQUIRED");
assert.equal(search?.revealedClueRefs.length, 0);
assert.equal(search?.withheldClueRefs.includes("tharqual-threshold:officer-command-signal"), true);
assert.equal(search?.checkProposal?.domain, "perception");

if (search?.checkProposal === null || search?.checkProposal === undefined) {
  throw new Error("access perception proposal missing");
}
const policy = buildPerceptionSkillCheckOutcomePolicyV1({
  proposal: search.checkProposal,
  scene
});
assert.equal(policy.ok, true);
if (!policy.ok) throw new Error("access perception policy failed");
assert.deepEqual(policy.value.success.effectPayload.revealedClueRefs, [
  "tharqual-threshold:officer-command-signal"
]);
assert.match(policy.value.success.publicSummary, /approche possible/u);
assert.doesNotMatch(policy.value.success.publicSummary, /passage est maintenant ouvert/u);
assert.equal(policy.value.success.ownerDomain, "perception");

const nothingFound = resolvePerceptionV1({
  semanticIntent: observation("FOCUSED", "chercher une poterne dans le mur nord"),
  targetRef: "element:unsupported-north-wall",
  scene
});
assert.equal(nothingFound?.status, "NOT_PERCEPTIBLE");
assert.deepEqual(nothingFound?.revealedClueRefs, []);

const local = buildLocalIntentPayload(
  "Je cherche minutieusement une autre entrée vers le Château Tharqual.",
  [],
  buildSceneReferentRegistryV1(scene)
).intents[0];
assert.equal(local.semanticIntent.kind, "observe_environment");
assert.equal(local.semanticIntent.perception?.depth, "SEARCH");
assert.equal(local.runtimeHandling.requiredDomain, "perception");
assert.equal(local.target?.ref, boundaryRef);

console.log("access-perception/1: information, contradiction, check, approach and no-result remain non-authoritative");

function observation(
  depth: "GLANCE" | "FOCUSED" | "SEARCH",
  focus: string
): AiStructuredSemanticIntentV1 {
  return {
    schemaVersion: 1,
    kind: "observe_environment",
    playerGoal: focus,
    target: { kind: "object", ref: boundaryRef, label: "passage vers le Château Tharqual" },
    commitment: "committed",
    evidenceFromInput: [focus],
    uncertainties: [],
    forbiddenInterpretations: ["inventer une entrée", "ouvrir le contrôle"],
    confidence: "high",
    perception: {
      schemaVersion: 1,
      depth,
      focus,
      soughtInformation: depth === "SEARCH" ? focus : null
    }
  };
}
