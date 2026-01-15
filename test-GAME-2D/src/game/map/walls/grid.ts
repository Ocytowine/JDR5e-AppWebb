import type { GridPosition } from "../../../types";
import type { WallDirection, WallSegment } from "./types";

export function normalizeWallEdge(params: {
  x: number;
  y: number;
  dir: WallDirection;
}): { x: number; y: number; dir: WallDirection } {
  const { x, y, dir } = params;
  if (dir === "W" && x > 0) return { x: x - 1, y, dir: "E" };
  if (dir === "N" && y > 0) return { x, y: y - 1, dir: "S" };
  return { x, y, dir };
}

export function wallEdgeKey(x: number, y: number, dir: WallDirection): string {
  const norm = normalizeWallEdge({ x, y, dir });
  return `${norm.x},${norm.y},${norm.dir}`;
}

export function wallEdgeKeyForSegment(segment: WallSegment): string {
  return wallEdgeKey(segment.x, segment.y, segment.dir);
}

export function getAdjacentCellsForEdge(params: {
  x: number;
  y: number;
  dir: WallDirection;
}): { a: GridPosition; b: GridPosition } {
  const { x, y, dir } = params;
  switch (dir) {
    case "N":
      return { a: { x, y: y - 1 }, b: { x, y } };
    case "S":
      return { a: { x, y }, b: { x, y: y + 1 } };
    case "W":
      return { a: { x: x - 1, y }, b: { x, y } };
    case "E":
    default:
      return { a: { x, y }, b: { x: x + 1, y } };
  }
}

export function edgeBetweenCells(
  from: GridPosition,
  to: GridPosition
): { x: number; y: number; dir: WallDirection } | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return { x: from.x, y: from.y, dir: "E" };
  if (dx === -1 && dy === 0) return { x: to.x, y: to.y, dir: "E" };
  if (dx === 0 && dy === 1) return { x: from.x, y: from.y, dir: "S" };
  if (dx === 0 && dy === -1) return { x: to.x, y: to.y, dir: "S" };
  return null;
}
