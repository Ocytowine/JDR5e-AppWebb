import type { ActionDefinition } from "./actionTypes";

export type ReactionTriggerEvent =
  | "movement.leave_reach"
  | "movement.enter_reach"
  | "visibility.first_seen"
  | string;

export type ReactionSource =
  | "hostile"
  | "ally"
  | "player"
  | "enemy"
  | "self"
  | "any";

export interface ReactionTrigger {
  event: ReactionTriggerEvent;
  source?: ReactionSource;
}

export interface ReactionCondition {
  type:
    | "actor_alive"
    | "target_alive"
    | "reaction_available"
    | "reaction_unused_combat"
    | "distance_max"
    | "target_first_seen"
    | "target_is_closest_visible"
    | "target_visible"
    | string;
  max?: number;
  reason?: string;
}

export interface ReactionDefinition {
  id: string;
  name: string;
  summary?: string;
  uiMessage?: string;
  uiMessageMiss?: string;
  trigger: ReactionTrigger;
  conditions?: ReactionCondition[];
  action: ActionDefinition;
  tags?: string[];
}
