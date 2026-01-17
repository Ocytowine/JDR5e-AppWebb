import type { GridPosition } from "./types";
import type { WallSegment } from "./game/map/walls/types";
import { isEdgeBlockingVision } from "./game/map/walls/runtime";

function key(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Bresenham line on grid cells (inclusive).
 * Works well for LOS/LOE checks on a square grid.
 */
export function lineCells(a: GridPosition, b: GridPosition): GridPosition[] {
  const cells: GridPosition[] = [];

  let x0 = Math.round(a.x);
  let y0 = Math.round(a.y);
  const x1 = Math.round(b.x);
  const y1 = Math.round(b.y);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  let err = dx - dy;

  while (true) {
    cells.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return cells;
}

/**
 * Grid traversal that returns every cell crossed by the segment.
 * Uses a DDA/voxel traversal so "thin" obstacles still block vision.
 */
export function lineCellsSupercover(a: GridPosition, b: GridPosition): GridPosition[] {
  const cells: GridPosition[] = [];

  const x0 = a.x + 0.5;
  const y0 = a.y + 0.5;
  const x1 = b.x + 0.5;
  const y1 = b.y + 0.5;

  const dx = x1 - x0;
  const dy = y1 - y0;

  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

  let x = Math.floor(x0);
  let y = Math.floor(y0);
  const endX = Math.floor(x1);
  const endY = Math.floor(y1);

  let tMaxX: number;
  let tMaxY: number;
  let tDeltaX: number;
  let tDeltaY: number;

  if (dx === 0) {
    tMaxX = Number.POSITIVE_INFINITY;
    tDeltaX = Number.POSITIVE_INFINITY;
  } else {
    const nextX = stepX > 0 ? Math.floor(x0) + 1 : Math.floor(x0);
    tMaxX = (nextX - x0) / dx;
    tDeltaX = 1 / Math.abs(dx);
  }

  if (dy === 0) {
    tMaxY = Number.POSITIVE_INFINITY;
    tDeltaY = Number.POSITIVE_INFINITY;
  } else {
    const nextY = stepY > 0 ? Math.floor(y0) + 1 : Math.floor(y0);
    tMaxY = (nextY - y0) / dy;
    tDeltaY = 1 / Math.abs(dy);
  }

  cells.push({ x, y });

  while (x !== endX || y !== endY) {
    if (tMaxX < tMaxY) {
      tMaxX += tDeltaX;
      x += stepX;
    } else {
      tMaxY += tDeltaY;
      y += stepY;
    }
    cells.push({ x, y });
  }

  return cells;
}

export function hasLineOfEffect(
  from: GridPosition,
  to: GridPosition,
  blockedCells: Set<string> | null | undefined,
  wallVisionEdges?: Map<string, WallSegment> | null
): boolean {
  const hasCells = blockedCells && blockedCells.size > 0;
  const hasWalls = wallVisionEdges && wallVisionEdges.size > 0;
  if (!hasCells && !hasWalls) return true;

  const cells = lineCells(from, to);
  // Ignore the start and end cells.
  for (let i = 1; i < cells.length - 1; i++) {
    const c = cells[i];
    if (hasCells && blockedCells!.has(key(c.x, c.y))) return false;
  }
  if (hasWalls) {
    for (let i = 1; i < cells.length; i++) {
      const prev = cells[i - 1] ?? from;
      const c = cells[i];
      if (isEdgeBlockingVision(prev, c, from, wallVisionEdges!)) return false;
      const dx = c.x - prev.x;
      const dy = c.y - prev.y;
      if (dx !== 0 && dy !== 0) {
        const stepX = { x: prev.x + dx, y: prev.y };
        const stepY = { x: prev.x, y: prev.y + dy };
        if (isEdgeBlockingVision(prev, stepX, from, wallVisionEdges!)) return false;
        if (isEdgeBlockingVision(prev, stepY, from, wallVisionEdges!)) return false;
        if (isEdgeBlockingVision(stepX, c, from, wallVisionEdges!)) return false;
        if (isEdgeBlockingVision(stepY, c, from, wallVisionEdges!)) return false;
      }
    }
  }
  return true;
}

export function hasLineOfSight(
  from: GridPosition,
  to: GridPosition,
  blockedCells: Set<string> | null | undefined,
  wallVisionEdges?: Map<string, WallSegment> | null
): boolean {
  const hasCells = blockedCells && blockedCells.size > 0;
  const hasWalls = wallVisionEdges && wallVisionEdges.size > 0;
  if (!hasCells && !hasWalls) return true;

  const cells = lineCellsSupercover(from, to);
  for (let i = 1; i < cells.length - 1; i++) {
    const c = cells[i];
    if (hasCells && blockedCells!.has(key(c.x, c.y))) return false;
  }
  if (hasWalls) {
    for (let i = 1; i < cells.length; i++) {
      const prev = cells[i - 1] ?? from;
      const c = cells[i];
      if (isEdgeBlockingVision(prev, c, from, wallVisionEdges!)) return false;
      const dx = c.x - prev.x;
      const dy = c.y - prev.y;
      if (dx !== 0 && dy !== 0) {
        const stepX = { x: prev.x + dx, y: prev.y };
        const stepY = { x: prev.x, y: prev.y + dy };
        if (isEdgeBlockingVision(prev, stepX, from, wallVisionEdges!)) return false;
        if (isEdgeBlockingVision(prev, stepY, from, wallVisionEdges!)) return false;
        if (isEdgeBlockingVision(stepX, c, from, wallVisionEdges!)) return false;
        if (isEdgeBlockingVision(stepY, c, from, wallVisionEdges!)) return false;
      }
    }
  }
  return true;
}
