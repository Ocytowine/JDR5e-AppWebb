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
    | "ACTOR_ALIVE"
    | "TARGET_ALIVE"
    | "REACTION_AVAILABLE"
    | "REACTION_UNUSED_COMBAT"
    | "DISTANCE_MAX"
    | "TARGET_FIRST_SEEN"
    | "TARGET_IS_CLOSEST_VISIBLE"
    | "TARGET_VISIBLE"
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
