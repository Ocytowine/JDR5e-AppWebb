import type { ObstacleTypeDefinition } from "./obstacleTypes";

import obstaclesIndex from "../../data/maps/obstacles/index.json";

import fenceWood from "../../data/maps/obstacles/fence-wood.json";
import treeOak from "../../data/maps/obstacles/tree-oak.json";
import bush from "../../data/maps/obstacles/bush.json";
import log from "../../data/maps/obstacles/log.json";
import rock from "../../data/maps/obstacles/rock.json";
import rubble from "../../data/maps/obstacles/rubble.json";
import stalagmite from "../../data/maps/obstacles/stalagmite.json";
import barrelWood from "../../data/maps/obstacles/barrel-wood.json";
import crateWood from "../../data/maps/obstacles/crate-wood.json";
import tableWood from "../../data/maps/obstacles/table-wood.json";
import chairWood from "../../data/maps/obstacles/chair-wood.json";
import statueStone from "../../data/maps/obstacles/statue-stone.json";
import torchWall from "../../data/maps/obstacles/torch-wall.json";
import brazier from "../../data/maps/obstacles/brazier.json";
import fireOnly from "../../data/maps/obstacles/fire-only.json";
import pillarStone from "../../data/maps/obstacles/pillar-stone.json";
import stairsStone from "../../data/maps/obstacles/stairs-stone.json";
import charetteWood from "../../data/maps/obstacles/charette-wood.json";

const OBSTACLE_TYPE_MODULES: Record<string, ObstacleTypeDefinition> = {
  "./fence-wood.json": fenceWood as ObstacleTypeDefinition,
  "./tree-oak.json": treeOak as ObstacleTypeDefinition,
  "./bush.json": bush as ObstacleTypeDefinition,
  "./log.json": log as ObstacleTypeDefinition,
  "./rock.json": rock as ObstacleTypeDefinition,
  "./rubble.json": rubble as ObstacleTypeDefinition,
  "./stalagmite.json": stalagmite as ObstacleTypeDefinition,
  "./barrel-wood.json": barrelWood as ObstacleTypeDefinition,
  "./crate-wood.json": crateWood as ObstacleTypeDefinition,
  "./table-wood.json": tableWood as ObstacleTypeDefinition,
  "./chair-wood.json": chairWood as ObstacleTypeDefinition,
  "./statue-stone.json": statueStone as ObstacleTypeDefinition,
  "./torch-wall.json": torchWall as ObstacleTypeDefinition,
  "./brazier.json": brazier as ObstacleTypeDefinition,
  "./fire-only.json": fireOnly as ObstacleTypeDefinition,
  "./pillar-stone.json": pillarStone as ObstacleTypeDefinition,
  "./stairs-stone.json": stairsStone as ObstacleTypeDefinition,
  "./charette-wood.json": charetteWood as ObstacleTypeDefinition
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
