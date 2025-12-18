import type { GridPosition } from "./types";

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

export function hasLineOfEffect(
  from: GridPosition,
  to: GridPosition,
  blockedCells: Set<string> | null | undefined
): boolean {
  if (!blockedCells || blockedCells.size === 0) return true;

  const cells = lineCells(from, to);
  // Ignore the start and end cells.
  for (let i = 1; i < cells.length - 1; i++) {
    const c = cells[i];
    if (blockedCells.has(key(c.x, c.y))) return false;
  }
  return true;
}

