import type { AiRoleV1 } from "../ai/types";
import type { JsonObject } from "../core";
import type { NarrativeIntentInterpretationV1 } from "./intentClarification";

export const NARRATIVE_AI_ROLE_STRATEGY_V1 = "narrative-ai-role-strategy/1" as const;

export interface NarrativeAiRoleStrategyV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof NARRATIVE_AI_ROLE_STRATEGY_V1;
  family: "CLARIFICATION" | "V8_DIALOGUE" | "V8_SCENE_RENDER" | "LEGACY_PLANNED";
  maximumRemoteSequence: AiRoleV1[];
  maxBillableCalls: 3 | 4;
  mjPlannerAllowed: boolean;
  authority: "ORCHESTRATION_ONLY";
}

export function buildNarrativeAiRoleStrategyV1(
  interpretation: NarrativeIntentInterpretationV1
): NarrativeAiRoleStrategyV1 {
  if (interpretation.requiresClarification || interpretation.runtimeDecision.status === "AI_INTERPRETATION_FAILED") {
    return strategy("CLARIFICATION", ["player_intent_interpreter"], false);
  }
  if (interpretation.semanticSource === "OPEN_SEMANTIC_FRAME_V8") {
    return interpretation.openSemanticRuntime?.executionPlan.steps.some(step =>
      step.capabilityId === "scene.visible-dialogue" || step.capabilityId?.startsWith("companion.")
    ) === true
      ? strategy("V8_DIALOGUE", ["player_intent_interpreter", "scene_creator", "npc_performer", "coherence_critic"], false)
      : strategy("V8_SCENE_RENDER", ["player_intent_interpreter", "scene_writer", "coherence_critic"], false);
  }
  return strategy("LEGACY_PLANNED", ["player_intent_interpreter", "mj_planner", "scene_writer"], true);
}

export function shouldUseMjPlannerForNarrativeTurnV1(
  interpretation: NarrativeIntentInterpretationV1
): boolean {
  return buildNarrativeAiRoleStrategyV1(interpretation).mjPlannerAllowed;
}

function strategy(
  family: NarrativeAiRoleStrategyV1["family"],
  maximumRemoteSequence: AiRoleV1[],
  mjPlannerAllowed: boolean
): NarrativeAiRoleStrategyV1 {
  return {
    schemaVersion: 1,
    contractVersion: NARRATIVE_AI_ROLE_STRATEGY_V1,
    family,
    maximumRemoteSequence,
    maxBillableCalls: maximumRemoteSequence.length === 4 ? 4 : 3,
    mjPlannerAllowed,
    authority: "ORCHESTRATION_ONLY"
  };
}
