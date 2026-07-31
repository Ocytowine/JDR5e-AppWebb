import type {
  CharacterImportCatalogV1,
  CharacterImportItemCatalogEntryV1
} from "../../../src/bootstrap/index";
import { loadRaceTypesFromIndex } from "../../../../src/PlayerCharacterCreator/catalogs/raceCatalog";
import { loadBackgroundTypesFromIndex } from "../../../../src/PlayerCharacterCreator/catalogs/backgroundCatalog";
import { loadClassTypesFromIndex, loadSubclassTypesFromIndex } from "../../../../src/PlayerCharacterCreator/catalogs/classCatalog";
import { loadLanguageTypesFromIndex } from "../../../../src/PlayerCharacterCreator/catalogs/languageCatalog";
import { loadWeaponTypesFromIndex } from "../../../../src/PlayerCharacterCreator/catalogs/weaponCatalog";
import { loadArmorItemsFromIndex } from "../../../../src/PlayerCharacterCreator/catalogs/armorCatalog";
import { loadObjectItemsFromIndex } from "../../../../src/PlayerCharacterCreator/catalogs/objectCatalog";
import { loadToolItemsFromIndex } from "../../../../src/PlayerCharacterCreator/catalogs/toolCatalog";
import { loadActionTypesFromIndex } from "../../../../src/game/actionCatalog";
import { spellCatalog } from "../../../../src/game/spellCatalog";
import reactionsIndex from "../../../../src/data/reactions/index.json";
import featuresIndex from "../../../../src/data/characters/features/index.json";

function basenameIds(paths: unknown): Set<string> {
  if (!Array.isArray(paths)) return new Set();
  return new Set(paths.filter(value => typeof value === "string").map(value => value.split("/").at(-1)?.replace(/\.json$/, "") ?? ""));
}

export function currentCharacterCatalog(): CharacterImportCatalogV1 {
  const items = new Map<string, CharacterImportItemCatalogEntryV1>();
  loadWeaponTypesFromIndex().forEach(value => items.set(value.id, {
    id: value.id, kind: "weapon", container: false, currencyDenomination: null,
    armorCategory: null, baseArmorClass: null, dexterityCap: null
  }));
  loadArmorItemsFromIndex().forEach(value => items.set(value.id, {
    id: value.id, kind: "armor", container: false, currencyDenomination: null,
    armorCategory: value.armorCategory ?? null,
    baseArmorClass: typeof value.baseAC === "number" ? value.baseAC : null,
    dexterityCap: typeof value.dexCap === "number" ? value.dexCap : null
  }));
  loadObjectItemsFromIndex().forEach(value => {
    const candidate = value as typeof value & { capacityWeight?: number; tags?: string[] };
    const denomination = value.id === "obj_piece_platine" ? "pp" : value.id === "obj_piece_or" ? "po" :
      value.id === "obj_piece_argent" ? "pa" : value.id === "obj_piece_cuivre" ? "pc" : null;
    items.set(value.id, {
      id: value.id, kind: "object",
      container: typeof candidate.capacityWeight === "number" || candidate.tags?.includes("sac") === true,
      currencyDenomination: denomination,
      armorCategory: null, baseArmorClass: null, dexterityCap: null
    });
  });
  loadToolItemsFromIndex().forEach(value => items.set(value.id, {
    id: value.id, kind: "tool", container: false, currencyDenomination: null,
    armorCategory: null, baseArmorClass: null, dexterityCap: null
  }));
  return {
    races: new Set(loadRaceTypesFromIndex().map(value => value.id)),
    backgrounds: new Set(loadBackgroundTypesFromIndex().map(value => value.id)),
    languages: new Set(loadLanguageTypesFromIndex().map(value => value.id)),
    classes: new Map(loadClassTypesFromIndex().map(value => [value.id, {
      id: value.id,
      hitDie: value.hitDie ?? 0,
      subclassLevel: value.subclassLevel ?? null,
      subclassIds: value.subclassIds ?? []
    }])),
    subclasses: new Map(loadSubclassTypesFromIndex().map(value => [value.id, value.classId])),
    items,
    actions: new Set(loadActionTypesFromIndex().map(value => value.id)),
    reactions: basenameIds((reactionsIndex as { reactions?: unknown }).reactions),
    spells: new Set(spellCatalog.list.map(value => value.id)),
    features: basenameIds((featuresIndex as { features?: unknown }).features)
  };
}
