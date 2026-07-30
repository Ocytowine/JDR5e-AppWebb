import assert from "node:assert/strict";
import type { NarrativeIntentInterpretationV1 } from "../../src/application";
import { prepareNarrativeRestV1 } from "../../src/application";

const rules = {
  shortRestDurationSeconds: 3_600,
  longRestDurationSeconds: 28_800,
  segmentSeconds: 3_600
};

function interpretation(restKind: "SHORT_REST" | "LONG_REST" | null): NarrativeIntentInterpretationV1 {
  return {
    schemaVersion: 1,
    contractVersion: "intent-clarification/1",
    intentId: "intent-rest-preparation",
    intentType: "action",
    commitment: "committed",
    target: { kind: "self", ref: "player-character:test", label: "personnage" },
    action: "act",
    requiresClarification: false,
    clarificationQuestion: null,
    semanticIntent: {
      schemaVersion: 1,
      kind: "context_question",
      playerGoal: "prendre un repos",
      target: { kind: "self", ref: "player-character:test", label: "personnage" },
      commitment: "committed",
      evidenceFromInput: ["demande explicite"],
      uncertainties: [],
      forbiddenInterpretations: [],
      confidence: "high",
      perception: null,
      dialogueAct: null,
      restPlan: { schemaVersion: 1, restKind }
    },
    runtimeHandling: {
      schemaVersion: 1,
      status: "SUPPORTED_BY_CURRENT_RUNTIME",
      reason: "domaine repos",
      requiredDomain: "rest",
      canonicalActionHint: "act",
      noCommit: false,
      noGameTime: false
    },
    runtimeDecision: {
      schemaVersion: 1,
      source: "LOCAL_CAPABILITY_REGISTRY",
      status: "UNSUPPORTED_DOMAIN",
      requiredDomain: "rest",
      reason: "propriétaire requis",
      noCommit: true,
      noGameTime: true,
      aiSuggestionMatched: true
    },
    referentResolution: null,
    coreMeaning: "prendre un repos",
    expectedTimeEffect: "DOMAIN_TO_DECIDE",
    safetyNotes: []
  };
}

const missing = prepareNarrativeRestV1({ interpretation: interpretation(null), rules });
assert.equal(missing.status, "NEEDS_PLAYER_CHOICES");
assert.deepEqual(missing.missingChoices.map(choice => choice.choiceId), ["REST_KIND"]);
assert.equal(missing.targetDurationSeconds, null);

const short = prepareNarrativeRestV1({ interpretation: interpretation("SHORT_REST"), rules });
assert.equal(short.status, "READY");
assert.equal(short.targetDurationSeconds, 3_600);
assert.deepEqual(short.missingChoices, []);

const long = prepareNarrativeRestV1({ interpretation: interpretation("LONG_REST"), rules });
assert.equal(long.status, "READY");
assert.equal(long.targetDurationSeconds, 28_800);
assert.deepEqual(long.missingChoices, []);

console.log("rest-preparation/6A: OK");
