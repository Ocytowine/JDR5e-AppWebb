const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const actionsRoot = path.join(projectRoot, "action-game", "actions");
const catalogRoot = path.join(actionsRoot, "catalog");
const indexPath = path.join(actionsRoot, "index.json");
const outputPath = path.join(projectRoot, "src", "game", "actionCatalog.ts");

function isJsonFile(file) {
  return file.toLowerCase().endsWith(".json");
}

function isIndexFile(file) {
  return path.basename(file).toLowerCase() === "index.json";
}

function listJsonFilesRecursive(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFilesRecursive(full));
    } else if (entry.isFile() && isJsonFile(entry.name) && !isIndexFile(entry.name)) {
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
  if (!cleaned) return "ActionModule";
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

function validateAction(filePath, data) {
  const errors = [];
  if (!data || typeof data !== "object") {
    errors.push("JSON invalide.");
    return errors;
  }
  if (!data.id || typeof data.id !== "string") {
    errors.push("Champ `id` manquant ou invalide.");
  }
  if (!data.name || typeof data.name !== "string") {
    errors.push("Champ `name` manquant ou invalide.");
  }
  if (!data.category || typeof data.category !== "string") {
    errors.push("Champ `category` manquant ou invalide.");
  }
  if (!data.actionCost || typeof data.actionCost !== "object") {
    errors.push("Champ `actionCost` manquant ou invalide.");
  }
  if (!data.targeting || typeof data.targeting !== "object") {
    errors.push("Champ `targeting` manquant ou invalide.");
  }
  if (!data.usage || typeof data.usage !== "object") {
    errors.push("Champ `usage` manquant ou invalide.");
  }
  if (!Array.isArray(data.effects)) {
    errors.push("Champ `effects` doit etre un tableau.");
  }
  if (typeof data.conditions !== "undefined" && !Array.isArray(data.conditions)) {
    errors.push("Champ `conditions` doit etre un tableau.");
  }
  return errors;
}

function main() {
  const files = listJsonFilesRecursive(catalogRoot);
  const actions = files.map(file => ({
    file,
    rel: normalizeRel(actionsRoot, file)
  }));

  const allErrors = [];
  const seenIds = new Map();
  for (const entry of actions) {
    const data = readJson(entry.file);
    const errors = validateAction(entry.file, data);
    if (errors.length > 0) {
      allErrors.push(`${entry.rel}: ${errors.join(" ")}`);
    }
    if (data && typeof data.id === "string") {
      if (seenIds.has(data.id)) {
        allErrors.push(
          `ID en double: "${data.id}" -> ${seenIds.get(data.id)} et ${entry.rel}`
        );
      } else {
        seenIds.set(data.id, entry.rel);
      }
    }
  }

  if (allErrors.length > 0) {
    const message = allErrors.map(err => `- ${err}`).join("\n");
    console.error("[gen-action-catalog] Validation errors:\n" + message);
    process.exit(1);
  }

  const actionList = actions
    .map(entry => entry.rel.replace(/\\/g, "/"))
    .sort((a, b) => a.localeCompare(b));

  let modelPath = "../action-model.json";
  if (fs.existsSync(indexPath)) {
    const existing = readJson(indexPath);
    if (existing && typeof existing.model === "string") {
      modelPath = existing.model;
    }
  }

  const indexContent = JSON.stringify({ model: modelPath, actions: actionList }, null, 2) + "\n";
  fs.writeFileSync(indexPath, indexContent, "utf8");

  const usedNames = new Set();
  const imports = [];
  const entries = [];
  for (const rel of actionList) {
    const modulePath = rel.replace(/^\.\//, "");
    const baseName = modulePath.replace(/\.json$/i, "");
    const importName = uniqueName(toIdentifier(baseName), usedNames);
    imports.push(`import ${importName} from "../../action-game/actions/${baseName}.json";`);
    entries.push(`  "${rel}": ${importName} as ActionDefinition`);
  }

  const content = `// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Source of truth: action-game/actions/catalog (generated index)

import type { ActionDefinition } from "./actionTypes";
import actionsIndex from "../../action-game/actions/index.json";
${imports.join("\n")}

const ACTION_MODULES: Record<string, ActionDefinition> = {
${entries.join(",\n")}
};

export function loadActionTypesFromIndex(): ActionDefinition[] {
  const indexed = Array.isArray((actionsIndex as any).actions)
    ? ((actionsIndex as any).actions as string[])
    : [];

  const loaded: ActionDefinition[] = [];
  for (const path of indexed) {
    const mod = ACTION_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[actions] Action path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[actions] No actions loaded from index.json");
  }

  return loaded;
}
`;

  fs.writeFileSync(outputPath, content, "utf8");
  console.log("[gen-action-catalog] Index and catalog generated.");
}

main();
