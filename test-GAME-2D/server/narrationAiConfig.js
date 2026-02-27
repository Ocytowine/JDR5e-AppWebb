"use strict";

function parseBooleanEnv(name, defaultValue = false, env = process.env) {
  if (!name) return Boolean(defaultValue);
  return String(env?.[name] ?? (defaultValue ? "1" : "0")) === "1";
}

function readAiBudgetConfig(env = process.env) {
  const aiCallMaxPerTurn = Math.max(
    1,
    Math.min(12, Number(env?.NARRATION_AI_MAX_CALLS_PER_TURN ?? 2) || 2)
  );
  const aiPrimaryMaxPerTurn = Math.max(
    0,
    Math.min(aiCallMaxPerTurn, Number(env?.NARRATION_AI_MAX_PRIMARY_CALLS_PER_TURN ?? 1) || 1)
  );
  const aiFallbackMaxPerTurn = Math.max(
    0,
    Math.min(aiCallMaxPerTurn, Number(env?.NARRATION_AI_MAX_FALLBACK_CALLS_PER_TURN ?? 1) || 1)
  );
  return {
    aiCallMaxPerTurn,
    aiPrimaryMaxPerTurn,
    aiFallbackMaxPerTurn
  };
}

function readAiFeatureFlags(env = process.env) {
  return {
    useAiClassifier: parseBooleanEnv("NARRATION_USE_AI_CLASSIFIER", false, env),
    useAiSceneFramePatch: parseBooleanEnv("NARRATION_USE_AI_SCENE_FRAME_PATCH", false, env),
    useAiWorldArbitration: parseBooleanEnv("NARRATION_USE_AI_WORLD_ARBITRATION", false, env),
    useAiRefine: parseBooleanEnv("NARRATION_USE_AI_REFINE", false, env),
    useAiStructuredMain: parseBooleanEnv("NARRATION_USE_AI_STRUCTURED_MAIN", false, env),
    useAiStructuredBranch: parseBooleanEnv("NARRATION_USE_AI_STRUCTURED_BRANCH", false, env),
    useAiStructuredLore: parseBooleanEnv("NARRATION_USE_AI_STRUCTURED_LORE", false, env),
    useAiBranchPriorityBudgetRouting: parseBooleanEnv(
      "NARRATION_USE_AI_BRANCH_PRIORITY_BUDGET_ROUTING",
      true,
      env
    ),
    useAiLocalMemory: parseBooleanEnv("NARRATION_USE_AI_LOCAL_MEMORY", false, env),
    useAiPendingTravelArbitration: parseBooleanEnv("NARRATION_USE_AI_PENDING_TRAVEL_ARBITRATION", false, env),
    useAiRuntimeEligibility: parseBooleanEnv("NARRATION_USE_AI_RUNTIME_ELIGIBILITY", false, env),
    useAiValidators: parseBooleanEnv("NARRATION_USE_AI_VALIDATORS", false, env)
  };
}

module.exports = {
  parseBooleanEnv,
  readAiBudgetConfig,
  readAiFeatureFlags
};
