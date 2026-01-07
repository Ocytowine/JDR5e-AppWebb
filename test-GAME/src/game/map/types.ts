import type { GridPosition } from "../../types";
import type { EnemyTypeDefinition } from "../enemyTypes";
import type { ObstacleTypeDefinition } from "../obstacleTypes";
import type { WallTypeDefinition } from "../wallTypes";
import type { DecorInstance } from "../decorTypes";
import type { TerrainCell } from "./draft";

export type MapTheme = "dungeon" | "forest" | "city" | "generic";

export type MapTimeOfDay = "day" | "night" | "unknown";

export type LayoutId =
  | "dungeon_circular_room"
  | "dungeon_square_room"
  | "dungeon_split_rooms"
  | "dungeon_corridor_rooms"
  | "forest_clearing"
  | "city_street"
  | "generic_scatter";

export type EntranceSide = "north" | "south" | "west" | "east";
export type EntrancePosition = "center" | "start" | "end";

export interface EntrancePlacementSpec {
  side: EntranceSide;
  count?: number;
  position?: EntrancePosition;
}

export interface MapEntrancesSpec {
  /**
   * Si `borderWalls` est true, on ouvrira des "trous" sur la périphérie.
   */
  count: number;
  /**
   * Largeur en cases (1 = une case d'ouverture).
   */
  width: number;
  /**
   * Si non vide, impose les côtés pour les ouvertures.
   */
  sides?: EntranceSide[];
  placements?: EntrancePlacementSpec[];
}

export interface DungeonRoomSpec {
  shape: "circle" | "rectangle";
  /**
   * Rayon approximatif en cases (cercle).
   */
  radius?: number;
  /**
   * Rectangle intérieur (hors murs) si shape = rectangle.
   */
  rect?: { x1: number; y1: number; x2: number; y2: number };
}

export interface DungeonSpec {
  borderWalls: boolean;
  entrances: MapEntrancesSpec;
  room: DungeonRoomSpec;
  columns: number;
  hasAltar: boolean;
  /**
   * "low" = ambiance sombre, "normal" = neutre.
   */
  lighting: "low" | "normal";
}

export type DungeonDoorState = "open" | "closed" | "locked";

export interface DungeonRoomContentSpec {
  kind: "table" | "barrel" | "crate" | "pillar" | "altar";
  count?: number;
}

export interface DungeonRoomPlanSpec {
  id: string;
  role?: "player" | "enemy" | "neutral";
  contents?: DungeonRoomContentSpec[];
}

export interface DungeonExteriorAccessSpec {
  roomId: string;
  side?: EntranceSide;
  position?: EntrancePosition;
  state?: DungeonDoorState;
}

export interface DungeonPlanSpec {
  roomCount: number;
  layoutStyle: "split" | "corridor";
  splitAxis?: "vertical" | "horizontal";
  corridorSide?: EntranceSide;
  doorPosition?: EntrancePosition;
  doorState?: DungeonDoorState;
  playerRoomId?: string;
  enemyRoomId?: string;
  enemyCountOverride?: number;
  rooms: DungeonRoomPlanSpec[];
  exteriorAccess?: DungeonExteriorAccessSpec[];
}

export interface ForestClearingSpec {
  radius: number;
  treesOnRing: "none" | "sparse" | "dense";
  lighting: "day" | "night";
}

export interface CityStreetSpec {
  direction: "horizontal" | "vertical";
  streetWidth: number;
  buildingDepth: number;
  doors: "closed" | "open";
  lighting: "day" | "night";
}

export interface MapSpec {
  prompt: string;
  grid: { cols: number; rows: number };
  layoutId: LayoutId;
  theme: MapTheme;
  timeOfDay: MapTimeOfDay;
  /**
   * Indication de taille issue du prompt.
   * Utilisée pour recommander une grille plus grande (Option A).
   */
  sizeHint?: "small" | "medium" | "large";

  // Sous-spécifications selon le layout
  dungeon?: DungeonSpec;
  dungeonPlan?: DungeonPlanSpec;
  forest?: ForestClearingSpec;
  city?: CityStreetSpec;
}

export interface MapBuildContext {
  enemyCount: number;
  enemyTypes: EnemyTypeDefinition[];
  obstacleTypes: ObstacleTypeDefinition[];
  wallTypes: WallTypeDefinition[];
}

export interface ManualMapBorderMask {
  north: boolean;
  south: boolean;
  west: boolean;
  east: boolean;
}

export interface ManualMapOptions {
  walls: boolean;
  density: "low" | "medium" | "high";
  corridors: boolean;
  entrances: number;
  lighting: "low" | "normal" | "bright";
  theme: MapTheme;
  borderMask: ManualMapBorderMask;
  patterns?: string[];
}

export interface ManualMapConfig {
  presetId: string;
  grid: { cols: number; rows: number };
  obstacles: { typeId: string; count: number }[];
  options: ManualMapOptions;
}

export interface MapBuildResult {
  summaryParts: string[];
  grid: { cols: number; rows: number };
  generationLog: string[];
  theme: MapTheme;
  playerStart: GridPosition;
  enemySpawns: { enemyType: EnemyTypeDefinition; position: GridPosition }[];
  playableCells: string[];
  obstacles: import("../obstacleTypes").ObstacleInstance[];
  walls: import("../wallTypes").WallInstance[];
  terrain: TerrainCell[];
  height: number[];
  decorations: DecorInstance[];
  recommendedGrid?: { cols: number; rows: number; reason: string };
}

