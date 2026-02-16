import patternsIndex from "../patterns/index.json";

import streetHouseFront from "../patterns/street-house-front-3x5.json";
import streetMarketStall from "../patterns/street-market-stall-3x4.json";
import interiorTableSet from "../patterns/interior-table-set.json";
import interiorTavernCorner from "../patterns/interior-tavern-corner.json";
import forestAlley from "../patterns/forest-alley-2x8.json";
import forestGrove from "../patterns/forest-grove-3x3.json";
import dungeonAltarNook from "../patterns/dungeon-altar-nook.json";
import houseTieredOpen from "../patterns/house-tiered-open.json";
import houseTieredClosed from "../patterns/house-tiered-closed.json";

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

export interface MapPatternFloorPaint {
  mode: "interior";
  terrain: string;
  height?: number;
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
  allowedTerrains?: string[];
  elements: MapPatternElement[];
  variants?: MapPatternVariant[];
  wallAscii?: string[];
  wallDoors?: { x: number; y: number; dir: "N" | "E" | "S" | "W"; state?: "open" | "closed" }[];
  floorPaint?: MapPatternFloorPaint;
}

function getNormalizedWallAsciiSize(lines?: string[]): { w: number; h: number } | null {
  if (!Array.isArray(lines)) return null;
  const cleaned = lines
    .map(line => String(line ?? "").replace(/\r/g, ""))
    .filter(line => line.trim().length > 0);
  if (cleaned.length === 0) return null;
  let w = 0;
  for (const line of cleaned) w = Math.max(w, line.length);
  return { w, h: cleaned.length };
}

function validatePattern(pattern: MapPatternDefinition): string[] {
  const issues: string[] = [];
  const w = Math.floor(pattern.footprint?.w ?? 0);
  const h = Math.floor(pattern.footprint?.h ?? 0);
  if (w <= 0 || h <= 0) {
    issues.push(`footprint invalide: ${pattern.footprint?.w}x${pattern.footprint?.h}`);
  }
  for (const el of pattern.elements ?? []) {
    const x = el.x;
    const y = el.y;
    if (typeof x === "number" && typeof y === "number" && w > 0 && h > 0) {
      if (x < 0 || y < 0 || x >= w || y >= h) {
        issues.push(`element hors footprint: (${x},${y})`);
      }
    }
  }
  const wallSize = getNormalizedWallAsciiSize(pattern.wallAscii);
  if (wallSize && w > 0 && h > 0) {
    if (wallSize.w !== w || wallSize.h !== h) {
      issues.push(`wallAscii ${wallSize.w}x${wallSize.h} != footprint ${w}x${h}`);
    }
    for (const door of pattern.wallDoors ?? []) {
      const dx = door.x;
      const dy = door.y;
      if (typeof dx === "number" && typeof dy === "number") {
        if (dx < 0 || dy < 0 || dx >= wallSize.w || dy >= wallSize.h) {
          issues.push(`door hors wallAscii: (${dx},${dy})`);
        }
      }
    }
  }
  return issues;
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
      const issues = validatePattern(mod);
      for (const issue of issues) {
        console.warn(`[patterns] ${mod.id}: ${issue}`);
      }
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
