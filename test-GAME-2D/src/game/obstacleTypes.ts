import type { GridPosition } from "../types";
import type { Orientation8 } from "./footprint";
import type { InteractionSpec } from "./interactions";

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
  spriteGrid?: { tilesX: number; tilesY: number; tileSize?: number };
  preserveAspect?: boolean;
  animationSpeed?: number;
  animationLoop?: boolean;
  paletteId?: string;
  palettes?: Record<
    string,
    {
      layers?: Record<
        string,
        {
          tint?: number;
          tintRange?: { dark: number; light: number };
          alpha?: number;
          visible?: boolean;
        }
      >;
    }
  >;
  randomRotation?: boolean;
  /**
   * Controls how shadows are anchored/scaled for large obstacles (e.g., trees).
   */
  shadowMode?: "default" | "tall";
  /**
   * Optional shadow sprite keys for obstacles with seasonal foliage.
   */
  shadowSpriteLeafy?: string;
  shadowSpriteLeafless?: string;
  /**
   * Used for visuals and later for cover/LOS heuristics if needed.
   */
  heightClass?: "low" | "medium" | "tall" | string;
  /**
   * Stretch multiplier for obstacle shadow rendering (1 = default).
   */
  shadowStretch?: number;
  layers?: Array<{
    id?: string;
    spriteKey: string;
    tint?: number;
    alpha?: number;
    scale?: number;
    z?: number;
    renderLayer?: "base" | "overhead" | string;
    visible?: "always" | "hideWhenTokenBelow";
    spriteGrid?: { tilesX: number; tilesY: number; tileSize?: number };
    preserveAspect?: boolean;
    animationSpeed?: number;
    animationLoop?: boolean;
  }>;
  tokenScale?: { default: number; min: number; max: number };
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

export interface ObstacleLight {
  radius: number;
  color?: number;
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
  litByDefault?: boolean;
  spawnRules?: ObstacleSpawnRules;
  light?: ObstacleLight;
  effects?: Array<{
    id: string;
    enabled?: boolean;
  }>;
  connects?: { from: number; to: number };
  interactions?: InteractionSpec[];
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
  orientation?: Orientation8;
  /**
   * Legacy rotation in degrees (0/90/180/270).
   * Prefer `orientation`.
   */
  rotation?: number;
  tokenScale?: number;
  state?: { lit?: boolean };
  hp: number;
  maxHp: number;
}
