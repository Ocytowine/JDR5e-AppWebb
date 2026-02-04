import type { LanguageDefinition } from "../../game/languageTypes";

import languagesIndex from "../../../character-data/languages/index.json";
import common from "../../../character-data/languages/commun.json";
import elvish from "../../../character-data/languages/elfique.json";
import dwarf from "../../../character-data/languages/nain.json";
import halfling from "../../../character-data/languages/halfelin.json";
import gnome from "../../../character-data/languages/gnome.json";
import orc from "../../../character-data/languages/orc.json";

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
