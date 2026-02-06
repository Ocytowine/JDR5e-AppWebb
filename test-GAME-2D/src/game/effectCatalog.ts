import type { EffectTypeDefinition } from "./effectTypes";

import effectsIndex from "../data/effects/index.json";
import fire from "../data/effects/fire.json";
import meleeSlash from "../data/effects/melee-slash.json";

const EFFECT_TYPE_MODULES: Record<string, EffectTypeDefinition> = {
  "./fire.json": fire as EffectTypeDefinition,
  "./melee-slash.json": meleeSlash as EffectTypeDefinition
};

export function loadEffectTypesFromIndex(): EffectTypeDefinition[] {
  const indexed = Array.isArray((effectsIndex as any).types)
    ? ((effectsIndex as any).types as string[])
    : [];

  const loaded: EffectTypeDefinition[] = [];
  for (const path of indexed) {
    const mod = EFFECT_TYPE_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[effect-types] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[effect-types] No effect types loaded from index.json");
  }

  return loaded;
}

