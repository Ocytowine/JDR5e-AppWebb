// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Source of truth: src/data/items/outils (generated indexes)

import type { ToolItemDefinition } from "../../game/toolTypes";


import toolsIndex from "../../../data/items/outils/index.json";
import OutilsArtisan from "../../../data/items/outils/outils-artisan.json";
import OutilsAutres from "../../../data/items/outils/outils-autres.json";
import OutilsInstruments from "../../../data/items/outils/outils-instruments.json";
import OutilsJeux from "../../../data/items/outils/outils-jeux.json";
import OutilsVehicules from "../../../data/items/outils/outils-vehicules.json";

const TOOL_MODULES: Record<string, ToolItemDefinition> = {
  "./outils-artisan.json": OutilsArtisan as ToolItemDefinition,
  "./outils-autres.json": OutilsAutres as ToolItemDefinition,
  "./outils-instruments.json": OutilsInstruments as ToolItemDefinition,
  "./outils-jeux.json": OutilsJeux as ToolItemDefinition,
  "./outils-vehicules.json": OutilsVehicules as ToolItemDefinition
};

export function loadToolItemsFromIndex(): ToolItemDefinition[] {
  const indexed = Array.isArray((toolsIndex as any).types)
    ? ((toolsIndex as any).types as string[])
    : [];

  const loaded: ToolItemDefinition[] = [];
  for (const path of indexed) {
    const mod = TOOL_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[tools] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[tools] No tools loaded from index.json");
  }

  return loaded;
}
