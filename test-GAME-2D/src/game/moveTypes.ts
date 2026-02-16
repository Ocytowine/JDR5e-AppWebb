import type { ActionDefinition } from "./engine/actionTypes";

export interface MoveTypeDefinition extends ActionDefinition {
  movement?: {
    pathLimitMultiplier?: number;
    modeId?: string;
  };
}

export function isMoveTypeAction(action: ActionDefinition | null): action is MoveTypeDefinition {
  return Boolean(action && action.tags?.includes("move-type"));
}

