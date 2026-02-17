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

const files = listJsonFiles(DATA_DIR);
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

if (errors.length > 0) {
  console.error("Content validation failed:");
  for (const line of errors) console.error(" - " + line);
  process.exit(1);
}

console.log("Content validation OK.");
