import type { GridPosition } from "../types";

export type WallRotationDeg = 0 | 90 | 180 | 270;
export type WallState = "open" | "closed";

export interface WallBlocking {
  movement: boolean;
  vision: boolean;
  attacks: boolean;
}

export interface WallVariant {
  id: string;
  label: string;
  footprint: GridPosition[];
  rotatable: boolean;
}

export interface WallAppearance {
  textureKey?: string;
  tint?: number;
  heightClass?: "low" | "medium" | "tall" | string;
}

export interface WallBehavior {
  kind?: "solid" | "door" | "window" | "arch";
}

export interface WallDurability {
  destructible: boolean;
  maxHp: number;
  ac?: number;
}

export interface WallTypeDefinition {
  id: string;
  label: string;
  category: "wall";
  tags?: string[];
  blocking: WallBlocking;
  variants: WallVariant[];
  appearance?: WallAppearance;
  behavior?: WallBehavior;
  durability?: WallDurability;
  [key: string]: unknown;
}

export interface WallInstance {
  id: string;
  typeId: string;
  variantId: string;
  x: number;
  y: number;
  rotation: WallRotationDeg;
  state?: WallState;
  hp: number;
  maxHp: number;
}
