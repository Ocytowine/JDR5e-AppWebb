/* Normalize gameplay JSON content using taxonomy conventions. */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "src", "data");
const TAXONOMY_PATH = path.join(DATA_DIR, "models", "taxonomy.json");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function writeJson(filePath, value) {
  const content = JSON.stringify(value, null, 2) + "\n";
  fs.writeFileSync(filePath, content, "utf8");
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

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeMasteryId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

const taxonomy = readJson(TAXONOMY_PATH);
const damageTypeAliases = Object.fromEntries(
  Object.entries(taxonomy.damageTypeAliases ?? {}).map(([k, v]) => [normalizeKey(k), String(v)])
);
for (const canonical of taxonomy.damageTypes ?? []) {
  damageTypeAliases[normalizeKey(canonical)] = String(canonical);
}

function normalizeDamageTypeValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;
  const normalized = damageTypeAliases[normalizeKey(value)];
  return normalized ?? value;
}

function normalizeDamageTypesDeep(node) {
  if (Array.isArray(node)) {
    node.forEach(item => normalizeDamageTypesDeep(item));
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "damageType") {
      node[key] = normalizeDamageTypeValue(value);
      continue;
    }
    normalizeDamageTypesDeep(value);
  }
}

function normalizeMasteryFields(node) {
  if (Array.isArray(node)) {
    node.forEach(item => normalizeMasteryFields(item));
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if ((key === "weaponMastery" || key === "weaponMasteries") && Array.isArray(value)) {
      node[key] = value.map(v => normalizeMasteryId(v));
      continue;
    }
    if (key === "masteryId" && typeof value === "string") {
      node[key] = normalizeMasteryId(value);
      continue;
    }
    normalizeMasteryFields(value);
  }
}

function normalizeWeaponMasteryAction(json) {
  if (!json || typeof json !== "object") return;
  if (typeof json.id !== "string" || !json.id.startsWith("wm-")) return;
  const masteryId = normalizeMasteryId(json.id.slice(3));

  if (Array.isArray(json.tags)) {
    json.tags = json.tags.map(tag => {
      if (tag === "weaponMastery") return tag;
      if (typeof tag !== "string") return tag;
      if (tag.startsWith("wm-trigger:")) return tag;
      return normalizeMasteryId(tag);
    });
  }

  const onResolve = Array.isArray(json?.ops?.onResolve) ? json.ops.onResolve : [];
  onResolve.forEach(op => {
    if (!op || typeof op !== "object") return;
    if (typeof op.kind === "string" && op.kind.startsWith("weaponMastery:")) {
      op.kind = `weaponMastery:${masteryId}`;
    }
    if (op.data && typeof op.data === "object" && typeof op.data.masteryId === "string") {
      op.data.masteryId = masteryId;
    }
  });
}

const files = listJsonFiles(DATA_DIR);
let changed = 0;

for (const filePath of files) {
  let json;
  try {
    json = readJson(filePath);
  } catch (_err) {
    continue;
  }
  const before = JSON.stringify(json);

  normalizeDamageTypesDeep(json);
  normalizeMasteryFields(json);
  normalizeWeaponMasteryAction(json);

  const after = JSON.stringify(json);
  if (before !== after) {
    writeJson(filePath, json);
    changed += 1;
  }
}

console.log(`[normalize-content] Updated ${changed} file(s).`);
