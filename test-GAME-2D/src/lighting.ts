import { hasLineOfSight } from "./lineOfSight";
import type { WallSegment } from "./game/map/walls/types";

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  color?: number;
}

export type LightVisionMode = "normal" | "lowlight" | "darkvision";

export const LIGHT_LEVEL_BRIGHT_MIN = 0.7;
export const LIGHT_LEVEL_SHADOW_MIN = 0.35;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

export function computeLightLevels(params: {
  grid: { cols: number; rows: number };
  mapLight?: number[] | null;
  lightSources?: LightSource[] | null;
  obstacleVisionCells?: Set<string> | null;
  wallVisionEdges?: Map<string, WallSegment> | null;
  closedCells?: Set<string> | null;
  roofOpenCells?: Set<string> | null;
  ambientBlockThreshold?: number;
}): number[] {
  const {
    grid,
    mapLight = null,
    lightSources = null,
    obstacleVisionCells = null,
    wallVisionEdges = null,
    closedCells = null,
    roofOpenCells = null,
    ambientBlockThreshold = LIGHT_LEVEL_BRIGHT_MIN
  } = params;
  const levels: number[] = new Array(grid.cols * grid.rows).fill(0);

  const baseLightAt = (x: number, y: number) => {
    if (!mapLight || mapLight.length === 0) return 1;
    const idx = y * grid.cols + x;
    const value = mapLight[idx];
    return Number.isFinite(value) ? clamp01(value) : 1;
  };

  const sources = Array.isArray(lightSources) ? lightSources : [];
  const hasBlocks =
    (obstacleVisionCells && obstacleVisionCells.size > 0) ||
    (wallVisionEdges && wallVisionEdges.size > 0);

  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      let ambient = baseLightAt(x, y);
      if (
        ambient >= ambientBlockThreshold &&
        closedCells?.has(key(x, y)) &&
        !roofOpenCells?.has(key(x, y))
      ) {
        ambient = 0;
      }

      let light = ambient;
      for (const source of sources) {
        const dx = x - source.x;
        const dy = y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > source.radius) continue;
        if (hasBlocks) {
          const hasLos = hasLineOfSight(
            { x: source.x, y: source.y },
            { x, y },
            obstacleVisionCells ?? null,
            wallVisionEdges ?? null
          );
          if (!hasLos) continue;
        }
        light = Math.max(light, 1);
      }

      levels[y * grid.cols + x] = clamp01(light);
    }
  }

  return levels;
}

export function computeLightTints(params: {
  grid: { cols: number; rows: number };
  lightSources?: LightSource[] | null;
  obstacleVisionCells?: Set<string> | null;
  wallVisionEdges?: Map<string, WallSegment> | null;
}): { colors: number[]; strength: number[] } {
  const { grid, lightSources = null, obstacleVisionCells = null, wallVisionEdges = null } = params;
  const colors: number[] = new Array(grid.cols * grid.rows).fill(0);
  const strength: number[] = new Array(grid.cols * grid.rows).fill(0);
  const sources = Array.isArray(lightSources) ? lightSources : [];
  if (sources.length === 0) return { colors, strength };

  const hasBlocks =
    (obstacleVisionCells && obstacleVisionCells.size > 0) ||
    (wallVisionEdges && wallVisionEdges.size > 0);

  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let total = 0;
      for (const source of sources) {
        if (typeof source.color !== "number") continue;
        const dx = x - source.x;
        const dy = y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > source.radius) continue;
        if (hasBlocks) {
          const hasLos = hasLineOfSight(
            { x: source.x, y: source.y },
            { x, y },
            obstacleVisionCells ?? null,
            wallVisionEdges ?? null
          );
          if (!hasLos) continue;
        }
        const weight = clamp01(1 - dist / Math.max(1, source.radius));
        const color = source.color;
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        sumR += r * weight;
        sumG += g * weight;
        sumB += b * weight;
        total += weight;
      }
      const idx = y * grid.cols + x;
      if (total > 0) {
        const r = Math.round(sumR / total);
        const g = Math.round(sumG / total);
        const b = Math.round(sumB / total);
        colors[idx] = (r << 16) | (g << 8) | b;
        strength[idx] = clamp01(total);
      }
    }
  }

  return { colors, strength };
}

export function resolveLightVisionMode(mode?: LightVisionMode | null): LightVisionMode {
  if (mode === "lowlight" || mode === "darkvision") return mode;
  return "normal";
}

export function isLightVisible(light: number, mode: LightVisionMode): boolean {
  if (mode === "darkvision") return true;
  return light >= LIGHT_LEVEL_SHADOW_MIN;
}
