import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildNarrativeAiRoleStrategyV1,
  measureNpcPerformerPacketV1
} from "../../src/application";
import type { NarrativeIntentInterpretationV1 } from "../../src/application";
import { buildNpcDialogueFallbackV1 } from "../../src/application/npcDialogueFallback";

const dialogue = interpretation({ capabilityId: "scene.visible-dialogue" });
const dialogueStrategy = buildNarrativeAiRoleStrategyV1(dialogue);
assert.equal(dialogueStrategy.family, "V8_DIALOGUE");
assert.equal(dialogueStrategy.mjPlannerAllowed, false);
assert.deepEqual(dialogueStrategy.maximumRemoteSequence, [
  "player_intent_interpreter",
  "npc_performer",
  "coherence_critic"
]);
assert.equal(dialogueStrategy.maximumRemoteSequence.length, 3);

const actionStrategy = buildNarrativeAiRoleStrategyV1(
  interpretation({ capabilityId: "scene.visible-object-interaction" })
);
assert.equal(actionStrategy.family, "V8_SCENE_RENDER");
assert.deepEqual(actionStrategy.maximumRemoteSequence, [
  "player_intent_interpreter",
  "scene_writer",
  "coherence_critic"
]);
assert.equal(actionStrategy.maximumRemoteSequence.length, 3);

const compactReceipt = measureNpcPerformerPacketV1(
  { dialogueHistory: [{ text: "Une réponse courte." }] },
  100,
  1
);
assert.equal(compactReceipt.withinDeclaredBudget, true);
assert.equal(compactReceipt.retainedDialogueTurns, 1);
assert.equal(compactReceipt.historyLimit, 5);
const oversizedReceipt = measureNpcPerformerPacketV1(
  { dialogueHistory: [{ text: "x".repeat(500) }] },
  10,
  1
);
assert.equal(oversizedReceipt.withinDeclaredBudget, false, "la mesure doit signaler un paquet estimé hors budget");

for (const act of ["INITIATE_CONVERSATION", "ASK_QUESTION", "MAKE_STATEMENT", "REQUEST_ACTION", "OTHER"] as const) {
  const fallback = buildNpcDialogueFallbackV1("npc:ambient", act, "Le clerc");
  assert.ok(fallback.text.trim().length > 0);
  assert.doesNotMatch(fallback.text, /OpenAI|runtime|moteur|fallback|intention canonique/iu);
}
assert.match(buildNpcDialogueFallbackV1("npc:ambient", "INITIATE_CONVERSATION", "Le clerc").text, /Bonjour/iu);
assert.match(buildNpcDialogueFallbackV1("npc:ambient", "ASK_QUESTION", "Le clerc").text, /question|confirmer|vérifié/iu);
assert.match(buildNpcDialogueFallbackV1("npc:ambient", "REQUEST_ACTION", "Le clerc").text, /promettre|faire/iu);

const plannerSource = readFileSync(resolve("narration-module/src/application/mjPlanning.ts"), "utf8");
assert.match(plannerSource, /timeoutMs: input\.config\.route\.timeoutMs/u);
assert.doesNotMatch(plannerSource, /outputTokenBudget: 1_000,\s*timeoutMs: 1_000/u);
const controllerSource = readFileSync(resolve("narration-module/src/application/NarrativeTurnController.ts"), "utf8");
assert.match(controllerSource, /shouldUseMjPlannerForNarrativeTurnV1\(interpretation\)/u);
const performerSource = readFileSync(resolve("narration-module/src/application/npcPerforming.ts"), "utf8");
assert.match(performerSource, /\.slice\(-5\)/u);
assert.match(performerSource, /buildNpcFallbackFromRequestV1\(request, input\.interpretation, actorId\)/u);

console.log("ai-orchestration-resilience/J10-H4: OK (routes, paquets, trois rôles et fallbacks)");

function interpretation(input: { capabilityId: string }): NarrativeIntentInterpretationV1 {
  return {
    schemaVersion: 1,
    contractVersion: "intent-clarification/1",
    intentId: `intent:${input.capabilityId}`,
    intentType: "action",
    commitment: "committed",
    target: null,
    action: "act",
    coreMeaning: "Sens structuré de test.",
    preconditions: [],
    requiresClarification: false,
    clarificationQuestion: null,
    confidence: "high",
    expectedTimeEffect: "NO_GAME_TIME",
    safetyNotes: [],
    semanticSource: "OPEN_SEMANTIC_FRAME_V8",
    semanticIntent: {
      schemaVersion: 1,
      kind: "unclear_intent",
      playerGoal: "Sens structuré de test.",
      target: null,
      commitment: "committed",
      preconditions: [],
      evidenceFromInput: [],
      uncertainties: [],
      forbiddenInterpretations: [],
      confidence: "high",
      perception: null,
      dialogueAct: null,
      companionDirective: null,
      restPlan: null
    },
    runtimeDecision: {
      schemaVersion: 1,
      source: "LOCAL_CAPABILITY_REGISTRY",
      status: "SUPPORTED_BY_CURRENT_RUNTIME",
      requiredDomain: "scene_resolution",
      reason: "Test H4.",
      noCommit: false,
      noGameTime: true,
      aiSuggestionMatched: true
    },
    openSemanticFrame: {
      schemaVersion: 1,
      understandingStatus: "UNDERSTOOD",
      overallMeaning: "Sens structuré de test.",
      overallCommitment: "committed",
      globalConditions: [],
      components: [],
      ambiguities: [],
      clarificationQuestion: null,
      confidence: "high"
    },
    openSemanticRuntime: {
      schemaVersion: 1,
      components: [],
      executionPlan: {
        schemaVersion: 1,
        contractVersion: "open-semantic-execution-plan/1",
        understandingStatus: "UNDERSTOOD",
        overallMeaning: "Sens structuré de test.",
        steps: [{
          schemaVersion: 1,
          componentId: "component:h4",
          order: 1,
          meaning: "Sens structuré de test.",
          commitment: "committed",
          conditions: [],
          relationToPrevious: "NONE",
          dependsOnComponentIds: [],
          targetRefs: [],
          capabilityId: input.capabilityId,
          suggestedDomain: "scene_resolution",
          requiredDomain: "scene_resolution",
          disposition: "ROUTABLE",
          noCommitBeforeOwnerValidation: true,
          noGameTimeBeforeOwnerValidation: true,
          reason: "Test H4."
        }],
        authority: "OWNER_PREFLIGHT_THEN_EXECUTE",
        rawInputAccess: "FORBIDDEN"
      }
    }
  } as unknown as NarrativeIntentInterpretationV1;
}
