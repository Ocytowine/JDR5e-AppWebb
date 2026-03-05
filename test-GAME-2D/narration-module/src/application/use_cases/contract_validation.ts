export function validateInputContract(payload: Record<string, unknown>): void {
  const required = [
    "schema_version",
    "player_input",
    "narrative_context",
    "world_state",
    "actors",
    "response_contract",
  ];
  for (const key of required) {
    if (!(key in payload)) {
      throw new Error(`input missing key: ${key}`);
    }
  }

  if (payload.schema_version !== "1.0.0") {
    throw new Error("input schema_version must be 1.0.0");
  }

  if (typeof payload.player_input !== "string" || payload.player_input.trim().length === 0) {
    throw new Error("player_input invalid");
  }

  const actors = payload.actors as Record<string, unknown>;
  if (!actors || !("player" in actors)) {
    throw new Error("actors.player missing");
  }

  const worldState = payload.world_state as Record<string, unknown>;
  if (!worldState || !("location_id" in worldState)) {
    throw new Error("world_state.location_id missing");
  }
}

export function validateOutputContract(payload: Record<string, unknown>): void {
  const required = [
    "schema_version",
    "intent_type",
    "intent_confidence",
    "requires_clarification",
    "clarification_question",
    "plan",
    "targets",
    "runtime_actions",
    "actor_updates",
    "narrative_output",
    "narrative_constraints",
  ];
  for (const key of required) {
    if (!(key in payload)) {
      throw new Error(`output missing key: ${key}`);
    }
  }

  if (payload.schema_version !== "1.0.0") {
    throw new Error("output schema_version must be 1.0.0");
  }

  const confidence = payload.intent_confidence;
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    throw new Error("intent_confidence out of range");
  }

  const plan = payload.plan as Record<string, unknown>;
  const planRequired = [
    "objective",
    "approach",
    "assumptions",
    "checks_needed",
    "resources_to_spend",
    "risks",
    "fallbacks",
    "need_clarification",
  ];
  for (const key of planRequired) {
    if (!(key in plan)) {
      throw new Error(`plan missing key: ${key}`);
    }
  }

  const requiresClarification = Boolean(payload.requires_clarification);
  const needClarification = Array.isArray(plan.need_clarification)
    ? plan.need_clarification
    : [];
  const runtimeActions = Array.isArray(payload.runtime_actions)
    ? payload.runtime_actions
    : [];
  if ((requiresClarification || needClarification.length > 0) && runtimeActions.length > 0) {
    throw new Error("runtime_actions must be empty when clarification is required");
  }

  const narrativeOutput = payload.narrative_output as Record<string, unknown>;
  if ("truth_view" in narrativeOutput) {
    throw new Error("truth_view leaked in narrative_output");
  }
}

