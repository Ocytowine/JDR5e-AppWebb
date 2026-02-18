import type { TokenState } from "../../../types";
import type { ConditionExpr, Comparator, OutcomeFlag } from "./conditions";
import type { Outcome } from "../core/types";

export interface ConditionEvalContext {
  actor: TokenState;
  target?: TokenState | null;
  outcome?: Outcome | null;
  phase?: string;
  distance?: number | null;
  lineOfSight?: boolean | null;
  sameLevel?: boolean | null;
  targetInArea?: boolean | null;
  inLight?: boolean | null;
  reactionAvailable?: boolean | null;
  concentrating?: boolean | null;
  surprised?: boolean | null;
  usage?: {
    turn?: Record<string, number>;
    round?: Record<string, number>;
    combat?: Record<string, number>;
  } | null;
  getResourceAmount?: (name: string, pool?: string | null) => number;
  getSlotAmount?: (slot: string, level?: number) => number;
  valueLookup?: {
    actor?: Record<string, number>;
    target?: Record<string, number>;
  };
}

function compare(cmp: Comparator, left: number, right: number): boolean {
  switch (cmp) {
    case "EQ":
      return left === right;
    case "NE":
      return left !== right;
    case "LT":
      return left < right;
    case "LTE":
      return left <= right;
    case "GT":
      return left > right;
    case "GTE":
      return left >= right;
    case "IN":
      return left === right;
    case "NIN":
      return left !== right;
    default:
      return false;
  }
}

function getTags(token: TokenState): string[] {
  const tags = token.combatStats?.tags ?? [];
  const extra = (token as { tags?: string[] }).tags ?? [];
  return [...tags, ...extra];
}

function getStatuses(token: TokenState): Array<{ id: string; remainingTurns: number }> {
  return token.statuses ?? [];
}

function getResourceAmountFallback(
  token: TokenState,
  name: string
): number {
  const pool = token.combatStats?.resources?.[name];
  if (!pool) return 0;
  return Number(pool.current ?? 0);
}

function outcomeHasFlag(outcome: Outcome | null | undefined, flag: OutcomeFlag): boolean {
  if (!outcome) return false;
  if (flag === "HIT") {
    return (
      outcome.kind === "hit" ||
      outcome.kind === "crit" ||
      outcome.kind === "checkSuccess" ||
      outcome.kind === "contestedWin"
    );
  }
  if (flag === "MISS") {
    return outcome.kind === "miss" || outcome.kind === "checkFail" || outcome.kind === "contestedLose";
  }
  if (flag === "CRIT") return outcome.kind === "crit";
  if (flag === "SAVE_SUCCESS") return outcome.kind === "saveSuccess";
  if (flag === "SAVE_FAIL") return outcome.kind === "saveFail";
  if (flag === "CHECK_SUCCESS") return outcome.kind === "checkSuccess";
  if (flag === "CHECK_FAIL") return outcome.kind === "checkFail";
  if (flag === "CONTESTED_WIN") return outcome.kind === "contestedWin";
  if (flag === "CONTESTED_LOSE") return outcome.kind === "contestedLose";
  if (flag === "AUTO_SUCCESS") {
    return outcome.kind === "hit" && outcome.roll === 0 && outcome.total === 0;
  }
  if (flag === "AUTO_FAIL") {
    return outcome.kind === "miss" && outcome.roll === 0 && outcome.total === 0;
  }
  if (flag === "PARTIAL") return false;
  return false;
}

function getCreatureType(token: TokenState): string | null {
  const anyToken = token as { creature?: { type?: string } };
  return anyToken.creature?.type ?? null;
}

function getCreatureTags(token: TokenState): string[] {
  const anyToken = token as { creature?: { tags?: string[] } };
  return anyToken.creature?.tags ?? [];
}

function getSize(token: TokenState): string | null {
  const anyToken = token as { creature?: { size?: string } };
  return anyToken.creature?.size ?? null;
}

function canMove(token: TokenState, move: string): boolean {
  const targetMove = move.toLowerCase();
  if (token.movementModes && typeof token.movementModes === "object") {
    return Object.keys(token.movementModes).some(key => key.toLowerCase() === targetMove);
  }
  const movementType = token.movementProfile?.type;
  if (!movementType) return false;
  if (movementType === "flying") return targetMove === "fly";
  if (movementType === "ground") return targetMove === "walk";
  return movementType.toLowerCase() === targetMove;
}

function getDamageDefenses(token: TokenState): {
  resist?: string[];
  immune?: string[];
  vulnerable?: string[];
} | null {
  const anyToken = token as { defenses?: { damage?: { resist?: string[]; immune?: string[]; vulnerable?: string[] } } };
  return anyToken.defenses?.damage ?? null;
}

function getValue(token: TokenState, key: string, values?: Record<string, number>): number | null {
  if (values && typeof values[key] === "number") return values[key];
  const anyToken = token as Record<string, unknown>;
  const raw = anyToken[key];
  if (typeof raw === "number") return raw;
  return null;
}

function getUsageCount(
  usage: ConditionEvalContext["usage"],
  scope: "turn" | "round" | "combat",
  key: string
): number {
  if (!usage) return 0;
  const map = usage[scope];
  if (!map) return 0;
  const raw = map[key];
  return typeof raw === "number" ? raw : 0;
}

function isHpBelow(params: { token: TokenState; value: number; mode?: "percent" | "absolute" }): boolean {
  const { token, value, mode } = params;
  if (mode === "absolute") {
    return (token.hp ?? 0) <= value;
  }
  const maxHp = token.maxHp ?? 0;
  const curHp = token.hp ?? 0;
  if (maxHp <= 0) return false;
  return curHp / maxHp < value;
}

export function evaluateConditionExpr(
  condition: ConditionExpr,
  ctx: ConditionEvalContext
): boolean {
  switch (condition.type) {
    case "AND":
      return condition.all.every(cond => evaluateConditionExpr(cond, ctx));
    case "OR":
      return condition.any.some(cond => evaluateConditionExpr(cond, ctx));
    case "NOT":
      return !evaluateConditionExpr(condition.expr, ctx);
    case "PHASE_IS": {
      const expected = condition.value ?? condition.mustBe;
      if (!expected) return true;
      return ctx.phase === expected;
    }
    case "OUTCOME_IS":
      return !!ctx.outcome && outcomeHasFlag(ctx.outcome, condition.value);
    case "OUTCOME_IN":
      return !!ctx.outcome && condition.values.some(flag => outcomeHasFlag(ctx.outcome, flag));
    case "ROLL_AT_LEAST":
      return typeof ctx.outcome?.roll === "number" ? ctx.outcome.roll >= condition.value : false;
    case "ROLL_AT_MOST":
      return typeof ctx.outcome?.roll === "number" ? ctx.outcome.roll <= condition.value : false;
    case "OUTCOME_HAS":
      return outcomeHasFlag(ctx.outcome, condition.flag);
    case "ACTOR_ALIVE":
      return (ctx.actor.hp ?? 0) > 0;
    case "ACTOR_DEAD":
      return (ctx.actor.hp ?? 0) <= 0;
    case "TARGET_ALIVE":
      return !!ctx.target && ctx.target.hp > 0;
    case "TARGET_DEAD":
      return !!ctx.target && (ctx.target.hp ?? 0) <= 0;
    case "TARGET_HP_BELOW":
      return !!ctx.target && isHpBelow({ token: ctx.target, value: condition.value, mode: condition.mode });
    case "ACTOR_HP_BELOW":
      return isHpBelow({ token: ctx.actor, value: condition.value, mode: condition.mode });
    case "DISTANCE_MAX":
      return typeof ctx.distance === "number" ? ctx.distance <= condition.max : false;
    case "DISTANCE_WITHIN":
      if (typeof ctx.distance !== "number") return false;
      if (typeof condition.min === "number" && ctx.distance < condition.min) return false;
      if (typeof condition.max === "number" && ctx.distance > condition.max) return false;
      return true;
    case "DISTANCE_BETWEEN": {
      if (typeof ctx.distance !== "number") return false;
      if (typeof condition.min === "number" && ctx.distance < condition.min) return false;
      if (typeof condition.max === "number" && ctx.distance > condition.max) return false;
      return true;
    }
    case "HAS_LINE_OF_SIGHT":
      if (typeof condition.value === "boolean") return (ctx.lineOfSight ?? false) === condition.value;
      return !!ctx.lineOfSight;
    case "SAME_LEVEL":
      if (typeof condition.value === "boolean") return (ctx.sameLevel ?? false) === condition.value;
      return !!ctx.sameLevel;
    case "TARGET_IN_AREA":
      if (typeof condition.value === "boolean") return (ctx.targetInArea ?? false) === condition.value;
      return !!ctx.targetInArea;
    case "ONCE_PER_TURN":
      return getUsageCount(ctx.usage, "turn", condition.key) <= 0;
    case "ONCE_PER_ROUND":
      return getUsageCount(ctx.usage, "round", condition.key) <= 0;
    case "ONCE_PER_COMBAT":
      return getUsageCount(ctx.usage, "combat", condition.key) <= 0;
    case "NOT_USED_THIS_TURN":
      return getUsageCount(ctx.usage, "turn", condition.key) <= 0;
    case "IS_REACTION_AVAILABLE":
      if (typeof condition.value === "boolean") return (ctx.reactionAvailable ?? false) === condition.value;
      return !!ctx.reactionAvailable;
    case "IS_CONCENTRATING":
      if (typeof condition.value === "boolean") return (ctx.concentrating ?? false) === condition.value;
      return !!ctx.concentrating;
    case "IS_SURPRISED":
      if (typeof condition.value === "boolean") return (ctx.surprised ?? false) === condition.value;
      return !!ctx.surprised;
    case "IS_IN_LIGHT":
      if (typeof condition.value === "boolean") return (ctx.inLight ?? false) === condition.value;
      return !!ctx.inLight;
    case "STAT_BELOW_PERCENT": {
      const who = condition.who === "target" ? ctx.target : ctx.actor;
      if (!who) return false;
      if (condition.stat !== "hp") return false;
      const maxHp = who.maxHp ?? 0;
      const curHp = who.hp ?? 0;
      if (maxHp <= 0) return false;
      return curHp / maxHp < condition.percentMax;
    }
    case "RESOURCE_AT_LEAST": {
      const amount = ctx.getResourceAmount
        ? ctx.getResourceAmount(condition.resource, condition.pool ?? null)
        : getResourceAmountFallback(ctx.actor, condition.resource);
      return amount >= condition.value;
    }
    case "RESOURCE_AT_MOST": {
      const amount = ctx.getResourceAmount
        ? ctx.getResourceAmount(condition.resource, condition.pool ?? null)
        : getResourceAmountFallback(ctx.actor, condition.resource);
      return amount <= condition.value;
    }
    case "HAS_RESOURCE": {
      const token = condition.who === "target" ? ctx.target : ctx.actor;
      if (!token) return false;
      const amount = getResourceAmountFallback(token, condition.key);
      return compare(condition.cmp, amount, condition.value);
    }
    case "SLOT_AVAILABLE": {
      if (!ctx.getSlotAmount) return false;
      const amount = ctx.getSlotAmount(condition.slot, condition.level);
      const min = typeof condition.min === "number" ? condition.min : 1;
      return amount >= min;
    }
    case "ACTOR_HAS_RESOURCE": {
      const amount = getResourceAmountFallback(ctx.actor, condition.key);
      return compare(condition.cmp, amount, condition.value);
    }
    case "TARGET_HAS_RESOURCE": {
      if (!ctx.target) return false;
      const amount = getResourceAmountFallback(ctx.target, condition.key);
      return compare(condition.cmp, amount, condition.value);
    }
    case "ACTOR_HAS_TAG":
      return getTags(ctx.actor).includes(condition.tag);
    case "TARGET_HAS_TAG":
      return !!ctx.target && getTags(ctx.target).includes(condition.tag);
    case "ACTOR_HAS_CONDITION":
      return getStatuses(ctx.actor).some(status => status.id === condition.condition);
    case "TARGET_HAS_CONDITION":
      return !!ctx.target && getStatuses(ctx.target).some(status => status.id === condition.condition);
    case "ACTOR_CONDITION_STACKS": {
      const stacks = getStatuses(ctx.actor).filter(status => status.id === condition.condition).length;
      return compare(condition.cmp, stacks, condition.value);
    }
    case "TARGET_CONDITION_STACKS": {
      if (!ctx.target) return false;
      const stacks = getStatuses(ctx.target).filter(status => status.id === condition.condition).length;
      return compare(condition.cmp, stacks, condition.value);
    }
    case "ACTOR_CREATURE_TYPE_IS":
      return getCreatureType(ctx.actor) === condition.value;
    case "TARGET_CREATURE_TYPE_IS":
      return !!ctx.target && getCreatureType(ctx.target) === condition.value;
    case "ACTOR_CREATURE_HAS_TAG":
      return getCreatureTags(ctx.actor).includes(condition.tag);
    case "TARGET_CREATURE_HAS_TAG":
      return !!ctx.target && getCreatureTags(ctx.target).includes(condition.tag);
    case "ACTOR_SIZE_IS":
      return getSize(ctx.actor) === condition.value;
    case "TARGET_SIZE_IS":
      return !!ctx.target && getSize(ctx.target) === condition.value;
    case "ACTOR_CAN_MOVE":
      return canMove(ctx.actor, condition.move);
    case "TARGET_CAN_MOVE":
      return !!ctx.target && canMove(ctx.target, condition.move);
    case "ACTOR_DAMAGE_IMMUNE": {
      const defenses = getDamageDefenses(ctx.actor);
      return !!defenses?.immune?.includes(condition.damageType);
    }
    case "TARGET_DAMAGE_IMMUNE": {
      const defenses = ctx.target ? getDamageDefenses(ctx.target) : null;
      return !!defenses?.immune?.includes(condition.damageType);
    }
    case "ACTOR_DAMAGE_RESIST": {
      const defenses = getDamageDefenses(ctx.actor);
      return !!defenses?.resist?.includes(condition.damageType);
    }
    case "TARGET_DAMAGE_RESIST": {
      const defenses = ctx.target ? getDamageDefenses(ctx.target) : null;
      return !!defenses?.resist?.includes(condition.damageType);
    }
    case "ACTOR_DAMAGE_VULNERABLE": {
      const defenses = getDamageDefenses(ctx.actor);
      return !!defenses?.vulnerable?.includes(condition.damageType);
    }
    case "TARGET_DAMAGE_VULNERABLE": {
      const defenses = ctx.target ? getDamageDefenses(ctx.target) : null;
      return !!defenses?.vulnerable?.includes(condition.damageType);
    }
    case "ACTOR_VALUE": {
      const value = getValue(ctx.actor, condition.key, ctx.valueLookup?.actor);
      if (value === null) return false;
      return compare(condition.cmp, value, condition.value);
    }
    case "TARGET_VALUE": {
      if (!ctx.target) return false;
      const value = getValue(ctx.target, condition.key, ctx.valueLookup?.target);
      if (value === null) return false;
      return compare(condition.cmp, value, condition.value);
    }
    default:
      return false;
  }
}

export function evaluateAllConditions(
  conditions: ConditionExpr[] | undefined,
  ctx: ConditionEvalContext
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(cond => evaluateConditionExpr(cond, ctx));
}


