import type { ArmorItemDefinition } from "./armorTypes";
import type { BonusDefinition } from "./bonusTypes";
import type { ObjectItemDefinition } from "./objectTypes";
import type { WeaponTypeDefinition } from "./weaponTypes";
import type { CombatStats, Personnage, TokenState } from "../types";
import { evaluateAllConditions } from "./engine/conditionEval";
import type { ConditionExpr } from "./conditions";

type GrantLike = {
  kind?: string;
  ids?: string[];
  inline?: BonusDefinition[];
};

type InventoryEntry = {
  type?: string;
  id?: string;
  equippedSlot?: string | null;
  storedIn?: string | null;
};

type BonusEntry = {
  bonus: BonusDefinition;
  sourceItemId: string;
  sourceItemType: "weapon" | "armor" | "object";
  sourceSlot: string | null;
};

type EquippedResolved = {
  itemId: string;
  itemType: "weapon" | "armor" | "object";
  slot: string | null;
  weapon?: WeaponTypeDefinition;
  armor?: ArmorItemDefinition;
  object?: ObjectItemDefinition;
};

const SUPPORTED_STATS = new Set([
  "modFOR",
  "modDEX",
  "modCON",
  "modINT",
  "modSAG",
  "modCHA",
  "armorClass",
  "maxHp",
  "moveRange",
  "attackBonus",
  "maxAttacksPerTurn",
  "actionsPerTurn",
  "bonusActionsPerTurn"
]);

function getEquippedInventoryEntries(character: Personnage): InventoryEntry[] {
  const inventory = Array.isArray((character as any)?.inventoryItems)
    ? ((character as any).inventoryItems as InventoryEntry[])
    : [];
  return inventory.filter(item => Boolean(item?.equippedSlot) && !item?.storedIn);
}

function getItemGrants(
  item: WeaponTypeDefinition | ArmorItemDefinition | ObjectItemDefinition | null
): GrantLike[] {
  if (!item) return [];
  const grants = (item as any)?.grants;
  return Array.isArray(grants) ? (grants as GrantLike[]) : [];
}

function resolveEquippedItems(params: {
  character: Personnage;
  weaponById: Map<string, WeaponTypeDefinition>;
  armorById: Map<string, ArmorItemDefinition>;
  objectById: Map<string, ObjectItemDefinition>;
}): EquippedResolved[] {
  const equipped = getEquippedInventoryEntries(params.character);
  const out: EquippedResolved[] = [];

  for (const entry of equipped) {
    const itemId = String(entry.id ?? "");
    const itemType = String(entry.type ?? "");
    const slot = typeof entry.equippedSlot === "string" ? entry.equippedSlot : null;
    if (!itemId || !itemType) continue;
    if (itemType === "weapon") {
      const weapon = params.weaponById.get(itemId);
      if (!weapon) continue;
      out.push({ itemId, itemType: "weapon", slot, weapon });
      continue;
    }
    if (itemType === "armor") {
      const armor = params.armorById.get(itemId);
      if (!armor) continue;
      out.push({ itemId, itemType: "armor", slot, armor });
      continue;
    }
    if (itemType === "object") {
      const object = params.objectById.get(itemId);
      if (!object) continue;
      out.push({ itemId, itemType: "object", slot, object });
    }
  }

  return out;
}

function uniquePush(target: string[], value: string) {
  if (!value) return;
  if (!target.includes(value)) target.push(value);
}

export function buildEquipmentContextTags(params: {
  character: Personnage;
  weaponById: Map<string, WeaponTypeDefinition>;
  armorById: Map<string, ArmorItemDefinition>;
  objectById: Map<string, ObjectItemDefinition>;
}): string[] {
  const equipped = resolveEquippedItems(params);
  const tags: string[] = [];

  for (const item of equipped) {
    uniquePush(tags, `equip:item:${item.itemId}`);
    uniquePush(tags, `equip:type:${item.itemType}`);
    if (item.slot) uniquePush(tags, `equip:slot:${item.slot}`);

    if (item.itemType === "weapon" && item.weapon) {
      if (item.weapon.category) {
        uniquePush(tags, `equip:weaponCategory:${item.weapon.category}`);
      }
    } else if (item.itemType === "armor" && item.armor) {
      if (item.armor.armorCategory) {
        uniquePush(tags, `equip:armorCategory:${item.armor.armorCategory}`);
      }
    } else if (item.itemType === "object" && item.object) {
      if (item.object.category) {
        uniquePush(tags, `equip:objectCategory:${item.object.category}`);
      }
    }
  }

  return tags;
}

function collectBonusEntries(params: {
  character: Personnage;
  weaponById: Map<string, WeaponTypeDefinition>;
  armorById: Map<string, ArmorItemDefinition>;
  objectById: Map<string, ObjectItemDefinition>;
  bonusById: Map<string, BonusDefinition>;
}): BonusEntry[] {
  const equipped = resolveEquippedItems(params);
  const out: BonusEntry[] = [];

  for (const resolved of equipped) {
    const item = resolved.weapon ?? resolved.armor ?? resolved.object ?? null;
    if (!item) continue;

    const grants = getItemGrants(item);
    for (const grant of grants) {
      if (grant?.kind !== "bonus") continue;

      const ids = Array.isArray(grant.ids) ? grant.ids : [];
      ids.forEach(id => {
        const def = params.bonusById.get(String(id));
        if (!def) return;
        out.push({
          bonus: def,
          sourceItemId: resolved.itemId,
          sourceItemType: resolved.itemType,
          sourceSlot: resolved.slot
        });
      });

      const inline = Array.isArray(grant.inline) ? grant.inline : [];
      inline.forEach(def => {
        if (!def || typeof def !== "object") return;
        out.push({
          bonus: def,
          sourceItemId: resolved.itemId,
          sourceItemType: resolved.itemType,
          sourceSlot: resolved.slot
        });
      });
    }
  }

  return out;
}

function getStatValue(stats: CombatStats, stat: string): number {
  if (stat === "modFOR") return Number(stats.mods.modFOR ?? 0);
  if (stat === "modDEX") return Number(stats.mods.modDEX ?? 0);
  if (stat === "modCON") return Number(stats.mods.modCON ?? 0);
  if (stat === "modINT") return Number(stats.mods.modINT ?? 0);
  if (stat === "modSAG") return Number(stats.mods.modSAG ?? 0);
  if (stat === "modCHA") return Number(stats.mods.modCHA ?? 0);
  if (stat === "armorClass") return Number(stats.armorClass ?? 0);
  if (stat === "maxHp") return Number(stats.maxHp ?? 0);
  if (stat === "moveRange") return Number(stats.moveRange ?? 0);
  if (stat === "attackBonus") return Number(stats.attackBonus ?? 0);
  if (stat === "maxAttacksPerTurn") return Number(stats.maxAttacksPerTurn ?? 0);
  if (stat === "actionsPerTurn") return Number(stats.actionsPerTurn ?? 0);
  if (stat === "bonusActionsPerTurn") return Number(stats.bonusActionsPerTurn ?? 0);
  return 0;
}

function setStatValue(stats: CombatStats, stat: string, value: number) {
  if (stat === "modFOR") stats.mods.modFOR = value;
  else if (stat === "modDEX") stats.mods.modDEX = value;
  else if (stat === "modCON") stats.mods.modCON = value;
  else if (stat === "modINT") stats.mods.modINT = value;
  else if (stat === "modSAG") stats.mods.modSAG = value;
  else if (stat === "modCHA") stats.mods.modCHA = value;
  else if (stat === "armorClass") stats.armorClass = value;
  else if (stat === "maxHp") stats.maxHp = value;
  else if (stat === "moveRange") stats.moveRange = value;
  else if (stat === "attackBonus") stats.attackBonus = value;
  else if (stat === "maxAttacksPerTurn") stats.maxAttacksPerTurn = value;
  else if (stat === "actionsPerTurn") stats.actionsPerTurn = value;
  else if (stat === "bonusActionsPerTurn") stats.bonusActionsPerTurn = value;
}

function buildActorForBonusRequirements(params: {
  character: Personnage;
  stats: CombatStats;
  tags: string[];
}): TokenState {
  return {
    id: params.character.id ?? "bonus-eval",
    type: "player",
    x: 0,
    y: 0,
    hp: Number((params.character as any)?.pvActuels ?? params.stats.maxHp ?? 1) || 1,
    maxHp: Number(params.stats.maxHp ?? 1) || 1,
    combatStats: {
      ...params.stats,
      tags: [...params.tags]
    },
    tags: [...params.tags]
  } as TokenState;
}

function bonusRequirementsPass(params: {
  bonus: BonusDefinition;
  actor: TokenState;
  itemTags: string[];
}): boolean {
  const requirements = Array.isArray(params.bonus?.requirements)
    ? (params.bonus.requirements as ConditionExpr[])
    : [];
  if (requirements.length === 0) return true;
  const actorTagsRaw = (params.actor as { tags?: string[] }).tags;
  const actorTags = Array.isArray(actorTagsRaw) ? [...actorTagsRaw, ...params.itemTags] : [...params.itemTags];
  const actor = { ...params.actor } as TokenState & { tags?: string[] };
  actor.tags = Array.from(new Set(actorTags));
  if (params.actor.combatStats) {
    actor.combatStats = {
      ...params.actor.combatStats,
      tags: Array.from(new Set([...(params.actor.combatStats.tags ?? []), ...params.itemTags]))
    };
  }
  return evaluateAllConditions(requirements, { actor: actor as TokenState, phase: "BUILD_INTENT" });
}

function buildItemTags(entry: BonusEntry): string[] {
  const tags: string[] = [];
  uniquePush(tags, `equip:item:${entry.sourceItemId}`);
  uniquePush(tags, `equip:type:${entry.sourceItemType}`);
  if (entry.sourceSlot) uniquePush(tags, `equip:slot:${entry.sourceSlot}`);
  return tags;
}

export function applyEquipmentBonusesToCombatStats(params: {
  character: Personnage;
  baseStats: CombatStats;
  weaponById: Map<string, WeaponTypeDefinition>;
  armorById: Map<string, ArmorItemDefinition>;
  objectById: Map<string, ObjectItemDefinition>;
  bonusById: Map<string, BonusDefinition>;
}): { stats: CombatStats; applied: Array<{ bonusId: string; sourceItemId: string }> } {
  const equipTags = buildEquipmentContextTags(params);
  const next: CombatStats = {
    ...params.baseStats,
    mods: { ...params.baseStats.mods },
    resources: { ...(params.baseStats.resources ?? {}) },
    tags: Array.from(
      new Set([...(Array.isArray(params.baseStats.tags) ? params.baseStats.tags : []), ...equipTags])
    )
  };

  const entries = collectBonusEntries(params);
  const applied: Array<{ bonusId: string; sourceItemId: string }> = [];

  for (const entry of entries) {
    const bonus = entry.bonus;
    const stat = String(bonus?.stat ?? "");
    if (!SUPPORTED_STATS.has(stat)) continue;
    const value = Number(bonus?.value ?? 0);
    if (!Number.isFinite(value)) continue;
    const actorForRequirements = buildActorForBonusRequirements({
      character: params.character,
      stats: next,
      tags: next.tags ?? []
    });
    if (!bonusRequirementsPass({ bonus, actor: actorForRequirements, itemTags: buildItemTags(entry) })) {
      continue;
    }
    const mode = bonus?.mode;
    const current = getStatValue(next, stat);
    let resolved = current;

    if (mode === "set") resolved = value;
    else if (mode === "max") resolved = Math.max(current, value);
    else resolved = current + value;

    setStatValue(next, stat, resolved);
    applied.push({ bonusId: String(bonus?.id ?? "bonus-inline"), sourceItemId: entry.sourceItemId });
  }

  return { stats: next, applied };
}
