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

type HookPhase =
  | "onIntentBuild"
  | "onOptionsResolve"
  | "onValidate"
  | "onTargeting"
  | "preResolution"
  | "onResolve"
  | "onOutcome"
  | "beforeApply"
  | "afterApply"
  | "postResolution"
  | "beforeCommit"
  | "afterCommit";

function normalizeHookWhen(when: string): HookPhase | null {
  switch (when) {
    case "pre_resolution":
    case "PRE_RESOLUTION_WINDOW":
    case "preResolution":
      return "preResolution";
    case "on_outcome":
    case "ON_OUTCOME":
    case "onOutcome":
      return "onOutcome";
    case "on_apply":
    case "APPLY_TARGET_EFFECTS":
    case "APPLY_WORLD_EFFECTS":
    case "afterApply":
      return "afterApply";
    case "post_resolution":
    case "POST_RESOLUTION_WINDOW":
    case "postResolution":
      return "postResolution";
    case "COMMIT":
    case "beforeCommit":
      return "beforeCommit";
    case "afterCommit":
      return "afterCommit";
    case "onIntentBuild":
    case "onOptionsResolve":
    case "onValidate":
    case "onTargeting":
    case "onResolve":
    case "beforeApply":
      return when;
    default:
      return null;
  }
}

function applyHooks(params: {
  hooks: ActionPlan["hooks"];
  phase: HookPhase;
  state: EngineState;
  target: TokenState | null;
  outcome: Outcome | null;
  explicitTarget: { kind: "token"; token: TokenState } | null;
  tx: import("./transaction").Transaction;
  opts: ExecuteOptions;
}) {
  const { hooks, phase, state, target, outcome, explicitTarget, tx, opts } = params;
  for (const hook of hooks ?? []) {
    const normalized = normalizeHookWhen(hook.when);
    if (normalized !== phase) continue;
    const hookContext = { actor: state.actor, target, outcome };
    if (!shouldApplyHook(hook, hookContext, opts)) continue;
    const decision = resolvePromptDecision(hook, opts);
    if (decision === "accept") {
      for (const op of hook.apply) {
        applyOperation({
          op,
          tx,
          state,
          explicitTarget,
          opts
        });
      }
    }
  }
}

function resolveOutcome(params: {
  plan: ActionPlan;
  state: EngineState;
  advantageMode?: AdvantageMode;
  rollOverrides?: ExecuteOptions["rollOverrides"];
  target: TokenState | null;
}): { outcome: Outcome; target: TokenState | null } {
  const { plan, state } = params;
  const resolution = plan.action.resolution ?? { kind: "NO_ROLL" };
  const target = params.target;
  const rollContext = state.rollContext ?? {};
  const abilityToModKey = (ability: "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA") => {
    switch (ability) {
      case "FOR":
        return "modFOR";
      case "DEX":
        return "modDEX";
      case "CON":
        return "modCON";
      case "INT":
        return "modINT";
      case "SAG":
        return "modSAG";
      case "CHA":
        return "modCHA";
      default:
        return "modFOR";
    }
  };

  if (resolution.kind === "ATTACK_ROLL") {
    const bonus = (resolution.bonus ?? 0) + (rollContext.bonusDelta ?? 0);
    const critRange = resolution.critRange ?? 20;
    let roll =
      params.rollOverrides?.attack ??
      rollAttack(bonus, params.advantageMode ?? "normal", critRange);
    if (rollContext.replaceRoll !== undefined) {
      const d20 = rollContext.replaceRoll;
      roll = {
        ...roll,
        d20: { total: d20 },
        total: d20 + bonus,
        isCrit: d20 >= critRange
      } as typeof roll;
    }
    if (rollContext.reroll) {
      const reroll = rollAttack(bonus, params.advantageMode ?? "normal", critRange);
      roll =
        rollContext.reroll === "min"
          ? (reroll.total < roll.total ? reroll : roll)
          : (reroll.total > roll.total ? reroll : roll);
    }
    if (typeof rollContext.minRoll === "number") {
      const d20 = Math.max(rollContext.minRoll, roll.d20.total);
      roll = { ...roll, d20: { total: d20 }, total: d20 + bonus, isCrit: d20 >= critRange } as typeof roll;
    }
    if (typeof rollContext.maxRoll === "number") {
      const d20 = Math.min(rollContext.maxRoll, roll.d20.total);
      roll = { ...roll, d20: { total: d20 }, total: d20 + bonus, isCrit: d20 >= critRange } as typeof roll;
    }
    const targetAC =
      target && typeof target.armorClass === "number" ? target.armorClass : null;
    const isHit = targetAC === null ? true : roll.total >= targetAC || roll.isCrit;
    const kind: OutcomeKey = roll.isCrit ? "crit" : isHit ? "hit" : "miss";
    return {
      outcome: { kind, roll: roll.d20.total, total: roll.total, isCrit: roll.isCrit },
      target
    };
  }

  if (resolution.kind === "SAVING_THROW" && resolution.save) {
    const ability = resolution.save.ability;
    const dc = resolution.save.dc + (rollContext.dcDelta ?? 0);
    const modKey = abilityToModKey(ability);
    const mod = (target?.combatStats?.mods?.[modKey] ?? 0) + (rollContext.bonusDelta ?? 0);
    let roll = rollDamage("1d20", { isCrit: false, critRule: "double-dice" });
    if (rollContext.replaceRoll !== undefined) {
      roll = { ...roll, total: rollContext.replaceRoll } as typeof roll;
    }
    if (rollContext.reroll) {
      const reroll = rollDamage("1d20", { isCrit: false, critRule: "double-dice" });
      roll = rollContext.reroll === "min" ? (reroll.total < roll.total ? reroll : roll) : (reroll.total > roll.total ? reroll : roll);
    }
    if (typeof rollContext.minRoll === "number") {
      roll = { ...roll, total: Math.max(rollContext.minRoll, roll.total) } as typeof roll;
    }
    if (typeof rollContext.maxRoll === "number") {
      roll = { ...roll, total: Math.min(rollContext.maxRoll, roll.total) } as typeof roll;
    }
    const total = roll.total + mod;
    const success = total >= dc;
    const kind: OutcomeKey = success ? "saveSuccess" : "saveFail";
    return {
      outcome: { kind, roll: roll.total, total },
      target
    };
  }

  if (resolution.kind === "ABILITY_CHECK" && resolution.check) {
    const ability = resolution.check.ability;
    const dc = resolution.check.dc + (rollContext.dcDelta ?? 0);
    const modKey = abilityToModKey(ability);
    const mod = (state.actor.combatStats?.mods?.[modKey] ?? 0) + (rollContext.bonusDelta ?? 0);
    let roll = rollDamage("1d20", { isCrit: false, critRule: "double-dice" });
    if (rollContext.replaceRoll !== undefined) {
      roll = { ...roll, total: rollContext.replaceRoll } as typeof roll;
    }
    if (rollContext.reroll) {
      const reroll = rollDamage("1d20", { isCrit: false, critRule: "double-dice" });
      roll = rollContext.reroll === "min" ? (reroll.total < roll.total ? reroll : roll) : (reroll.total > roll.total ? reroll : roll);
    }
    if (typeof rollContext.minRoll === "number") {
      roll = { ...roll, total: Math.max(rollContext.minRoll, roll.total) } as typeof roll;
    }
    if (typeof rollContext.maxRoll === "number") {
      roll = { ...roll, total: Math.min(rollContext.maxRoll, roll.total) } as typeof roll;
    }
    const total = roll.total + mod;
    const success = total >= dc;
    const kind: OutcomeKey = success ? "checkSuccess" : "checkFail";
    return {
      outcome: { kind, roll: roll.total, total },
      target
    };
  }

  if (resolution.kind === "CONTESTED_CHECK") {
    const contested = resolution.contested;
    const actorAbility = contested?.actorAbility ?? resolution.check?.ability ?? "FOR";
    const targetAbility = contested?.targetAbility ?? resolution.save?.ability ?? "FOR";
    const actorModKey = abilityToModKey(actorAbility);
    const targetModKey = abilityToModKey(targetAbility);
    const actorMod =
      (state.actor.combatStats?.mods?.[actorModKey] ?? 0) +
      (contested?.actorBonus ?? 0) +
      (rollContext.bonusDelta ?? 0);
    const targetMod =
      (target?.combatStats?.mods?.[targetModKey] ?? 0) + (contested?.targetBonus ?? 0);

    const actorRoll = rollDamage("1d20", { isCrit: false, critRule: "double-dice" });
    const targetRoll = rollDamage("1d20", { isCrit: false, critRule: "double-dice" });
    const actorTotal = actorRoll.total + actorMod;
    const targetTotal = targetRoll.total + targetMod;
    const tieWinner = contested?.tieWinner ?? "actor";
    const actorWins = actorTotal > targetTotal || (actorTotal === targetTotal && tieWinner === "actor");
    const kind: OutcomeKey = actorWins ? "contestedWin" : "contestedLose";
    return {
      outcome: {
        kind,
        roll: actorRoll.total,
        total: actorTotal,
        contested: {
          actorRoll: actorRoll.total,
          actorTotal,
          targetRoll: targetRoll.total,
          targetTotal
        }
      } as Outcome,
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
  if (
    (outcome.kind === "hit" ||
      outcome.kind === "checkSuccess" ||
      outcome.kind === "contestedWin") &&
    effects?.onHit
  ) {
    ops.push(...effects.onHit);
  }
  if (
    (outcome.kind === "miss" ||
      outcome.kind === "checkFail" ||
      outcome.kind === "contestedLose") &&
    effects?.onMiss
  ) {
    ops.push(...effects.onMiss);
  }
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
  tx.state.targetingConfig = {
    target: plan.action.targeting?.target ?? null,
    maxTargets:
      typeof plan.action.targeting?.maxTargets === "number"
        ? plan.action.targeting.maxTargets
        : null
  };

  const initialTarget =
    plan.target && "id" in plan.target ? (plan.target as TokenState) : null;
  const initialTargets: TokenState[] = (() => {
    if (plan.target && "kind" in plan.target && plan.target.kind === "tokens") {
      return plan.target.tokens ?? [];
    }
    if (plan.target && "id" in plan.target) {
      return [plan.target as TokenState];
    }
    if (plan.action.targeting?.target === "self") {
      return [tx.state.actor];
    }
    return [];
  })();
  tx.state.targeting = {
    targets: initialTargets.filter(Boolean),
    locked: false
  };

  applyHooks({
    hooks: plan.hooks ?? [],
    phase: "onIntentBuild",
    state: tx.state,
    target: initialTarget,
    outcome: null,
    explicitTarget: initialTarget ? { kind: "token", token: initialTarget } : null,
    tx,
    opts
  });
  applyHooks({
    hooks: plan.hooks ?? [],
    phase: "onOptionsResolve",
    state: tx.state,
    target: initialTarget,
    outcome: null,
    explicitTarget: initialTarget ? { kind: "token", token: initialTarget } : null,
    tx,
    opts
  });
  applyHooks({
    hooks: plan.hooks ?? [],
    phase: "onValidate",
    state: tx.state,
    target: initialTarget,
    outcome: null,
    explicitTarget: initialTarget ? { kind: "token", token: initialTarget } : null,
    tx,
    opts
  });
  applyHooks({
    hooks: plan.hooks ?? [],
    phase: "onTargeting",
    state: tx.state,
    target: initialTarget,
    outcome: null,
    explicitTarget: initialTarget ? { kind: "token", token: initialTarget } : null,
    tx,
    opts
  });
  const primaryTarget = tx.state.targeting?.targets?.[0] ?? initialTarget;
  applyHooks({
    hooks: plan.hooks ?? [],
    phase: "preResolution",
    state: tx.state,
    target: primaryTarget,
    outcome: null,
    explicitTarget: primaryTarget ? { kind: "token", token: primaryTarget } : null,
    tx,
    opts
  });

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

  const targets: TokenState[] = (tx.state.targeting?.targets ?? []).filter(Boolean);

  const resolvedOutcomes = targets.length
    ? targets.map(target =>
        resolveOutcome({
          plan,
          state: tx.state,
          advantageMode: params.advantageMode,
          rollOverrides: opts.rollOverrides,
          target
        })
      )
    : [
        resolveOutcome({
          plan,
          state: tx.state,
          advantageMode: params.advantageMode,
          rollOverrides: opts.rollOverrides,
          target: null
        })
      ];

  for (const { outcome, target } of resolvedOutcomes) {
    if (plan.action.resolution?.kind === "ATTACK_ROLL") {
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

    applyHooks({
      hooks: plan.hooks ?? [],
      phase: "onResolve",
      state: tx.state,
      target,
      outcome,
      explicitTarget: target ? { kind: "token", token: target } : null,
      tx,
      opts
    });
    applyHooks({
      hooks: plan.hooks ?? [],
      phase: "onOutcome",
      state: tx.state,
      target,
      outcome,
      explicitTarget: target ? { kind: "token", token: target } : null,
      tx,
      opts
    });

    applyHooks({
      hooks: plan.hooks ?? [],
      phase: "beforeApply",
      state: tx.state,
      target,
      outcome,
      explicitTarget: target ? { kind: "token", token: target } : null,
      tx,
      opts
    });

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

    applyHooks({
      hooks: plan.hooks ?? [],
      phase: "afterApply",
      state: tx.state,
      target,
      outcome,
      explicitTarget: target ? { kind: "token", token: target } : null,
      tx,
      opts
    });

    applyHooks({
      hooks: plan.hooks ?? [],
      phase: "postResolution",
      state: tx.state,
      target,
      outcome,
      explicitTarget: target ? { kind: "token", token: target } : null,
      tx,
      opts
    });
  }

  if (plan.reactionWindows.includes("post")) {
    const result = opts.onReactionWindow?.("post") ?? "continue";
    if (result === "interrupt") {
      const lastOutcome = resolvedOutcomes[resolvedOutcomes.length - 1]?.outcome ?? { kind: "miss", roll: 0, total: 0 };
      return { ok: false, logs: tx.logs, state: tx.state, interrupted: true, outcome: lastOutcome };
    }
  }

  applyHooks({
    hooks: plan.hooks ?? [],
    phase: "beforeCommit",
    state: tx.state,
    target,
    outcome,
    explicitTarget: target ? { kind: "token", token: target } : null,
    tx,
    opts
  });

  applyHooks({
    hooks: plan.hooks ?? [],
    phase: "afterCommit",
    state: tx.state,
    target,
    outcome,
    explicitTarget: target ? { kind: "token", token: target } : null,
    tx,
    opts
  });

  const lastOutcome = resolvedOutcomes[resolvedOutcomes.length - 1]?.outcome ?? { kind: "hit", roll: 0, total: 0 };
  return { ok: true, logs: tx.logs, state: tx.state, outcome: lastOutcome };
}
