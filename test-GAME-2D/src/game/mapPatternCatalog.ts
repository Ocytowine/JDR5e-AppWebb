import patternsIndex from "./map/patterns/index.json";

import streetHouseFront from "./map/patterns/street-house-front-3x5.json";
import streetMarketStall from "./map/patterns/street-market-stall-3x4.json";
import interiorTableSet from "./map/patterns/interior-table-set.json";
import interiorTavernCorner from "./map/patterns/interior-tavern-corner.json";
import forestAlley from "./map/patterns/forest-alley-2x8.json";
import forestGrove from "./map/patterns/forest-grove-3x3.json";
import dungeonAltarNook from "./map/patterns/dungeon-altar-nook.json";
import houseTieredOpen from "./map/patterns/house-tiered-open.json";
import houseTieredClosed from "./map/patterns/house-tiered-closed.json";

export type MapPatternTheme = "dungeon" | "forest" | "city" | "generic";
export type MapPatternAnchor = "center" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
export type MapPatternElementType = "obstacle" | "decor" | "wall" | "tile";
export type MapPatternRotation = 0 | 90 | 180 | 270;

export interface MapPatternFootprint {
  w: number;
  h: number;
}

export interface MapPatternConstraints {
  needsClearArea?: boolean;
  avoidBorder?: { top?: number; bottom?: number; left?: number; right?: number };
}

export interface MapPatternElement {
  type: MapPatternElementType;
  typeId?: string;
  spriteKey?: string;
  x: number;
  y: number;
  variant?: string;
  rotation?: MapPatternRotation;
  scale?: number;
  height?: number;
  terrain?: string;
}

export interface MapPatternVariant {
  id: string;
  elements: MapPatternElement[];
}

export interface MapPatternDefinition {
  id: string;
  label: string;
  theme: MapPatternTheme;
  tags?: string[];
  footprint: MapPatternFootprint;
  anchor: MapPatternAnchor;
  constraints?: MapPatternConstraints;
  elements: MapPatternElement[];
  variants?: MapPatternVariant[];
  wallAscii?: string[];
  wallDoors?: { x: number; y: number; dir: "N" | "E" | "S" | "W"; state?: "open" | "closed" }[];
}

const PATTERN_MODULES: Record<string, MapPatternDefinition> = {
  "./street-house-front-3x5.json": streetHouseFront as MapPatternDefinition,
  "./street-market-stall-3x4.json": streetMarketStall as MapPatternDefinition,
  "./interior-table-set.json": interiorTableSet as MapPatternDefinition,
  "./interior-tavern-corner.json": interiorTavernCorner as MapPatternDefinition,
  "./forest-alley-2x8.json": forestAlley as MapPatternDefinition,
  "./forest-grove-3x3.json": forestGrove as MapPatternDefinition,
  "./dungeon-altar-nook.json": dungeonAltarNook as MapPatternDefinition,
  "./house-tiered-open.json": houseTieredOpen as MapPatternDefinition,
  "./house-tiered-closed.json": houseTieredClosed as MapPatternDefinition
};

export function loadMapPatternsFromIndex(): MapPatternDefinition[] {
  const indexed = Array.isArray((patternsIndex as any).patterns)
    ? ((patternsIndex as any).patterns as string[])
    : [];

  const loaded: MapPatternDefinition[] = [];
  for (const path of indexed) {
    const mod = PATTERN_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[patterns] Pattern path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[patterns] No patterns loaded from index.json");
  }

  return loaded;
}
