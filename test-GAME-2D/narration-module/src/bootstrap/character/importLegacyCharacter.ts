import { canonicalizeJson, cloneJson, computeJsonFingerprint } from "../../core/canonical-json/canonicalJson";
import type { JsonObject } from "../../core/contracts/types";
import type {
  AbilityIdV1,
  CharacterAggregatePayloadV1,
  CharacterClassV1,
  CharacterImportDiagnosticV1,
  CharacterImportEnvelopeV1,
  CharacterImportOptionsV1,
  CharacterImportOutcomeV1,
  CharacterInventoryInstanceV1,
  CharacterItemKindV1,
  NarrativeCharacterProjectionV1,
  TacticalCharacterProjectionV1
} from "./types";

const ABILITIES: AbilityIdV1[] = ["FOR", "DEX", "CON", "INT", "SAG", "CHA"];
const ABILITY_PATHS: Record<AbilityIdV1, [string, string]> = {
  FOR: ["force", "FOR"], DEX: ["dexterite", "DEX"], CON: ["constitution", "CON"],
  INT: ["intelligence", "INT"], SAG: ["sagesse", "SAG"], CHA: ["charisme", "CHA"]
};
const LEGACY_KEYS = new Set([
  "id", "nom", "age", "sexe", "taille", "poids", "langues", "alignement", "raceId",
  "backgroundId", "classe", "niveauGlobal", "xp", "dv", "maitriseBonus", "pvActuels", "pvTmp",
  "nivFatigueActuel", "nivFatigueMax", "actionIds", "reactionIds", "combatStats", "caracs",
  "movementModes", "visionProfile", "appearance", "competences", "expertises", "initiative", "besoin",
  "percPassive", "proficiencies", "weaponMasteries", "savingThrows", "inspiration", "notes", "argent",
  "materielSlots", "armesDefaut", "inventoryItems", "descriptionPersonnage", "profileDetails",
  "choiceSelections", "creationLocks", "classLocks", "progressionHistory", "spellcastingState", "derived"
]);
const CURRENCY_IDS: Record<string, "pp" | "po" | "pa" | "pc"> = {
  obj_piece_platine: "pp", obj_piece_or: "po", obj_piece_argent: "pa", obj_piece_cuivre: "pc"
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function jsonRecord(value: unknown): JsonObject {
  const candidate = record(value);
  return candidate ? cloneJson(candidate as JsonObject) : {};
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(entry => typeof entry === "string").map(entry => entry.trim()).filter(Boolean))];
}

function number(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function diagnostic(
  diagnostics: CharacterImportDiagnosticV1[],
  code: string,
  severity: "WARNING" | "ERROR",
  path: string,
  details: JsonObject = {}
): void {
  diagnostics.push({ code, severity, path, details });
}

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function proficiencyBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

function collectSpellIds(character: Record<string, unknown>): string[] {
  const ids = new Set(strings(record(record(character.derived)?.grants)?.spells));
  const spellcasting = record(character.spellcastingState);
  const sources = record(spellcasting?.sources);
  Object.values(sources ?? {}).forEach(value => {
    const source = record(value);
    strings(source?.preparedSpellIds).forEach(id => ids.add(id));
    strings(source?.knownSpellIds).forEach(id => ids.add(id));
    strings(source?.grantedSpellIds).forEach(id => ids.add(id));
  });
  const grants = record(spellcasting?.spellGrants);
  Object.values(grants ?? {}).forEach(value => {
    if (!Array.isArray(value)) return;
    value.forEach(entry => {
      const id = record(entry)?.spellId;
      if (typeof id === "string" && id.trim()) ids.add(id.trim());
    });
  });
  return [...ids].sort();
}

function validateCatalogIds(
  values: readonly string[],
  catalog: ReadonlySet<string>,
  code: string,
  path: string,
  diagnostics: CharacterImportDiagnosticV1[]
): void {
  values.forEach((id, index) => {
    if (!catalog.has(id)) diagnostic(diagnostics, code, "ERROR", `${path}/${index}`, { id });
  });
}

export async function importLegacyCharacterV1(
  envelope: CharacterImportEnvelopeV1,
  options: CharacterImportOptionsV1
): Promise<CharacterImportOutcomeV1> {
  const diagnostics: CharacterImportDiagnosticV1[] = [];
  if (!record(envelope) || envelope.schemaVersion !== 1) {
    diagnostic(diagnostics, "CHARACTER_ENVELOPE_INVALID", "ERROR", "/", {});
    return { ok: false, diagnostics };
  }
  if (envelope.sourceKind !== "CHARACTER_CREATOR_LEGACY" || envelope.sourceSchemaVersion !== 1) {
    diagnostic(diagnostics, "CHARACTER_VERSION_UNSUPPORTED", "ERROR", "/sourceSchemaVersion", {
      sourceKind: envelope.sourceKind,
      sourceSchemaVersion: envelope.sourceSchemaVersion
    });
    return { ok: false, diagnostics };
  }
  let fingerprint: string;
  try {
    canonicalizeJson(envelope.character);
    fingerprint = await computeJsonFingerprint(envelope.character);
  } catch (error) {
    diagnostic(diagnostics, "CHARACTER_JSON_INVALID", "ERROR", "/character", {
      message: error instanceof Error ? error.message : "invalid JSON"
    });
    return { ok: false, diagnostics };
  }
  if (fingerprint !== envelope.sourceFingerprint) {
    diagnostic(diagnostics, "CHARACTER_FINGERPRINT_MISMATCH", "ERROR", "/sourceFingerprint", {
      expected: fingerprint,
      received: envelope.sourceFingerprint
    });
  }
  const source = record(envelope.character);
  if (!source) {
    diagnostic(diagnostics, "CHARACTER_JSON_NOT_OBJECT", "ERROR", "/character", {});
    return { ok: false, diagnostics };
  }
  Object.keys(source).filter(key => !LEGACY_KEYS.has(key)).sort().forEach(key =>
    diagnostic(diagnostics, "CHARACTER_UNKNOWN_PROPERTY", "WARNING", `/character/${key}`, { key }));

  const characterId = typeof source.id === "string" ? source.id.trim() : "";
  if (!characterId) diagnostic(diagnostics, "CHARACTER_ID_MISSING", "ERROR", "/character/id", {});
  const nameRecord = record(source.nom);
  const name = typeof nameRecord?.nomcomplet === "string" ? nameRecord.nomcomplet.trim() : "";
  if (!name) diagnostic(diagnostics, "CHARACTER_NAME_MISSING", "ERROR", "/character/nom/nomcomplet", {});

  const raceId = typeof source.raceId === "string" ? source.raceId : "";
  const backgroundId = typeof source.backgroundId === "string" ? source.backgroundId : "";
  if (!options.catalog.races.has(raceId)) diagnostic(diagnostics, "CHARACTER_RACE_UNKNOWN", "ERROR", "/character/raceId", { id: raceId });
  if (!options.catalog.backgrounds.has(backgroundId)) diagnostic(diagnostics, "CHARACTER_BACKGROUND_UNKNOWN", "ERROR", "/character/backgroundId", { id: backgroundId });

  const caracs = record(source.caracs);
  const abilityScores = {} as Record<AbilityIdV1, number>;
  for (const ability of ABILITIES) {
    const [group, key] = ABILITY_PATHS[ability];
    const score = number(record(caracs?.[group])?.[key], Number.NaN);
    abilityScores[ability] = score;
    if (!Number.isInteger(score) || score < 1 || score > 30) {
      diagnostic(diagnostics, "CHARACTER_ABILITY_OUT_OF_RANGE", "ERROR", `/character/caracs/${group}/${key}`, { ability, score });
    }
  }

  const classes: CharacterClassV1[] = [];
  const classSource = record(source.classe);
  Object.keys(classSource ?? {}).sort((a, b) => Number(a) - Number(b)).forEach(key => {
    const entry = record(classSource?.[key]);
    const classId = typeof entry?.classeId === "string" ? entry.classeId : "";
    const subclassId = typeof entry?.subclasseId === "string" && entry.subclasseId ? entry.subclasseId : null;
    const level = number(entry?.niveau, Number.NaN);
    const classDefinition = options.catalog.classes.get(classId);
    if (!classDefinition) diagnostic(diagnostics, "CHARACTER_CLASS_UNKNOWN", "ERROR", `/character/classe/${key}/classeId`, { id: classId });
    if (!Number.isInteger(level) || level < 1 || level > 20) {
      diagnostic(diagnostics, "CHARACTER_CLASS_LEVEL_INVALID", "ERROR", `/character/classe/${key}/niveau`, { level });
    }
    if (subclassId && options.catalog.subclasses.get(subclassId) !== classId) {
      diagnostic(diagnostics, "CHARACTER_SUBCLASS_UNKNOWN", "ERROR", `/character/classe/${key}/subclasseId`, { id: subclassId, classId });
    }
    classes.push({ classId, subclassId, level });
  });
  const globalLevel = classes.reduce((sum, entry) => sum + (Number.isInteger(entry.level) ? entry.level : 0), 0);
  if (globalLevel < 1 || globalLevel > 20) diagnostic(diagnostics, "CHARACTER_GLOBAL_LEVEL_INVALID", "ERROR", "/character/classe", { globalLevel });
  if (source.niveauGlobal !== undefined && number(source.niveauGlobal, Number.NaN) !== globalLevel) {
    diagnostic(diagnostics, "CHARACTER_GLOBAL_LEVEL_MISMATCH", "ERROR", "/character/niveauGlobal", {
      field: "niveauGlobal", source: number(source.niveauGlobal), computed: globalLevel
    });
  }

  const modifiers = Object.fromEntries(ABILITIES.map(id => [id, abilityModifier(abilityScores[id])])) as Record<AbilityIdV1, number>;
  const mastery = proficiencyBonus(Math.max(1, globalLevel));
  let maximumHitPoints = 0;
  let firstLevel = true;
  classes.forEach(entry => {
    const hitDie = options.catalog.classes.get(entry.classId)?.hitDie ?? 0;
    for (let level = 0; level < entry.level; level += 1) {
      maximumHitPoints += (firstLevel ? hitDie : Math.floor(hitDie / 2) + 1) + modifiers.CON;
      firstLevel = false;
    }
  });
  maximumHitPoints = Math.max(1, maximumHitPoints);

  const slots = record(source.materielSlots) ?? {};
  const inventorySource = Array.isArray(source.inventoryItems) ? source.inventoryItems : [];
  const inventory: CharacterInventoryInstanceV1[] = [];
  const sourceByInstance = new Map<string, Record<string, unknown>>();
  inventorySource.forEach((raw, index) => {
    const item = record(raw);
    if (!item) {
      diagnostic(diagnostics, "CHARACTER_ITEM_INVALID", "ERROR", `/character/inventoryItems/${index}`, {});
      return;
    }
    const instanceId = typeof item.instanceId === "string" ? item.instanceId.trim() : "";
    const itemId = typeof item.id === "string" ? item.id.trim() : "";
    const itemKind = typeof item.type === "string" ? item.type as CharacterItemKindV1 : "object";
    const definition = options.catalog.items.get(itemId);
    if (!instanceId) diagnostic(diagnostics, "CHARACTER_ITEM_INSTANCE_ID_MISSING", "ERROR", `/character/inventoryItems/${index}/instanceId`, {});
    else if (sourceByInstance.has(instanceId)) diagnostic(diagnostics, "CHARACTER_ITEM_INSTANCE_ID_DUPLICATE", "ERROR", `/character/inventoryItems/${index}/instanceId`, { instanceId });
    else sourceByInstance.set(instanceId, item);
    if (!definition || definition.kind !== itemKind) diagnostic(diagnostics, "CHARACTER_ITEM_UNKNOWN", "ERROR", `/character/inventoryItems/${index}/id`, { itemId, itemKind });
    const quantity = number(item.qty, 1);
    if (!Number.isInteger(quantity) || quantity <= 0) diagnostic(diagnostics, "CHARACTER_ITEM_QUANTITY_INVALID", "ERROR", `/character/inventoryItems/${index}/qty`, { quantity });
    inventory.push({
      instanceId,
      itemId,
      itemKind,
      quantity,
      equippedSlot: typeof item.equippedSlot === "string" && item.equippedSlot ? item.equippedSlot : null,
      storedInInstanceId: typeof item.storedIn === "string" && item.storedIn ? item.storedIn : null,
      primaryWeapon: item.isPrimaryWeapon === true
    });
  });
  const instances = new Map(inventory.map(item => [item.instanceId, item]));
  inventory.forEach((item, index) => {
    if (item.storedInInstanceId && !instances.has(item.storedInInstanceId)) {
      const slotted = slots[item.storedInInstanceId];
      if (typeof slotted === "string" && instances.has(slotted)) item.storedInInstanceId = slotted;
    }
    if (item.storedInInstanceId) {
      const container = instances.get(item.storedInInstanceId);
      if (!container || !options.catalog.items.get(container.itemId)?.container) {
        diagnostic(diagnostics, "CHARACTER_CONTAINER_MISSING", "ERROR", `/character/inventoryItems/${index}/storedIn`, { storedIn: item.storedInInstanceId });
      }
    }
    if (item.equippedSlot && Object.prototype.hasOwnProperty.call(slots, item.equippedSlot) && slots[item.equippedSlot] !== item.instanceId) {
      diagnostic(diagnostics, "CHARACTER_EQUIPMENT_SLOT_MISMATCH", "ERROR", `/character/inventoryItems/${index}/equippedSlot`, {
        slot: item.equippedSlot, expectedInstanceId: slots[item.equippedSlot] as string
      });
    }
  });
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const parent = instances.get(id)?.storedInInstanceId;
    const cyclic = parent ? visit(parent) : false;
    visiting.delete(id);
    visited.add(id);
    return cyclic;
  };
  inventory.forEach((item, index) => {
    if (visit(item.instanceId)) diagnostic(diagnostics, "CHARACTER_CONTAINER_CYCLE", "ERROR", `/character/inventoryItems/${index}/storedIn`, { instanceId: item.instanceId });
  });

  const money = record(source.argent) ?? {};
  const expectedMoney = {
    pp: number(money.platine ?? money.pp), po: number(money.or ?? money.po),
    pa: number(money.argent ?? money.pa), pc: number(money.cuivre ?? money.pc)
  };
  const physicalMoney = { pp: 0, po: 0, pa: 0, pc: 0 };
  inventory.forEach(item => {
    const denomination = options.catalog.items.get(item.itemId)?.currencyDenomination ?? CURRENCY_IDS[item.itemId];
    if (denomination) physicalMoney[denomination] += item.quantity;
  });
  if (canonicalizeJson(expectedMoney) !== canonicalizeJson(physicalMoney)) {
    diagnostic(diagnostics, "CHARACTER_CURRENCY_MISMATCH", "ERROR", "/character/argent", { expectedMoney, physicalMoney });
  }

  let armorClass = 10 + modifiers.DEX;
  let bodyArmor = 0;
  let shieldBonus = 0;
  inventory.filter(item => item.equippedSlot !== null).forEach(item => {
    const definition = options.catalog.items.get(item.itemId);
    if (definition?.kind !== "armor" || definition.baseArmorClass === null) return;
    if (definition.armorCategory === "shield") shieldBonus += definition.baseArmorClass;
    else bodyArmor = Math.max(bodyArmor, definition.baseArmorClass + Math.min(modifiers.DEX, definition.dexterityCap ?? modifiers.DEX));
  });
  if (bodyArmor > 0) armorClass = bodyArmor;
  armorClass += shieldBonus;

  const skills = strings(source.competences);
  const expertise = strings(source.expertises);
  const passivePerception = 10 + modifiers.SAG + (skills.includes("perception") ? mastery : 0) + (expertise.includes("perception") ? mastery : 0);
  const combatStats = record(source.combatStats) ?? {};
  const sourceModifiers = record(combatStats.mods) ?? {};
  const sourceDerived: Array<[string, unknown, number]> = [
    ["maitriseBonus", source.maitriseBonus, mastery], ["percPassive", source.percPassive, passivePerception],
    ["combatStats.level", combatStats.level, globalLevel],
    ["combatStats.maxHp", combatStats.maxHp, maximumHitPoints],
    ["combatStats.armorClass", combatStats.armorClass, armorClass],
    ["combatStats.attackBonus", combatStats.attackBonus, modifiers.FOR + mastery],
    ["combatStats.mods.modFOR", sourceModifiers.modFOR, modifiers.FOR],
    ["combatStats.mods.modDEX", sourceModifiers.modDEX, modifiers.DEX],
    ["combatStats.mods.modCON", sourceModifiers.modCON, modifiers.CON],
    ["combatStats.mods.modINT", sourceModifiers.modINT, modifiers.INT],
    ["combatStats.mods.modSAG", sourceModifiers.modSAG, modifiers.SAG],
    ["combatStats.mods.modCHA", sourceModifiers.modCHA, modifiers.CHA]
  ];
  sourceDerived.forEach(([field, value, computed]) => {
    if (value !== undefined && number(value, Number.NaN) !== computed) diagnostic(diagnostics, "CHARACTER_DERIVED_MISMATCH", "WARNING", `/character/${field.replaceAll(".", "/")}`, { field, source: number(value), computed });
  });
  const currentHitPoints = number(source.pvActuels, Number.NaN);
  if (!Number.isFinite(currentHitPoints) || currentHitPoints < 0 || currentHitPoints > maximumHitPoints) {
    diagnostic(diagnostics, "CHARACTER_CURRENT_HP_INVALID", "ERROR", "/character/pvActuels", { currentHitPoints, maximumHitPoints });
  }
  const resources = jsonRecord(combatStats.resources);
  Object.entries(resources).forEach(([key, value]) => {
    const state = record(value);
    if (state && number(state.current) > number(state.max, Number.POSITIVE_INFINITY)) {
      diagnostic(diagnostics, "CHARACTER_RESOURCE_EXCEEDS_MAXIMUM", "ERROR", `/character/combatStats/resources/${key}`, {
        current: number(state.current), max: number(state.max)
      });
    }
  });

  const actionIds = strings(source.actionIds).sort();
  const reactionIds = strings(source.reactionIds).sort();
  const spellIds = collectSpellIds(source);
  const featureIds = strings(record(record(source.derived)?.grants)?.features).sort();
  const languages = strings(source.langues).sort();
  validateCatalogIds(actionIds, options.catalog.actions, "CHARACTER_ACTION_UNKNOWN", "/character/actionIds", diagnostics);
  validateCatalogIds(reactionIds, options.catalog.reactions, "CHARACTER_REACTION_UNKNOWN", "/character/reactionIds", diagnostics);
  validateCatalogIds(spellIds, options.catalog.spells, "CHARACTER_SPELL_UNKNOWN", "/character/spellcastingState", diagnostics);
  validateCatalogIds(featureIds, options.catalog.features, "CHARACTER_FEATURE_UNKNOWN", "/character/derived/grants/features", diagnostics);
  validateCatalogIds(languages, options.catalog.languages, "CHARACTER_LANGUAGE_UNKNOWN", "/character/langues", diagnostics);

  if (diagnostics.some(value => value.severity === "ERROR")) return { ok: false, diagnostics };

  const progressionHistory = Array.isArray(source.progressionHistory)
    ? source.progressionHistory.map(jsonRecord)
    : [];
  const aggregate: CharacterAggregatePayloadV1 = {
    schemaVersion: 1, characterId, sourceFingerprint: envelope.sourceFingerprint,
    rulesetId: options.rulesetId, rulesetVersion: options.rulesetVersion, name, raceId, backgroundId,
    classes, globalLevel, abilityScores, currentHitPoints, temporaryHitPoints: number(source.pvTmp),
    exhaustion: number(source.nivFatigueActuel), languages, skills, expertise,
    proficiencies: jsonRecord(source.proficiencies), inventory, equipmentSlots: jsonRecord(source.materielSlots),
    actionIds, reactionIds, spellIds, featureIds, choices: jsonRecord(source.choiceSelections), progressionHistory,
    description: jsonRecord(source.descriptionPersonnage), profile: jsonRecord(source.profileDetails),
    appearance: jsonRecord(source.appearance), movementModes: jsonRecord(source.movementModes),
    vision: jsonRecord(source.visionProfile), resources
  };
  const equipped = inventory.filter(item => item.equippedSlot !== null);
  const tacticalProjection: TacticalCharacterProjectionV1 = {
    schemaVersion: 1, characterId, level: globalLevel, abilityModifiers: modifiers, proficiencyBonus: mastery,
    currentHitPoints, maximumHitPoints, temporaryHitPoints: number(source.pvTmp), armorClass, passivePerception,
    movementModes: aggregate.movementModes, vision: aggregate.vision, actionIds, reactionIds, spellIds, resources,
    equippedItemInstanceIds: equipped.map(item => item.instanceId).sort(), appearance: aggregate.appearance
  };
  const narrativeProjection: NarrativeCharacterProjectionV1 = {
    schemaVersion: 1, characterId, name, raceId, backgroundId, languages,
    observable: {
      physicalDescription: typeof aggregate.description.physique === "string" ? aggregate.description.physique : "",
      profile: aggregate.profile,
      visibleEquipment: equipped.map(item => ({ instanceId: item.instanceId, itemId: item.itemId })),
      appearance: aggregate.appearance,
      clothingState: "UNKNOWN"
    },
    knownToPlayer: {
      biography: typeof aggregate.description.bio === "string" ? aggregate.description.bio : "",
      personality: typeof aggregate.description.personnalite === "string" ? aggregate.description.personnalite : "",
      objectives: typeof aggregate.description.objectifs === "string" ? aggregate.description.objectifs : "",
      flaws: typeof aggregate.description.defauts === "string" ? aggregate.description.defauts : ""
    },
    privateMechanical: { abilityScores, skills, expertise, featureIds }
  };
  return { ok: true, value: { character: aggregate, tacticalProjection, narrativeProjection, diagnostics } };
}
