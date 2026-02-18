/* Validate content JSON against strict taxonomy enums. */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "src", "data");
const TAXONOMY_PATH = path.join(DATA_DIR, "models", "taxonomy.json");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function listJsonFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "models") continue;
      files.push(...listJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(full);
    }
  }
  return files;
}

function getAllValuesByKey(obj, key) {
  const values = [];
  if (Array.isArray(obj)) {
    for (const item of obj) values.push(...getAllValuesByKey(item, key));
    return values;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (k === key) values.push(v);
      values.push(...getAllValuesByKey(v, key));
    }
  }
  return values;
}

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getNestedValue(obj, pathParts) {
  let cur = obj;
  for (const part of pathParts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

const taxonomy = readJson(TAXONOMY_PATH);

const damageTypeAliases = Object.fromEntries(
  Object.entries(taxonomy.damageTypeAliases ?? {}).map(([k, v]) => [normalizeKey(k), String(v)])
);
const canonicalDamageTypes = new Set((taxonomy.damageTypes ?? []).map(v => String(v)));
for (const value of canonicalDamageTypes) {
  damageTypeAliases[normalizeKey(value)] = value;
}
const tagPattern = (() => {
  const raw = taxonomy.tags?.allowPattern;
  if (!raw || typeof raw !== "string") return null;
  try {
    return new RegExp(raw);
  } catch (_err) {
    return null;
  }
})();

const enums = {
  damageTypes: canonicalDamageTypes,
  tags: new Set(taxonomy.tags?.allowed ?? []),
  actionCategory: new Set(taxonomy.action?.category ?? []),
  actionCostType: new Set(taxonomy.action?.actionCost?.actionType ?? []),
  targetingTarget: new Set(taxonomy.action?.targeting?.target ?? []),
  targetingShape: new Set(taxonomy.action?.targeting?.["range.shape"] ?? []),
  reactionEvent: new Set(taxonomy.reaction?.trigger?.event ?? []),
  reactionSource: new Set(taxonomy.reaction?.trigger?.source ?? []),
  actionConditions: new Set(taxonomy.action?.conditions?.types ?? []),
  reactionConditions: new Set(taxonomy.reaction?.conditions?.types ?? []),
  actionOps: new Set(taxonomy.action?.ops ?? []),
  weaponType: new Set(taxonomy.weapon?.type ?? []),
  weaponSubtype: new Set(taxonomy.weapon?.subtype ?? []),
  weaponCategory: new Set(taxonomy.weapon?.category ?? []),
  weaponRarity: new Set(taxonomy.weapon?.rarity ?? []),
  armorType: new Set(taxonomy.armor?.type ?? []),
  armorCategory: new Set(taxonomy.armor?.armorCategory ?? []),
  objectType: new Set(taxonomy.object?.type ?? []),
  ammoType: new Set(taxonomy.ammo?.type ?? []),
  ammoSubtype: new Set(taxonomy.ammo?.subtype ?? []),
  ammoCategory: new Set(taxonomy.ammo?.category ?? []),
  ammoRarity: new Set(taxonomy.ammo?.rarity ?? []),
  abilitiesFR: new Set(taxonomy.abilities ?? []),
  restTypes: new Set(taxonomy.restTypes ?? [])
};

const errors = [];

function assertEnum(file, field, value, set) {
  if (value === null || value === undefined) return;
  if (typeof value !== "string") return;
  if (!set.has(value)) {
    errors.push(`${file}: ${field} -> "${value}" not in enum`);
  }
}

function assertEnumArray(file, field, values, set) {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    if (typeof value !== "string") continue;
    if (!set.has(value)) {
      errors.push(`${file}: ${field}[] -> "${value}" not in enum`);
    }
  }
}

function normalizeDamageTypeValue(value) {
  if (value === null || value === undefined) return null;
  const key = normalizeKey(String(value));
  return damageTypeAliases[key] ?? null;
}

function isTagAllowed(tag) {
  if (typeof tag !== "string") return true;
  if (enums.tags.has(tag)) return true;
  const prefixes = Array.isArray(taxonomy.tags?.allowedPrefixes) ? taxonomy.tags.allowedPrefixes : [];
  if (prefixes.some(prefix => tag.startsWith(String(prefix)))) return true;
  if (tagPattern && tagPattern.test(tag)) return true;
  return false;
}

function assertTagArray(file, field, values) {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    if (!isTagAllowed(value)) {
      errors.push(`${file}: ${field}[] -> "${value}" not allowed by taxonomy tag policy`);
    }
  }
}

function isActionLike(json) {
  return (
    json &&
    typeof json === "object" &&
    json.actionCost &&
    json.targeting &&
    typeof json.category === "string"
  );
}

function isReaction(json) {
  return json && typeof json === "object" && json.trigger && json.action;
}

function isWeapon(json) {
  return (
    json &&
    typeof json === "object" &&
    String(json.type ?? "").toLowerCase() === "arme" &&
    json.properties &&
    (json.damage || json.effectOnHit)
  );
}

function isArmor(json) {
  return json && typeof json === "object" && String(json.type ?? "").toLowerCase() === "armor";
}

function isObjectItem(json) {
  return json && typeof json === "object" && String(json.type ?? "").toLowerCase() === "object";
}

function isAmmo(json) {
  return json && typeof json === "object" && String(json.type ?? "").toLowerCase() === "munition";
}

function normalizeRelPath(relPath) {
  return String(relPath).replace(/\\/g, "/");
}

function isIndexFile(relPath) {
  return normalizeRelPath(relPath).endsWith("/index.json");
}

function validateActionObject(json, rel, prefix) {
  const p = prefix ? `${prefix}.` : "";
  assertEnum(rel, `${p}category`, json.category, enums.actionCategory);
  assertEnum(rel, `${p}actionCost.actionType`, getNestedValue(json, ["actionCost", "actionType"]), enums.actionCostType);
  assertEnum(rel, `${p}targeting.target`, getNestedValue(json, ["targeting", "target"]), enums.targetingTarget);
  assertEnum(rel, `${p}targeting.range.shape`, getNestedValue(json, ["targeting", "range", "shape"]), enums.targetingShape);
  if (Array.isArray(json.conditions)) {
    for (const cond of json.conditions) {
      assertEnum(rel, `${p}conditions.type`, cond?.type, enums.actionConditions);
    }
  }
  if (Array.isArray(json.effects)) {
    // legacy effects are tolerated but not validated against V2 ops
  }
}

function assertValueObject(file, valueObj) {
  if (!valueObj || typeof valueObj !== "object") return;
  const keys = ["platinum", "gold", "silver", "copper"];
  for (const k of keys) {
    if (valueObj[k] === undefined) {
      errors.push(`${file}: value.${k} missing`);
    } else if (typeof valueObj[k] !== "number") {
      errors.push(`${file}: value.${k} must be number`);
    }
  }
}

function assertBooleanIfPresent(file, field, value) {
  if (value === undefined) return;
  if (typeof value !== "boolean") {
    errors.push(`${file}: ${field} must be boolean`);
  }
}

function isMultipleOfHalf(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return false;
  const doubled = value * 2;
  return Math.abs(doubled - Math.round(doubled)) <= 1e-6;
}

function assertMultipleOfHalf(file, field, value) {
  if (value === undefined || value === null) return;
  if (typeof value !== "number") return;
  if (!isMultipleOfHalf(value)) {
    errors.push(`${file}: ${field} -> ${value} not multiple of 0.5m`);
  }
}

function assertNumberArrayMultipleOfHalf(file, field, values) {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    if (typeof value !== "number") continue;
    if (!isMultipleOfHalf(value)) {
      errors.push(`${file}: ${field}[] -> ${value} not multiple of 0.5m`);
    }
  }
}

function assertNonEmptyString(file, field, value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${file}: ${field} must be a non-empty string.`);
  }
}

function assertArrayOfNonEmptyStrings(file, field, value) {
  if (!Array.isArray(value)) {
    errors.push(`${file}: ${field} must be an array.`);
    return;
  }
  value.forEach((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      errors.push(`${file}: ${field}[${index}] must be a non-empty string.`);
    }
  });
}

function assertGrantListShape(file, field, grants, options) {
  if (!Array.isArray(grants)) {
    errors.push(`${file}: ${field} must be an array.`);
    return;
  }
  const allowedKinds = new Set(options?.allowedKinds ?? []);
  const allowEmptyIdsForKinds = new Set(options?.allowEmptyIdsForKinds ?? []);
  grants.forEach((grant, index) => {
    if (!grant || typeof grant !== "object") {
      errors.push(`${file}: ${field}[${index}] must be an object.`);
      return;
    }
    const kind = String(grant.kind ?? "");
    if (!kind) {
      errors.push(`${file}: ${field}[${index}].kind is required.`);
    } else if (allowedKinds.size > 0 && !allowedKinds.has(kind)) {
      errors.push(`${file}: ${field}[${index}].kind -> "${kind}" not allowed.`);
    }
    if (!Array.isArray(grant.ids)) {
      errors.push(`${file}: ${field}[${index}].ids must be an array.`);
    } else if (!allowEmptyIdsForKinds.has(kind) && grant.ids.length === 0) {
      errors.push(`${file}: ${field}[${index}].ids must not be empty for kind "${kind}".`);
    } else {
      grant.ids.forEach((id, idIndex) => {
        if (typeof id !== "string" || id.trim().length === 0) {
          errors.push(`${file}: ${field}[${index}].ids[${idIndex}] must be a non-empty string.`);
        }
      });
    }
  });
}

function assertProgressionShape(file, field, progression, options) {
  if (!progression || typeof progression !== "object" || Array.isArray(progression)) {
    errors.push(`${file}: ${field} must be an object keyed by level.`);
    return;
  }
  Object.entries(progression).forEach(([levelKey, entry]) => {
    if (!/^\d+$/.test(levelKey)) {
      errors.push(`${file}: ${field}.${levelKey} invalid level key (expected numeric string).`);
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${file}: ${field}.${levelKey} must be an object.`);
      return;
    }
    if (entry.grants !== undefined) {
      assertGrantListShape(file, `${field}.${levelKey}.grants`, entry.grants, options);
    }
  });
}

function assertNoUnexpectedObjectKeys(file, field, obj, allowedKeys) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
  const allowed = new Set(Array.isArray(allowedKeys) ? allowedKeys : []);
  Object.keys(obj).forEach(key => {
    if (!allowed.has(key)) {
      errors.push(`${file}: ${field}.${key} unexpected key`);
    }
  });
}

function assertWeaponModSpec(file, field, value) {
  if (value === undefined || value === null) return;
  if (typeof value !== "string") {
    errors.push(`${file}: ${field} must be string.`);
    return;
  }
  const ok = /^mod\.(FOR|DEX|CON|INT|SAG|CHA)$/.test(value.trim());
  if (!ok) {
    errors.push(
      `${file}: ${field} -> "${value}" invalid (expected mod.FOR|mod.DEX|mod.CON|mod.INT|mod.SAG|mod.CHA).`
    );
  }
}

function assertWeaponBonusSpec(file, field, value) {
  if (value === undefined || value === null) return;
  if (typeof value === "number") return;
  if (typeof value === "string" && value.trim() === "bonus_maitrise") return;
  errors.push(`${file}: ${field} -> "${value}" invalid (expected number or "bonus_maitrise").`);
}

function isInlineBonusId(value) {
  const id = String(value ?? "").trim();
  if (!id) return false;
  if (id === "asi-or-feat") return true;
  return /^(?:stat|carac)[:.](FOR|DEX|CON|INT|SAG|CHA)[:.]([+-]?\d+)$/i.test(id);
}

const files = listJsonFiles(DATA_DIR);
const parsedEntries = [];
for (const filePath of files) {
  let json;
  try {
    json = readJson(filePath);
  } catch (err) {
    errors.push(`${filePath}: invalid JSON`);
    continue;
  }
  const rel = path.relative(ROOT, filePath);
  const relNorm = normalizeRelPath(rel);
  parsedEntries.push({ filePath, rel, relNorm, json });
}

const allJsonRelPaths = new Set(parsedEntries.map(entry => entry.relNorm));
const actionIds = new Set(
  parsedEntries
    .filter(entry => isActionLike(entry.json) && !isReaction(entry.json))
    .map(entry => String(entry.json.id ?? ""))
    .filter(Boolean)
);
const reactionIds = new Set(
  parsedEntries
    .filter(entry => isReaction(entry.json))
    .map(entry => String(entry.json.id ?? ""))
    .filter(Boolean)
);
for (const entry of parsedEntries) {
  if (isIndexFile(entry.relNorm)) continue;
  if (!entry.relNorm.startsWith("src/data/characters/features/")) continue;
  if (entry.json?.kind === "action" && typeof entry.json?.id === "string" && entry.json.id.trim()) {
    actionIds.add(entry.json.id.trim());
  }
  if (entry.json?.kind === "reaction" && typeof entry.json?.id === "string" && entry.json.id.trim()) {
    reactionIds.add(entry.json.id.trim());
  }
}
const spellIds = new Set(
  parsedEntries
    .filter(entry => entry.relNorm.startsWith("src/data/spells/") && !isIndexFile(entry.relNorm))
    .map(entry => String(entry.json.id ?? ""))
    .filter(Boolean)
);
const featureIds = new Set(
  parsedEntries
    .filter(entry => entry.relNorm.startsWith("src/data/characters/features/") && !isIndexFile(entry.relNorm))
    .map(entry => String(entry.json.id ?? ""))
    .filter(Boolean)
);
const bonusIds = new Set(
  parsedEntries
    .filter(entry => entry.relNorm.startsWith("src/data/bonuses/") && !isIndexFile(entry.relNorm))
    .map(entry => String(entry.json.id ?? ""))
    .filter(Boolean)
);
const classDefs = parsedEntries.filter(
  entry =>
    entry.relNorm.startsWith("src/data/characters/classes/") &&
    !isIndexFile(entry.relNorm) &&
    !entry.relNorm.includes("/class.json") &&
    typeof entry.json?.classId === "string"
);
const baseClassDefs = parsedEntries.filter(
  entry =>
    entry.relNorm.startsWith("src/data/characters/classes/") &&
    !isIndexFile(entry.relNorm) &&
    entry.relNorm.includes("/class.json")
);
const classIds = new Set(baseClassDefs.map(entry => String(entry.json.id ?? "")).filter(Boolean));
const subclassIds = new Set(classDefs.map(entry => String(entry.json.id ?? "")).filter(Boolean));

for (const { rel, relNorm, json } of parsedEntries) {

  // Tags
  assertTagArray(rel, "tags", json.tags);

  // priceGp deprecated
  if (json.priceGp !== undefined) {
    errors.push(`${rel}: priceGp is deprecated, use value{platinum,gold,silver,copper}`);
  }
  if (json.value) {
    assertValueObject(rel, json.value);
  }
  assertBooleanIfPresent(rel, "harmonisable", json.harmonisable);

  // damageType validation on gameplay-relevant fields only
  const assertDamageType = (field, value) => {
    if (value === null || value === undefined) return;
    const normalized = normalizeDamageTypeValue(value);
    if (!normalized || !enums.damageTypes.has(normalized)) {
      errors.push(`${rel}: ${field} -> "${value}" invalid damageType`);
    }
  };
  assertDamageType("damage.damageType", getNestedValue(json, ["damage", "damageType"]));
  assertDamageType("effectOnHit.damageType", getNestedValue(json, ["effectOnHit", "damageType"]));

  // Actions
  if (isActionLike(json) && !isReaction(json)) {
    if (json.effects !== undefined) {
      errors.push(`${rel}: effects is deprecated, use ops`);
    }
    if (json.effectsV2 !== undefined) {
      errors.push(`${rel}: effectsV2 is deprecated, use ops`);
    }
    validateActionObject(json, rel, "");
    assertMultipleOfHalf(rel, "targeting.range.min", getNestedValue(json, ["targeting", "range", "min"]));
    assertMultipleOfHalf(rel, "targeting.range.max", getNestedValue(json, ["targeting", "range", "max"]));
    if (Array.isArray(json.conditions)) {
      for (const cond of json.conditions) {
        if (cond?.type === "distance_max") {
          assertMultipleOfHalf(rel, "conditions.distance_max.max", cond?.max);
        }
        if (cond?.type === "distance_between") {
          assertMultipleOfHalf(rel, "conditions.distance_between.min", cond?.min);
          assertMultipleOfHalf(rel, "conditions.distance_between.max", cond?.max);
        }
      }
    }
    if (Array.isArray(json.effects)) {
      for (const eff of json.effects) {
        if (eff?.type === "move" || eff?.type === "move_to") {
          assertMultipleOfHalf(rel, `effects.${eff.type}.maxSteps`, eff?.maxSteps);
        }
      }
    }
  }

  if (
    !isIndexFile(relNorm) &&
    (relNorm.startsWith("src/data/attacks/") ||
      relNorm.startsWith("src/data/moves/") ||
      relNorm.startsWith("src/data/supports/") ||
      relNorm.startsWith("src/data/spells/")) &&
    !isActionLike(json)
  ) {
    errors.push(`${rel}: expected action structure (actionCost + targeting + category).`);
  }

  if (
    !isIndexFile(relNorm) &&
    relNorm.startsWith("src/data/actions/weapon-mastery/")
  ) {
    if (!(typeof json?.id === "string" && json.id.startsWith("wm-"))) {
      errors.push(`${rel}: weapon mastery action id must start with "wm-".`);
    }
    if (!Array.isArray(json?.tags) || !json.tags.includes("weaponMastery")) {
      errors.push(`${rel}: weapon mastery action must include tag "weaponMastery".`);
    }
  }

  // Reactions (top-level + embedded action)
  if (isReaction(json)) {
    assertEnum(rel, "trigger.event", getNestedValue(json, ["trigger", "event"]), enums.reactionEvent);
    assertEnum(rel, "trigger.source", getNestedValue(json, ["trigger", "source"]), enums.reactionSource);
    if (Array.isArray(json.conditions)) {
      for (const cond of json.conditions) {
        assertEnum(rel, "conditions.type", cond?.type, enums.reactionConditions);
      }
    }
    // Rest recharge fields inside grants meta
    if (Array.isArray(json.grants)) {
      for (const grant of json.grants) {
        const recharge = grant?.meta?.recharge;
        if (recharge && recharge !== "none") {
          assertEnum(rel, "grants.meta.recharge", recharge, enums.restTypes);
        }
      }
    }
    if (json.action?.effects !== undefined) {
      errors.push(`${rel}: action.effects is deprecated, use action.ops`);
    }
    if (json.action?.effectsV2 !== undefined) {
      errors.push(`${rel}: action.effectsV2 is deprecated, use action.ops`);
    }
    if (json.action && isActionLike(json.action)) {
      validateActionObject(json.action, rel, "action");
    }
  }
  if (!isIndexFile(relNorm) && relNorm.startsWith("src/data/reactions/") && !isReaction(json)) {
    errors.push(`${rel}: expected reaction structure (trigger + action).`);
  }

  // Features: recharge in grants meta
  if (Array.isArray(json.grants)) {
    for (const grant of json.grants) {
      const recharge = grant?.meta?.recharge;
      if (recharge && recharge !== "none") {
        assertEnum(rel, "grants.meta.recharge", recharge, enums.restTypes);
      }
    }
  }

  // Feature usage per rest (if present)
  const perRestType = getNestedValue(json, ["usage", "perRest", "type"]);
  if (perRestType) {
    assertEnum(rel, "usage.perRest.type", perRestType, enums.restTypes);
  }

  // Characters taxonomy checks
  const characterGrantKinds = new Set([
    "action",
    "bonus",
    "feature",
    "language-choice",
    "reaction",
    "resource",
    "skill",
    "spell",
    "tool",
    "tool-choice",
    "trait",
    "weaponMastery"
  ]);
  const allowEmptyIdsKinds = ["language-choice", "tool-choice"];
  const verifyGrantReferences = (field, grants) => {
    if (!Array.isArray(grants)) return;
    grants.forEach((grant, index) => {
      const kind = String(grant?.kind ?? "");
      const ids = Array.isArray(grant?.ids) ? grant.ids.map(id => String(id)) : [];
      ids.forEach(id => {
        if (kind === "action" && !actionIds.has(id)) {
          errors.push(`${rel}: ${field}[${index}] action id "${id}" not found.`);
        }
        if (kind === "reaction" && !reactionIds.has(id)) {
          errors.push(`${rel}: ${field}[${index}] reaction id "${id}" not found.`);
        }
        if (kind === "feature" && !featureIds.has(id)) {
          errors.push(`${rel}: ${field}[${index}] feature id "${id}" not found.`);
        }
        if (kind === "spell" && !spellIds.has(id)) {
          errors.push(`${rel}: ${field}[${index}] spell id "${id}" not found.`);
        }
        if (kind === "bonus" && !bonusIds.has(id) && !isInlineBonusId(id)) {
          errors.push(`${rel}: ${field}[${index}] bonus id "${id}" not found.`);
        }
      });
    });
  };

  if (!isIndexFile(relNorm) && relNorm.startsWith("src/data/characters/languages/")) {
    assertNonEmptyString(rel, "id", json.id);
    assertNonEmptyString(rel, "label", json.label);
  }

  if (!isIndexFile(relNorm) && relNorm.startsWith("src/data/characters/backgrounds/")) {
    assertNonEmptyString(rel, "id", json.id);
    assertNonEmptyString(rel, "label", json.label);
    assertNonEmptyString(rel, "description", json.description);
    if (json.grants !== undefined) {
      assertGrantListShape(rel, "grants", json.grants, {
        allowedKinds: characterGrantKinds,
        allowEmptyIdsForKinds: allowEmptyIdsKinds
      });
      verifyGrantReferences("grants", json.grants);
    }
    if (json.progression !== undefined) {
      assertProgressionShape(rel, "progression", json.progression, {
        allowedKinds: characterGrantKinds,
        allowEmptyIdsForKinds: allowEmptyIdsKinds
      });
      Object.entries(json.progression ?? {}).forEach(([level, entry]) =>
        verifyGrantReferences(`progression.${level}.grants`, entry?.grants)
      );
    }
  }

  if (!isIndexFile(relNorm) && relNorm.startsWith("src/data/characters/races/")) {
    assertNonEmptyString(rel, "id", json.id);
    assertNonEmptyString(rel, "label", json.label);
    assertNonEmptyString(rel, "description", json.description);
    if (json.size !== undefined) {
      const allowedSize = new Set(["small", "medium", "large"]);
      if (!allowedSize.has(String(json.size))) {
        errors.push(`${rel}: size -> "${json.size}" invalid (small|medium|large).`);
      }
    }
    if (json.actionIds !== undefined) {
      assertArrayOfNonEmptyStrings(rel, "actionIds", json.actionIds);
      json.actionIds.forEach(id => {
        if (!actionIds.has(String(id))) errors.push(`${rel}: actionIds -> "${id}" not found.`);
      });
    }
    if (json.reactionIds !== undefined) {
      assertArrayOfNonEmptyStrings(rel, "reactionIds", json.reactionIds);
      json.reactionIds.forEach(id => {
        if (!reactionIds.has(String(id))) errors.push(`${rel}: reactionIds -> "${id}" not found.`);
      });
    }
    if (json.grants !== undefined) {
      assertGrantListShape(rel, "grants", json.grants, {
        allowedKinds: characterGrantKinds,
        allowEmptyIdsForKinds: allowEmptyIdsKinds
      });
      verifyGrantReferences("grants", json.grants);
    }
  }

  if (!isIndexFile(relNorm) && relNorm.startsWith("src/data/characters/classes/")) {
    const isSubclass = typeof json.classId === "string" && !relNorm.endsWith("/class.json");
    assertNonEmptyString(rel, "id", json.id);
    assertNonEmptyString(rel, "label", json.label);
    assertNonEmptyString(rel, "description", json.description);
    if (isSubclass) {
      assertNonEmptyString(rel, "classId", json.classId);
      if (!classIds.has(String(json.classId))) {
        errors.push(`${rel}: classId -> "${json.classId}" not found among class ids.`);
      }
    } else {
      if (json.hitDie !== undefined) {
        const allowedHitDie = new Set([4, 6, 8, 10, 12, 20]);
        if (!allowedHitDie.has(Number(json.hitDie))) {
          errors.push(`${rel}: hitDie -> "${json.hitDie}" invalid.`);
        }
      }
      if (Array.isArray(json.subclassIds)) {
        json.subclassIds.forEach(id => {
          if (!subclassIds.has(String(id))) {
            errors.push(`${rel}: subclassIds -> "${id}" not found.`);
          }
        });
      }
    }
    if (json.spellcasting && typeof json.spellcasting === "object") {
      const sc = json.spellcasting;
      const allowedAbility = new Set(["SAG", "INT", "CHA"]);
      const allowedPreparation = new Set(["prepared", "known"]);
      const allowedStorage = new Set(["memory", "innate", "grimoire"]);
      const allowedProgression = new Set(["full", "half", "third", "none"]);
      if (sc.ability !== undefined && !allowedAbility.has(String(sc.ability))) {
        errors.push(`${rel}: spellcasting.ability -> "${sc.ability}" invalid.`);
      }
      if (sc.preparation !== undefined && !allowedPreparation.has(String(sc.preparation))) {
        errors.push(`${rel}: spellcasting.preparation -> "${sc.preparation}" invalid.`);
      }
      if (sc.storage !== undefined && !allowedStorage.has(String(sc.storage))) {
        errors.push(`${rel}: spellcasting.storage -> "${sc.storage}" invalid.`);
      }
      if (sc.casterProgression !== undefined && !allowedProgression.has(String(sc.casterProgression))) {
        errors.push(`${rel}: spellcasting.casterProgression -> "${sc.casterProgression}" invalid.`);
      }
      if (sc.slotsByLevel !== undefined && (typeof sc.slotsByLevel !== "object" || Array.isArray(sc.slotsByLevel))) {
        errors.push(`${rel}: spellcasting.slotsByLevel must be an object.`);
      }
    }
    if (json.progression !== undefined) {
      assertProgressionShape(rel, "progression", json.progression, {
        allowedKinds: characterGrantKinds,
        allowEmptyIdsForKinds: allowEmptyIdsKinds
      });
      Object.entries(json.progression ?? {}).forEach(([level, entry]) =>
        verifyGrantReferences(`progression.${level}.grants`, entry?.grants)
      );
    }
  }

  if (!isIndexFile(relNorm) && relNorm.startsWith("src/data/characters/features/")) {
    assertNonEmptyString(rel, "id", json.id);
    assertNonEmptyString(rel, "label", json.label);
    if (json.kind !== undefined) {
      const allowedFeatureKinds = new Set(["passive", "action", "reaction", "resource", "feature"]);
      if (!allowedFeatureKinds.has(String(json.kind))) {
        errors.push(`${rel}: kind -> "${json.kind}" invalid.`);
      }
    }
    if (json.grants !== undefined) {
      assertGrantListShape(rel, "grants", json.grants, {
        allowedKinds: characterGrantKinds,
        allowEmptyIdsForKinds: allowEmptyIdsKinds
      });
      verifyGrantReferences("grants", json.grants);
    }
  }

  // Weapon fields
  if (isWeapon(json)) {
    const allowedWeaponPropKeys = Object.keys(
      getNestedValue(taxonomy, ["weapon", "fields", "properties"]) ?? {}
    );
    const allowedWeaponAttackKeys = Object.keys(
      getNestedValue(taxonomy, ["weapon", "fields", "attack"]) ?? {}
    );
    const allowedWeaponDamageKeys = Object.keys(
      getNestedValue(taxonomy, ["weapon", "fields", "damage"]) ?? {}
    );
    const allowedWeaponOnHitKeys = Object.keys(
      getNestedValue(taxonomy, ["weapon", "fields", "effectOnHit"]) ?? {}
    );
    assertNoUnexpectedObjectKeys(rel, "properties", json.properties, allowedWeaponPropKeys);
    assertNoUnexpectedObjectKeys(rel, "attack", json.attack, allowedWeaponAttackKeys);
    assertNoUnexpectedObjectKeys(rel, "damage", json.damage, allowedWeaponDamageKeys);
    assertNoUnexpectedObjectKeys(rel, "effectOnHit", json.effectOnHit, allowedWeaponOnHitKeys);
    assertEnum(rel, "type", json.type, enums.weaponType);
    assertEnum(rel, "subtype", json.subtype, enums.weaponSubtype);
    assertEnum(rel, "category", json.category, enums.weaponCategory);
    assertEnum(rel, "rarity", json.rarity, enums.weaponRarity);
    assertMultipleOfHalf(rel, "properties.reach", getNestedValue(json, ["properties", "reach"]));
    assertMultipleOfHalf(rel, "properties.range.normal", getNestedValue(json, ["properties", "range", "normal"]));
    assertMultipleOfHalf(rel, "properties.range.long", getNestedValue(json, ["properties", "range", "long"]));
    assertMultipleOfHalf(rel, "properties.thrown.normal", getNestedValue(json, ["properties", "thrown", "normal"]));
    assertMultipleOfHalf(rel, "properties.thrown.long", getNestedValue(json, ["properties", "thrown", "long"]));
    assertWeaponModSpec(rel, "attack.mod", getNestedValue(json, ["attack", "mod"]));
    assertWeaponBonusSpec(rel, "attack.bonus", getNestedValue(json, ["attack", "bonus"]));
    assertWeaponModSpec(rel, "effectOnHit.mod", getNestedValue(json, ["effectOnHit", "mod"]));
  }
  if (isArmor(json)) {
    assertEnum(rel, "type", json.type, enums.armorType);
    assertEnum(rel, "armorCategory", json.armorCategory, enums.armorCategory);
  }
  if (isObjectItem(json)) {
    assertEnum(rel, "type", json.type, enums.objectType);
  }
  if (isAmmo(json)) {
    assertEnum(rel, "type", json.type, enums.ammoType);
    assertEnum(rel, "subtype", json.subtype, enums.ammoSubtype);
    assertEnum(rel, "category", json.category, enums.ammoCategory);
    assertEnum(rel, "rarity", json.rarity, enums.ammoRarity);
  }
  if (!isIndexFile(relNorm)) {
    if (
      relNorm.startsWith("src/data/items/armes/simple/") ||
      relNorm.startsWith("src/data/items/armes/martiale/") ||
      relNorm.startsWith("src/data/items/armes/speciale/") ||
      relNorm.startsWith("src/data/items/armes/monastique/")
    ) {
      if (!isWeapon(json)) {
        errors.push(`${rel}: expected weapon item (type=arme).`);
      }
    }
    if (relNorm.startsWith("src/data/items/armes/munitions/")) {
      if (!isAmmo(json)) {
        errors.push(`${rel}: expected ammo item (type=munition).`);
      }
    }
    if (relNorm.startsWith("src/data/items/armures/")) {
      if (!isArmor(json)) {
        errors.push(`${rel}: expected armor item (type=armor).`);
      }
    }
    if (
      relNorm.startsWith("src/data/items/objets/") &&
      !relNorm.startsWith("src/data/items/objets/contenants/")
    ) {
      if (!isObjectItem(json)) {
        errors.push(`${rel}: expected object item (type=object).`);
      }
    }
    if (relNorm.startsWith("src/data/items/objets/contenants/")) {
      if (!isObjectItem(json)) {
        errors.push(`${rel}: expected container object item (type=object).`);
      }
    }
  }

  // Class spellcasting ability (FR codes)
  assertEnum(rel, "spellcasting.ability", getNestedValue(json, ["spellcasting", "ability"]), enums.abilitiesFR);

  // ops validation
  const ops = getNestedValue(json, ["ops"]);
  if (ops && typeof ops === "object") {
    for (const [key, list] of Object.entries(ops)) {
      if (!Array.isArray(list)) continue;
      for (const op of list) {
        assertEnum(rel, `ops.${key}.op`, op?.op, enums.actionOps);
        if (op?.op === "DealDamage" || op?.op === "ApplyDamageTypeMod") {
          assertDamageType(`ops.${key}.damageType`, op?.damageType);
        }
        if (op?.op === "MoveTo") {
          assertMultipleOfHalf(rel, `ops.${key}.maxSteps`, op?.maxSteps);
        }
      }
    }
  }

  const actionOps = getNestedValue(json, ["action", "ops"]);
  if (actionOps && typeof actionOps === "object") {
    for (const [key, list] of Object.entries(actionOps)) {
      if (!Array.isArray(list)) continue;
      for (const op of list) {
        assertEnum(rel, `action.ops.${key}.op`, op?.op, enums.actionOps);
        if (op?.op === "DealDamage" || op?.op === "ApplyDamageTypeMod") {
          assertDamageType(`action.ops.${key}.damageType`, op?.damageType);
        }
        if (op?.op === "MoveTo") {
          assertMultipleOfHalf(rel, `action.ops.${key}.maxSteps`, op?.maxSteps);
        }
      }
    }
  }

  // Enemy distance fields
  assertMultipleOfHalf(rel, "combatStats.moveRange", getNestedValue(json, ["combatStats", "moveRange"]));
  assertMultipleOfHalf(rel, "movement.speed", getNestedValue(json, ["movement", "speed"]));
  assertMultipleOfHalf(rel, "vision.range", getNestedValue(json, ["vision", "range"]));
  assertMultipleOfHalf(rel, "combatProfile.preferredRangeMin", getNestedValue(json, ["combatProfile", "preferredRangeMin"]));
  assertMultipleOfHalf(rel, "combatProfile.preferredRangeMax", getNestedValue(json, ["combatProfile", "preferredRangeMax"]));
  assertMultipleOfHalf(rel, "combatProfile.avoidRangeMin", getNestedValue(json, ["combatProfile", "avoidRangeMin"]));
  assertMultipleOfHalf(rel, "combatProfile.avoidRangeMax", getNestedValue(json, ["combatProfile", "avoidRangeMax"]));
  assertMultipleOfHalf(rel, "behavior.preferredRangeMin", getNestedValue(json, ["behavior", "preferredRangeMin"]));
  assertMultipleOfHalf(rel, "behavior.preferredRangeMax", getNestedValue(json, ["behavior", "preferredRangeMax"]));
  assertMultipleOfHalf(rel, "behavior.panicRange", getNestedValue(json, ["behavior", "panicRange"]));
}

function validateIndexCoverage(params) {
  const { relPath, listKey, folderPrefix } = params;
  const indexEntry = parsedEntries.find(entry => entry.relNorm === relPath);
  if (!indexEntry) {
    errors.push(`${relPath}: missing index file.`);
    return;
  }
  const list = indexEntry.json?.[listKey];
  if (!Array.isArray(list)) {
    errors.push(`${relPath}: "${listKey}" must be an array.`);
    return;
  }
  const listed = new Set(
    list
      .map(value => String(value).trim())
      .filter(Boolean)
      .map(value => `${folderPrefix}/${value.replace(/^\.\//, "")}`)
  );
  listed.forEach(rel => {
    if (!allJsonRelPaths.has(rel)) {
      errors.push(`${relPath}: listed file missing -> ${rel}`);
    }
  });
  parsedEntries
    .filter(entry => entry.relNorm.startsWith(folderPrefix + "/") && !isIndexFile(entry.relNorm))
    .forEach(entry => {
      if (!listed.has(entry.relNorm)) {
        errors.push(`${relPath}: file not referenced in index -> ${entry.relNorm}`);
      }
    });
}

validateIndexCoverage({
  relPath: "src/data/characters/backgrounds/index.json",
  listKey: "types",
  folderPrefix: "src/data/characters/backgrounds"
});
validateIndexCoverage({
  relPath: "src/data/characters/races/index.json",
  listKey: "types",
  folderPrefix: "src/data/characters/races"
});
validateIndexCoverage({
  relPath: "src/data/characters/classes/index.json",
  listKey: "types",
  folderPrefix: "src/data/characters/classes"
});
validateIndexCoverage({
  relPath: "src/data/characters/features/index.json",
  listKey: "features",
  folderPrefix: "src/data/characters/features"
});
validateIndexCoverage({
  relPath: "src/data/characters/languages/index.json",
  listKey: "types",
  folderPrefix: "src/data/characters/languages"
});

if (errors.length > 0) {
  console.error("Content validation failed:");
  for (const line of errors) console.error(" - " + line);
  process.exit(1);
}

console.log("Content validation OK.");
