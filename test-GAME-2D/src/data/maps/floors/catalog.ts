import type { FloorMaterial, FloorTexture } from "./types";

import unknown from "./data/unknown.json";
import stone from "./data/stone.json";
import road from "./data/road.json";
import grass from "./data/grass.json";
import floor from "./data/floor.json";
import dirt from "./data/dirt.json";
import mud from "./data/mud.json";
import water from "./data/water.json";
import deepWater from "./data/deepWater.json";

export const FLOOR_TEXTURES: FloorTexture[] = [
  { id: "stone-basic", label: "Stone basic", kind: "color", color: "#6b6f74" },
  { id: "road-basic", label: "Road basic", kind: "color", color: "#5a4a3a" },
  { id: "grass-basic", label: "Grass basic", kind: "color", color: "#3f6b3a" },
  { id: "wood-plank", label: "Wood plank", kind: "pattern", patternId: "wood-plank" }
];

export const FLOOR_MATERIALS: FloorMaterial[] = [
  unknown as FloorMaterial,
  stone as FloorMaterial,
  road as FloorMaterial,
  grass as FloorMaterial,
  floor as FloorMaterial,
  dirt as FloorMaterial,
  mud as FloorMaterial,
  water as FloorMaterial,
  deepWater as FloorMaterial
];

const floorMaterialMap = new Map(FLOOR_MATERIALS.map(mat => [mat.id, mat]));

export function getFloorMaterial(id: string | null | undefined): FloorMaterial | null {
  if (!id) return null;
  return floorMaterialMap.get(id) ?? null;
}

export function getFloorFallbackColor(id: string | null | undefined): string | null {
  const mat = getFloorMaterial(id);
  return mat?.fallbackColor ?? null;
}
