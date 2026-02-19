// Utilitaires pour les tracés et zones d'effet sur la grille.
// -----------------------------------------------------------
// Ces fonctions travaillent uniquement en coordonnées de grille
// (x, y) et ne connaissent rien de Pixi ou de l'affichage.
// GameBoard s'occupe ensuite de projeter ces cases en isométrique.

import { isCellInsideBoard, isCellInsideGrid } from "./boardConfig";
import {
  GRID_COLS,
  GRID_ROWS,
  distanceBetweenGridCells,
  getBoardHexOptions,
  getBoardGridProjectionKind,
  gridToScreenForGrid
} from "./boardConfig";

const SQRT_3 = Math.sqrt(3);

export type EffectType = "circle" | "rectangle" | "cone" | "line";

export interface GridCell {
  x: number;
  y: number;
}

export interface BoardEffect {
  id: string;
  type: EffectType;
  cells: GridCell[];
}

export interface BoardEffectBoundsOptions {
  /**
   * Masque de cases jouables (limites de la battlemap).
   * Si fourni, il prime sur `grid`.
   */
  playableCells?: Set<string> | null;
  /**
   * Grille logique (cols/rows) utilisée comme bornes si aucun mask.
   * Si absent, fallback sur la grille "par défaut" via `isCellInsideBoard`.
   */
  grid?: { cols: number; rows: number } | null;
}

function allowCell(x: number, y: number, options?: BoardEffectBoundsOptions): boolean {
  const playable = options?.playableCells ?? null;
  if (playable && playable.size > 0) {
    return playable.has(`${x},${y}`);
  }

  const grid = options?.grid ?? null;
  if (grid) {
    return isCellInsideGrid(x, y, grid.cols, grid.rows);
  }

  return isCellInsideBoard(x, y);
}

function getBounds(options?: BoardEffectBoundsOptions): { cols: number; rows: number } {
  const grid = options?.grid ?? null;
  if (grid) {
    return {
      cols: Math.max(1, Math.floor(grid.cols)),
      rows: Math.max(1, Math.floor(grid.rows))
    };
  }
  return { cols: GRID_COLS, rows: GRID_ROWS };
}

function dedupCells(cells: GridCell[]): GridCell[] {
  const map = new Map<string, GridCell>();
  for (const cell of cells) {
    map.set(`${cell.x},${cell.y}`, cell);
  }
  return Array.from(map.values());
}

interface Axial {
  q: number;
  r: number;
}

function offsetToAxial(cell: GridCell): Axial {
  const { offset } = getBoardHexOptions();
  if (offset === "odd-r") {
    return {
      q: cell.x - Math.floor((cell.y - (cell.y & 1)) / 2),
      r: cell.y
    };
  }
  return {
    q: cell.x - Math.floor((cell.y + (cell.y & 1)) / 2),
    r: cell.y
  };
}

function axialToOffset(axial: Axial): GridCell {
  const { offset } = getBoardHexOptions();
  if (offset === "odd-r") {
    return {
      x: axial.q + Math.floor((axial.r - (axial.r & 1)) / 2),
      y: axial.r
    };
  }
  return {
    x: axial.q + Math.floor((axial.r + (axial.r & 1)) / 2),
    y: axial.r
  };
}

// Génère un disque (approximation) de rayon `radius` autour de (cx, cy).
export function generateCircleEffect(
  id: string,
  cx: number,
  cy: number,
  radius: number,
  options?: BoardEffectBoundsOptions
): BoardEffect {
  if (radius <= 0) return { id, type: "circle", cells: [] };
  const kind = getBoardGridProjectionKind();
  if (kind === "hex") {
    const bounds = getBounds(options);
    const cells: GridCell[] = [];
    const scan = Math.max(1, radius * 2 + 2);
    const minX = Math.max(0, cx - scan);
    const maxX = Math.min(bounds.cols - 1, cx + scan);
    const minY = Math.max(0, cy - scan);
    const maxY = Math.min(bounds.rows - 1, cy + scan);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!allowCell(x, y, options)) continue;
        const dist = distanceBetweenGridCells({ x: cx, y: cy }, { x, y });
        if (dist <= radius) cells.push({ x, y });
      }
    }
    return { id, type: "circle", cells: dedupCells(cells) };
  }

  const cells: GridCell[] = [];

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (!allowCell(x, y, options)) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius + 0.01) {
        cells.push({ x, y });
      }
    }
  }

  return { id, type: "circle", cells };
}

// Génère un rectangle centré sur (cx, cy), de largeur/hauteur en cases.
export function generateRectangleEffect(
  id: string,
  cx: number,
  cy: number,
  width: number,
  height: number,
  options?: BoardEffectBoundsOptions
): BoardEffect {
  const kind = getBoardGridProjectionKind();
  if (kind === "hex") {
    // Regle definitive hex v2:
    // rectangle = fenetre axiale (q, r) centree, donc un parallelogramme stable.
    const center = offsetToAxial({ x: cx, y: cy });
    const halfW = Math.floor(width / 2);
    const halfH = Math.floor(height / 2);
    const cells: GridCell[] = [];
    for (let r = center.r - halfH; r <= center.r + halfH; r++) {
      for (let q = center.q - halfW; q <= center.q + halfW; q++) {
        const cell = axialToOffset({ q, r });
        if (!allowCell(cell.x, cell.y, options)) continue;
        cells.push(cell);
      }
    }
    return { id, type: "rectangle", cells: dedupCells(cells) };
  }

  const cells: GridCell[] = [];
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  for (let y = cy - halfH; y <= cy + halfH; y++) {
    for (let x = cx - halfW; x <= cx + halfW; x++) {
      if (!allowCell(x, y, options)) continue;
      cells.push({ x, y });
    }
  }

  return { id, type: "rectangle", cells };
}

export type ConeDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "up-left"
  | "up-right"
  | "down-left"
  | "down-right";

function directionToVector(direction: ConeDirection): { x: number; y: number } {
  switch (direction) {
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "up-left":
      return { x: -1, y: -1 };
    case "up-right":
      return { x: 1, y: -1 };
    case "down-left":
      return { x: -1, y: 1 };
    case "down-right":
      return { x: 1, y: 1 };
    default:
      return { x: 1, y: 0 };
  }
}

function hexDirectionVectorsByOrientation(): Array<{
  axial: Axial;
  screen: { x: number; y: number };
}> {
  const orientation = getBoardHexOptions().orientation;
  const sqrt3 = Math.sqrt(3);
  const vectors = [
    { axial: { q: 1, r: 0 } },
    { axial: { q: 1, r: -1 } },
    { axial: { q: 0, r: -1 } },
    { axial: { q: -1, r: 0 } },
    { axial: { q: -1, r: 1 } },
    { axial: { q: 0, r: 1 } }
  ];
  return vectors.map(v => {
    const q = v.axial.q;
    const r = v.axial.r;
    if (orientation === "flat-top") {
      return {
        axial: v.axial,
        screen: { x: 1.5 * q, y: sqrt3 * (r + q / 2) }
      };
    }
    return {
      axial: v.axial,
      screen: { x: sqrt3 * (q + r / 2), y: 1.5 * r }
    };
  });
}

function resolveHexLineDirection(direction: ConeDirection): Axial {
  const wish = directionToVector(direction);
  const wishLen = Math.hypot(wish.x, wish.y) || 1;
  const candidates = hexDirectionVectorsByOrientation();
  let best = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const cLen = Math.hypot(candidate.screen.x, candidate.screen.y) || 1;
    const score =
      (wish.x * candidate.screen.x + wish.y * candidate.screen.y) / (wishLen * cLen);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best.axial;
}

function resolveHexFacingScreenVector(direction: ConeDirection): { x: number; y: number } {
  const axial = resolveHexLineDirection(direction);
  const orientation = getBoardHexOptions().orientation;
  if (orientation === "flat-top") {
    return { x: 1.5 * axial.q, y: SQRT_3 * (axial.r + axial.q / 2) };
  }
  return { x: SQRT_3 * (axial.q + axial.r / 2), y: 1.5 * axial.r };
}

// Génère un cône très simple partant de (cx, cy) dans une direction donnée.
// Cette approximation est suffisante pour un premier rendu visuel.
export function generateConeEffect(
  id: string,
  cx: number,
  cy: number,
  range: number,
  direction: ConeDirection,
  apertureDeg?: number,
  options?: BoardEffectBoundsOptions
): BoardEffect {
  if (range <= 0) return { id, type: "cone", cells: [] };
  const kind = getBoardGridProjectionKind();

  const cells: GridCell[] = [];

  const angle =
    typeof apertureDeg === "number" && apertureDeg > 0
      ? Math.min(180, apertureDeg)
      : 90;
  const halfAngleRad = (angle * Math.PI) / 360;
  const cosMin = Math.cos(halfAngleRad);
  const dirVector = kind === "hex" ? resolveHexFacingScreenVector(direction) : directionToVector(direction);

  const dirLen = Math.hypot(dirVector.x, dirVector.y);

  if (kind === "hex") {
    const bounds = getBounds(options);
    const center = gridToScreenForGrid(cx, cy, bounds.cols, bounds.rows);
    const scan = Math.max(1, range * 2 + 2);
    const minX = Math.max(0, cx - scan);
    const maxX = Math.min(bounds.cols - 1, cx + scan);
    const minY = Math.max(0, cy - scan);
    const maxY = Math.min(bounds.rows - 1, cy + scan);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x === cx && y === cy) continue;
        if (!allowCell(x, y, options)) continue;
        const distCells = distanceBetweenGridCells({ x: cx, y: cy }, { x, y });
        if (distCells > range) continue;
        const p = gridToScreenForGrid(x, y, bounds.cols, bounds.rows);
        const vx = p.x - center.x;
        const vy = p.y - center.y;
        const vLen = Math.hypot(vx, vy);
        if (vLen <= 1e-6) continue;
        const dot = dirVector.x * vx + dirVector.y * vy;
        const cosTheta = dot / (dirLen * vLen);
        if (cosTheta < cosMin) continue;
        cells.push({ x, y });
      }
    }

    return { id, type: "cone", cells: dedupCells(cells) };
  }

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (dx === 0 && dy === 0) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > range + 1e-6) continue;

      const dot = dirVector.x * dx + dirVector.y * dy;
      const cosTheta = dot / (dirLen * dist);
      if (cosTheta < cosMin) continue;

      const x = cx + dx;
      const y = cy + dy;
      if (!allowCell(x, y, options)) continue;
      cells.push({ x, y });
    }
  }

  return { id, type: "cone", cells };
}

export function generateLineEffect(
  id: string,
  cx: number,
  cy: number,
  range: number,
  direction: ConeDirection,
  options?: BoardEffectBoundsOptions
): BoardEffect {
  if (range < 0) return { id, type: "line", cells: [] };
  const kind = getBoardGridProjectionKind();
  const cells: GridCell[] = [];

  if (kind === "hex") {
    const start = offsetToAxial({ x: cx, y: cy });
    const step = resolveHexLineDirection(direction);
    for (let i = 0; i <= range; i++) {
      const cell = axialToOffset({ q: start.q + step.q * i, r: start.r + step.r * i });
      if (!allowCell(cell.x, cell.y, options)) continue;
      cells.push(cell);
    }
    return { id, type: "line", cells: dedupCells(cells) };
  }

  const dir = directionToVector(direction);
  for (let i = 0; i <= range; i++) {
    const x = cx + Math.round(dir.x * i);
    const y = cy + Math.round(dir.y * i);
    if (!allowCell(x, y, options)) continue;
    cells.push({ x, y });
  }
  return { id, type: "line", cells: dedupCells(cells) };
}
