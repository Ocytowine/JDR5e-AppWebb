import type {
  InterpreterCharacterReferenceCatalogEntryV1,
  InterpreterCharacterReferenceCatalogV1
} from "../../narration-module/src/application";
import { loadLanguageTypesFromIndex } from
  "../PlayerCharacterCreator/catalogs/languageCatalog";
import { loadWeaponTypesFromIndex } from
  "../PlayerCharacterCreator/catalogs/weaponCatalog";
import { loadArmorItemsFromIndex } from
  "../PlayerCharacterCreator/catalogs/armorCatalog";
import { loadObjectItemsFromIndex } from
  "../PlayerCharacterCreator/catalogs/objectCatalog";
import { loadToolItemsFromIndex } from
  "../PlayerCharacterCreator/catalogs/toolCatalog";
import { loadActionTypesFromIndex } from "../game/actionCatalog";
import { spellCatalog } from "../game/spellCatalog";
import featuresIndex from "../data/characters/features/index.json";

export function buildInstalledInterpreterCharacterReferenceCatalogV1():
InterpreterCharacterReferenceCatalogV1 {
  const spells =
    spellCatalog.list.map(entry => reference(entry.id, entry.name));
  const spellIds = new Set(spells.map(entry => entry.id));
  return {
    languages: loadLanguageTypesFromIndex()
      .map(entry => reference(entry.id, entry.label)),
    actions: loadActionTypesFromIndex()
      .filter(entry => !spellIds.has(entry.id))
      .map(entry => reference(entry.id, entry.name)),
    spells,
    features: featureReferencesFromIndex(),
    items: [
      ...loadWeaponTypesFromIndex()
        .map(entry => reference(entry.id, entry.label ?? entry.name)),
      ...loadArmorItemsFromIndex()
        .map(entry => reference(entry.id, entry.label)),
      ...loadObjectItemsFromIndex()
        .map(entry => reference(entry.id, entry.label)),
      ...loadToolItemsFromIndex()
        .map(entry => reference(entry.id, entry.label))
    ]
  };
}

function featureReferencesFromIndex(): InterpreterCharacterReferenceCatalogEntryV1[] {
  const paths = Array.isArray((featuresIndex as { features?: unknown }).features)
    ? (featuresIndex as { features: unknown[] }).features
    : [];
  return paths
    .filter((entry): entry is string => typeof entry === "string")
    .map(path => path.split("/").at(-1)?.replace(/\.json$/u, "") ?? "")
    .filter(Boolean)
    .map(id => reference(id, id.replaceAll(/[-_]+/gu, " ")));
}

function reference(
  id: string,
  label: string
): InterpreterCharacterReferenceCatalogEntryV1 {
  return {
    id,
    label,
    aliases: [id.replaceAll(/[-_]+/gu, " ")]
  };
}
