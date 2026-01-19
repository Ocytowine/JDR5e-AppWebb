import type { GridPosition } from "../../types";
import type { ObstacleInstance, ObstacleTypeDefinition } from "../obstacleTypes";
import { getObstacleOccupiedCells } from "../obstacleRuntime";
import { key } from "./draft";

export function isTreeType(typeDef: ObstacleTypeDefinition | null): boolean {
  if (!typeDef) return false;
  return (typeDef.tags ?? []).some(tag => String(tag).toLowerCase() === "tree");
}

export function getSpriteGridCells(params: {
  x: number;
  y: number;
  tilesX: number;
  tilesY: number;
  cols: number;
  rows: number;
}): GridPosition[] {
  const tilesX = Math.max(1, Math.floor(params.tilesX));
  const tilesY = Math.max(1, Math.floor(params.tilesY));
  const left = Math.floor(tilesX / 2);
  const right = tilesX - left - 1;
  const top = Math.floor(tilesY / 2);
  const bottom = tilesY - top - 1;

  const cells: GridPosition[] = [];
  for (let dy = -top; dy <= bottom; dy++) {
    for (let dx = -left; dx <= right; dx++) {
      const gx = params.x + dx;
      const gy = params.y + dy;
      if (gx < 0 || gy < 0 || gx >= params.cols || gy >= params.rows) continue;
      cells.push({ x: gx, y: gy });
    }
  }
  return cells;
}

export function getTreePlacementCells(params: {
  obstacle: ObstacleInstance;
  typeDef: ObstacleTypeDefinition | null;
  cols: number;
  rows: number;
}): GridPosition[] {
  const { obstacle, typeDef, cols, rows } = params;
  if (!typeDef) return [];
  const grid = typeDef.appearance?.spriteGrid;
  if (grid && Number.isFinite(grid.tilesX) && Number.isFinite(grid.tilesY)) {
    return getSpriteGridCells({
      x: obstacle.x,
      y: obstacle.y,
      tilesX: grid.tilesX,
      tilesY: grid.tilesY,
      cols,
      rows
    });
  }
  return getObstacleOccupiedCells(obstacle, typeDef);
}

export function hasTreeOverlap(params: {
  candidate: GridPosition[];
  draftObstacles: ObstacleInstance[];
  typeById: Map<string, ObstacleTypeDefinition>;
  cols: number;
  rows: number;
}): boolean {
  if (!params.candidate.length) return false;
  const candidateKeys = new Set<string>(params.candidate.map(c => key(c.x, c.y)));

  for (const obs of params.draftObstacles) {
    const typeDef = params.typeById.get(obs.typeId) ?? null;
    if (!isTreeType(typeDef)) continue;
    const cells = getTreePlacementCells({
      obstacle: obs,
      typeDef,
      cols: params.cols,
      rows: params.rows
    });
    for (const cell of cells) {
      if (candidateKeys.has(key(cell.x, cell.y))) return true;
    }
  }

  return false;
}
