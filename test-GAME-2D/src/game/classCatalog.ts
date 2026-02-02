import type { ClassDefinition, SubclassDefinition } from "./classTypes";

import classesIndex from "../../character-data/classes/index.json";
import cleric from "../../character-data/classes/Clerc/class.json";
import fighter from "../../character-data/classes/Guerrier/class.json";
import peaceDomain from "../../character-data/classes/Clerc/peace-domain.json";
import eldritchKnight from "../../character-data/classes/Guerrier/eldritch-knight.json";

const CLASS_MODULES: Record<string, ClassDefinition> = {
  "./Clerc/class.json": cleric as ClassDefinition,
  "./Guerrier/class.json": fighter as ClassDefinition
};

const SUBCLASS_MODULES: Record<string, SubclassDefinition> = {
  "./Clerc/peace-domain.json": peaceDomain as SubclassDefinition,
  "./Guerrier/eldritch-knight.json": eldritchKnight as SubclassDefinition
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
