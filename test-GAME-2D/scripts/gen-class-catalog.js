const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const indexPath = path.join(projectRoot, "src", "data", "characters", "classes", "index.json");
const outputPath = path.join(
  projectRoot,
  "src",
  "PlayerCharacterCreator",
  "catalogs",
  "classCatalog.ts"
);

function toIdentifier(input) {
  const cleaned = input
    .replace(/\.json$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
  if (!cleaned) return "ClassModule";
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

const raw = fs.readFileSync(indexPath, "utf8");
const parsed = JSON.parse(raw);
const types = Array.isArray(parsed.types) ? parsed.types : [];

const usedNames = new Set();
const imports = [];
const classEntries = [];
const subclassEntries = [];

types.forEach(entry => {
  const isClass = entry.toLowerCase().includes("class.json");
  const relPath = entry.replace(/\\/g, "/");
  const baseName = relPath
    .replace(/^\.\/+/g, "")
    .replace(/\.json$/i, "");
  const candidate = toIdentifier(baseName);
  const importName = uniqueName(candidate, usedNames);
  imports.push(`import ${importName} from "../../data/characters/classes/${baseName}.json";`);
  if (isClass) {
    classEntries.push(`  "${relPath}": ${importName} as ClassDefinition`);
  } else {
    subclassEntries.push(`  "${relPath}": ${importName} as SubclassDefinition`);
  }
});

const content = `// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Source of truth: src/data/characters/classes/index.json

import type { ClassDefinition, SubclassDefinition } from "../../game/classTypes";

import classesIndex from "../../data/characters/classes/index.json";
${imports.join("\n")}

const CLASS_MODULES: Record<string, ClassDefinition> = {
${classEntries.join(",\n")}
};

const SUBCLASS_MODULES: Record<string, SubclassDefinition> = {
${subclassEntries.join(",\n")}
};

export function loadClassTypesFromIndex(): ClassDefinition[] {
  const indexed = Array.isArray((classesIndex as any).types)
    ? ((classesIndex as any).types as string[])
    : [];

  const loaded: ClassDefinition[] = [];
  for (const path of indexed) {
    if (path.toLowerCase().includes("class.json")) {
      const mod = CLASS_MODULES[path];
      if (mod) {
        loaded.push(mod);
      } else {
        console.warn("[class-types] Type path missing in bundle:", path);
      }
    }
  }

  if (loaded.length === 0) {
    console.warn("[class-types] No classes loaded from index.json");
  }

  return loaded;
}

export function loadSubclassTypesFromIndex(): SubclassDefinition[] {
  const indexed = Array.isArray((classesIndex as any).types)
    ? ((classesIndex as any).types as string[])
    : [];

  const loaded: SubclassDefinition[] = [];
  for (const path of indexed) {
    if (!path.toLowerCase().includes("class.json")) {
      const mod = SUBCLASS_MODULES[path];
      if (mod) {
        loaded.push(mod);
      } else {
        console.warn("[class-types] Subclass path missing in bundle:", path);
      }
    }
  }

  if (loaded.length === 0) {
    console.warn("[class-types] No subclasses loaded from index.json");
  }

  return loaded;
}
`;

fs.writeFileSync(outputPath, content, "utf8");
console.log(`[gen-class-catalog] Generated ${path.relative(projectRoot, outputPath)}`);
