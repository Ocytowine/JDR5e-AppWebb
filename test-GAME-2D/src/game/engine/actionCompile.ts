import type { ActionPlan, ActionSpec } from "./types";
import type { TokenState } from "../../types";

export function compileActionPlan(params: {
  action: ActionSpec;
  actor: TokenState;
  target?: TokenState | { x: number; y: number } | { kind: "tokens"; tokens: TokenState[] } | null;
}): ActionPlan {
  const hooks = params.action.hooks ?? [];
  const reactionWindows = params.action.reactionWindows ?? [];

  return {
    action: params.action,
    actor: params.actor,
    target: params.target ?? null,
    hooks,
    reactionWindows
  };
}
