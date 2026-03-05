import {
  addFragment,
  createNarrationEvent,
  transitionEventState,
  transitionFragmentState,
  updateEvolutiveFragmentPayload,
} from "../../domain/events/event_engine";
import {
  RuntimeCommandHandler,
  RuntimeExecutionError,
} from "./runtime_types";

function ensureString(
  value: unknown,
  actionName: string,
  field: string,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RuntimeExecutionError(
      "invalid_params",
      actionName,
      `${field} must be a non-empty string`,
    );
  }
  return value;
}

function ensureNumber(
  value: unknown,
  actionName: string,
  field: string,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new RuntimeExecutionError(
      "invalid_params",
      actionName,
      `${field} must be a number`,
    );
  }
  return value;
}

function ensureNonNegative(
  value: number,
  actionName: string,
  field: string,
): number {
  if (value < 0) {
    throw new RuntimeExecutionError(
      "invalid_params",
      actionName,
      `${field} must be >= 0`,
    );
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asArrayOfRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? (value as Array<Record<string, unknown>>)
    : [];
}

const moveLocal: RuntimeCommandHandler = (state, params) => {
  const destinationId = ensureString(params.destination_id, "moveLocal", "destination_id");
  const timeCost = params.time_cost_min;

  state.location_id = destinationId;
  if (typeof timeCost === "number") {
    ensureNonNegative(timeCost, "moveLocal", "time_cost_min");
    const current = typeof state.clock_min === "number" ? (state.clock_min as number) : 0;
    state.clock_min = current + timeCost;
  }
};

const enterLocation: RuntimeCommandHandler = (state, params) => {
  const locationId = ensureString(params.location_id, "enterLocation", "location_id");
  state.location_id = locationId;
};

const advanceTime: RuntimeCommandHandler = (state, params) => {
  const minutes = ensureNonNegative(
    ensureNumber(params.minutes, "advanceTime", "minutes"),
    "advanceTime",
    "minutes",
  );
  const current = typeof state.clock_min === "number" ? (state.clock_min as number) : 0;
  state.clock_min = current + minutes;
};

const requestCheck: RuntimeCommandHandler = (state, params) => {
  const skillId = ensureString(params.skill_id, "requestCheck", "skill_id");
  const difficulty = ensureNumber(params.difficulty, "requestCheck", "difficulty");
  const reason = ensureString(params.reason, "requestCheck", "reason");

  const checks = asArrayOfRecords(state.pending_checks);
  checks.push({ skill_id: skillId, difficulty, reason });
  state.pending_checks = checks;
};

const startDialogue: RuntimeCommandHandler = (state, params) => {
  const targetId = ensureString(params.target_id, "startDialogue", "target_id");
  state.active_dialogue_target = targetId;
};

const startCombat: RuntimeCommandHandler = (state, params) => {
  const targetIds = params.target_ids;
  if (!Array.isArray(targetIds) || targetIds.length === 0) {
    throw new RuntimeExecutionError(
      "invalid_params",
      "startCombat",
      "target_ids must be a non-empty array",
    );
  }
  const triggerReason = ensureString(params.trigger_reason, "startCombat", "trigger_reason");
  state.combat_state = {
    active: true,
    target_ids: targetIds,
    trigger_reason: triggerReason,
  };
};

const addJournalEntry: RuntimeCommandHandler = (state, params) => {
  const entryType = ensureString(params.entry_type, "addJournalEntry", "entry_type");
  const payload = asRecord(params.payload);
  const journal = asArrayOfRecords(state.journal);
  journal.push({ entry_type: entryType, payload });
  state.journal = journal;
};

const queryLore: RuntimeCommandHandler = (state, params, context) => {
  const topicIds = params.topic_ids;
  if (!Array.isArray(topicIds)) {
    throw new RuntimeExecutionError(
      "invalid_params",
      "queryLore",
      "topic_ids must be an array",
    );
  }
  const normalizedTopicIds = topicIds
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);

  const loreDb =
    context && typeof context.loreDb === "object" && context.loreDb !== null
      ? (context.loreDb as Record<string, unknown>)
      : {};

  const hits = normalizedTopicIds.map((topicId) => {
    const loreEntry = loreDb[topicId];
    if (typeof loreEntry === "undefined") {
      return {
        topic_id: topicId,
        found: false,
      };
    }
    return {
      topic_id: topicId,
      found: true,
      entry: loreEntry,
    };
  });

  const queries = asArrayOfRecords(state.lore_queries);
  queries.push({
    topic_ids: normalizedTopicIds,
    found_count: hits.filter((item) => item.found).length,
  });
  state.lore_queries = queries;
  state.lore_last_query = {
    turn_id: context.turnId,
    topic_ids: normalizedTopicIds,
    hits,
  };
};

const createNpcProfile: RuntimeCommandHandler = (state, params) => {
  const roleHint = ensureString(params.role_hint, "createNpcProfile", "role_hint");
  const context = asRecord(params.context);
  const generated = asArrayOfRecords(state.generated_npcs);
  generated.push({
    role_hint: roleHint,
    context,
  });
  state.generated_npcs = generated;
};

const setFlag: RuntimeCommandHandler = (state, params) => {
  const flagId = ensureString(params.flag_id, "setFlag", "flag_id");
  const value = Boolean(params.value);
  const worldFlags = new Set<string>(
    Array.isArray(state.world_flags) ? (state.world_flags as string[]) : [],
  );
  if (value) {
    worldFlags.add(flagId);
  } else {
    worldFlags.delete(flagId);
  }
  state.world_flags = [...worldFlags].sort();
};

const rejectAction: RuntimeCommandHandler = (state, params) => {
  const reasonCode = ensureString(params.reason_code, "rejectAction", "reason_code");
  const rejected = asArrayOfRecords(state.rejected_actions);
  rejected.push({ reason_code: reasonCode });
  state.rejected_actions = rejected;
};

const createEvent: RuntimeCommandHandler = (state, params) => {
  const final = asRecord(params.final);
  const created = createNarrationEvent({
    event_id: params.event_id,
    origin_trigger_id: params.origin_trigger_id,
    created_at_turn: params.created_at_turn,
    final,
  });
  const events = asArrayOfRecords(state.events);
  events.push(created as unknown as Record<string, unknown>);
  state.events = events;
};

const addEventFragment: RuntimeCommandHandler = (state, params) => {
  const eventId = ensureString(params.event_id, "addEventFragment", "event_id");
  const fragmentId = ensureString(
    params.fragment_id,
    "addEventFragment",
    "fragment_id",
  );
  const kind = ensureString(params.kind, "addEventFragment", "kind");
  const finalRefs = params.final_refs;
  if (!Array.isArray(finalRefs)) {
    throw new RuntimeExecutionError(
      "invalid_params",
      "addEventFragment",
      "final_refs must be an array",
    );
  }
  const turnId = ensureString(params.turn_id, "addEventFragment", "turn_id");
  const payload = asRecord(params.payload);
  const events = asArrayOfRecords(state.events);
  const event = events.find((e) => e.event_id === eventId);
  if (!event) {
    throw new RuntimeExecutionError("invalid_params", "addEventFragment", "event not found");
  }
  addFragment(event as any, {
    fragment_id: fragmentId,
    kind,
    payload,
    final_refs: finalRefs,
  }, turnId);
  state.events = events;
};

const transitionEventLifecycle: RuntimeCommandHandler = (state, params) => {
  const eventId = ensureString(
    params.event_id,
    "transitionEventLifecycle",
    "event_id",
  );
  const nextState = ensureString(
    params.next_state,
    "transitionEventLifecycle",
    "next_state",
  );
  const turnId = ensureString(params.turn_id, "transitionEventLifecycle", "turn_id");
  const reason = ensureString(params.reason, "transitionEventLifecycle", "reason");
  const events = asArrayOfRecords(state.events);
  const event = events.find((e) => e.event_id === eventId);
  if (!event) {
    throw new RuntimeExecutionError(
      "invalid_params",
      "transitionEventLifecycle",
      "event not found",
    );
  }
  transitionEventState(event as any, nextState, turnId, reason);
  state.events = events;
};

const transitionFragmentLifecycle: RuntimeCommandHandler = (state, params) => {
  const eventId = ensureString(
    params.event_id,
    "transitionFragmentLifecycle",
    "event_id",
  );
  const fragmentId = ensureString(
    params.fragment_id,
    "transitionFragmentLifecycle",
    "fragment_id",
  );
  const nextState = ensureString(
    params.next_state,
    "transitionFragmentLifecycle",
    "next_state",
  );
  const turnId = ensureString(params.turn_id, "transitionFragmentLifecycle", "turn_id");
  const reason = ensureString(params.reason, "transitionFragmentLifecycle", "reason");
  const events = asArrayOfRecords(state.events);
  const event = events.find((e) => e.event_id === eventId);
  if (!event) {
    throw new RuntimeExecutionError(
      "invalid_params",
      "transitionFragmentLifecycle",
      "event not found",
    );
  }
  transitionFragmentState(event as any, fragmentId, nextState, turnId, reason);
  state.events = events;
};

const patchEvolutiveFragment: RuntimeCommandHandler = (state, params) => {
  const eventId = ensureString(params.event_id, "patchEvolutiveFragment", "event_id");
  const fragmentId = ensureString(
    params.fragment_id,
    "patchEvolutiveFragment",
    "fragment_id",
  );
  const turnId = ensureString(params.turn_id, "patchEvolutiveFragment", "turn_id");
  const patch = asRecord(params.patch);
  const events = asArrayOfRecords(state.events);
  const event = events.find((e) => e.event_id === eventId);
  if (!event) {
    throw new RuntimeExecutionError(
      "invalid_params",
      "patchEvolutiveFragment",
      "event not found",
    );
  }
  updateEvolutiveFragmentPayload(event as any, fragmentId, patch, turnId);
  state.events = events;
};

export const COMMAND_REGISTRY: Record<string, RuntimeCommandHandler> = {
  moveLocal,
  enterLocation,
  advanceTime,
  requestCheck,
  startDialogue,
  startCombat,
  addJournalEntry,
  queryLore,
  createNpcProfile,
  setFlag,
  rejectAction,
  createEvent,
  addEventFragment,
  transitionEventLifecycle,
  transitionFragmentLifecycle,
  patchEvolutiveFragment,
};
