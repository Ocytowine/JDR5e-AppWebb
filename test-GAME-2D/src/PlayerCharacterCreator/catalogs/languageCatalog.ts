import type { LanguageDefinition } from "../../game/languageTypes";

import languagesIndex from "../../../data/characters/languages/index.json";
import common from "../../../data/characters/languages/commun.json";
import elvish from "../../../data/characters/languages/elfique.json";
import dwarf from "../../../data/characters/languages/nain.json";
import halfling from "../../../data/characters/languages/halfelin.json";
import gnome from "../../../data/characters/languages/gnome.json";
import orc from "../../../data/characters/languages/orc.json";

const LANGUAGE_MODULES: Record<string, LanguageDefinition> = {
  "./commun.json": common as LanguageDefinition,
  "./elfique.json": elvish as LanguageDefinition,
  "./nain.json": dwarf as LanguageDefinition,
  "./halfelin.json": halfling as LanguageDefinition,
  "./gnome.json": gnome as LanguageDefinition,
  "./orc.json": orc as LanguageDefinition
};

export function loadLanguageTypesFromIndex(): LanguageDefinition[] {
  const indexed = Array.isArray((languagesIndex as any).types)
    ? ((languagesIndex as any).types as string[])
    : [];

  const loaded: LanguageDefinition[] = [];
  for (const path of indexed) {
    const mod = LANGUAGE_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[languages] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[languages] No languages loaded from index.json");
  }

  return loaded;
}
