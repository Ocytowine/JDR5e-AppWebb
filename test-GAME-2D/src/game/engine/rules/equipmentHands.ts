import type { ArmorItemDefinition } from "../armorTypes";
import type { WeaponTypeDefinition } from "../weaponTypes";
import type { ActionDefinition } from "./actionTypes";
import { getDualWieldConstraintIssues } from "./weaponPairingRules";

type InventoryEntryLike = {
  type?: string;
  id?: string;
  equippedSlot?: string | null;
  storedIn?: string | null;
  isPrimaryWeapon?: boolean;
  isSecondaryHand?: boolean;
};

export type HandUsageState = {
  readyWeaponCount: number;
  readyShieldCount: number;
  strictTwoHandedReady: boolean;
  hasShieldInHands: boolean;
  hasOffhandWeapon: boolean;
  occupiedHands: number;
  freeHands: number;
};

type FeatureLike = {
  rules?: {
    modifiers?: Array<Record<string, unknown>>;
  };
};

export type EquipmentRuntimePolicy = {
  ignoreTwoHandedShieldRestriction: boolean;
  allowSomaticWithOccupiedHands: boolean;
  extraWeaponInteractionsPerTurn: number;
  allowWeaponSwapWithoutInteraction: boolean;
  drawWeaponFromPackAsInteraction: boolean;
};

const DEFAULT_POLICY: EquipmentRuntimePolicy = {
  ignoreTwoHandedShieldRestriction: false,
  allowSomaticWithOccupiedHands: false,
  extraWeaponInteractionsPerTurn: 0,
  allowWeaponSwapWithoutInteraction: false,
  drawWeaponFromPackAsInteraction: false
};

function isEquippedInHands(entry: InventoryEntryLike): boolean {
  return Boolean(entry?.equippedSlot) && !entry?.storedIn;
}

function parsePolicyModifier(entry: Record<string, unknown>): Partial<EquipmentRuntimePolicy> {
  const applyTo = String(entry?.applyTo ?? "")
    .trim()
    .toLowerCase();
  if (!["equipment", "equipmentpolicy", "hands"].includes(applyTo)) {
    return {};
  }
  const stat = String(entry?.stat ?? entry?.mode ?? entry?.policy ?? "")
    .trim()
    .toLowerCase();
  const value =
    typeof entry?.value === "number"
      ? entry.value
      : typeof entry?.enabled === "boolean"
      ? (entry.enabled ? 1 : 0)
      : 1;
  if (value <= 0) return {};
  if (
    stat === "ignoretwohandedshieldrestriction" ||
    stat === "allow_two_handed_with_shield" ||
    stat === "allowtwohandedwithshield"
  ) {
    return { ignoreTwoHandedShieldRestriction: true };
  }
  if (
    stat === "allowsomaticwithoccupiedhands" ||
    stat === "allow_somatic_with_occupied_hands" ||
    stat === "allowsomaticwithoutfreehand"
  ) {
    return { allowSomaticWithOccupiedHands: true };
  }
  if (stat === "extraweaponinteractionsperturn" || stat === "extra_weapon_interactions_per_turn") {
    return { extraWeaponInteractionsPerTurn: Math.max(0, Math.floor(value)) };
  }
  if (stat === "allowweaponswapwithoutinteraction" || stat === "allow_weapon_swap_without_interaction") {
    return { allowWeaponSwapWithoutInteraction: true };
  }
  if (stat === "drawweaponfrompackasinteraction" || stat === "draw_weapon_from_pack_as_interaction") {
    return { drawWeaponFromPackAsInteraction: true };
  }
  return {};
}

export function resolveEquipmentRuntimePolicy(params: {
  features?: FeatureLike[] | null;
}): EquipmentRuntimePolicy {
  const features = Array.isArray(params.features) ? params.features : [];
  const policy: EquipmentRuntimePolicy = { ...DEFAULT_POLICY };
  for (const feature of features) {
    const modifiers = Array.isArray(feature?.rules?.modifiers)
      ? (feature.rules?.modifiers as Array<Record<string, unknown>>)
      : [];
    for (const modifier of modifiers) {
      const parsed = parsePolicyModifier(modifier);
      if (parsed.ignoreTwoHandedShieldRestriction) {
        policy.ignoreTwoHandedShieldRestriction = true;
      }
      if (parsed.allowSomaticWithOccupiedHands) {
        policy.allowSomaticWithOccupiedHands = true;
      }
      if (typeof parsed.extraWeaponInteractionsPerTurn === "number") {
        policy.extraWeaponInteractionsPerTurn += Math.max(0, parsed.extraWeaponInteractionsPerTurn);
      }
      if (parsed.allowWeaponSwapWithoutInteraction) {
        policy.allowWeaponSwapWithoutInteraction = true;
      }
      if (parsed.drawWeaponFromPackAsInteraction) {
        policy.drawWeaponFromPackAsInteraction = true;
      }
    }
  }
  return policy;
}

export function getHandUsageState(params: {
  inventoryItems: Array<InventoryEntryLike>;
  weaponById: Map<string, WeaponTypeDefinition>;
  armorById: Map<string, ArmorItemDefinition>;
}): HandUsageState {
  const inventory = Array.isArray(params.inventoryItems) ? params.inventoryItems : [];
  const primaryReadyWeaponEntries = inventory.filter(entry => {
    if (entry?.type !== "weapon") return false;
    if (!entry?.isPrimaryWeapon) return false;
    return isEquippedInHands(entry);
  });
  const secondaryEntry =
    inventory.find(entry => Boolean(entry?.isSecondaryHand) && isEquippedInHands(entry)) ?? null;
  const readyWeapons: InventoryEntryLike[] = [];
  if (primaryReadyWeaponEntries.length > 0) {
    readyWeapons.push(primaryReadyWeaponEntries[0]);
  }
  if (secondaryEntry?.type === "weapon") {
    const secondaryId = String(secondaryEntry.id ?? "");
    const already = readyWeapons.some(entry => String(entry.id ?? "") === secondaryId);
    if (!already) readyWeapons.push(secondaryEntry);
  }
  if (readyWeapons.length === 0) {
    const fallback = inventory.filter(entry => entry?.type === "weapon" && isEquippedInHands(entry)).slice(0, 1);
    fallback.forEach(entry => readyWeapons.push(entry));
  }
  const readyShields = secondaryEntry
    ? secondaryEntry.type === "armor" &&
      (params.armorById.get(String(secondaryEntry.id ?? ""))?.armorCategory === "shield")
      ? [secondaryEntry]
      : []
    : inventory.filter(entry => {
        if (entry?.type !== "armor") return false;
        if (!entry?.equippedSlot || entry?.storedIn) return false;
        const def = params.armorById.get(String(entry.id ?? ""));
        return def?.armorCategory === "shield";
      });
  const strictTwoHandedReady = readyWeapons.some(entry => {
    const def = params.weaponById.get(String(entry.id ?? ""));
    return Boolean(def?.properties?.twoHanded);
  });
  const readyWeaponCount = readyWeapons.length;
  const readyShieldCount = readyShields.length;
  const hasShieldInHands = readyShieldCount > 0;
  const hasOffhandWeapon = !strictTwoHandedReady && readyWeaponCount >= 2;
  const occupiedHands = strictTwoHandedReady
    ? 2
    : Math.min(2, readyShieldCount + Math.min(2, readyWeaponCount));
  const freeHands = Math.max(0, 2 - occupiedHands);
  return {
    readyWeaponCount,
    readyShieldCount,
    strictTwoHandedReady,
    hasShieldInHands,
    hasOffhandWeapon,
    occupiedHands,
    freeHands
  };
}

export function getEquipmentConstraintIssues(params: {
  action: ActionDefinition;
  inventoryItems: Array<InventoryEntryLike>;
  weaponById: Map<string, WeaponTypeDefinition>;
  armorById: Map<string, ArmorItemDefinition>;
  selectedWeapon?: WeaponTypeDefinition | null;
  features?: FeatureLike[] | null;
  customPolicy?: Partial<EquipmentRuntimePolicy> | null;
}): string[] {
  const issues: string[] = [];
  const handState = getHandUsageState({
    inventoryItems: params.inventoryItems,
    weaponById: params.weaponById,
    armorById: params.armorById
  });
  const policy = {
    ...resolveEquipmentRuntimePolicy({ features: params.features }),
    ...(params.customPolicy ?? {})
  };
  const weapon = params.selectedWeapon ?? null;

  if (
    weapon?.properties?.twoHanded &&
    handState.hasShieldInHands &&
    !policy.ignoreTwoHandedShieldRestriction
  ) {
    issues.push("Arme a deux mains incompatible avec un bouclier equipe.");
  }

  const needsSomatic = Boolean(params.action?.components?.somatic);
  if (needsSomatic && handState.freeHands <= 0 && !policy.allowSomaticWithOccupiedHands) {
    issues.push("Composante somatique impossible (aucune main libre).");
  }

  const dualWieldIssues = getDualWieldConstraintIssues({
    action: params.action,
    inventoryItems: params.inventoryItems,
    weaponById: params.weaponById,
    armorById: params.armorById,
    selectedWeapon: params.selectedWeapon ?? null,
    features: params.features
  });
  dualWieldIssues.forEach(issue => issues.push(issue));

  return Array.from(new Set(issues));
}
