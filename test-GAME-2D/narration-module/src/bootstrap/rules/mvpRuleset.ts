import type { JsonObject } from "../../core/contracts/types";
import { computeRuleDefinitionFingerprintV1, computeRulesetRootFingerprintV1 } from "./RuleRegistry";
import type { RuleDefinitionV1, RuleExecutorV1, RulesetManifestV1 } from "./types";

type DeterministicSpec = [ruleId: string, executorId: string, title: string, normativeText: string, scenarios?: string[]];

const deterministicSpecs: DeterministicSpec[] = [
  ["core.character.ability-modifier", "character.compute-ability-modifier", "Modificateur de caractéristique", "Valide un score de 1 à 30 puis applique floor((score - 10) / 2)."],
  ["core.character.global-level", "character.compute-global-level", "Niveau global", "Additionne les niveaux de classe validés et exige un total de 1 à 20."],
  ["core.character.proficiency-bonus", "character.compute-proficiency-bonus", "Bonus de maîtrise", "Retourne 2 aux niveaux 1 à 4, puis augmente de 1 par tranche de quatre niveaux jusqu'à 6."],
  ["core.character.maximum-hit-points", "character.compute-maximum-hit-points", "Points de vie maximum", "Calcule les PV depuis les dés de vie, les niveaux et le modificateur de Constitution."],
  ["core.character.armor-class", "character.compute-armor-class", "Classe d'armure", "Utilise la meilleure armure équipée, le plafond de Dextérité et les boucliers déclarés."],
  ["core.character.passive-perception", "character.compute-passive-perception", "Perception passive", "Calcule base 10 plus Sagesse et maîtrise ou expertise applicable."],
  ["core.character.capability-availability", "character.resolve-capability-availability", "Disponibilité d'une capacité", "Refuse une capacité absente, non préparée, sans ressource ou sans précondition.", ["NAR-ACC-008"]],
  ["core.check.difficulty-class", "check.resolve-difficulty-class", "Classe de difficulté d'un test", "Convertit une bande de difficulté explicitement arbitrée en DD: très facile 5, facile 10, moyenne 15, difficile 20, très difficile 25, presque impossible 30."],
  ["core.inventory.containment", "inventory.validate-containment", "Contenance d'inventaire", "Exige des instances uniques, des contenants existants et un graphe sans cycle."],
  ["core.inventory.equipment-slots", "inventory.validate-equipment-slots", "Emplacements d'équipement", "Exige des emplacements compatibles et exclusifs."],
  ["core.inventory.physical-currency", "inventory.resolve-physical-currency", "Monnaie physique", "Compte uniquement les pièces matérialisées et accessibles."],
  ["core.character.visible-appearance", "character.project-visible-appearance", "Apparence visible", "Projette uniquement le corps, l'état et les instances équipées réellement visibles.", ["NAR-ACC-009"]]
];

function baseDefinition(
  ruleId: string,
  title: string,
  normativeText: string,
  kind: RuleDefinitionV1["kind"],
  execution: RuleDefinitionV1["execution"],
  executorId: string | null,
  scenarios: string[] = []
): RuleDefinitionV1 {
  return {
    schemaVersion: 1,
    ruleId,
    ruleVersion: 1,
    title,
    normativeText,
    kind,
    ownerDomain: ruleId.startsWith("core.inventory") ? "inventory" : ruleId.startsWith("house") ? "narration" : "character",
    status: "ACTIVE",
    execution,
    executorId,
    parameters: {},
    scope: {},
    overrides: [],
    specializes: [],
    incompatibleWith: [],
    examples: [],
    acceptanceScenarioIds: scenarios
  };
}

export const MVP_RULE_DEFINITIONS_V1: RuleDefinitionV1[] = [
  ...deterministicSpecs.map(([ruleId, executorId, title, text, scenarios]) =>
    baseDefinition(ruleId, title, text, "GENERAL", "DETERMINISTIC", executorId, scenarios)),
  baseDefinition(
    "core.transaction.atomicity",
    "Atomicité transactionnelle",
    "Une résolution multidonnée réussit entièrement ou n'écrit rien.",
    "SYSTEM_INVARIANT",
    "DESCRIPTIVE",
    null
  ),
  baseDefinition(
    "house.social.observable-appearance",
    "Influence de l'apparence observable",
    "L'apparence observable est un facteur contextuel sans modifier les caractéristiques.",
    "HOUSE",
    "ADJUDICATION_REQUIRED",
    null,
    ["NAR-ACC-021"]
  ),
  baseDefinition(
    "house.action.impossible-before-roll",
    "Impossibilité avant jet",
    "Une impossibilité établie est refusée avant jet, coût ou commit.",
    "HOUSE",
    "DESCRIPTIVE",
    null,
    ["NAR-ACC-008"]
  ),
  baseDefinition(
    "house.rules.local-authority",
    "Autorité des règles locales",
    "Le ruleset épinglé prévaut sur toute connaissance générique du modèle.",
    "HOUSE",
    "DESCRIPTIVE",
    null,
    ["NAR-ACC-021"]
  )
];

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(entry => entry && typeof entry === "object") as Record<string, unknown>[] : [];
}

function numeric(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function executor(executorId: string, execute: RuleExecutorV1["execute"]): RuleExecutorV1 {
  return { executorId, contractVersion: 1, execute };
}

export const MVP_RULE_EXECUTORS_V1: RuleExecutorV1[] = [
  executor("character.compute-ability-modifier", input => {
    const score = numeric(input.score, "score");
    if (!Number.isInteger(score) || score < 1 || score > 30) throw new Error("score out of range");
    return { modifier: Math.floor((score - 10) / 2) };
  }),
  executor("character.compute-global-level", input => {
    const level = asArray(input.classes).reduce((sum, entry) => sum + numeric(entry.level, "class level"), 0);
    if (!Number.isInteger(level) || level < 1 || level > 20) throw new Error("global level out of range");
    return { level };
  }),
  executor("character.compute-proficiency-bonus", input => {
    const level = numeric(input.level, "level");
    if (!Number.isInteger(level) || level < 1 || level > 20) throw new Error("level out of range");
    return { proficiencyBonus: 2 + Math.floor((level - 1) / 4) };
  }),
  executor("character.compute-maximum-hit-points", input => {
    const con = numeric(input.constitutionModifier, "constitutionModifier");
    let maximumHitPoints = 0;
    let first = true;
    for (const entry of asArray(input.classes)) {
      const hitDie = numeric(entry.hitDie, "hitDie");
      const levels = numeric(entry.level, "level");
      if (!Number.isInteger(hitDie) || hitDie < 1 || !Number.isInteger(levels) || levels < 1) throw new Error("invalid class progression");
      for (let index = 0; index < levels; index += 1) {
        maximumHitPoints += (first ? hitDie : Math.floor(hitDie / 2) + 1) + con;
        first = false;
      }
    }
    return { maximumHitPoints: Math.max(1, maximumHitPoints) };
  }),
  executor("character.compute-armor-class", input => {
    const dexterity = numeric(input.dexterityModifier, "dexterityModifier");
    let body = 10 + dexterity;
    let shield = 0;
    for (const armor of asArray(input.armors)) {
      if (armor.equipped !== true) continue;
      const base = numeric(armor.baseArmorClass, "baseArmorClass");
      if (armor.category === "shield") shield += base;
      else {
        const cap = armor.dexterityCap === null || armor.dexterityCap === undefined
          ? dexterity
          : numeric(armor.dexterityCap, "dexterityCap");
        body = Math.max(body, base + Math.min(dexterity, cap));
      }
    }
    const bonuses = Array.isArray(input.bonuses) ? input.bonuses.reduce<number>((sum, value) => sum + numeric(value, "bonus"), 0) : 0;
    return { armorClass: body + shield + bonuses };
  }),
  executor("character.compute-passive-perception", input => {
    const base = input.base === undefined ? 10 : numeric(input.base, "base");
    const wisdom = numeric(input.wisdomModifier, "wisdomModifier");
    const bonus = numeric(input.proficiencyBonus, "proficiencyBonus");
    const rank = numeric(input.proficiencyRank, "proficiencyRank");
    if (![0, 1, 2].includes(rank)) throw new Error("invalid proficiency rank");
    return { passivePerception: base + wisdom + bonus * rank };
  }),
  executor("character.resolve-capability-availability", input => {
    const reasons: string[] = [];
    if (input.declared !== true) reasons.push("NOT_DECLARED");
    if (input.prepared === false) reasons.push("NOT_PREPARED");
    if (input.resourceAvailable === false) reasons.push("RESOURCE_UNAVAILABLE");
    if (input.prerequisitesMet === false) reasons.push("PREREQUISITE_MISSING");
    return { available: reasons.length === 0, reasons };
  }),
  executor("check.resolve-difficulty-class", input => {
    const values = {
      VERY_EASY: 5,
      EASY: 10,
      MEDIUM: 15,
      HARD: 20,
      VERY_HARD: 25,
      NEARLY_IMPOSSIBLE: 30
    } as const;
    const band = typeof input.band === "string" ? input.band : "";
    if (!(band in values)) throw new Error("unknown difficulty band");
    return { band, dc: values[band as keyof typeof values] };
  }),
  executor("inventory.validate-containment", input => {
    const items = asArray(input.items);
    const ids = new Set<string>();
    const byId = new Map<string, Record<string, unknown>>();
    const reasons: string[] = [];
    items.forEach(item => {
      const id = String(item.instanceId ?? "");
      if (!id || ids.has(id)) reasons.push("DUPLICATE_OR_MISSING_INSTANCE");
      ids.add(id); byId.set(id, item);
    });
    items.forEach(item => {
      const parent = typeof item.storedInInstanceId === "string" ? item.storedInInstanceId : null;
      if (parent && (byId.get(parent)?.container !== true || byId.get(parent)?.accessible === false)) reasons.push("CONTAINER_UNAVAILABLE");
      const seen = new Set<string>();
      let cursor = parent;
      while (cursor) {
        if (seen.has(cursor)) { reasons.push("CONTAINER_CYCLE"); break; }
        seen.add(cursor);
        const next = byId.get(cursor)?.storedInInstanceId;
        cursor = typeof next === "string" ? next : null;
      }
    });
    return { valid: reasons.length === 0, reasons: [...new Set(reasons)].sort() };
  }),
  executor("inventory.validate-equipment-slots", input => {
    const occupied = new Set<string>();
    const reasons: string[] = [];
    asArray(input.items).forEach(item => {
      const slot = typeof item.equippedSlot === "string" ? item.equippedSlot : null;
      if (!slot) return;
      const allowed = Array.isArray(item.allowedSlots) ? item.allowedSlots : [];
      if (!allowed.includes(slot)) reasons.push("SLOT_INCOMPATIBLE");
      if (occupied.has(slot)) reasons.push("SLOT_NOT_EXCLUSIVE");
      occupied.add(slot);
    });
    return { valid: reasons.length === 0, reasons: [...new Set(reasons)].sort() };
  }),
  executor("inventory.resolve-physical-currency", input => {
    const totals = { pp: 0, po: 0, pa: 0, pc: 0 };
    asArray(input.items).forEach(item => {
      const denomination = item.denomination;
      if (item.accessible !== true || !["pp", "po", "pa", "pc"].includes(String(denomination))) return;
      totals[denomination as keyof typeof totals] += numeric(item.quantity, "quantity");
    });
    return totals;
  }),
  executor("character.project-visible-appearance", input => ({
    physicalDescription: typeof input.physicalDescription === "string" ? input.physicalDescription : "",
    clothingState: typeof input.clothingState === "string" ? input.clothingState : "UNKNOWN",
    visibleEquipment: asArray(input.items)
      .filter(item => item.equipped === true && item.visible !== false)
      .map(item => ({ instanceId: String(item.instanceId ?? ""), itemId: String(item.itemId ?? "") }))
  }))
];

export async function createMvpRulesetManifestV1(
  contentPackageId = "content.jdr5e",
  minimumVersion = 1,
  maximumVersion = 1,
  rulesetVersion = 2
): Promise<RulesetManifestV1> {
  const rules = await Promise.all(MVP_RULE_DEFINITIONS_V1.map(async definition => ({
    ruleId: definition.ruleId,
    ruleVersion: definition.ruleVersion,
    fingerprint: await computeRuleDefinitionFingerprintV1(definition)
  })));
  const base: Omit<RulesetManifestV1, "rootFingerprint"> = {
    schemaVersion: 1,
    rulesetId: "rules.jdr5e",
    rulesetVersion,
    compatibleContentPackages: [{ packageId: contentPackageId, minimumVersion, maximumVersion }],
    rules
  };
  return { ...base, rootFingerprint: await computeRulesetRootFingerprintV1(base) };
}
