import type { ActionDefinition } from "./actionTypes";
import type { WeaponTypeDefinition } from "../weaponTypes";
import type { TokenState } from "../../../types";

export function normalizeWeaponModToken(mod: string | null | undefined): string | null {
  if (!mod) return null;
  const cleaned = String(mod).replace(/\s+/g, "");
  if (cleaned === "mod.FOR" || cleaned === "modFOR") return "modFOR";
  if (cleaned === "mod.DEX" || cleaned === "modDEX") return "modDEX";
  if (cleaned === "mod.CON" || cleaned === "modCON") return "modCON";
  if (cleaned === "mod.INT" || cleaned === "modINT") return "modINT";
  if (cleaned === "mod.SAG" || cleaned === "modSAG" || cleaned === "mod.WIS" || cleaned === "modWIS") {
    return "modSAG";
  }
  if (cleaned === "mod.CHA" || cleaned === "modCHA") return "modCHA";
  return null;
}

export function computeWeaponAttackBonus(params: {
  actor: TokenState;
  weapon: WeaponTypeDefinition;
  getAbilityModForActor: (actor: TokenState, modToken: string | null) => number;
  getProficiencyBonusForActor: (actor: TokenState) => number;
  getWeaponProficienciesForActor: (actor: TokenState) => string[];
  forceModToken?: string | null;
}): number {
  const {
    actor,
    weapon,
    getAbilityModForActor,
    getProficiencyBonusForActor,
    getWeaponProficienciesForActor,
    forceModToken
  } =
    params;
  const modToken = forceModToken ?? normalizeWeaponModToken(weapon.attack?.mod ?? null);
  const abilityMod = getAbilityModForActor(actor, modToken);
  const profs = getWeaponProficienciesForActor(actor);
  const proficient = profs.includes(weapon.subtype);
  const profBonus = proficient ? getProficiencyBonusForActor(actor) : 0;
  const bonusSpec = weapon.attack?.bonus;
  const extraBonus =
    typeof bonusSpec === "number"
      ? bonusSpec
      : typeof bonusSpec === "string" && bonusSpec === "bonus_maitrise"
      ? profBonus
      : 0;
  return abilityMod + extraBonus;
}

export function resolveWeaponModToken(params: {
  actor: TokenState;
  weapon: WeaponTypeDefinition;
  getAbilityModForActor: (actor: TokenState, modToken: string | null) => number;
}): string | null {
  const { actor, weapon, getAbilityModForActor } = params;
  const base = normalizeWeaponModToken(weapon.effectOnHit?.mod ?? weapon.attack?.mod ?? null);
  if (!weapon.properties?.finesse) return base;
  const str = getAbilityModForActor(actor, "modFOR");
  const dex = getAbilityModForActor(actor, "modDEX");
  return dex >= str ? "modDEX" : "modFOR";
}

export function buildWeaponOverrideAction(params: {
  action: ActionDefinition;
  actor: TokenState;
  weapon: WeaponTypeDefinition;
  attackBonus: number;
  modToken?: string | null;
  prefersRanged?: boolean;
  useTwoHandedDamage?: boolean;
}): ActionDefinition {
  const { action, weapon, attackBonus, modToken, prefersRanged, useTwoHandedDamage } = params;
  const weaponMasteries = Array.isArray(weapon.weaponMastery) ? weapon.weaponMastery : [];
  const masteryTags = weaponMasteries.map(id => `wm-active:${id}`);
  const weaponTags: string[] = [];
  weaponTags.push(`weapon:id:${weapon.id}`);
  if (weapon.properties?.light) weaponTags.push("weapon:light");
  if (weapon.properties?.heavy) weaponTags.push("weapon:heavy");
  if (weapon.properties?.thrown) weaponTags.push("weapon:thrown");
  if (weapon.properties?.twoHanded) weaponTags.push("weapon:two-handed");
  if (weapon.properties?.loading) weaponTags.push("weapon:loading");
  if (weapon.properties?.ammunition) weaponTags.push("weapon:ammunition");

  const useRangedMode = Boolean(prefersRanged);
  weaponTags.push(useRangedMode ? "weapon:mode:ranged" : "weapon:mode:melee");
  const normalRange =
    useRangedMode && weapon.properties?.thrown
      ? weapon.properties.thrown.normal
      : weapon.properties?.range?.normal ?? weapon.properties?.reach ?? null;
  const longRange =
    useRangedMode && weapon.properties?.thrown
      ? weapon.properties.thrown.long
      : weapon.properties?.range?.long ?? null;
  if (typeof normalRange === "number" && normalRange > 0) {
    weaponTags.push(`weapon:range-normal:${normalRange}`);
  }
  if (typeof longRange === "number" && longRange > 0) {
    weaponTags.push(`weapon:range-long:${longRange}`);
  }
  const nextTags = Array.from(new Set([...(action.tags ?? []), ...masteryTags, ...weaponTags]));

  const versatileDice = weapon.properties?.versatile;
  const canUseVersatile =
    !useRangedMode &&
    Boolean(useTwoHandedDamage) &&
    typeof versatileDice === "string" &&
    versatileDice.trim().length > 0;
  const damageDice =
    canUseVersatile && typeof versatileDice === "string"
      ? versatileDice
      : weapon.effectOnHit?.damage ?? weapon.damage?.dice ?? null;
  const damageType = weapon.effectOnHit?.damageType ?? weapon.damage?.damageType ?? null;
  const finalModToken =
    modToken ?? normalizeWeaponModToken(weapon.effectOnHit?.mod ?? weapon.attack?.mod);
  if (!damageDice) {
    return {
      ...action,
      tags: nextTags,
      ops: mergeWeaponExtraDamageOps(action.ops, weapon)
    };
  }

  const formula = finalModToken ? `${damageDice} + ${finalModToken}` : damageDice;
  const nextRangeMax =
    typeof longRange === "number" && longRange > 0
      ? longRange
      : typeof normalRange === "number" && normalRange > 0
      ? normalRange
      : action.targeting.range.max;
  const nextBase: ActionDefinition = {
    ...action,
    tags: nextTags,
    attack: action.attack
      ? { ...action.attack, bonus: attackBonus }
      : { bonus: attackBonus, critRange: 20 },
    damage: action.damage
      ? { ...action.damage, formula, damageType: damageType ?? action.damage.damageType }
      : action.damage,
    targeting: action.targeting
      ? {
          ...action.targeting,
          range: {
            ...action.targeting.range,
            max: nextRangeMax
          }
        }
      : action.targeting,
    ops: action.ops
      ? Object.fromEntries(
          Object.entries(action.ops).map(([key, list]) => [
            key,
            Array.isArray(list)
              ? list.map(op => {
                  if (op?.op !== "DealDamage") return op;
                  const currentFormula = String(op.formula ?? "");
                  const shouldOverride = currentFormula === action.damage?.formula;
                  if (!shouldOverride) return op;
                  return {
                    ...op,
                    formula,
                    damageType: damageType ?? op.damageType
                  };
                })
              : list
          ])
        )
      : action.ops
  };
  return {
    ...nextBase,
    ops: mergeWeaponExtraDamageOps(nextBase.ops, weapon)
  };
}

function normalizeExtraDamageBranch(
  when: string | null | undefined
): "onResolve" | "onHit" | "onMiss" | "onCrit" {
  if (when === "onResolve") return "onResolve";
  if (when === "onCrit") return "onCrit";
  if (when === "onMiss") return "onMiss";
  return "onHit";
}

function mergeWeaponExtraDamageOps(
  ops: ActionDefinition["ops"],
  weapon: WeaponTypeDefinition
): ActionDefinition["ops"] {
  const extra = Array.isArray(weapon.extraDamage) ? weapon.extraDamage : [];
  if (extra.length === 0) return ops;

  const nextOps: NonNullable<ActionDefinition["ops"]> = {
    onResolve: Array.isArray(ops?.onResolve) ? [...ops.onResolve] : [],
    onHit: Array.isArray(ops?.onHit) ? [...ops.onHit] : [],
    onMiss: Array.isArray(ops?.onMiss) ? [...ops.onMiss] : [],
    onCrit: Array.isArray(ops?.onCrit) ? [...ops.onCrit] : [],
    onSaveSuccess: Array.isArray(ops?.onSaveSuccess) ? [...ops.onSaveSuccess] : [],
    onSaveFail: Array.isArray(ops?.onSaveFail) ? [...ops.onSaveFail] : []
  };

  const existingKeySet = new Set<string>();
  (["onResolve", "onHit", "onMiss", "onCrit"] as const).forEach(branch => {
    const list = nextOps[branch] ?? [];
    list.forEach(op => {
      if (op?.op !== "DealDamage") return;
      const source = String(op?.source ?? "");
      const sourceWeaponId = String(op?.sourceWeaponId ?? "");
      const formula = String(op?.formula ?? "");
      const damageType = String(op?.damageType ?? "");
      if (source !== "weapon-extraDamage") return;
      existingKeySet.add(`${sourceWeaponId}|${branch}|${formula}|${damageType}`);
    });
  });

  extra.forEach(entry => {
    if (!entry) return;
    const formula = String(entry.dice ?? "").trim();
    const damageType = String(entry.damageType ?? "").trim();
    if (!formula || !damageType) return;
    const branch = normalizeExtraDamageBranch(entry.when);
    const dedupeKey = `${weapon.id}|${branch}|${formula}|${damageType}`;
    if (existingKeySet.has(dedupeKey)) return;
    existingKeySet.add(dedupeKey);
    (nextOps[branch] ??= []).push({
      op: "DealDamage",
      target: "primary",
      formula,
      damageType,
      source: "weapon-extraDamage",
      sourceWeaponId: weapon.id
    });
  });

  return nextOps;
}

export function getWeaponIdFromActionTags(tags: string[] | undefined): string | null {
  if (!Array.isArray(tags)) return null;
  const token = tags.find(tag => typeof tag === "string" && tag.startsWith("weapon:id:"));
  if (!token) return null;
  const value = token.slice("weapon:id:".length).trim();
  return value.length > 0 ? value : null;
}

export function getWeaponLoadingUsageKey(action: ActionDefinition): string | null {
  const tags = Array.isArray(action.tags) ? action.tags : [];
  if (!tags.includes("weapon:loading")) return null;
  const actionType = action.actionCost?.actionType;
  if (actionType !== "action" && actionType !== "bonus" && actionType !== "reaction") return null;
  const weaponId = getWeaponIdFromActionTags(tags) ?? action.id;
  return `weapon:loading:${weaponId}:${actionType}`;
}
