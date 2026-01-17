import type { GridPosition } from "../types";
import type { InteractionSpec } from "./interactions";

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
  interactions?: InteractionSpec[];
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

