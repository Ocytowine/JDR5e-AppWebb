import assert from "node:assert/strict";
import type { AiStructuredSemanticIntentV1 } from "../../src/ai/types";
import {
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  resolvePerceptionV1
} from "../../src/application";

const target = {
  kind: "npc" as const,
  ref: "npc:npc-serveuse-nerveuse",
  label: "Serveuse nerveuse"
};

const glance = resolvePerceptionV1({
  semanticIntent: observation("GLANCE", "observer immédiatement la serveuse"),
  targetRef: target.ref,
  scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
});
assert.equal(glance?.status, "AUTOMATIC_RESULT");
assert.deepEqual(glance?.revealedClueRefs, ["waitress-immediate-signs"]);
assert.equal(glance?.revealedTexts.some(text => /regard revient régulièrement vers la porte/u.test(text)), true);
assert.equal(glance?.revealedClueRefs.includes("waitress-hidden-motive"), false);

const focused = resolvePerceptionV1({
  semanticIntent: observation("FOCUSED", "examiner plus attentivement les gestes de la serveuse"),
  targetRef: target.ref,
  scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
});
assert.equal(focused?.status, "AUTOMATIC_RESULT");
assert.deepEqual(focused?.revealedClueRefs, ["waitress-focused-rhythm"]);
assert.equal(focused?.revealedTexts.some(text => /geste ralentit/u.test(text)), true);
assert.equal(focused?.revealedTexts.some(text => /cause exacte|redoute|pense/u.test(text)), false);

const doorGlance = resolvePerceptionV1({
  semanticIntent: { ...observation("GLANCE", "observer la porte"), target: { kind: "object", ref: "poi:back-room-door", label: "Porte du fond" } },
  targetRef: "poi:back-room-door",
  scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
});
assert.deepEqual(doorGlance?.revealedClueRefs, ["door-immediate-signs"]);
assert.equal(doorGlance?.revealedTexts.some(text => /rien.*permet.*établir.*derrière/iu.test(text)), true);
assert.equal(doorGlance?.revealedTexts.some(text => /n'est pas verrouillée/iu.test(text)), false);

const doorFocused = resolvePerceptionV1({
  semanticIntent: { ...observation("FOCUSED", "examiner attentivement la porte"), target: { kind: "object", ref: "poi:back-room-door", label: "Porte du fond" } },
  targetRef: "poi:back-room-door",
  scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
});
assert.deepEqual(doorFocused?.revealedClueRefs, ["door-focused-signs"]);
assert.equal(doorFocused?.revealedTexts.some(text => /état interne/iu.test(text)), true);

const sceneWideGlance = resolvePerceptionV1({
  semanticIntent: {
    ...observation("GLANCE", "percevoir les personnes présentes à proximité"),
    target: null,
    perception: {
      schemaVersion: 1,
      depth: "GLANCE",
      focus: "personnes présentes à proximité",
      soughtInformation: "présences humaines perceptibles alentour"
    }
  },
  targetRef: null,
  scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
});
assert.equal(sceneWideGlance?.status, "AUTOMATIC_RESULT");
assert.equal(sceneWideGlance?.revealedTexts.some(text => /proximité.*serveuse nerveuse/iu.test(text)), true, "une observation globale expose les PNJ dans une formulation narrative");
assert.equal(sceneWideGlance?.revealedTexts.some(text => /fonction_principale|rumeurs|visible-element|point-of-interest/iu.test(text)), false, "le rendu joueur ne reçoit aucun libellé de catalogue");
assert.equal(sceneWideGlance?.revealedTexts.some(text => /cause exacte|redoute|pense/iu.test(text)), false, "une observation globale ne promeut aucun indice privé");

const search = resolvePerceptionV1({
  semanticIntent: observation("SEARCH", "chercher à déterminer la cause de sa nervosité", "cause de sa nervosité"),
  targetRef: target.ref,
  scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
});
assert.equal(search?.status, "CHECK_REQUIRED");
assert.deepEqual(search?.revealedClueRefs, []);
assert.equal(search?.withheldClueRefs.includes("waitress-hidden-motive"), true);
assert.equal(search?.checkProposal?.contractVersion, "skill-check-proposal/1");
assert.equal(search?.checkProposal?.domain, "perception");
assert.equal(search?.checkProposal?.goal, "cause de sa nervosité");
assert.equal(search?.checkProposal?.targetRef, target.ref);
assert.equal(search?.checkProposal?.ability, "SAG");
assert.equal(search?.checkProposal?.skillId, "perception");
assert.equal(search?.checkProposal?.difficulty.status, "BAND_SELECTED");
assert.equal(search?.checkProposal?.difficulty.band, "MEDIUM");
assert.equal(search?.checkProposal?.difficulty.dc, null);
assert.equal(search?.checkProposal?.commitAuthority, false);

const speech: AiStructuredSemanticIntentV1 = {
  ...observation("GLANCE", "observer"),
  kind: "address_visible_actor",
  perception: null
};
assert.equal(resolvePerceptionV1({ semanticIntent: speech, targetRef: target.ref, scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1 }), null);

console.log("perception-resolution/1: OK (GLANCE, FOCUSED, SEARCH bornés)");

function observation(
  depth: "GLANCE" | "FOCUSED" | "SEARCH",
  focus: string,
  soughtInformation: string | null = null
): AiStructuredSemanticIntentV1 {
  return {
    schemaVersion: 1,
    kind: "observe_environment",
    playerGoal: focus,
    target,
    commitment: "committed",
    evidenceFromInput: [focus],
    uncertainties: [],
    forbiddenInterpretations: ["révéler une pensée privée", "présenter une motivation comme certaine"],
    confidence: "high",
    perception: { schemaVersion: 1, depth, focus, soughtInformation }
  };
}
