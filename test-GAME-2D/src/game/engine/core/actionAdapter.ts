import type { ActionDefinition, TargetingSpec } from "../rules/actionTypes";
import type { ActionSpec, ConditionalEffects, ResolutionSpec } from "./types";

const kindMap: Record<string, ResolutionSpec["kind"]> = {
  ATTACK_ROLL: "ATTACK_ROLL",
  SAVING_THROW: "SAVING_THROW",
  ABILITY_CHECK: "ABILITY_CHECK",
  CONTESTED_CHECK: "CONTESTED_CHECK",
  NO_ROLL: "NO_ROLL"
};

const abilityMap: Record<string, "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA"> = {
  FOR: "FOR",
  DEX: "DEX",
  CON: "CON",
  INT: "INT",
  SAG: "SAG",
  CHA: "CHA"
};

function mapResolution(action: ActionDefinition): ResolutionSpec | undefined {
  if (action.resolution) {
    const res = action.resolution as ResolutionSpec;
    const normalized: ResolutionSpec = { ...res };
    if (typeof res.kind === "string" && kindMap[res.kind]) {
      normalized.kind = kindMap[res.kind];
    }
    if (res.save?.ability && abilityMap[String(res.save.ability)]) {
      normalized.save = { ...res.save, ability: abilityMap[String(res.save.ability)] };
    }
    if (res.check?.ability && abilityMap[String(res.check.ability)]) {
      normalized.check = { ...res.check, ability: abilityMap[String(res.check.ability)] };
    }
    return normalized;
  }

  if (action.attack) {
    return {
      kind: "ATTACK_ROLL",
      bonus: action.attack.bonus,
      critRange: action.attack.critRange ?? 20,
      critRule: action.damage?.critRule ?? "double-dice"
    };
  }

  return { kind: "NO_ROLL" };
}

function normalizeTargeting(action: ActionDefinition): TargetingSpec | undefined {
  return action.targeting;
}

function mapEffects(action: ActionDefinition): ConditionalEffects | undefined {
  if (!action.ops) return undefined;
  return action.ops as ConditionalEffects;
}

export function actionDefinitionToActionSpec(action: ActionDefinition): ActionSpec {
  return {
    id: action.id,
    name: action.name,
    summary: action.summary,
    targeting: normalizeTargeting(action),
    resolution: mapResolution(action),
    effects: mapEffects(action),
    reactionWindows: action.reactionWindows ?? [],
    hooks: action.hooks ?? [],
    tags: action.tags ?? []
  };
}

