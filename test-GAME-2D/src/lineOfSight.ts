import type { GridPosition } from "./types";
import type { WallSegment } from "./game/map/walls/types";
import { isEdgeBlockingVision } from "./game/map/walls/runtime";
import { getBoardGridProjectionKind, lineBetweenGridCells } from "./boardConfig";

function key(x: number, y: number): string {
  return `${x},${y}`;
}

export function lineCells(a: GridPosition, b: GridPosition): GridPosition[] {
  return lineBetweenGridCells(a, b);
}

export function lineCellsSupercover(a: GridPosition, b: GridPosition): GridPosition[] {
  return lineBetweenGridCells(a, b);
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
    const isSquare = getBoardGridProjectionKind() === "square";
    for (let i = 1; i < cells.length; i++) {
      const prev = cells[i - 1] ?? from;
      const c = cells[i];
      if (isEdgeBlockingVision(prev, c, from, wallVisionEdges!)) return false;
      const dx = c.x - prev.x;
      const dy = c.y - prev.y;
      if (isSquare && dx !== 0 && dy !== 0) {
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
    const isSquare = getBoardGridProjectionKind() === "square";
    for (let i = 1; i < cells.length; i++) {
      const prev = cells[i - 1] ?? from;
      const c = cells[i];
      if (isEdgeBlockingVision(prev, c, from, wallVisionEdges!)) return false;
      const dx = c.x - prev.x;
      const dy = c.y - prev.y;
      if (isSquare && dx !== 0 && dy !== 0) {
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
