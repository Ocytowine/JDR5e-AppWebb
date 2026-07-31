import type { JsonObject } from "../../core/contracts/types";

export type AbilityIdV1 = "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA";

export interface CharacterImportEnvelopeV1 {
  schemaVersion: 1;
  sourceKind: "CHARACTER_CREATOR_LEGACY" | "CHARACTER_CREATOR_V1";
  sourceSchemaVersion: number;
  sourceFingerprint: `sha256:${string}`;
  character: unknown;
}

export type CharacterImportDiagnosticSeverityV1 = "WARNING" | "ERROR";

export interface CharacterImportDiagnosticV1 {
  code: string;
  severity: CharacterImportDiagnosticSeverityV1;
  path: string;
  details: JsonObject;
}

export interface CharacterClassV1 {
  classId: string;
  subclassId: string | null;
  level: number;
}

export interface CharacterInventoryInstanceV1 {
  instanceId: string;
  itemId: string;
  itemKind: CharacterItemKindV1;
  quantity: number;
  equippedSlot: string | null;
  storedInInstanceId: string | null;
  primaryWeapon: boolean;
}

export interface CharacterAggregatePayloadV1 {
  schemaVersion: 1;
  characterId: string;
  sourceFingerprint: string;
  rulesetId: string;
  rulesetVersion: number;
  name: string;
  raceId: string;
  backgroundId: string;
  classes: CharacterClassV1[];
  globalLevel: number;
  abilityScores: Record<AbilityIdV1, number>;
  currentHitPoints: number;
  temporaryHitPoints: number;
  exhaustion: number;
  languages: string[];
  skills: string[];
  expertise: string[];
  proficiencies: JsonObject;
  inventory: CharacterInventoryInstanceV1[];
  equipmentSlots: JsonObject;
  actionIds: string[];
  reactionIds: string[];
  spellIds: string[];
  featureIds: string[];
  choices: JsonObject;
  progressionHistory: JsonObject[];
  description: JsonObject;
  profile: JsonObject;
  appearance: JsonObject;
  movementModes: JsonObject;
  vision: JsonObject;
  resources: JsonObject;
}

export interface TacticalCharacterProjectionV1 {
  schemaVersion: 1;
  characterId: string;
  level: number;
  abilityModifiers: Record<AbilityIdV1, number>;
  proficiencyBonus: number;
  currentHitPoints: number;
  maximumHitPoints: number;
  temporaryHitPoints: number;
  armorClass: number;
  passivePerception: number;
  movementModes: JsonObject;
  vision: JsonObject;
  actionIds: string[];
  reactionIds: string[];
  spellIds: string[];
  resources: JsonObject;
  equippedItemInstanceIds: string[];
  appearance: JsonObject;
}

export interface NarrativeCharacterProjectionV1 {
  schemaVersion: 1;
  characterId: string;
  name: string;
  raceId: string;
  backgroundId: string;
  languages: string[];
  observable: JsonObject;
  knownToPlayer: JsonObject;
  privateMechanical: JsonObject;
}

export interface CharacterImportResultV1 {
  character: CharacterAggregatePayloadV1;
  tacticalProjection: TacticalCharacterProjectionV1;
  narrativeProjection: NarrativeCharacterProjectionV1;
  diagnostics: CharacterImportDiagnosticV1[];
}

export type CharacterImportOutcomeV1 =
  | { ok: true; value: CharacterImportResultV1 }
  | { ok: false; diagnostics: CharacterImportDiagnosticV1[] };

export type CharacterItemKindV1 = "weapon" | "armor" | "tool" | "object";

export interface CharacterImportItemCatalogEntryV1 {
  id: string;
  kind: CharacterItemKindV1;
  container: boolean;
  currencyDenomination: "pp" | "po" | "pa" | "pc" | null;
  armorCategory: string | null;
  baseArmorClass: number | null;
  dexterityCap: number | null;
}

export interface CharacterImportClassCatalogEntryV1 {
  id: string;
  hitDie: number;
  subclassLevel: number | null;
  subclassIds: string[];
}

export interface CharacterImportCatalogV1 {
  races: ReadonlySet<string>;
  backgrounds: ReadonlySet<string>;
  languages: ReadonlySet<string>;
  classes: ReadonlyMap<string, CharacterImportClassCatalogEntryV1>;
  subclasses: ReadonlyMap<string, string>;
  items: ReadonlyMap<string, CharacterImportItemCatalogEntryV1>;
  actions: ReadonlySet<string>;
  reactions: ReadonlySet<string>;
  spells: ReadonlySet<string>;
  features: ReadonlySet<string>;
}

export interface CharacterImportOptionsV1 {
  rulesetId: string;
  rulesetVersion: number;
  catalog: CharacterImportCatalogV1;
}
