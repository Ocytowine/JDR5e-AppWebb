import type { BackgroundDefinition } from "../../game/backgroundTypes";

import backgroundsIndex from "../../data/characters/backgrounds/index.json";
import academic from "../../data/characters/backgrounds/apprenti-academique.json";
import streetKid from "../../data/characters/backgrounds/enfant-des-rues.json";
import veteran from "../../data/characters/backgrounds/veteran-de-guerre.json";

const BACKGROUND_MODULES: Record<string, BackgroundDefinition> = {
  "./apprenti-academique.json": academic as BackgroundDefinition,
  "./enfant-des-rues.json": streetKid as BackgroundDefinition,
  "./veteran-de-guerre.json": veteran as BackgroundDefinition
};

export function loadBackgroundTypesFromIndex(): BackgroundDefinition[] {
  const indexed = Array.isArray((backgroundsIndex as any).types)
    ? ((backgroundsIndex as any).types as string[])
    : [];

  const loaded: BackgroundDefinition[] = [];
  for (const path of indexed) {
    const mod = BACKGROUND_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[backgrounds] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[backgrounds] No backgrounds loaded from index.json");
  }

  return loaded;
}

