import {
  EventFragment,
  FragmentKind,
  LifecycleState,
  NarrationEvent,
} from "./event_types";

const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  actif: ["pertinent", "dormant", "archive"],
  pertinent: ["actif", "dormant", "archive"],
  dormant: ["pertinent", "archive"],
  archive: ["dormant"],
};

function ensureNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function ensureFragmentKind(value: unknown): FragmentKind {
  const kind = ensureNonEmptyString(value, "kind");
  if (kind !== "ponctuel" && kind !== "persistant" && kind !== "evolutif") {
    throw new Error("kind must be one of ponctuel|persistant|evolutif");
  }
  return kind;
}

function ensureLifecycleState(value: unknown, field: string): LifecycleState {
  const state = ensureNonEmptyString(value, field);
  if (state !== "actif" && state !== "pertinent" && state !== "dormant" && state !== "archive") {
    throw new Error(`${field} must be one of actif|pertinent|dormant|archive`);
  }
  return state;
}

export function createNarrationEvent(input: {
  event_id: unknown;
  origin_trigger_id: unknown;
  created_at_turn: unknown;
  final: unknown;
}): NarrationEvent {
  const eventId = ensureNonEmptyString(input.event_id, "event_id");
  const triggerId = ensureNonEmptyString(input.origin_trigger_id, "origin_trigger_id");
  const createdAtTurn = ensureNonEmptyString(input.created_at_turn, "created_at_turn");
  const final = (input.final ?? {}) as Record<string, unknown>;
  if (typeof final !== "object" || final === null || Object.keys(final).length === 0) {
    throw new Error("final must be a non-empty object");
  }

  return {
    event_id: eventId,
    origin_trigger_id: triggerId,
    created_at_turn: createdAtTurn,
    final,
    status: "actif",
    lifecycle_history: [
      {
        from: null,
        to: "actif",
        turn_id: createdAtTurn,
        reason: "event_created",
      },
    ],
    fragments: [],
  };
}

export function transitionEventState(
  event: NarrationEvent,
  nextStateInput: unknown,
  turnIdInput: unknown,
  reasonInput: unknown,
): NarrationEvent {
  const nextState = ensureLifecycleState(nextStateInput, "next_state");
  const turnId = ensureNonEmptyString(turnIdInput, "turn_id");
  const reason = ensureNonEmptyString(reasonInput, "reason");
  const current = event.status;

  if (current === nextState) {
    return event;
  }

  if (!VALID_TRANSITIONS[current].includes(nextState)) {
    throw new Error(`invalid lifecycle transition: ${current} -> ${nextState}`);
  }

  event.status = nextState;
  event.lifecycle_history.push({
    from: current,
    to: nextState,
    turn_id: turnId,
    reason,
  });
  return event;
}

export function addFragment(
  event: NarrationEvent,
  input: {
    fragment_id: unknown;
    kind: unknown;
    payload: unknown;
    final_refs: unknown;
  },
  turnIdInput: unknown,
): EventFragment {
  const fragmentId = ensureNonEmptyString(input.fragment_id, "fragment_id");
  const kind = ensureFragmentKind(input.kind);
  const turnId = ensureNonEmptyString(turnIdInput, "turn_id");
  const payload = (input.payload ?? {}) as Record<string, unknown>;
  if (typeof payload !== "object" || payload === null) {
    throw new Error("payload must be an object");
  }

  if (event.fragments.some((f) => f.fragment_id === fragmentId)) {
    throw new Error(`fragment already exists: ${fragmentId}`);
  }

  if (!Array.isArray(input.final_refs) || input.final_refs.length === 0) {
    throw new Error("final_refs must be a non-empty array");
  }
  const refs = input.final_refs.map((v) => ensureNonEmptyString(v, "final_ref"));
  for (const ref of refs) {
    if (!(ref in event.final)) {
      throw new Error(`final_ref does not exist in event.final: ${ref}`);
    }
  }

  const fragment: EventFragment = {
    fragment_id: fragmentId,
    kind,
    status: "actif",
    payload,
    final_refs: refs,
    created_at_turn: turnId,
    last_updated_turn: turnId,
  };
  event.fragments.push(fragment);
  return fragment;
}

export function transitionFragmentState(
  event: NarrationEvent,
  fragmentIdInput: unknown,
  nextStateInput: unknown,
  turnIdInput: unknown,
  _reasonInput: unknown,
): EventFragment {
  const fragmentId = ensureNonEmptyString(fragmentIdInput, "fragment_id");
  const nextState = ensureLifecycleState(nextStateInput, "next_state");
  const turnId = ensureNonEmptyString(turnIdInput, "turn_id");
  const fragment = event.fragments.find((f) => f.fragment_id === fragmentId);
  if (!fragment) {
    throw new Error(`fragment not found: ${fragmentId}`);
  }
  if (fragment.status !== nextState) {
    if (!VALID_TRANSITIONS[fragment.status].includes(nextState)) {
      throw new Error(`invalid fragment transition: ${fragment.status} -> ${nextState}`);
    }
    fragment.status = nextState;
    fragment.last_updated_turn = turnId;
  }
  return fragment;
}

export function updateEvolutiveFragmentPayload(
  event: NarrationEvent,
  fragmentIdInput: unknown,
  patchInput: unknown,
  turnIdInput: unknown,
): EventFragment {
  const fragmentId = ensureNonEmptyString(fragmentIdInput, "fragment_id");
  const turnId = ensureNonEmptyString(turnIdInput, "turn_id");
  const patch = (patchInput ?? {}) as Record<string, unknown>;
  if (typeof patch !== "object" || patch === null) {
    throw new Error("patch must be an object");
  }
  const fragment = event.fragments.find((f) => f.fragment_id === fragmentId);
  if (!fragment) {
    throw new Error(`fragment not found: ${fragmentId}`);
  }
  if (fragment.kind !== "evolutif") {
    throw new Error("fragment is not evolutif");
  }
  fragment.payload = {
    ...fragment.payload,
    ...patch,
  };
  fragment.last_updated_turn = turnId;
  return fragment;
}

export function suggestLifecycleByInactivity(
  current: LifecycleState,
  unattendedTurns: number,
): LifecycleState {
  if (unattendedTurns >= 10) return "archive";
  if (unattendedTurns >= 5) return "dormant";
  if (unattendedTurns >= 2) return "pertinent";
  return current;
}

