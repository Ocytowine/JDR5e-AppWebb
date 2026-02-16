import type { ArmorItemDefinition } from "../armorTypes";
import type { WeaponTypeDefinition } from "../weaponTypes";
import type { ActionDefinition } from "./actionTypes";

type InventoryEntryLike = {
  type?: string;
  id?: string;
  equippedSlot?: string | null;
  storedIn?: string | null;
  isPrimaryWeapon?: boolean;
  isSecondaryHand?: boolean;
};

type FeatureLike = {
  rules?: {
    modifiers?: Array<Record<string, unknown>>;
  };
};

export type DualWieldPolicy = {
  ignoreLightRequirement: boolean;
};

export type DualWieldValidationResult = {
  ok: boolean;
  issues: string[];
  mainWeapon: WeaponTypeDefinition | null;
  offhandWeapon: WeaponTypeDefinition | null;
};

export const DUAL_WIELD_ACTION_TAGS = ["dual-wield", "offhand-attack", "secondary-attack"] as const;

const DEFAULT_DUAL_WIELD_POLICY: DualWieldPolicy = {
  ignoreLightRequirement: false
};

function isEquippedInCarrySlot(entry: InventoryEntryLike): boolean {
  return Boolean(entry?.equippedSlot) && !entry?.storedIn;
}

function parseDualWieldPolicyModifier(entry: Record<string, unknown>): Partial<DualWieldPolicy> {
  const applyTo = String(entry?.applyTo ?? "")
    .trim()
    .toLowerCase();
  if (!["dualwield", "weaponpairing", "equipment", "equipmentpolicy", "hands"].includes(applyTo)) {
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
    stat === "dualwieldignorelightrequirement" ||
    stat === "dual_wield_ignore_light_requirement" ||
    stat === "ignoredualwieldlightrequirement" ||
    stat === "ignore_dual_wield_light_requirement"
  ) {
    return { ignoreLightRequirement: true };
  }
  return {};
}

export function resolveDualWieldPolicy(params: {
  features?: FeatureLike[] | null;
}): DualWieldPolicy {
  const features = Array.isArray(params.features) ? params.features : [];
  const policy: DualWieldPolicy = { ...DEFAULT_DUAL_WIELD_POLICY };
  for (const feature of features) {
    const modifiers = Array.isArray(feature?.rules?.modifiers)
      ? (feature.rules?.modifiers as Array<Record<string, unknown>>)
      : [];
    for (const modifier of modifiers) {
      const parsed = parseDualWieldPolicyModifier(modifier);
      if (parsed.ignoreLightRequirement) {
        policy.ignoreLightRequirement = true;
      }
    }
  }
  return policy;
}

export function hasDualWieldActionTag(tags: string[] | undefined | null): boolean {
  const list = Array.isArray(tags) ? tags : [];
  return DUAL_WIELD_ACTION_TAGS.some(tag => list.includes(tag));
}

export function normalizeDualWieldActionTags(tags: string[] | undefined | null): string[] {
  const list = Array.isArray(tags) ? [...tags] : [];
  if (!hasDualWieldActionTag(list)) return list;
  const next = new Set<string>(list);
  DUAL_WIELD_ACTION_TAGS.forEach(tag => next.add(tag));
  return Array.from(next);
}

function isDualWieldAction(action: ActionDefinition): boolean {
  return hasDualWieldActionTag(action?.tags);
}

function getReadyWeaponDefs(params: {
  inventoryItems: Array<InventoryEntryLike>;
  weaponById: Map<string, WeaponTypeDefinition>;
}): WeaponTypeDefinition[] {
  const inventory = Array.isArray(params.inventoryItems) ? params.inventoryItems : [];
  const primaryEntries = inventory.filter(entry => {
    if (entry?.type !== "weapon") return false;
    if (!entry?.isPrimaryWeapon) return false;
    return isEquippedInCarrySlot(entry);
  });
  const secondaryEntry =
    inventory.find(entry => Boolean(entry?.isSecondaryHand) && isEquippedInCarrySlot(entry)) ?? null;
  const selectedEntries: InventoryEntryLike[] = [];
  if (primaryEntries.length > 0) selectedEntries.push(primaryEntries[0]);
  if (secondaryEntry?.type === "weapon") {
    const sid = String(secondaryEntry.id ?? "");
    const exists = selectedEntries.some(entry => String(entry.id ?? "") === sid);
    if (!exists) selectedEntries.push(secondaryEntry);
  }
  if (selectedEntries.length === 0) {
    const fallback = inventory.filter(entry => entry?.type === "weapon" && isEquippedInCarrySlot(entry)).slice(0, 1);
    fallback.forEach(entry => selectedEntries.push(entry));
  }
  return selectedEntries
    .map(entry => params.weaponById.get(String(entry.id ?? "")) ?? null)
    .filter((weapon): weapon is WeaponTypeDefinition => Boolean(weapon));
}

function hasReadyShield(params: {
  inventoryItems: Array<InventoryEntryLike>;
  armorById: Map<string, ArmorItemDefinition>;
}): boolean {
  const inventory = Array.isArray(params.inventoryItems) ? params.inventoryItems : [];
  const secondaryEntry =
    inventory.find(entry => Boolean(entry?.isSecondaryHand) && isEquippedInCarrySlot(entry)) ?? null;
  if (secondaryEntry) {
    if (secondaryEntry.type !== "armor") return false;
    const def = params.armorById.get(String(secondaryEntry.id ?? ""));
    return def?.armorCategory === "shield";
  }
  return inventory.some(entry => {
    if (entry?.type !== "armor") return false;
    if (!isEquippedInCarrySlot(entry)) return false;
    const def = params.armorById.get(String(entry.id ?? ""));
    return def?.armorCategory === "shield";
  });
}

export function getDualWieldConstraintIssues(params: {
  action: ActionDefinition;
  inventoryItems: Array<InventoryEntryLike>;
  weaponById: Map<string, WeaponTypeDefinition>;
  armorById: Map<string, ArmorItemDefinition>;
  selectedWeapon?: WeaponTypeDefinition | null;
  features?: FeatureLike[] | null;
  policyOverride?: Partial<DualWieldPolicy> | null;
}): string[] {
  const issues: string[] = [];
  const readyWeapons = getReadyWeaponDefs({
    inventoryItems: params.inventoryItems,
    weaponById: params.weaponById
  });
  const hasShield = hasReadyShield({
    inventoryItems: params.inventoryItems,
    armorById: params.armorById
  });
  const policy = {
    ...resolveDualWieldPolicy({ features: params.features }),
    ...(params.policyOverride ?? {})
  };
  const dualAttempt = isDualWieldAction(params.action);

  const hasStrictTwoHandedReady = readyWeapons.some(weapon => Boolean(weapon?.properties?.twoHanded));
  if (hasStrictTwoHandedReady && readyWeapons.length > 1) {
    issues.push("Arme a deux mains incompatible avec une seconde arme prete.");
  }
  if (hasStrictTwoHandedReady && hasShield) {
    issues.push("Arme a deux mains incompatible avec un bouclier equipe.");
  }
  if (readyWeapons.length >= 2 && hasShield) {
    issues.push("Combat a deux armes incompatible avec un bouclier equipe.");
  }

  if (!dualAttempt) return issues;

  const offhandWeapon = params.selectedWeapon ?? null;
  const mainWeapon =
    readyWeapons.find(weapon => !offhandWeapon || weapon.id !== offhandWeapon.id) ??
    readyWeapons[0] ??
    null;
  const resolvedOffhand =
    offhandWeapon ??
    readyWeapons.find(weapon => !mainWeapon || weapon.id !== mainWeapon.id) ??
    null;

  if (!mainWeapon || !resolvedOffhand) {
    issues.push("Attaque secondaire impossible: deux armes pretes sont requises.");
    return issues;
  }
  if (mainWeapon.properties?.twoHanded || resolvedOffhand.properties?.twoHanded) {
    issues.push("Attaque secondaire impossible avec une arme a deux mains.");
  }
  if (!policy.ignoreLightRequirement) {
    const mainLight = Boolean(mainWeapon.properties?.light);
    const offhandLight = Boolean(resolvedOffhand.properties?.light);
    if (!mainLight || !offhandLight) {
      issues.push("Attaque secondaire impossible: les deux armes doivent etre Light.");
    }
  }
  return issues;
}

export function validateDualWieldAttempt(params: {
  action: ActionDefinition;
  inventoryItems: Array<InventoryEntryLike>;
  weaponById: Map<string, WeaponTypeDefinition>;
  armorById: Map<string, ArmorItemDefinition>;
  selectedWeapon?: WeaponTypeDefinition | null;
  features?: FeatureLike[] | null;
  policyOverride?: Partial<DualWieldPolicy> | null;
}): DualWieldValidationResult {
  const readyWeapons = getReadyWeaponDefs({
    inventoryItems: params.inventoryItems,
    weaponById: params.weaponById
  });
  const offhandWeapon = params.selectedWeapon ?? null;
  const mainWeapon =
    readyWeapons.find(weapon => !offhandWeapon || weapon.id !== offhandWeapon.id) ??
    readyWeapons[0] ??
    null;
  const resolvedOffhand =
    offhandWeapon ??
    readyWeapons.find(weapon => !mainWeapon || weapon.id !== mainWeapon.id) ??
    null;

  const issues = getDualWieldConstraintIssues(params);
  return {
    ok: issues.length === 0,
    issues,
    mainWeapon,
    offhandWeapon: resolvedOffhand
  };
}
