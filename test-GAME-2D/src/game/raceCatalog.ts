import type { RaceDefinition } from "./raceTypes";

import racesIndex from "../../character-data/races/index.json";
import human from "../../character-data/races/human.json";
import elf from "../../character-data/races/elf.json";
import dwarf from "../../character-data/races/dwarf.json";

const RACE_MODULES: Record<string, RaceDefinition> = {
  "./human.json": human as RaceDefinition,
  "./elf.json": elf as RaceDefinition,
  "./dwarf.json": dwarf as RaceDefinition
};

export function loadRaceTypesFromIndex(): RaceDefinition[] {
  const indexed = Array.isArray((racesIndex as any).types)
    ? ((racesIndex as any).types as string[])
    : [];

  const loaded: RaceDefinition[] = [];
  for (const path of indexed) {
    const mod = RACE_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[race-types] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[race-types] No races loaded from index.json");
  }

  return loaded;
}
