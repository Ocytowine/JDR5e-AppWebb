import type { GridPosition } from "../types";

export type ObstacleRotationDeg = 0 | 90 | 180 | 270;

export interface ObstacleBlocking {
  movement: boolean;
  vision: boolean;
  attacks: boolean;
}

export interface ObstacleDurability {
  destructible: boolean;
  maxHp: number;
  ac?: number;
}

export interface ObstacleVariant {
  id: string;
  label: string;
  /**
   * Footprint expressed in relative grid cells from the anchor (0,0).
   * Example for a 1x3 horizontal segment: [{0,0},{1,0},{2,0}]
   */
  footprint: GridPosition[];
  rotatable: boolean;
}

export interface ObstacleAppearance {
  spriteKey?: string;
  tint?: number;
  /**
   * Used for visuals and later for cover/LOS heuristics if needed.
   */
  heightClass?: "low" | "medium" | "tall" | string;
  scale?: number;
  scaleRange?: { min: number; max: number };
  scaleVariants?: number[];
  variantWeights?: Record<string, number>;
}

export interface ObstacleSpawnRules {
  weight?: number;
  cluster?: { min: number; max: number };
  shapeHint?: "line" | "scatter" | "room" | string;
  avoidNearTokens?: boolean;
}

export interface ObstacleTypeDefinition {
  id: string;
  label: string;
  category: string;
  tags?: string[];
  blocking: ObstacleBlocking;
  durability: ObstacleDurability;
  variants: ObstacleVariant[];
  appearance?: ObstacleAppearance;
  spawnRules?: ObstacleSpawnRules;
  /**
   * Free-form for later extensions (cover, doors, interactables...).
   */
  [key: string]: unknown;
}

export interface ObstacleInstance {
  id: string;
  typeId: string;
  variantId: string;
  x: number;
  y: number;
  rotation: ObstacleRotationDeg;
  hp: number;
  maxHp: number;
}
