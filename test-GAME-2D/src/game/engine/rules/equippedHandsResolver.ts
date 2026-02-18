import type { ArmorItemDefinition } from "../armorTypes";
import type { WeaponTypeDefinition } from "../weaponTypes";

export type InventoryEntryLike = {
  type?: string;
  id?: string;
  instanceId?: string;
  equippedSlot?: string | null;
  storedIn?: string | null;
  isPrimaryWeapon?: boolean;
  isSecondaryHand?: boolean;
};

function isExplicitlyInHands(entry: InventoryEntryLike): boolean {
  return !entry?.storedIn && Boolean(entry?.isPrimaryWeapon || entry?.isSecondaryHand);
}

function getEntryKey(entry: InventoryEntryLike): string {
  const instanceId = String(entry?.instanceId ?? "").trim();
  if (instanceId) return `instance:${instanceId}`;
  const itemId = String(entry?.id ?? "").trim();
  const slot = String(entry?.equippedSlot ?? "").trim();
  return `item:${itemId}|slot:${slot}`;
}

export type EquippedHandsLoadout = {
  equippedEntries: InventoryEntryLike[];
  primaryEntry: InventoryEntryLike | null;
  secondaryEntry: InventoryEntryLike | null;
  primaryWeaponEntry: InventoryEntryLike | null;
  offhandWeaponEntry: InventoryEntryLike | null;
  readyWeaponEntries: InventoryEntryLike[];
  readyShieldEntries: InventoryEntryLike[];
  readyWeapons: WeaponTypeDefinition[];
  strictTwoHandedReady: boolean;
};

export function resolveEquippedHandsLoadout(params: {
  inventoryItems: Array<InventoryEntryLike>;
  weaponById: Map<string, WeaponTypeDefinition>;
  armorById: Map<string, ArmorItemDefinition>;
}): EquippedHandsLoadout {
  const inventory = Array.isArray(params.inventoryItems) ? params.inventoryItems : [];
  const explicitHandEntries = inventory.filter(isExplicitlyInHands);
  const equippedEntries =
    explicitHandEntries.length > 0
      ? explicitHandEntries
      : inventory.filter(entry => {
          if (!entry?.equippedSlot || entry?.storedIn) return false;
          if (entry?.type === "weapon") return true;
          if (entry?.type === "armor") {
            const def = params.armorById.get(String(entry.id ?? ""));
            return def?.armorCategory === "shield";
          }
          return false;
        });
  const equippedWeaponEntries = equippedEntries.filter(entry => entry?.type === "weapon");
  const equippedShieldEntries = equippedEntries.filter(entry => {
    if (entry?.type !== "armor") return false;
    const def = params.armorById.get(String(entry.id ?? ""));
    return def?.armorCategory === "shield";
  });

  const primaryWeaponEntry =
    equippedWeaponEntries.find(entry => Boolean(entry?.isPrimaryWeapon)) ??
    equippedWeaponEntries[0] ??
    null;
  const secondaryFlaggedEntry =
    equippedEntries.find(entry => Boolean(entry?.isSecondaryHand)) ?? null;

  let secondaryEntry: InventoryEntryLike | null = secondaryFlaggedEntry;
  if (!secondaryEntry) {
    secondaryEntry =
      equippedWeaponEntries.find(entry => {
        if (!primaryWeaponEntry) return true;
        return getEntryKey(entry) !== getEntryKey(primaryWeaponEntry);
      }) ??
      equippedShieldEntries[0] ??
      null;
  }

  const readyWeaponEntries: InventoryEntryLike[] = [];
  const seenWeaponEntryKeys = new Set<string>();
  const pushWeaponEntry = (entry: InventoryEntryLike | null) => {
    if (!entry || entry.type !== "weapon") return;
    const key = getEntryKey(entry);
    if (!key || seenWeaponEntryKeys.has(key)) return;
    seenWeaponEntryKeys.add(key);
    readyWeaponEntries.push(entry);
  };
  pushWeaponEntry(primaryWeaponEntry);
  pushWeaponEntry(secondaryEntry);
  equippedWeaponEntries.forEach(pushWeaponEntry);

  const mainReadyWeaponEntry = readyWeaponEntries[0] ?? null;
  const offhandReadyWeaponEntry = readyWeaponEntries[1] ?? null;
  const readyWeapons = readyWeaponEntries
    .map(entry => params.weaponById.get(String(entry.id ?? "")) ?? null)
    .filter((weapon): weapon is WeaponTypeDefinition => Boolean(weapon));
  const strictTwoHandedReady = readyWeapons.some(weapon => Boolean(weapon?.properties?.twoHanded));

  const readyShieldEntries: InventoryEntryLike[] = [];
  if (secondaryEntry?.type === "armor") {
    const def = params.armorById.get(String(secondaryEntry.id ?? ""));
    if (def?.armorCategory === "shield") {
      readyShieldEntries.push(secondaryEntry);
    }
  } else {
    readyShieldEntries.push(...equippedShieldEntries);
  }

  return {
    equippedEntries,
    primaryEntry: primaryWeaponEntry ?? (equippedEntries[0] ?? null),
    secondaryEntry,
    primaryWeaponEntry: mainReadyWeaponEntry,
    offhandWeaponEntry: offhandReadyWeaponEntry,
    readyWeaponEntries,
    readyShieldEntries,
    readyWeapons,
    strictTwoHandedReady
  };
}
