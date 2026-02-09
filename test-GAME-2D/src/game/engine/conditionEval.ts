import type { TokenState } from "../../types";
import type { ConditionExpr, Comparator, OutcomeFlag } from "../conditions";
import type { Outcome } from "./types";

export interface ConditionEvalContext {
  actor: TokenState;
  target?: TokenState | null;
  outcome?: Outcome | null;
  phase?: string;
  distance?: number | null;
  getResourceAmount?: (name: string, pool?: string | null) => number;
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
  if (flag === "HIT") return outcome.kind === "hit";
  if (flag === "MISS") return outcome.kind === "miss";
  if (flag === "CRIT") return outcome.kind === "crit";
  if (flag === "SAVE_SUCCESS") return outcome.kind === "saveSuccess";
  if (flag === "SAVE_FAIL") return outcome.kind === "saveFail";
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
    case "OUTCOME_HAS":
      return outcomeHasFlag(ctx.outcome, condition.flag);
    case "TARGET_ALIVE":
      return !!ctx.target && ctx.target.hp > 0;
    case "DISTANCE_MAX":
      return typeof ctx.distance === "number" ? ctx.distance <= condition.max : false;
    case "DISTANCE_BETWEEN": {
      if (typeof ctx.distance !== "number") return false;
      if (typeof condition.min === "number" && ctx.distance < condition.min) return false;
      if (typeof condition.max === "number" && ctx.distance > condition.max) return false;
      return true;
    }
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
