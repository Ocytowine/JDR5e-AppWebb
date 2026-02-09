import type { ExecuteOptions, Hook, Outcome } from "./types";
import type { TokenState } from "../../types";
import type { ConditionExpr } from "../conditions";
import { evaluateAllConditions } from "./conditionEval";

interface HookContext {
  actor: TokenState;
  target: TokenState | null;
  outcome: Outcome | null;
}

export function shouldApplyHook(
  hook: Hook,
  ctx: HookContext,
  opts: ExecuteOptions
): boolean {
  return evaluateAllConditions(hook.if, {
    actor: ctx.actor,
    target: ctx.target,
    outcome: ctx.outcome,
    getResourceAmount: opts.getResourceAmount
  });
}

export function resolvePromptDecision(
  hook: Hook,
  opts: ExecuteOptions
): "accept" | "reject" {
  if (!hook.prompt) return "accept";
  if (opts.promptHandler) return opts.promptHandler(hook.prompt);
  return hook.prompt.defaultDecision ?? "reject";
}
