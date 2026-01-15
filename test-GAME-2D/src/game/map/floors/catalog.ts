import type { FloorMaterial, FloorTexture } from "./types";

export const FLOOR_TEXTURES: FloorTexture[] = [
  { id: "stone-basic", label: "Stone basic", kind: "color", color: "#6b6f74" },
  { id: "road-basic", label: "Road basic", kind: "color", color: "#5a4a3a" },
  { id: "grass-basic", label: "Grass basic", kind: "color", color: "#3f6b3a" },
  { id: "wood-plank", label: "Wood plank", kind: "pattern", patternId: "wood-plank" }
];

export const FLOOR_MATERIALS: FloorMaterial[] = [
  { id: "stone", label: "Stone", terrain: "stone", textureId: "stone-basic", fallbackColor: "#6b6f74" },
  { id: "road", label: "Road", terrain: "road", textureId: "road-basic", fallbackColor: "#5a4a3a" },
  { id: "grass", label: "Grass", terrain: "grass", textureId: "grass-basic", fallbackColor: "#3f6b3a" },
  { id: "floor", label: "Floor", terrain: "floor", textureId: "wood-plank", fallbackColor: "#7a5c3b" }
];
