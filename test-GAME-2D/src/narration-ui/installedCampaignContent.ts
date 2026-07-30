import type {
  CharacterImportCatalogV1,
  CharacterImportItemCatalogEntryV1,
  ContentPackageResolverV1,
  ResolvedContentPackageV1,
  ResolvedRulesetV1,
  RulesetResolverV1
} from "../../narration-module/src/bootstrap";
import {
  createMvpRulesetManifestV1,
  MVP_RULE_DEFINITIONS_V1,
  MVP_RULE_EXECUTORS_V1
} from "../../narration-module/src/bootstrap";
import { loadRaceTypesFromIndex } from "../PlayerCharacterCreator/catalogs/raceCatalog";
import { loadBackgroundTypesFromIndex } from "../PlayerCharacterCreator/catalogs/backgroundCatalog";
import {
  loadClassTypesFromIndex,
  loadSubclassTypesFromIndex
} from "../PlayerCharacterCreator/catalogs/classCatalog";
import { loadLanguageTypesFromIndex } from "../PlayerCharacterCreator/catalogs/languageCatalog";
import { loadWeaponTypesFromIndex } from "../PlayerCharacterCreator/catalogs/weaponCatalog";
import { loadArmorItemsFromIndex } from "../PlayerCharacterCreator/catalogs/armorCatalog";
import { loadObjectItemsFromIndex } from "../PlayerCharacterCreator/catalogs/objectCatalog";
import { loadToolItemsFromIndex } from "../PlayerCharacterCreator/catalogs/toolCatalog";
import { loadActionTypesFromIndex } from "../game/actionCatalog";
import { spellCatalog } from "../game/spellCatalog";
import reactionsIndex from "../data/reactions/index.json";
import featuresIndex from "../data/characters/features/index.json";
import installedPackageJson from "./generated/campaignBootstrapPackage.generated.json";

export const INSTALLED_CONTENT_PACKAGE_ID_V1 = "jdr5e.production-lore";
export const INSTALLED_CONTENT_PACKAGE_VERSION_V1 = 1;
export const INSTALLED_RULESET_ID_V1 = "rules.jdr5e";
export const INSTALLED_RULESET_VERSION_V1 = 2;

function basenameIds(paths: unknown): Set<string> {
  if (!Array.isArray(paths)) return new Set();
  return new Set(paths
    .filter(value => typeof value === "string")
    .map(value => value.split("/").at(-1)?.replace(/\.json$/, "") ?? "")
    .filter(Boolean));
}

export function buildInstalledCharacterCatalogV1(): CharacterImportCatalogV1 {
  const items = new Map<string, CharacterImportItemCatalogEntryV1>();
  loadWeaponTypesFromIndex().forEach(value => items.set(value.id, {
    id: value.id,
    kind: "weapon",
    container: false,
    currencyDenomination: null,
    armorCategory: null,
    baseArmorClass: null,
    dexterityCap: null
  }));
  loadArmorItemsFromIndex().forEach(value => items.set(value.id, {
    id: value.id,
    kind: "armor",
    container: false,
    currencyDenomination: null,
    armorCategory: value.armorCategory ?? null,
    baseArmorClass:
      typeof value.baseAC === "number" ? value.baseAC : null,
    dexterityCap: typeof value.dexCap === "number" ? value.dexCap : null
  }));
  loadObjectItemsFromIndex().forEach(value => {
    const candidate =
      value as typeof value & { capacityWeight?: number; tags?: string[] };
    const currencyDenomination =
      value.id === "obj_piece_platine" ? "pp"
        : value.id === "obj_piece_or" ? "po"
          : value.id === "obj_piece_argent" ? "pa"
            : value.id === "obj_piece_cuivre" ? "pc"
              : null;
    items.set(value.id, {
      id: value.id,
      kind: "object",
      container:
        typeof candidate.capacityWeight === "number"
        || candidate.tags?.includes("sac") === true,
      currencyDenomination,
      armorCategory: null,
      baseArmorClass: null,
      dexterityCap: null
    });
  });
  loadToolItemsFromIndex().forEach(value => items.set(value.id, {
    id: value.id,
    kind: "tool",
    container: false,
    currencyDenomination: null,
    armorCategory: null,
    baseArmorClass: null,
    dexterityCap: null
  }));
  return {
    races: new Set(loadRaceTypesFromIndex().map(value => value.id)),
    backgrounds: new Set(loadBackgroundTypesFromIndex().map(value => value.id)),
    languages: new Set(loadLanguageTypesFromIndex().map(value => value.id)),
    classes: new Map(loadClassTypesFromIndex().map(value => [value.id, {
      id: value.id,
      hitDie: value.hitDie ?? 0,
      subclassIds: value.subclassIds ?? []
    }])),
    subclasses: new Map(loadSubclassTypesFromIndex()
      .map(value => [value.id, value.classId])),
    items,
    actions: new Set(loadActionTypesFromIndex().map(value => value.id)),
    reactions: basenameIds(
      (reactionsIndex as { reactions?: unknown }).reactions
    ),
    spells: new Set(spellCatalog.list.map(value => value.id)),
    features: basenameIds((featuresIndex as { features?: unknown }).features)
  };
}

export function createInstalledContentPackageResolverV1():
ContentPackageResolverV1 {
  const installedPackage = {
    ...installedPackageJson,
    characterCatalog: buildInstalledCharacterCatalogV1()
  } as unknown as ResolvedContentPackageV1;
  return {
    async resolve(packageId, packageVersion) {
      return packageId === installedPackage.manifest.packageId
        && packageVersion === installedPackage.manifest.packageVersion
        ? installedPackage
        : null;
    }
  };
}

export function createInstalledRulesetResolverV1(): RulesetResolverV1 {
  let installedRuleset: Promise<ResolvedRulesetV1> | null = null;
  return {
    async resolve(rulesetId, rulesetVersion) {
      if (
        rulesetId !== INSTALLED_RULESET_ID_V1
        || rulesetVersion !== INSTALLED_RULESET_VERSION_V1
      ) return null;
      installedRuleset ??= createMvpRulesetManifestV1(
        INSTALLED_CONTENT_PACKAGE_ID_V1,
        INSTALLED_CONTENT_PACKAGE_VERSION_V1,
        INSTALLED_CONTENT_PACKAGE_VERSION_V1,
        INSTALLED_RULESET_VERSION_V1
      ).then(manifest => ({
        manifest,
        definitions: MVP_RULE_DEFINITIONS_V1,
        executors: MVP_RULE_EXECUTORS_V1
      }));
      return installedRuleset;
    }
  };
}
