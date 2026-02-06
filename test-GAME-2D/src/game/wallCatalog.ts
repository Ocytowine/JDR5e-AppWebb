import type { WallTypeDefinition } from "./wallTypes";

import wallsIndex from "../data/maps/walls/index.json";

import wallStone from "../data/maps/walls/wall-stone.json";
import wallStoneDoor from "../data/maps/walls/wall-stone-door.json";
import wallWood from "../data/maps/walls/wall-wood.json";
import wallWoodDoor from "../data/maps/walls/wall-wood-door.json";
import lowWallStone from "../data/maps/walls/low-wall-stone.json";
import lowWallWood from "../data/maps/walls/low-wall-wood.json";

const WALL_TYPE_MODULES: Record<string, WallTypeDefinition> = {
  "./wall-stone.json": wallStone as WallTypeDefinition,
  "./wall-stone-door.json": wallStoneDoor as WallTypeDefinition,
  "./wall-wood.json": wallWood as WallTypeDefinition,
  "./wall-wood-door.json": wallWoodDoor as WallTypeDefinition,
  "./low-wall-stone.json": lowWallStone as WallTypeDefinition,
  "./low-wall-wood.json": lowWallWood as WallTypeDefinition
};

export function loadWallTypesFromIndex(): WallTypeDefinition[] {
  const indexed = Array.isArray((wallsIndex as any).types)
    ? ((wallsIndex as any).types as string[])
    : [];

  const loaded: WallTypeDefinition[] = [];
  for (const path of indexed) {
    const mod = WALL_TYPE_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[wall-types] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[wall-types] No wall types loaded from index.json");
  }

  return loaded;
}

