export type LifecycleState = "actif" | "pertinent" | "dormant" | "archive";

export type FragmentKind = "ponctuel" | "persistant" | "evolutif";

export type EventLifecycleEntry = {
  from: LifecycleState | null;
  to: LifecycleState;
  turn_id: string;
  reason: string;
};

export type EventFragment = {
  fragment_id: string;
  kind: FragmentKind;
  status: LifecycleState;
  payload: Record<string, unknown>;
  final_refs: string[];
  created_at_turn: string;
  last_updated_turn: string;
};

export type NarrationEvent = {
  event_id: string;
  origin_trigger_id: string;
  created_at_turn: string;
  final: Record<string, unknown>;
  status: LifecycleState;
  lifecycle_history: EventLifecycleEntry[];
  fragments: EventFragment[];
};

