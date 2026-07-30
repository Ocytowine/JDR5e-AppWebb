import {
  type CharacterProgressionCatalogV1,
  type CharacterProgressionLevelEntryV1
} from "../../narration-module/src/application";
import type { ClassDefinition, SubclassDefinition } from "../game/classTypes";
import { loadActionTypesFromIndex } from "../game/actionCatalog";
import { spellCatalog } from "../game/spellCatalog";
import {
  loadClassTypesFromIndex,
  loadSubclassTypesFromIndex
} from "../PlayerCharacterCreator/catalogs/classCatalog";
import reactionsIndex from "../data/reactions/index.json";
import featuresIndex from "../data/characters/features/index.json";

function basenameIds(paths: unknown): Set<string> {
  if (!Array.isArray(paths)) return new Set();
  return new Set(paths
    .filter((value): value is string => typeof value === "string")
    .map(value => value.split("/").at(-1)?.replace(/\.json$/, "") ?? "")
    .filter(Boolean));
}

function progressionEntries(
  progression: ClassDefinition["progression"] | SubclassDefinition["progression"]
): Map<number, CharacterProgressionLevelEntryV1> {
  return new Map(Object.entries(progression ?? {}).flatMap(([level, entry]) => {
    const parsedLevel = Number(level);
    if (!Number.isInteger(parsedLevel) || parsedLevel < 1) return [];
    return [[parsedLevel, {
      grants: (entry.grants ?? []).map(grant => ({
        kind: grant.kind,
        ids: [...grant.ids]
      })),
      description: entry.description?.trim() || null
    }]];
  }));
}

export function currentCharacterProgressionCatalogV1(): CharacterProgressionCatalogV1 {
  const classes = loadClassTypesFromIndex();
  const subclasses = loadSubclassTypesFromIndex();
  return {
    classes: new Map(classes.map(entry => [entry.id, {
      id: entry.id,
      label: entry.label,
      hitDie: entry.hitDie ?? 0,
      subclassLevel: entry.subclassLevel ?? null,
      progression: progressionEntries(entry.progression)
    }])),
    subclasses: new Map(subclasses.map(entry => [entry.id, {
      id: entry.id,
      classId: entry.classId,
      label: entry.label,
      progression: progressionEntries(entry.progression)
    }])),
    actions: new Set(loadActionTypesFromIndex().map(entry => entry.id)),
    reactions: basenameIds((reactionsIndex as { reactions?: unknown }).reactions),
    spells: new Set(spellCatalog.list.map(entry => entry.id)),
    features: basenameIds((featuresIndex as { features?: unknown }).features)
  };
}
