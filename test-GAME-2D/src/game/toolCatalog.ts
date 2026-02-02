import type { ToolItemDefinition } from "./toolTypes";

import toolsIndex from "../../materiel-type/outils/index.json";
import artisan from "../../materiel-type/outils/outils-artisan.json";
import games from "../../materiel-type/outils/outils-jeux.json";
import instruments from "../../materiel-type/outils/outils-instruments.json";
import misc from "../../materiel-type/outils/outils-autres.json";
import vehicles from "../../materiel-type/outils/outils-vehicules.json";

const TOOL_MODULES: Record<string, ToolItemDefinition> = {
  "./outils-artisan.json": artisan as ToolItemDefinition,
  "./outils-jeux.json": games as ToolItemDefinition,
  "./outils-instruments.json": instruments as ToolItemDefinition,
  "./outils-autres.json": misc as ToolItemDefinition,
  "./outils-vehicules.json": vehicles as ToolItemDefinition
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
