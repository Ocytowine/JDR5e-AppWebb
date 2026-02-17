import type { TokenState } from "../../../types";
import type { WeaponTypeDefinition } from "../weaponTypes";
import type { ActionDefinition } from "./actionTypes";

export type ActionEconomyUsage = {
  usedActionCount: number;
  usedBonusCount: number;
};

export type ActionEconomyBudget = {
  actionsPerTurn: number;
  bonusActionsPerTurn: number;
  bonusMainActionsThisTurn?: number;
};

export type ActionCostType = "action" | "bonus" | "reaction" | "free" | string;

export type ActionCostContext = {
  costType: string;
  bypassedBonusAction: boolean;
  bypassUsageKey: string | null;
  bypassMaxPerTurn: number;
  bypassLimitMessage: string;
  bypassLabel: string;
};

export function getMaxMainActionsPerTurn(budget: ActionEconomyBudget): number {
  return Math.max(0, Number(budget.actionsPerTurn ?? 0)) + Math.max(0, Number(budget.bonusMainActionsThisTurn ?? 0));
}

export function canConsumeActionCost(params: {
  costType?: ActionCostType | null;
  usage: ActionEconomyUsage;
  budget: ActionEconomyBudget;
}): { ok: boolean; reason?: string } {
  const costType = String(params.costType ?? "free");
  if (costType === "action") {
    const max = getMaxMainActionsPerTurn(params.budget);
    if (params.usage.usedActionCount >= max) {
      return { ok: false, reason: "Action principale deja utilisee." };
    }
    return { ok: true };
  }
  if (costType === "bonus") {
    const max = Math.max(0, Number(params.budget.bonusActionsPerTurn ?? 0));
    if (params.usage.usedBonusCount >= max) {
      return { ok: false, reason: "Action bonus deja utilisee." };
    }
    return { ok: true };
  }
  return { ok: true };
}

export function consumeActionCost(
  usage: ActionEconomyUsage,
  costType?: ActionCostType | null,
  options?: { extraBonusCost?: number }
): ActionEconomyUsage {
  const normalized = String(costType ?? "free");
  const extraBonusCost = Math.max(0, Math.floor(Number(options?.extraBonusCost ?? 0)));
  return {
    usedActionCount: usage.usedActionCount + (normalized === "action" ? 1 : 0),
    usedBonusCount: usage.usedBonusCount + (normalized === "bonus" ? 1 : 0) + extraBonusCost
  };
}

export function refundActionCost(
  usage: ActionEconomyUsage,
  costType?: ActionCostType | null,
  options?: { extraBonusRefund?: number }
): ActionEconomyUsage {
  const normalized = String(costType ?? "free");
  const extraBonusRefund = Math.max(0, Math.floor(Number(options?.extraBonusRefund ?? 0)));
  return {
    usedActionCount: Math.max(0, usage.usedActionCount - (normalized === "action" ? 1 : 0)),
    usedBonusCount: Math.max(0, usage.usedBonusCount - (normalized === "bonus" ? 1 : 0) - extraBonusRefund)
  };
}

export function resolveActionCostContext(params: {
  action: ActionDefinition;
  actor: TokenState;
  weapon?: WeaponTypeDefinition | null;
  usedMainActionCount: number;
  getFeatureRuleModifiersForActor: (actor: TokenState) => Array<Record<string, unknown>>;
  featureModifierMatches: (args: {
    modifier: Record<string, unknown>;
    actor: TokenState;
    action: ActionDefinition;
    weapon: WeaponTypeDefinition | null;
  }) => boolean;
  normalizeActionTags: (tags: string[] | undefined | null) => string[];
  hasDualWieldActionTag: (tags: string[] | undefined | null) => boolean;
}): ActionCostContext {
  const baseCostType = String(params.action.actionCost?.actionType ?? "free");
  if (params.actor.type !== "player") {
    return {
      costType: baseCostType,
      bypassedBonusAction: false,
      bypassUsageKey: null,
      bypassMaxPerTurn: 0,
      bypassLimitMessage: "",
      bypassLabel: ""
    };
  }

  const normalizedTags = params.normalizeActionTags(params.action.tags);
  const modifiers = params.getFeatureRuleModifiersForActor(params.actor);
  const matchingCandidates = modifiers.filter((mod: Record<string, unknown>) => {
    const applyTo = String(mod.applyTo ?? "").trim().toLowerCase();
    if (!["actioncost", "dualwield", "equipment", "equipmentpolicy", "hands"].includes(applyTo)) {
      return false;
    }

    const stat = String(mod.stat ?? mod.mode ?? "").trim().toLowerCase();
    const isDualWieldBypass =
      stat === "dualwieldbonusattackwithoutbonusaction" ||
      stat === "dual_wield_bonus_attack_without_bonus_action";
    const isGenericCostOverride = [
      "actioncostoverride",
      "action_cost_override",
      "overridecosttype",
      "costoverride"
    ].includes(stat);
    if (!isDualWieldBypass && !isGenericCostOverride) return false;

    const actionWithNormalizedTags = { ...params.action, tags: normalizedTags };
    if (
      !params.featureModifierMatches({
        modifier: mod,
        actor: params.actor,
        action: actionWithNormalizedTags,
        weapon: params.weapon ?? null
      })
    ) {
      return false;
    }

    if (isDualWieldBypass) {
      const value = Number(mod.value ?? 1);
      return (
        Number.isFinite(value) &&
        value > 0 &&
        baseCostType === "bonus" &&
        params.hasDualWieldActionTag(normalizedTags)
      );
    }

    const toCostType = String(mod.toCostType ?? "").trim().toLowerCase();
    if (!["action", "bonus", "reaction", "free"].includes(toCostType)) return false;
    const fromCostType = String(mod.fromCostType ?? "").trim().toLowerCase();
    if (fromCostType && fromCostType !== baseCostType.toLowerCase()) return false;
    return true;
  });

  const matching =
    matchingCandidates
      .slice()
      .sort((a, b) => {
        const priorityA = Number(a.priority ?? 0);
        const priorityB = Number(b.priority ?? 0);
        if (priorityA !== priorityB) return priorityB - priorityA;
        const aMax = Number(a.maxPerTurn ?? 0);
        const bMax = Number(b.maxPerTurn ?? 0);
        if (aMax !== bMax) return bMax - aMax;
        const aPerAction = Number(a.maxPerTurnPerActionUsed ?? 0);
        const bPerAction = Number(b.maxPerTurnPerActionUsed ?? 0);
        return bPerAction - aPerAction;
      })[0] ?? null;

  if (!matching) {
    return {
      costType: baseCostType,
      bypassedBonusAction: false,
      bypassUsageKey: null,
      bypassMaxPerTurn: 0,
      bypassLimitMessage: "",
      bypassLabel: ""
    };
  }

  const stat = String(matching.stat ?? matching.mode ?? "").trim().toLowerCase();
  const isDualWieldBypass =
    stat === "dualwieldbonusattackwithoutbonusaction" ||
    stat === "dual_wield_bonus_attack_without_bonus_action";
  const toCostType = isDualWieldBypass
    ? "free"
    : String(matching.toCostType ?? baseCostType).trim().toLowerCase();
  const hasUsageLimitFields =
    matching.usageKey !== undefined ||
    matching.maxPerTurn !== undefined ||
    matching.limitPerTurn !== undefined ||
    matching.maxPerTurnPerActionUsed !== undefined;
  const usageKeyRaw = String(
    matching.usageKey ?? `action-cost-override:${String(matching.stat ?? "rule").trim().toLowerCase()}:${params.action.id}`
  );
  const usageKey = hasUsageLimitFields && usageKeyRaw.trim().length > 0 ? usageKeyRaw.trim() : null;
  const maxPerTurnRaw = Number(matching.maxPerTurn ?? matching.limitPerTurn ?? 0);
  const maxPerTurnPerActionRaw = Number(matching.maxPerTurnPerActionUsed ?? 0);
  let maxPerTurn = Number.isFinite(maxPerTurnRaw) ? Math.max(0, Math.floor(maxPerTurnRaw)) : 0;
  if (Number.isFinite(maxPerTurnPerActionRaw) && maxPerTurnPerActionRaw > 0) {
    const computed = Math.floor(maxPerTurnPerActionRaw * Math.max(0, params.usedMainActionCount));
    maxPerTurn = Math.max(maxPerTurn, computed);
  }
  const limitMessageRaw = String(matching.limitMessage ?? "").trim();
  const limitMessage =
    limitMessageRaw.length > 0 ? limitMessageRaw : "Limite d'utilisation atteinte pour cette regle.";
  const labelRaw = String(matching.label ?? "Action cost override").trim();
  return {
    costType: toCostType || baseCostType,
    bypassedBonusAction: Boolean(usageKey),
    bypassUsageKey: usageKey,
    bypassMaxPerTurn: maxPerTurn,
    bypassLimitMessage: limitMessage,
    bypassLabel: labelRaw
  };
}
