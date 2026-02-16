import type { ConeDirection } from "../boardEffects";
import type { FootprintSpec, GridPosition, TokenState } from "../../../types";

export type Orientation8 = ConeDirection;

const ORIENTATION_TO_DEG: Record<Orientation8, number> = {
  right: 0,
  "up-right": 45,
  up: 90,
  "up-left": 135,
  left: 180,
  "down-left": 225,
  down: 270,
  "down-right": 315
};

export function orientationToRotationDeg(orientation: Orientation8): number {
  return ORIENTATION_TO_DEG[orientation];
}

export function orientationFromRotationDeg(rotation?: number | null): Orientation8 {
  const raw = typeof rotation === "number" && Number.isFinite(rotation) ? rotation : 0;
  let deg = raw % 360;
  if (deg < 0) deg += 360;
  const rounded = Math.round(deg / 45) * 45;
  const normalized = (rounded + 360) % 360;
  switch (normalized) {
    case 45:
      return "down-right";
    case 90:
      return "down";
    case 135:
      return "down-left";
    case 180:
      return "left";
    case 225:
      return "up-left";
    case 270:
      return "up";
    case 315:
      return "up-right";
    default:
      return "right";
  }
}

export function getDefaultOrientationForToken(token: TokenState): Orientation8 {
  if (token.facing) return token.facing;
  return token.type === "player" ? "right" : "left";
}

export function getTokenFootprintSpec(token: TokenState): FootprintSpec {
  const spec = token.footprint;
  if (spec && spec.kind === "rect") {
    const width = Math.max(1, Math.floor(spec.width));
    const height = Math.max(1, Math.floor(spec.height));
    return { kind: "rect", width, height };
  }
  if (spec && spec.kind === "cells") {
    const cells = Array.isArray(spec.cells) ? spec.cells.filter(Boolean) : [];
    if (cells.length > 0) return { kind: "cells", cells };
  }
  return { kind: "rect", width: 1, height: 1 };
}

export function buildRectangleCells(width: number, height: number): GridPosition[] {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const startX = -Math.floor(w / 2);
  const startY = -Math.floor(h / 2);
  const cells: GridPosition[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      cells.push({ x: startX + x, y: startY + y });
    }
  }
  return cells;
}

function rotatePoint(x: number, y: number, orientation: Orientation8): { x: number; y: number } {
  const angle = (ORIENTATION_TO_DEG[orientation] * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x * cos + y * sin,
    y: -x * sin + y * cos
  };
}

function rotateCell(cell: GridPosition, orientation: Orientation8): GridPosition {
  const rotated = rotatePoint(cell.x, cell.y, orientation);
  return { x: Math.round(rotated.x), y: Math.round(rotated.y) };
}

function rasterizeRotatedRect(
  width: number,
  height: number,
  orientation: Orientation8
): GridPosition[] {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const startX = -Math.floor(w / 2) - 0.5;
  const startY = -Math.floor(h / 2) - 0.5;
  const endX = startX + w;
  const endY = startY + h;

  const corners = [
    rotatePoint(startX, startY, orientation),
    rotatePoint(endX, startY, orientation),
    rotatePoint(endX, endY, orientation),
    rotatePoint(startX, endY, orientation)
  ];

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const c of corners) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  }

  const angle = (ORIENTATION_TO_DEG[orientation] * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cells: GridPosition[] = [];
  const eps = 1e-6;

  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      // Inverse rotation (world -> local).
      const lx = x * cos - y * sin;
      const ly = x * sin + y * cos;
      if (lx + eps < startX || lx - eps > endX) continue;
      if (ly + eps < startY || ly - eps > endY) continue;
      cells.push({ x, y });
    }
  }

  return cells;
}

export function getFootprintCells(
  spec: FootprintSpec,
  orientation: Orientation8
): GridPosition[] {
  if (spec.kind === "rect") {
    const cells = rasterizeRotatedRect(spec.width, spec.height, orientation);
    const unique = new Map<string, GridPosition>();
    for (const c of cells) {
      unique.set(`${c.x},${c.y}`, c);
    }
    return Array.from(unique.values());
  }

  const rotated = spec.cells.map(cell => rotateCell(cell, orientation));
  const unique = new Map<string, GridPosition>();
  for (const c of rotated) {
    unique.set(`${c.x},${c.y}`, c);
  }
  return Array.from(unique.values());
}

export function getFootprintCellsAt(
  pivot: GridPosition,
  spec: FootprintSpec,
  orientation: Orientation8
): GridPosition[] {
  const rel = getFootprintCells(spec, orientation);
  return rel.map(c => ({ x: pivot.x + c.x, y: pivot.y + c.y }));
}

export function getTokenOccupiedCells(token: TokenState): GridPosition[] {
  const spec = getTokenFootprintSpec(token);
  const orientation = getDefaultOrientationForToken(token);
  return getFootprintCellsAt({ x: token.x, y: token.y }, spec, orientation);
}

export function getTokenOccupiedCellsAt(
  token: TokenState,
  pivot: GridPosition
): GridPosition[] {
  const spec = getTokenFootprintSpec(token);
  const orientation = getDefaultOrientationForToken(token);
  return getFootprintCellsAt(pivot, spec, orientation);
}

export function isCellInTokenFootprint(token: TokenState, cell: GridPosition): boolean {
  const cells = getTokenOccupiedCells(token);
  return cells.some(c => c.x === cell.x && c.y === cell.y);
}

export function chebyshevDistance(a: GridPosition, b: GridPosition): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function distanceToCells(point: GridPosition, cells: GridPosition[]): number {
  if (!cells.length) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const c of cells) {
    const d = chebyshevDistance(point, c);
    if (d < best) best = d;
  }
  return best;
}

export function distanceBetweenCells(a: GridPosition[], b: GridPosition[]): number {
  if (!a.length || !b.length) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const ca of a) {
    for (const cb of b) {
      const d = chebyshevDistance(ca, cb);
      if (d < best) best = d;
    }
  }
  return best;
}

export function getClosestCellToPoint(
  point: GridPosition,
  cells: GridPosition[]
): GridPosition | null {
  if (!cells.length) return null;
  let best = cells[0];
  let bestDist = chebyshevDistance(point, best);
  for (const c of cells) {
    const d = chebyshevDistance(point, c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

export function getClosestFootprintCellToPoint(
  point: GridPosition,
  token: TokenState
): GridPosition | null {
  const cells = getTokenOccupiedCells(token);
  return getClosestCellToPoint(point, cells);
}
