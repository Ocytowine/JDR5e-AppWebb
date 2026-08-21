import {
  createCatalogInventoryTransactionRuntimeV1,
  type InventoryTransactionCatalogEntryV1
} from "../../narration-module/src/application";
import { loadWeaponTypesFromIndex } from "../PlayerCharacterCreator/catalogs/weaponCatalog";
import { loadArmorItemsFromIndex } from "../PlayerCharacterCreator/catalogs/armorCatalog";
import { loadObjectItemsFromIndex } from "../PlayerCharacterCreator/catalogs/objectCatalog";
import { loadToolItemsFromIndex } from "../PlayerCharacterCreator/catalogs/toolCatalog";
import { loadAmmoTypesFromIndex } from "../game/ammoCatalog";

export function createInstalledInventoryTransactionRuntimeV1() {
  return createCatalogInventoryTransactionRuntimeV1({
    catalog: buildInstalledInventoryTransactionCatalogV1()
  });
}

export function buildInstalledInventoryTransactionCatalogV1(): InventoryTransactionCatalogEntryV1[] {
  return [
    ...loadWeaponTypesFromIndex().map(entry => item({
      raw: entry,
      id: entry.id,
      label: entry.label ?? entry.name,
      slots: ["main_droite", "main_gauche"]
    })),
    ...loadArmorItemsFromIndex().map(entry => item({
      raw: entry,
      id: entry.id,
      label: entry.label,
      slots: ["corps"]
    })),
    ...loadObjectItemsFromIndex().map(entry => item({
      raw: entry,
      id: entry.id,
      label: entry.label,
      slots: entry.id === "obj_bourse"
        ? ["ceinture_bourse_1", "ceinture_bourse_2"]
        : []
    })),
    ...loadToolItemsFromIndex().map(entry => item({
      raw: entry,
      id: entry.id,
      label: entry.label,
      slots: []
    })),
    ...loadAmmoTypesFromIndex().map(entry => item({
      raw: entry,
      id: entry.id,
      label: entry.label ?? entry.name ?? entry.id,
      slots: []
    }))
  ];
}

function item(input: {
  raw: unknown;
  id: string;
  label: string;
  slots: string[];
}): InventoryTransactionCatalogEntryV1 {
  const raw = input.raw as {
    weight?: number;
    capacityWeight?: number;
    tags?: string[];
    value?: { platinum?: number; gold?: number; silver?: number; copper?: number; pp?: number; po?: number; pa?: number; pc?: number };
  };
  return {
    schemaVersion: 1,
    itemId: input.id,
    label: input.label,
    aliases: [
      input.id.replaceAll(/[-_]+/gu, " "),
      ...(raw.tags ?? []),
      ...currencyAliases(input.id)
    ],
    weight: typeof raw.weight === "number" && raw.weight >= 0 ? raw.weight : 0,
    containerCapacityWeight:
      typeof raw.capacityWeight === "number" && raw.capacityWeight >= 0
        ? raw.capacityWeight
        : null,
    allowedEquipmentSlots: [...input.slots],
    valueInCopper: moneyInCopper(raw.value),
    sourceRefs: [`src/data/items:${input.id}`]
  };
}

function moneyInCopper(value: { platinum?: number; gold?: number; silver?: number; copper?: number; pp?: number; po?: number; pa?: number; pc?: number } | undefined): number {
  if (value === undefined) return 0;
  return (value.platinum ?? value.pp ?? 0) * 1000
    + (value.gold ?? value.po ?? 0) * 100
    + (value.silver ?? value.pa ?? 0) * 10
    + (value.copper ?? value.pc ?? 0);
}

function currencyAliases(itemId: string): string[] {
  if (itemId === "obj_piece_or") return ["piece d'or", "pieces d'or", "or"];
  if (itemId === "obj_piece_argent") return ["piece d'argent", "pieces d'argent"];
  if (itemId === "obj_piece_cuivre") return ["piece de cuivre", "pieces de cuivre"];
  if (itemId === "obj_piece_platine") return ["piece de platine", "pieces de platine"];
  return [];
}
