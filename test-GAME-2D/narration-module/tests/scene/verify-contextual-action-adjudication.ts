import assert from "node:assert/strict";
import type { AiStructuredSemanticIntentV1 } from "../../src/ai/types";
import {
  adjudicateContextualActionV1,
  attachMechanicalCharacterContextV1,
  buildActionAdjudicationDiagnosticLinesV1,
  projectRelevantMechanicalCharacterContextV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  validateSkillCheckProposalV1,
  type NarrativeIntentInterpretationV1
} from "../../src/application";
import type {
  NarrativeCharacterProjectionV1,
  TacticalCharacterProjectionV1
} from "../../src/bootstrap/character/types";

function interpretation(semanticIntent: AiStructuredSemanticIntentV1): NarrativeIntentInterpretationV1 {
  return {
    schemaVersion: 1,
    contractVersion: "intent-clarification/1",
    intentId: `intent:${semanticIntent.kind}`,
    intentType: "action",
    commitment: semanticIntent.commitment,
    semanticIntent,
    referentResolution: {
      schemaVersion: 1,
      usedPreviousContext: false,
      source: "current_input",
      resolvedTarget: semanticIntent.target,
      evidence: [],
      ambiguity: "none",
      confidence: "high"
    },
    runtimeHandling: {
      schemaVersion: 1,
      status: "SUPPORTED_BY_CURRENT_RUNTIME",
      reason: "fixture",
      requiredDomain: semanticIntent.kind === "traverse_visible_boundary" ? "world" : "scene_resolution",
      canonicalActionHint: null,
      noCommit: false,
      noGameTime: true
    },
    runtimeDecision: {
      schemaVersion: 1,
      source: "LOCAL_CAPABILITY_REGISTRY",
      status: "SUPPORTED_BY_CURRENT_RUNTIME",
      reason: "fixture",
      requiredDomain: semanticIntent.kind === "traverse_visible_boundary" ? "world" : "scene_resolution",
      noCommit: false,
      noGameTime: true,
      aiSuggestionMatched: true
    },
    coreMeaning: semanticIntent.playerGoal,
    requiresClarification: false,
    clarificationQuestion: null,
    expectedTimeEffect: "DOMAIN_TO_DECIDE",
    safetyNotes: []
  };
}

function semantic(overrides: Partial<AiStructuredSemanticIntentV1>): AiStructuredSemanticIntentV1 {
  return {
    schemaVersion: 1,
    kind: "traverse_visible_boundary",
    playerGoal: "trouver une rue calme non loin",
    target: { kind: "place", ref: null, label: "une rue calme non loin" },
    commitment: "committed",
    evidenceFromInput: ["une rue calme non loin"],
    uncertainties: [],
    forbiddenInterpretations: [],
    confidence: "high",
    perception: null,
    ...overrides
  };
}

const quietStreet = adjudicateContextualActionV1({
  interpretation: interpretation(semantic({})),
  scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
});
assert.equal(quietStreet.disposition, "AUTOMATIC_SUCCESS");
assert.equal(quietStreet.resolutionScope, "ACTION_ALLOWED");
assert.equal(quietStreet.checkProposal, null);
assert.equal(buildActionAdjudicationDiagnosticLinesV1(quietStreet).some(line => /AUTOMATIC_SUCCESS/u.test(line)), true);

const deepSearch = adjudicateContextualActionV1({
  interpretation: interpretation(semantic({
    kind: "observe_environment",
    playerGoal: "chercher un mécanisme dissimulé",
    target: { kind: "object", ref: "poi:back-room-door", label: "la porte du fond" },
    perception: {
      schemaVersion: 1,
      depth: "SEARCH",
      focus: "le mécanisme",
      soughtInformation: "un mécanisme dissimulé"
    }
  })),
  scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
});
assert.equal(deepSearch.disposition, "CHECK_REQUIRED");
assert.equal(deepSearch.checkProposal?.domain, "perception");
assert.equal(deepSearch.checkProposal?.ability, "SAG");
assert.equal(deepSearch.checkProposal?.skillId, "perception");
assert.equal(deepSearch.checkProposal?.difficulty.status, "BAND_SELECTED");
assert.equal(deepSearch.checkProposal?.difficulty.band, "MEDIUM");
assert.equal(deepSearch.checkProposal?.difficulty.dc, null);
assert.equal(deepSearch.checkProposal?.difficulty.assessment?.privateFactorCount, 1);
assert.equal(deepSearch.commitAuthority, false);
assert.deepEqual(validateSkillCheckProposalV1(deepSearch.checkProposal!), { ok: true });

const absentActor = adjudicateContextualActionV1({
  interpretation: interpretation(semantic({
    kind: "move_near_visible_actor",
    playerGoal: "m'approcher du magistrat",
    target: { kind: "npc", ref: "npc:magistrat-absent", label: "le magistrat" }
  })),
  scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
});
assert.equal(absentActor.disposition, "IMPOSSIBLE");
assert.deepEqual(absentActor.ruleRefs, ["house.action.impossible-before-roll@1"]);
assert.equal(buildActionAdjudicationDiagnosticLinesV1(absentActor).some(line => /house\.action\.impossible-before-roll@1/u.test(line)), true);

const missingTarget = adjudicateContextualActionV1({
  interpretation: interpretation(semantic({
    kind: "move_near_visible_actor",
    playerGoal: "m'approcher de lui",
    target: null
  })),
  scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
});
assert.equal(missingTarget.disposition, "NEEDS_CLARIFICATION");

const tactical: TacticalCharacterProjectionV1 = {
  schemaVersion: 1,
  characterId: "character:elwen",
  level: 5,
  abilityModifiers: { FOR: 0, DEX: 2, CON: 1, INT: 1, SAG: 3, CHA: -1 },
  proficiencyBonus: 3,
  currentHitPoints: 30,
  maximumHitPoints: 30,
  temporaryHitPoints: 0,
  armorClass: 15,
  passivePerception: 19,
  movementModes: {},
  vision: {},
  actionIds: [],
  reactionIds: [],
  spellIds: [],
  resources: {},
  equippedItemInstanceIds: [],
  appearance: {}
};
const narrative: NarrativeCharacterProjectionV1 = {
  schemaVersion: 1,
  characterId: "character:elwen",
  name: "Elwen",
  raceId: "elfe",
  backgroundId: "eclaireur",
  languages: ["commun", "elfique"],
  observable: {},
  knownToPlayer: {},
  privateMechanical: {
    abilityScores: {},
    skills: ["perception", "survie"],
    expertise: ["perception"],
    featureIds: []
  }
};
const mechanicalContext = projectRelevantMechanicalCharacterContextV1({
  tactical,
  narrative,
  ability: "SAG",
  skillId: "perception",
  passiveScore: tactical.passivePerception
});
assert.equal(mechanicalContext.proficiencyRank, 2);
assert.equal(mechanicalContext.totalModifier, 9);
assert.equal(mechanicalContext.passiveScore, 19);
assert.equal(mechanicalContext.backgroundId, "eclaireur");
const enrichedSearch = attachMechanicalCharacterContextV1(deepSearch.checkProposal!, mechanicalContext);
assert.equal(enrichedSearch.characterContext?.totalModifier, 9);
assert.equal(enrichedSearch.passive.score, null);
assert.deepEqual(validateSkillCheckProposalV1(enrichedSearch), { ok: true });
const diagnosticLines = buildActionAdjudicationDiagnosticLinesV1({
  ...deepSearch,
  checkProposal: enrichedSearch
});
assert.equal(diagnosticLines.some(line => /CHECK_REQUIRED/u.test(line)), true);
assert.equal(diagnosticLines.some(line => /Sagesse \(SAG\) \/ perception/u.test(line)), true);
assert.equal(diagnosticLines.some(line => /modificateur total=\+9/u.test(line)), true);
assert.equal(diagnosticLines.some(line => /bande MEDIUM sélectionnée/u.test(line)), true);
assert.equal(diagnosticLines.some(line => /facteurs privés appliqués=1/u.test(line)), true);
assert.equal(diagnosticLines.some(line => /protected-information|HIDDEN_FACT|waitress-hidden-motive/u.test(line)), false);
assert.equal(diagnosticLines.some(line => /Jet: non lancé/u.test(line)), true);

console.log("contextual-action-adjudication: 5 scenarios passed");
