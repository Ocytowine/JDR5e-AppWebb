import { rollAttack, rollDamage, type AdvantageMode } from "../../dice/roller";
import type { TokenState } from "../../types";
import { beginTransaction, logTransaction } from "./transaction";
import { applyOperation } from "./ops";
import { resolvePromptDecision, shouldApplyHook } from "./hooks";
import type {
  ActionPlan,
  EngineState,
  ExecuteOptions,
  Outcome,
  OutcomeKey,
  Operation
} from "./types";

function resolveOutcome(params: {
  plan: ActionPlan;
  state: EngineState;
  advantageMode?: AdvantageMode;
  rollOverrides?: ExecuteOptions["rollOverrides"];
}): { outcome: Outcome; target: TokenState | null } {
  const { plan, state } = params;
  const resolution = plan.action.resolution ?? { kind: "none" };
  const target =
    plan.target && "id" in plan.target
      ? (plan.target as TokenState)
      : null;

  if (resolution.kind === "attack") {
    const bonus = resolution.bonus ?? 0;
    const critRange = resolution.critRange ?? 20;
    const roll =
      params.rollOverrides?.attack ??
      rollAttack(bonus, params.advantageMode ?? "normal", critRange);
    const targetAC =
      target && typeof target.armorClass === "number" ? target.armorClass : null;
    const isHit = targetAC === null ? true : roll.total >= targetAC || roll.isCrit;
    const kind: OutcomeKey = roll.isCrit ? "crit" : isHit ? "hit" : "miss";
    return {
      outcome: { kind, roll: roll.d20.total, total: roll.total, isCrit: roll.isCrit },
      target
    };
  }

  if (resolution.kind === "save" && resolution.save) {
    const ability = resolution.save.ability;
    const dc = resolution.save.dc;
    const mod = target?.combatStats?.mods?.[ability] ?? 0;
    const roll = rollDamage("1d20", { isCrit: false, critRule: "double-dice" });
    const total = roll.total + mod;
    const success = total >= dc;
    const kind: OutcomeKey = success ? "saveSuccess" : "saveFail";
    return {
      outcome: { kind, roll: roll.total, total },
      target
    };
  }

  if (resolution.kind === "check" && resolution.check) {
    const ability = resolution.check.ability;
    const dc = resolution.check.dc;
    const mod = state.actor.combatStats?.mods?.[ability] ?? 0;
    const roll = rollDamage("1d20", { isCrit: false, critRule: "double-dice" });
    const total = roll.total + mod;
    const success = total >= dc;
    const kind: OutcomeKey = success ? "hit" : "miss";
    return {
      outcome: { kind, roll: roll.total, total },
      target
    };
  }

  return {
    outcome: { kind: "hit", roll: 0, total: 0 },
    target
  };
}

function collectOperations(effects: ActionPlan["action"]["effects"], outcome: Outcome): Operation[] {
  const ops: Operation[] = [];
  if (effects?.onResolve) ops.push(...effects.onResolve);
  if (outcome.kind === "hit" && effects?.onHit) ops.push(...effects.onHit);
  if (outcome.kind === "miss" && effects?.onMiss) ops.push(...effects.onMiss);
  if (outcome.kind === "crit") {
    if (effects?.onHit) ops.push(...effects.onHit);
    if (effects?.onCrit) ops.push(...effects.onCrit);
  }
  if (outcome.kind === "saveSuccess" && effects?.onSaveSuccess) ops.push(...effects.onSaveSuccess);
  if (outcome.kind === "saveFail" && effects?.onSaveFail) ops.push(...effects.onSaveFail);
  return ops;
}

export function executePlan(params: {
  plan: ActionPlan;
  state: EngineState;
  opts: ExecuteOptions;
  advantageMode?: AdvantageMode;
}): {
  ok: boolean;
  logs: string[];
  state: EngineState;
  interrupted?: boolean;
  outcome: Outcome;
} {
  const { plan, state, opts } = params;
  const tx = beginTransaction(state);

  if (plan.reactionWindows.includes("pre")) {
    const result = opts.onReactionWindow?.("pre") ?? "continue";
    if (result === "interrupt") {
      return {
        ok: false,
        logs: tx.logs,
        state: tx.state,
        interrupted: true,
        outcome: { kind: "miss", roll: 0, total: 0 }
      };
    }
  }

  const { outcome, target } = resolveOutcome({
    plan,
    state: tx.state,
    advantageMode: params.advantageMode,
    rollOverrides: opts.rollOverrides
  });

  if (plan.action.resolution?.kind === "attack") {
    const targetAC =
      target && typeof target.armorClass === "number" ? target.armorClass : null;
    logTransaction(
      tx,
      `Jet de touche (${plan.action.name}) : ${outcome.roll} + ${
        plan.action.resolution?.bonus ?? 0
      } = ${outcome.total}` +
        (targetAC !== null ? ` vs CA ${targetAC}` : "") +
        (outcome.isCrit ? " (critique!)" : ""),
      opts.onLog
    );
    if (outcome.kind === "miss") {
      logTransaction(
        tx,
        `L'attaque (${plan.action.name}) rate sa cible. Pas de degats.`,
        opts.onLog
      );
    }
  }

  const hookContext = { actor: tx.state.actor, target, outcome };
  const hooks = plan.hooks ?? [];
  for (const hook of hooks) {
    if (hook.when !== "on_outcome") continue;
    if (!shouldApplyHook(hook, hookContext, opts)) continue;
    const decision = resolvePromptDecision(hook, opts);
    if (decision === "accept") {
      for (const op of hook.apply) {
        applyOperation({
          op,
          tx,
          state: tx.state,
          explicitTarget: target ? { kind: "token", token: target } : null,
          opts
        });
      }
    }
  }

  const ops = collectOperations(plan.action.effects, outcome);
  const explicitTarget =
    plan.target && "id" in plan.target
      ? { kind: "token" as const, token: plan.target }
      : plan.target && "x" in plan.target
      ? { kind: "cell" as const, x: plan.target.x, y: plan.target.y }
      : null;
  for (const op of ops) {
    applyOperation({
      op,
      tx,
      state: tx.state,
      explicitTarget: explicitTarget ?? (target ? { kind: "token", token: target } : null),
      opts
    });
  }

  if (plan.reactionWindows.includes("post")) {
    const result = opts.onReactionWindow?.("post") ?? "continue";
    if (result === "interrupt") {
      return { ok: false, logs: tx.logs, state: tx.state, interrupted: true, outcome };
    }
  }

  return { ok: true, logs: tx.logs, state: tx.state, outcome };
}
