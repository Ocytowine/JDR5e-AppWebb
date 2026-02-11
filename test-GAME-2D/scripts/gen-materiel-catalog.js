const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const materielRoot = path.join(projectRoot, "src", "data", "items");

const CATEGORY_CONFIG = [
  { folder: "armes", type: "arme", nameKey: "name", indexName: "weapon", tsType: "WeaponTypeDefinition" },
  { folder: "armures", type: "armor", nameKey: "label", indexName: "armor", tsType: "ArmorItemDefinition" },
  { folder: "objets", type: "object", nameKey: "label", indexName: "object", tsType: "ObjectItemDefinition" },
  { folder: "outils", type: "tool", nameKey: "label", indexName: "tool", tsType: "ToolItemDefinition" }
];

function isJsonFile(file) {
  return file.toLowerCase().endsWith(".json");
}

function isIndexFile(file) {
  return path.basename(file).toLowerCase() === "index.json";
}

function isTemplateFile(file) {
  const name = path.basename(file).toLowerCase();
  return name.includes("template");
}

function listDirsRecursive(dir, skipDirs = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const dirs = [dir];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (skipDirs.includes(entry.name)) continue;
    dirs.push(...listDirsRecursive(path.join(dir, entry.name), skipDirs));
  }
  return dirs;
}

function listJsonFilesRecursive(dir, skipDirs = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.includes(entry.name)) continue;
      files.push(...listJsonFilesRecursive(full, skipDirs));
    } else if (entry.isFile() && isJsonFile(entry.name) && !isIndexFile(entry.name) && !isTemplateFile(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function normalizeRel(fromDir, filePath) {
  const rel = path.relative(fromDir, filePath).replace(/\\/g, "/");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function toIdentifier(input) {
  const cleaned = input
    .replace(/\.json$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
  if (!cleaned) return "ItemModule";
  const parts = cleaned.split(" ");
  const name =
    parts[0].charAt(0).toUpperCase() +
    parts[0].slice(1) +
    parts
      .slice(1)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join("");
  return name.replace(/^[^a-zA-Z_]/, "_$&");
}

function uniqueName(name, used) {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let i = 2;
  while (used.has(`${name}${i}`)) i += 1;
  const next = `${name}${i}`;
  used.add(next);
  return next;
}

function readJson(file) {
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw);
}

function validateItem(filePath, data, expectedType, nameKey) {
  const errors = [];
  if (!data || typeof data !== "object") {
    errors.push("JSON invalide.");
    return errors;
  }
  if (!data.id || typeof data.id !== "string") {
    errors.push("Champ `id` manquant ou invalide.");
  }
  if (!data.type || data.type !== expectedType) {
    errors.push(`Champ \`type\` attendu: "${expectedType}".`);
  }
  if (!data[nameKey] || typeof data[nameKey] !== "string") {
    errors.push(`Champ \`${nameKey}\` manquant ou invalide.`);
  }
  if (expectedType === "arme") {
    if (!data.subtype || typeof data.subtype !== "string") {
      errors.push("Champ `subtype` manquant (arme).");
    }
    if (!data.category || typeof data.category !== "string") {
      errors.push("Champ `category` manquant (arme).");
    }
  }
  if (data.tags && !Array.isArray(data.tags)) {
    errors.push("Champ `tags` doit etre un tableau.");
  }
  if (data.weight && typeof data.weight !== "number") {
    errors.push("Champ `weight` doit etre un nombre.");
  }
  if (data.value && typeof data.value !== "object") {
    errors.push("Champ `value` doit etre un objet.");
  }
  return errors;
}

function writeIndexJson(dir, relPaths) {
  const content = JSON.stringify({ types: relPaths }, null, 2) + "\n";
  fs.writeFileSync(path.join(dir, "index.json"), content, "utf8");
}

function generateCatalog(options) {
  const {
    folder,
    indexName,
    tsType,
    functionName,
    warnLabel,
    extraImports = [],
    beforeLoad = "",
    transformEntry = null
  } = options;
  const indexPath = path.join(materielRoot, folder, "index.json");
  const indexJson = readJson(indexPath);
  const types = Array.isArray(indexJson.types) ? indexJson.types : [];
  const used = new Set();
  const imports = [];
  const entries = [];
  for (const rel of types) {
    const modulePath = rel.replace(/^\.\//, "");
    const baseName = modulePath.replace(/\.json$/i, "");
    const importName = uniqueName(toIdentifier(baseName), used);
    imports.push(`import ${importName} from "../../data/items/${folder}/${modulePath}";`);
    entries.push(`  "${rel}": ${importName} as ${tsType}`);
  }
  const filePath = path.join(
    projectRoot,
    "src",
    "PlayerCharacterCreator",
    "catalogs",
    `${indexName}Catalog.ts`
  );
  const content = `// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Source of truth: src/data/items/${folder} (generated indexes)

import type { ${tsType} } from "../../game/${indexName}Types";
${extraImports.join("\n")}

import ${indexName}sIndex from "../../data/items/${folder}/index.json";
${imports.join("\n")}

const ${indexName.toUpperCase()}_MODULES: Record<string, ${tsType}> = {
${entries.join(",\n")}
};
${beforeLoad}
export function ${functionName}(): ${tsType}[] {
  const indexed = Array.isArray((${indexName}sIndex as any).types)
    ? ((${indexName}sIndex as any).types as string[])
    : [];

  const loaded: ${tsType}[] = [];
  for (const path of indexed) {
    const mod = ${indexName.toUpperCase()}_MODULES[path];
    if (mod) {
      ${transformEntry ? "loaded.push(" + transformEntry("mod") + ");" : "loaded.push(mod);"}
    } else {
      console.warn("[${warnLabel}] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[${warnLabel}] No ${indexName}s loaded from index.json");
  }

  return loaded;
}
`;
  fs.writeFileSync(filePath, content, "utf8");
}

function main() {
  const allErrors = [];
  const seenIds = new Map();

  for (const category of CATEGORY_CONFIG) {
    const baseDir = path.join(materielRoot, category.folder);
    const skipDirs = category.folder === "armes" ? ["munitions"] : [];
    const dirs = listDirsRecursive(baseDir, skipDirs);
    const files = listJsonFilesRecursive(baseDir, skipDirs);

    for (const file of files) {
      const data = readJson(file);
      const relFromCategory = normalizeRel(baseDir, file);

      const errors = validateItem(file, data, category.type, category.nameKey);
      if (errors.length > 0) {
        allErrors.push(`${category.folder}/${relFromCategory}: ${errors.join(" ")}`);
      }

      if (data && typeof data.id === "string") {
        if (seenIds.has(data.id)) {
          allErrors.push(
            `ID en double: "${data.id}" -> ${seenIds.get(data.id)} et ${category.folder}/${relFromCategory}`
          );
        } else {
          seenIds.set(data.id, `${category.folder}/${relFromCategory}`);
        }
      }
    }

    for (const dir of dirs) {
      const relPaths = listJsonFilesRecursive(dir, skipDirs)
        .map(file => normalizeRel(dir, file))
        .sort((a, b) => a.localeCompare(b));
      writeIndexJson(dir, relPaths);
    }
  }

  if (allErrors.length > 0) {
    const message = allErrors.map(err => `- ${err}`).join("\n");
    console.error("[gen-materiel-catalog] Validation errors:\n" + message);
    process.exit(1);
  }

  generateCatalog({
    folder: "armes",
    indexName: "weapon",
    tsType: "WeaponTypeDefinition",
    functionName: "loadWeaponTypesFromIndex",
    warnLabel: "weapon-types",
    extraImports: ['import { normalizeDamageType } from "../../game/damageTypes";'],
    beforeLoad: `
function normalizeWeaponDamageTypes(def: WeaponTypeDefinition): WeaponTypeDefinition {
  const damage = def.damage;
  const effectOnHit = def.effectOnHit;
  const damageTypeId = normalizeDamageType(damage?.damageType ?? null);
  const onHitDamageTypeId = normalizeDamageType(effectOnHit?.damageType ?? null);

  if (damage?.damageType && !damageTypeId) {
    console.warn(
      "[weapon-types] Unknown damage type for weapon:",
      def.id,
      "->",
      damage.damageType
    );
  }
  if (effectOnHit?.damageType && !onHitDamageTypeId) {
    console.warn(
      "[weapon-types] Unknown on-hit damage type for weapon:",
      def.id,
      "->",
      effectOnHit.damageType
    );
  }

  return {
    ...def,
    damage: damage
      ? {
          ...damage,
          damageTypeId
        }
      : damage,
    effectOnHit: effectOnHit
      ? {
          ...effectOnHit,
          damageTypeId: onHitDamageTypeId
        }
      : effectOnHit
  };
}
`,
    transformEntry: mod => `normalizeWeaponDamageTypes(${mod})`
  });

  generateCatalog({
    folder: "armures",
    indexName: "armor",
    tsType: "ArmorItemDefinition",
    functionName: "loadArmorItemsFromIndex",
    warnLabel: "armors"
  });

  generateCatalog({
    folder: "objets",
    indexName: "object",
    tsType: "ObjectItemDefinition",
    functionName: "loadObjectItemsFromIndex",
    warnLabel: "objects"
  });

  generateCatalog({
    folder: "outils",
    indexName: "tool",
    tsType: "ToolItemDefinition",
    functionName: "loadToolItemsFromIndex",
    warnLabel: "tools"
  });

  console.log("[gen-materiel-catalog] Indexes and catalogs generated.");
}

main();
