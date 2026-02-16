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
import { distanceBetweenTokens } from "../combatUtils";
import { resolveFormula } from "./formulas";

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

function logPipeline(
  tx: import("./transaction").Transaction,
  message: string,
  opts: ExecuteOptions
) {
  logTransaction(tx, `[pipeline] ${message}`, opts.onLog);
}

function describeOperation(op: Operation): string {
  switch (op.op) {
    case "DealDamage":
      return `DealDamage(${op.formula}${op.damageType ? `, ${op.damageType}` : ""}${
        op.scale ? `, scale=${op.scale}` : ""
      })`;
    case "DealDamageScaled":
      return `DealDamageScaled(${op.formula}, scale=${op.scale}${
        op.damageType ? `, ${op.damageType}` : ""
      })`;
    case "Heal":
      return `Heal(${op.formula})`;
    case "ApplyCondition":
      return `ApplyCondition(${op.statusId}, ${op.durationTurns} tours)`;
    case "RemoveCondition":
      return `RemoveCondition(${op.statusId})`;
    case "SpendResource":
      return `SpendResource(${op.name}, ${op.amount})`;
    case "ConsumeSlot":
      return `ConsumeSlot(${op.slot}${op.level ? ` lvl ${op.level}` : ""})`;
    case "CreateZone":
      return `CreateZone(${op.effectTypeId})`;
    case "CreateSurface":
      return `CreateSurface(${op.effectTypeId})`;
    case "ApplyAura":
      return `ApplyAura(${op.effectTypeId})`;
    case "Push":
    case "Pull":
    case "Knockback":
      return `${op.op}(${op.distance})`;
    case "LogEvent":
      return `LogEvent(${op.message})`;
    default:
      return op.op;
  }
}

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
    if (!shouldApplyHook(hook, hookContext, opts)) {
      logPipeline(tx, `Hook ${phase}: ignore (conditions non remplies).`, opts);
      continue;
    }
    const decision = resolvePromptDecision(hook, opts);
    if (decision === "accept") {
      logPipeline(tx, `Hook ${phase}: applique (${hook.apply.length} operation(s)).`, opts);
      for (const op of hook.apply) {
        applyOperation({
          op,
          tx,
          state,
          explicitTarget,
          opts
        });
      }
    } else {
      logPipeline(tx, `Hook ${phase}: refuse (prompt).`, opts);
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
    const effectiveAdvantage = resolveWeaponMasteryAdvantage({
      base: params.advantageMode ?? "normal",
      actor: state.actor,
      target
    });
    const bonus = (resolution.bonus ?? 0) + (rollContext.bonusDelta ?? 0);
    const critRange = resolution.critRange ?? 20;
    let roll =
      params.rollOverrides?.attack ??
      rollAttack(bonus, effectiveAdvantage, critRange);
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
    consumeWeaponMasteryAdvantage({
      actor: state.actor,
      target,
      advantageUsed: effectiveAdvantage !== "normal"
    });
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

function getTokenTags(token: TokenState | null): string[] {
  if (!token) return [];
  const tags = Array.isArray((token as any).tags) ? ((token as any).tags as string[]) : [];
  const combatTags = Array.isArray(token.combatStats?.tags) ? token.combatStats?.tags ?? [] : [];
  return [...tags, ...combatTags];
}

function addTokenTag(token: TokenState | null, tag: string) {
  if (!token) return;
  const anyToken = token as { tags?: string[] };
  anyToken.tags = Array.isArray(anyToken.tags) ? anyToken.tags : [];
  if (!anyToken.tags.includes(tag)) anyToken.tags.push(tag);
}

function removeTokenTag(token: TokenState | null, tag: string) {
  if (!token) return;
  const anyToken = token as { tags?: string[] };
  if (!Array.isArray(anyToken.tags)) return;
  anyToken.tags = anyToken.tags.filter(t => t !== tag);
}

function removeTokenTagsByPrefix(token: TokenState | null, prefix: string) {
  if (!token) return;
  const anyToken = token as { tags?: string[] };
  if (!Array.isArray(anyToken.tags)) return;
  const nextTags = anyToken.tags.filter(tag => !tag.startsWith(prefix));
  if (nextTags.length === anyToken.tags.length) return;
  anyToken.tags = nextTags;
}

function resolveWeaponMasteryAdvantage(params: {
  base: AdvantageMode;
  actor: TokenState;
  target: TokenState | null;
}): AdvantageMode {
  const { base, actor, target } = params;
  let score = base === "advantage" ? 1 : base === "disadvantage" ? -1 : 0;
  const actorTags = getTokenTags(actor);
  if (actorTags.some(tag => tag.startsWith("wm-sape:next:"))) score -= 1;
  if (target) {
    const targetTags = getTokenTags(target);
    const advPrefix = `wm-ouverture:adv:${actor.id}`;
    if (targetTags.some(tag => tag === advPrefix || tag.startsWith(`${advPrefix}:`))) {
      score += 1;
    }
  }
  if (score > 0) return "advantage";
  if (score < 0) return "disadvantage";
  return "normal";
}

function consumeWeaponMasteryAdvantage(params: {
  actor: TokenState;
  target: TokenState | null;
  advantageUsed: boolean;
}) {
  const { actor, target, advantageUsed } = params;
  if (!advantageUsed) return;
  removeTokenTagsByPrefix(actor, "wm-sape:next:");
  if (target) {
    removeTokenTagsByPrefix(target, `wm-ouverture:adv:${actor.id}`);
  }
}

function extractAbilityModToken(formula?: string | null): string | null {
  if (!formula) return null;
  const match = formula.match(/modFOR|modDEX|modCON|modINT|modSAG|modCHA/);
  return match ? match[0] : null;
}

function abilityModFromToken(actor: TokenState, modToken: string | null): number {
  if (!modToken) return 0;
  const mods = actor.combatStats?.mods;
  if (!mods) return 0;
  if (modToken === "modFOR") return Number(mods.modFOR ?? 0);
  if (modToken === "modDEX") return Number(mods.modDEX ?? 0);
  if (modToken === "modCON") return Number(mods.modCON ?? 0);
  if (modToken === "modINT") return Number(mods.modINT ?? 0);
  if (modToken === "modSAG") return Number(mods.modSAG ?? 0);
  if (modToken === "modCHA") return Number(mods.modCHA ?? 0);
  return 0;
}

function stripAbilityMod(formula: string, modToken: string | null): string {
  if (!modToken) return formula;
  const cleaned = formula.replace(/\s+/g, "");
  const pattern = new RegExp(`([+-])${modToken}`, "i");
  const removed = cleaned.replace(pattern, "");
  return removed.length > 0 ? removed : formula;
}

function getMasteryTriggerFromTags(tags: string[], masteryId: string): "on_hit" | "on_miss" | "on_intent" {
  const token = `wm-trigger:${masteryId}:`;
  const found = tags.find(tag => tag.startsWith(token));
  if (found === `${token}on_miss`) return "on_miss";
  if (found === `${token}on_intent`) return "on_intent";
  return "on_hit";
}

function getProficiencyBonus(actor: TokenState): number {
  const level = Number(actor.combatStats?.level ?? 1);
  if (level <= 4) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  if (level <= 16) return 5;
  return 6;
}

function getHostileTargets(state: EngineState, actor: TokenState): TokenState[] {
  if (actor.type === "player") return state.enemies ?? [];
  return [state.player];
}

function applyWeaponMasteryEffects(params: {
  plan: ActionPlan;
  state: EngineState;
  tx: import("./transaction").Transaction;
  target: TokenState | null;
  outcome: Outcome;
  opts: ExecuteOptions;
}) {
  const { plan, state, tx, target, outcome, opts } = params;
  const tags = plan.action.tags ?? [];
  const activeMasteries = tags
    .filter(tag => tag.startsWith("wm-active:"))
    .map(tag => tag.replace("wm-active:", ""))
    .filter(Boolean);
  if (activeMasteries.length === 0) return;

  const actorTags = getTokenTags(state.actor);
  const damageFormula = plan.action.damage?.formula ?? "";
  const damageType = plan.action.damage?.damageType ?? undefined;
  const modToken = extractAbilityModToken(damageFormula);
  const abilityMod = abilityModFromToken(state.actor, modToken);
  const baseRange = plan.action.targeting?.range?.max ?? 1.5;

  for (const masteryId of activeMasteries) {
    if (!actorTags.includes(`wm:${masteryId}`)) continue;
    const trigger = getMasteryTriggerFromTags(tags, masteryId);
    if (trigger === "on_hit" && !(outcome.kind === "hit" || outcome.kind === "crit")) continue;
    if (trigger === "on_miss" && outcome.kind !== "miss") continue;

    if (masteryId === "ouverture") {
      if (target) {
        addTokenTag(target, `wm-ouverture:adv:${state.actor.id}`);
        logTransaction(tx, "Botte d'arme: Ouverture (avantage prochain jet)", opts.onLog);
      }
      continue;
    }

    if (masteryId === "sape") {
      if (target) {
        addTokenTag(target, `wm-sape:next:${state.actor.id}`);
        logTransaction(tx, "Botte d'arme: Sape (desavantage prochain jet)", opts.onLog);
      }
      continue;
    }

    if (masteryId === "poussee") {
      if (target) {
        applyOperation({
          op: { op: "Push", target: "primary", distance: 3 },
          tx,
          state,
          explicitTarget: { kind: "token", token: target },
          opts
        });
      }
      continue;
    }

    if (masteryId === "ralentissement") {
      if (target) {
        addTokenTag(target, `wm-ralentissement:${state.actor.id}`);
        logTransaction(tx, "Botte d'arme: Ralentissement (-3m vitesse)", opts.onLog);
      }
      continue;
    }

    if (masteryId === "ecorchure") {
      if (target && abilityMod > 0) {
        applyOperation({
          op: {
            op: "DealDamage",
            target: "primary",
            formula: String(Math.max(0, abilityMod)),
            damageType
          },
          tx,
          state,
          explicitTarget: { kind: "token", token: target },
          opts
        });
        logTransaction(tx, "Botte d'arme: Ecorchure", opts.onLog);
      }
      continue;
    }

    if (masteryId === "renversement") {
      if (target) {
        const prof = getProficiencyBonus(state.actor);
        const dc = 8 + abilityMod + prof;
        const mod = target.combatStats?.mods?.modCON ?? 0;
        const roll = rollDamage("1d20", { isCrit: false, critRule: "double-dice" });
        const total = roll.total + mod;
        logTransaction(tx, `Renversement: d20 ${roll.total} + ${mod} = ${total} vs DD ${dc}`, opts.onLog);
        if (total < dc) {
          applyOperation({
            op: { op: "ApplyCondition", target: "primary", statusId: "prone", durationTurns: 1 },
            tx,
            state,
            explicitTarget: { kind: "token", token: target },
            opts
          });
        }
      }
      continue;
    }

    if (masteryId === "enchainement") {
      const primary = target;
      if (!primary) continue;
      const hostiles = getHostileTargets(state, state.actor)
        .filter(t => t.id !== primary.id && t.hp > 0)
        .filter(t => distanceBetweenTokens(primary, t) <= 1.5)
        .filter(t => distanceBetweenTokens(state.actor, t) <= baseRange);
      if (hostiles.length === 0) continue;
      const secondary = hostiles.sort(
        (a, b) => distanceBetweenTokens(primary, a) - distanceBetweenTokens(primary, b)
      )[0];
      const bonus = plan.action.attack?.bonus ?? plan.action.resolution?.bonus ?? 0;
      const critRange = plan.action.attack?.critRange ?? plan.action.resolution?.critRange ?? 20;
      const roll = rollAttack(bonus, "normal", critRange);
      const targetAC = typeof secondary.armorClass === "number" ? secondary.armorClass : null;
      const hit = targetAC === null ? true : roll.total >= targetAC || roll.isCrit;
      logTransaction(tx, `Enchainement: jet ${roll.total}${hit ? " (hit)" : " (miss)"}`, opts.onLog);
      if (hit) {
        const baseFormula =
          damageFormula
            ? abilityMod < 0
              ? damageFormula
              : stripAbilityMod(damageFormula, modToken)
            : "";
        if (baseFormula) {
          const formula = resolveFormula(baseFormula, { actor: state.actor, sampleCharacter: undefined });
          const dmg = rollDamage(formula, { isCrit: false, critRule: "double-dice" });
          const total = dmg.total;
          secondary.hp = Math.max(0, secondary.hp - total);
          logTransaction(tx, `Enchainement: degats ${total} (${formula})`, opts.onLog);
        }
      }
      continue;
    }

    if (masteryId === "coup_double") {
      const hasLight = tags.includes("weapon:light");
      if (!hasLight || !target) continue;
      const bonus = plan.action.attack?.bonus ?? plan.action.resolution?.bonus ?? 0;
      const critRange = plan.action.attack?.critRange ?? plan.action.resolution?.critRange ?? 20;
      const roll = rollAttack(bonus, "normal", critRange);
      const targetAC = typeof target.armorClass === "number" ? target.armorClass : null;
      const hit = targetAC === null ? true : roll.total >= targetAC || roll.isCrit;
      logTransaction(tx, `Coup double: jet ${roll.total}${hit ? " (hit)" : " (miss)"}`, opts.onLog);
      if (hit) {
        const baseFormula =
          damageFormula
            ? abilityMod < 0
              ? damageFormula
              : stripAbilityMod(damageFormula, modToken)
            : "";
        if (baseFormula) {
          const formula = resolveFormula(baseFormula, { actor: state.actor, sampleCharacter: undefined });
          const dmg = rollDamage(formula, { isCrit: false, critRule: "double-dice" });
          const total = dmg.total;
          target.hp = Math.max(0, target.hp - total);
          logTransaction(tx, `Coup double: degats ${total} (${formula})`, opts.onLog);
        }
      }
      continue;
    }
  }
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
  logPipeline(
    tx,
    `Start action=${plan.action.id} (${plan.action.name}) actor=${tx.state.actor.id} resolution=${
      plan.action.resolution?.kind ?? "NO_ROLL"
    }`,
    opts
  );
  logPipeline(
    tx,
    `Targeting init: mode=${plan.action.targeting?.target ?? "none"} targets=${
      tx.state.targeting.targets?.map(t => t.id).join(", ") || "none"
    } max=${plan.action.targeting?.maxTargets ?? "n/a"}`,
    opts
  );

  logPipeline(tx, "Phase 1 BuildIntent", opts);
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
  logPipeline(tx, "Phase 2 GatherResolveOptions", opts);
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
  logPipeline(tx, "Phase 3 Validate", opts);
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
  logPipeline(tx, "Phase 4 Targeting", opts);
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
  logPipeline(tx, "Phase 5 PreResolution", opts);
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
    logPipeline(tx, "Pre reaction window open", opts);
    const result = opts.onReactionWindow?.("pre") ?? "continue";
    if (result === "interrupt") {
      logPipeline(tx, "Interrupted during pre reaction window", opts);
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
  logPipeline(
    tx,
    `Phase 6 ResolveCheck: ${resolvedOutcomes.length} cible(s)`,
    opts
  );

  for (const [index, resolved] of resolvedOutcomes.entries()) {
    const { outcome, target } = resolved;
    const outcomeScopedOpts: ExecuteOptions = {
      ...opts,
      damageContext: {
        isCrit: Boolean(outcome.isCrit || outcome.kind === "crit"),
        critRule: plan.action.resolution?.critRule ?? "double-dice"
      }
    };
    const targetLabel = target ? `${target.id}` : "none";
    logPipeline(
      tx,
      `Cible ${index + 1}/${resolvedOutcomes.length}: ${targetLabel} -> outcome=${outcome.kind}`,
      opts
    );
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
    if (plan.action.resolution?.kind === "SAVING_THROW" && plan.action.resolution.save) {
      const ability = plan.action.resolution.save.ability;
      const dc = plan.action.resolution.save.dc + (tx.state.rollContext?.dcDelta ?? 0);
      const modKey = `mod${ability}` as const;
      const mod =
        (target?.combatStats?.mods?.[modKey] ?? 0) + (tx.state.rollContext?.bonusDelta ?? 0);
      logTransaction(
        tx,
        `Jet de sauvegarde (${ability}) : ${outcome.roll} + ${mod} = ${outcome.total} vs DD ${dc}`,
        opts.onLog
      );
    }
    if (plan.action.resolution?.kind === "ABILITY_CHECK" && plan.action.resolution.check) {
      const ability = plan.action.resolution.check.ability;
      const dc = plan.action.resolution.check.dc + (tx.state.rollContext?.dcDelta ?? 0);
      const modKey = `mod${ability}` as const;
      const mod =
        (target?.combatStats?.mods?.[modKey] ?? 0) + (tx.state.rollContext?.bonusDelta ?? 0);
      logTransaction(
        tx,
        `Jet de competence (${ability}) : ${outcome.roll} + ${mod} = ${outcome.total} vs DD ${dc}`,
        opts.onLog
      );
    }
    if (plan.action.resolution?.kind === "CONTESTED_CHECK" && outcome.contested) {
      const actorRoll = outcome.contested.actorRoll;
      const targetRoll = outcome.contested.targetRoll;
      const actorTotal = outcome.contested.actorTotal;
      const targetTotal = outcome.contested.targetTotal;
      logTransaction(
        tx,
        `Jet oppose : acteur ${actorRoll} => ${actorTotal} vs cible ${targetRoll} => ${targetTotal}`,
        opts.onLog
      );
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

    applyWeaponMasteryEffects({
      plan,
      state: tx.state,
      tx,
      target,
      outcome,
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
    logPipeline(
      tx,
      `Phase 7/8/9 Outcome+Apply: ${ops.length} operation(s) pour ${targetLabel}`,
      opts
    );
    const explicitTarget =
      plan.target && "id" in plan.target
        ? { kind: "token" as const, token: plan.target }
        : plan.target && "x" in plan.target
        ? { kind: "cell" as const, x: plan.target.x, y: plan.target.y }
        : null;
    for (const op of ops) {
      logPipeline(tx, `Apply op: ${describeOperation(op)}`, opts);
      applyOperation({
        op,
        tx,
        state: tx.state,
        explicitTarget: explicitTarget ?? (target ? { kind: "token", token: target } : null),
        opts: outcomeScopedOpts
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
    logPipeline(tx, "Post reaction window open", opts);
    const result = opts.onReactionWindow?.("post") ?? "continue";
    if (result === "interrupt") {
      logPipeline(tx, "Interrupted during post reaction window", opts);
      const lastOutcome = resolvedOutcomes[resolvedOutcomes.length - 1]?.outcome ?? { kind: "miss", roll: 0, total: 0 };
      return { ok: false, logs: tx.logs, state: tx.state, interrupted: true, outcome: lastOutcome };
    }
  }

  const lastResolved = resolvedOutcomes[resolvedOutcomes.length - 1] ?? {
    outcome: { kind: "hit", roll: 0, total: 0 },
    target: null
  };
  const finalTarget = lastResolved.target ?? null;
  const finalOutcome = lastResolved.outcome;

  applyHooks({
    hooks: plan.hooks ?? [],
    phase: "beforeCommit",
    state: tx.state,
    target: finalTarget,
    outcome: finalOutcome,
    explicitTarget: finalTarget ? { kind: "token", token: finalTarget } : null,
    tx,
    opts
  });

  applyHooks({
    hooks: plan.hooks ?? [],
    phase: "afterCommit",
    state: tx.state,
    target: finalTarget,
    outcome: finalOutcome,
    explicitTarget: finalTarget ? { kind: "token", token: finalTarget } : null,
    tx,
    opts
  });

  logPipeline(tx, `Phase 11 Commit done: finalOutcome=${finalOutcome.kind}`, opts);

  return { ok: true, logs: tx.logs, state: tx.state, outcome: finalOutcome };
}
