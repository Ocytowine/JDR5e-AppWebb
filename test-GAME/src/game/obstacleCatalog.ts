import type { ObstacleTypeDefinition } from "./obstacleTypes";

import obstaclesIndex from "../../obstacle-types/index.json";

import fenceWood from "../../obstacle-types/fence-wood.json";
import doorWood from "../../obstacle-types/door-wood.json";
import treeOak from "../../obstacle-types/tree-oak.json";
import bush from "../../obstacle-types/bush.json";
import log from "../../obstacle-types/log.json";
import rock from "../../obstacle-types/rock.json";
import rubble from "../../obstacle-types/rubble.json";
import stalagmite from "../../obstacle-types/stalagmite.json";
import barrelWood from "../../obstacle-types/barrel-wood.json";
import crateWood from "../../obstacle-types/crate-wood.json";
import tableWood from "../../obstacle-types/table-wood.json";
import chairWood from "../../obstacle-types/chair-wood.json";
import statueStone from "../../obstacle-types/statue-stone.json";
import torchWall from "../../obstacle-types/torch-wall.json";
import brazier from "../../obstacle-types/brazier.json";
import pillarStone from "../../obstacle-types/pillar-stone.json";
import stairsStone from "../../obstacle-types/stairs-stone.json";

const OBSTACLE_TYPE_MODULES: Record<string, ObstacleTypeDefinition> = {
  "./fence-wood.json": fenceWood as ObstacleTypeDefinition,
  "./door-wood.json": doorWood as ObstacleTypeDefinition,
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
  "./pillar-stone.json": pillarStone as ObstacleTypeDefinition,
  "./stairs-stone.json": stairsStone as ObstacleTypeDefinition
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
