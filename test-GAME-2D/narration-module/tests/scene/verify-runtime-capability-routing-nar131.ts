import assert from "node:assert/strict";
import type { AiIntentRuntimeHandlingV1, AiStructuredSemanticIntentV1 } from "../../src/ai/types";
import { routeNarrativeSemanticIntentV1 } from "../../src/application";

const baseSemantic: AiStructuredSemanticIntentV1 = {
  schemaVersion: 1,
  kind: "manipulate_visible_object",
  playerGoal: "interagir avec la cible indiquée",
  target: { kind: "object", ref: "poi:back-room-door", label: "Porte du fond" },
  commitment: "committed",
  evidenceFromInput: ["geste explicite"],
  uncertainties: [],
  forbiddenInterpretations: ["scene_transition"],
  confidence: "high",
  perception: null,
  dialogueAct: null
};

function suggestion(domain: AiIntentRuntimeHandlingV1["requiredDomain"], hint: string | null): AiIntentRuntimeHandlingV1 {
  return { schemaVersion: 1, status: "SUPPORTED_BY_CURRENT_RUNTIME", reason: "suggestion test", requiredDomain: domain, canonicalActionHint: hint, noCommit: false, noGameTime: true };
}

const sceneWithoutHint = routeNarrativeSemanticIntentV1({ semanticIntent: baseSemantic, runtimeSuggestion: suggestion("scene_resolution", null) });
assert.equal(sceneWithoutHint.capabilityId, "scene.visible-interaction", "la cible de scène suffit sans action canonique open/force");
assert.equal(sceneWithoutHint.disposition, "HANDLE");
assert.equal(sceneWithoutHint.requiredDomain, "scene_resolution");

const sceneWithIrrelevantHint = routeNarrativeSemanticIntentV1({ semanticIntent: baseSemantic, runtimeSuggestion: suggestion("scene_resolution", "ask") });
assert.equal(sceneWithIrrelevantHint.routeId, sceneWithoutHint.routeId, "canonicalActionHint ne doit pas changer le routage sémantique");

const sceneDespiteIncompatibleWorldSuggestion = routeNarrativeSemanticIntentV1({ semanticIntent: baseSemantic, runtimeSuggestion: suggestion("world", "open") });
assert.equal(sceneDespiteIncompatibleWorldSuggestion.capabilityId, "scene.visible-interaction", "une suggestion world incompatible ne détourne pas une cible de scène visible");

const inventory = routeNarrativeSemanticIntentV1({
  semanticIntent: { ...baseSemantic, target: { kind: "object", ref: "item:healing-potion", label: "Potion" } },
  runtimeSuggestion: suggestion("inventory", "act")
});
assert.equal(inventory.disposition, "HANDOFF");
assert.equal(inventory.requiredDomain, "inventory");
assert.equal(inventory.commandFamily, "HANDOFF");

const dialogue = routeNarrativeSemanticIntentV1({
  semanticIntent: { ...baseSemantic, kind: "address_visible_actor", target: { kind: "npc", ref: "npc:npc-garde-blesse", label: "Garde blessé" } },
  runtimeSuggestion: suggestion("social", null)
});
assert.equal(dialogue.capabilityId, "scene.visible-dialogue");
assert.equal(dialogue.commandFamily, "SPEECH");

const approach = routeNarrativeSemanticIntentV1({
  semanticIntent: { ...baseSemantic, kind: "move_near_visible_actor", target: { kind: "npc", ref: "npc:npc-garde-blesse", label: "Garde blessé" } },
  runtimeSuggestion: suggestion("scene_resolution", "approcher")
});
assert.equal(approach.capabilityId, "scene.visible-interaction");
assert.equal(approach.commandFamily, "SCENE_INTERACTION");

const transition = routeNarrativeSemanticIntentV1({
  semanticIntent: { ...baseSemantic, kind: "traverse_visible_boundary", forbiddenInterpretations: [] },
  runtimeSuggestion: suggestion("world", "franchir")
});
assert.equal(transition.disposition, "HANDOFF");
assert.equal(transition.requiredDomain, "world");

const perception = routeNarrativeSemanticIntentV1({
  semanticIntent: { ...baseSemantic, kind: "observe_environment", commitment: "committed", target: null },
  runtimeSuggestion: suggestion("perception", null)
});
assert.equal(perception.capabilityId, "scene.visible-perception");
assert.equal(perception.commitPolicy, "FORBIDDEN");

const unclear = routeNarrativeSemanticIntentV1({
  semanticIntent: { ...baseSemantic, kind: "unclear_intent", playerGoal: "faire quelque chose", target: null },
  runtimeSuggestion: suggestion("scene_resolution", "act")
});
assert.equal(unclear.disposition, "CLARIFY");
assert.equal(unclear.requiredDomain, null, "une intention inconnue ne retombe plus par défaut dans scene_resolution");

console.log("runtime-capability-routing/nar131: OK");
