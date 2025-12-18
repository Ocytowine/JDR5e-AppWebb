import type { ObstacleTypeDefinition } from "./obstacleTypes";

import obstaclesIndex from "../../obstacle-types/index.json";

import wallStone from "../../obstacle-types/wall-stone.json";
import lowWallStone from "../../obstacle-types/low-wall-stone.json";
import treeOak from "../../obstacle-types/tree-oak.json";
import barrelWood from "../../obstacle-types/barrel-wood.json";
import pillarStone from "../../obstacle-types/pillar-stone.json";

const OBSTACLE_TYPE_MODULES: Record<string, ObstacleTypeDefinition> = {
  "./wall-stone.json": wallStone as ObstacleTypeDefinition,
  "./low-wall-stone.json": lowWallStone as ObstacleTypeDefinition,
  "./tree-oak.json": treeOak as ObstacleTypeDefinition,
  "./barrel-wood.json": barrelWood as ObstacleTypeDefinition,
  "./pillar-stone.json": pillarStone as ObstacleTypeDefinition
};

export function loadObstacleTypesFromIndex(): ObstacleTypeDefinition[] {
  const indexed = Array.isArray((obstaclesIndex as any).types)
    ? ((obstaclesIndex as any).types as string[])
    : [];

  const loaded: ObstacleTypeDefinition[] = [];
  for (const path of indexed) {
    const mod = OBSTACLE_TYPE_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[obstacle-types] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[obstacle-types] No obstacle types loaded from index.json");
  }

  return loaded;
}

