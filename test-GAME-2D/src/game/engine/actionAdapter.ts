import type { ActionDefinition } from "../actionTypes";
import type { ActionSpec, ConditionalEffects, ResolutionSpec } from "./types";

const kindMap: Record<string, ResolutionSpec["kind"]> = {
  ATTACK_ROLL: "attack",
  SAVING_THROW: "save",
  ABILITY_CHECK: "check",
  NO_ROLL: "none",
  attack: "attack",
  save: "save",
  check: "check",
  none: "none"
};

const abilityMap: Record<string, "str" | "dex" | "con" | "int" | "wis" | "cha"> = {
  STR: "str",
  FOR: "str",
  DEX: "dex",
  CON: "con",
  INT: "int",
  WIS: "wis",
  SAG: "wis",
  CHA: "cha",
  str: "str",
  dex: "dex",
  con: "con",
  int: "int",
  wis: "wis",
  cha: "cha"
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
      kind: "attack",
      bonus: action.attack.bonus,
      critRange: action.attack.critRange ?? 20,
      critRule: action.damage?.critRule ?? "double-dice"
    };
  }

  return { kind: "none" };
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
    targeting: action.targeting,
    resolution: mapResolution(action),
    effects: mapEffects(action),
    reactionWindows: action.reactionWindows ?? [],
    hooks: action.hooks ?? [],
    tags: action.tags ?? []
  };
}
