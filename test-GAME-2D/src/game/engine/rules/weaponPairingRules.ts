import type { ArmorItemDefinition } from "../armorTypes";
import type { WeaponTypeDefinition } from "../weaponTypes";
import type { ActionDefinition } from "./actionTypes";
import {
  type InventoryEntryLike,
  resolveEquippedHandsLoadout
} from "./equippedHandsResolver";

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
const DUAL_WIELD_TAG_ALIASES: Record<string, (typeof DUAL_WIELD_ACTION_TAGS)[number]> = {
  "dual-wield": "dual-wield",
  dualwield: "dual-wield",
  "two-weapon": "dual-wield",
  "two-weapons": "dual-wield",
  offhand: "offhand-attack",
  "offhand-attack": "offhand-attack",
  "offhand_attack": "offhand-attack",
  secondary: "secondary-attack",
  "secondary-attack": "secondary-attack",
  "secondary_attack": "secondary-attack"
};

const DEFAULT_DUAL_WIELD_POLICY: DualWieldPolicy = {
  ignoreLightRequirement: false
};

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
  return list.some(tag => {
    const normalized = String(tag ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, "-");
    return Boolean(DUAL_WIELD_TAG_ALIASES[normalized]);
  });
}

export function normalizeDualWieldActionTags(tags: string[] | undefined | null): string[] {
  const list = Array.isArray(tags) ? [...tags] : [];
  const next = new Set<string>(
    list
      .map(tag => String(tag ?? "").trim())
      .filter(Boolean)
  );
  const canonicalMatches = new Set<(typeof DUAL_WIELD_ACTION_TAGS)[number]>();
  list.forEach(rawTag => {
    const normalized = String(rawTag ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, "-");
    const canonical = DUAL_WIELD_TAG_ALIASES[normalized];
    if (canonical) canonicalMatches.add(canonical);
  });
  if (canonicalMatches.size === 0) return Array.from(next);
  DUAL_WIELD_ACTION_TAGS.forEach(tag => next.add(tag));
  return Array.from(next);
}

function isDualWieldAction(action: ActionDefinition): boolean {
  return hasDualWieldActionTag(action?.tags);
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
  const loadout = resolveEquippedHandsLoadout({
    inventoryItems: params.inventoryItems,
    weaponById: params.weaponById,
    armorById: params.armorById
  });
  const readyWeapons = loadout.readyWeapons;
  const hasShield = loadout.readyShieldEntries.length > 0;
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
  const loadout = resolveEquippedHandsLoadout({
    inventoryItems: params.inventoryItems,
    weaponById: params.weaponById,
    armorById: params.armorById
  });
  const readyWeapons = loadout.readyWeapons;
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
