import type { GridPosition } from "../../types";
import type {
  ObstacleInstance,
  ObstacleTypeDefinition,
  ObstacleRotationDeg
} from "../obstacleTypes";
import { getObstacleOccupiedCells } from "../obstacleRuntime";

// ------------------------------------------------------------
// MapDraft: état intermédiaire "multi-couches"
// ------------------------------------------------------------
// Idée:
// - obstacle/instances (déjà utilisées par le gameplay)
// - terrain (eau/boue/route...), hauteur, lumière (futur)
// - un log de génération lisible (debug)

export type TerrainCell = "floor" | "grass" | "water" | "road" | "unknown";

export interface MapLayers {
  terrain: TerrainCell[];
  height: number[];
  light: number[]; // 0..1
}

export interface MapDraft {
  cols: number;
  rows: number;
  layers: MapLayers;

  /**
   * Masque des cases jouables (limites de la battlemap).
   * Si vide, on considère que toute la grille est jouable.
   */
  playable: Set<string>;

  obstacles: ObstacleInstance[];
  occupied: Set<string>;
  movementBlocked: Set<string>;

  reserved: Set<string>;
  log: string[];

  nextObstacleId: () => string;
}

export function key(x: number, y: number): string {
  return `${x},${y}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function isInside(draft: MapDraft, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < draft.cols && y < draft.rows;
}

export function indexOf(draft: MapDraft, x: number, y: number): number {
  return y * draft.cols + x;
}

export function createDraft(params: {
  cols: number;
  rows: number;
  reserved?: Set<string>;
  seedPrefix?: string;
}): MapDraft {
  const cols = Math.max(1, params.cols);
  const rows = Math.max(1, params.rows);
  const size = cols * rows;

  const layers: MapLayers = {
    terrain: Array.from({ length: size }, () => "unknown"),
    height: Array.from({ length: size }, () => 0),
    light: Array.from({ length: size }, () => 1)
  };

  let seq = 1;
  const prefix = params.seedPrefix ?? "obs";

  const playable = new Set<string>();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      playable.add(key(x, y));
    }
  }

  return {
    cols,
    rows,
    layers,
    playable,
    obstacles: [],
    occupied: new Set<string>(),
    movementBlocked: new Set<string>(),
    reserved: params.reserved ?? new Set<string>(),
    log: [],
    nextObstacleId: () => `${prefix}-${seq++}`
  };
}

export function buildReservedRadius(
  center: GridPosition,
  radius: number,
  cols: number,
  rows: number
): Set<string> {
  const reserved = new Set<string>();
  const r = Math.max(0, Math.floor(radius));
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > r) continue;
      const x = center.x + dx;
      const y = center.y + dy;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      reserved.add(key(x, y));
    }
  }
  return reserved;
}

export function setTerrain(draft: MapDraft, x: number, y: number, cell: TerrainCell): void {
  if (!isInside(draft, x, y)) return;
  draft.layers.terrain[indexOf(draft, x, y)] = cell;
}

export function setHeight(draft: MapDraft, x: number, y: number, h: number): void {
  if (!isInside(draft, x, y)) return;
  draft.layers.height[indexOf(draft, x, y)] = h;
}

export function setLight(draft: MapDraft, x: number, y: number, value01: number): void {
  if (!isInside(draft, x, y)) return;
  draft.layers.light[indexOf(draft, x, y)] = clamp(value01, 0, 1);
}

export function tryPlaceObstacle(params: {
  draft: MapDraft;
  type: ObstacleTypeDefinition | null;
  x: number;
  y: number;
  variantId: string;
  rotation: ObstacleRotationDeg;
  allowOnReserved?: boolean;
}): boolean {
  const { draft, type, x, y, variantId, rotation } = params;
  if (!type) return false;

  const maxHp = Math.max(1, Number(type.durability?.maxHp ?? 1));
  const instance: ObstacleInstance = {
    id: draft.nextObstacleId(),
    typeId: type.id,
    variantId,
    x,
    y,
    rotation,
    hp: maxHp,
    maxHp
  };

  const cells = getObstacleOccupiedCells(instance, type);
  if (!cells.length) return false;

  const enforcePlayable = draft.playable.size > 0;
  for (const c of cells) {
    if (!isInside(draft, c.x, c.y)) return false;
    const k = key(c.x, c.y);
    if (enforcePlayable && !draft.playable.has(k)) return false;
    if (!params.allowOnReserved && draft.reserved.has(k)) return false;
    if (draft.occupied.has(k)) return false;
  }

  draft.obstacles.push(instance);
  for (const c of cells) {
    const k = key(c.x, c.y);
    draft.occupied.add(k);
    if (type.blocking?.movement) draft.movementBlocked.add(k);
  }

  return true;
}

export function computeReachableCells(draft: MapDraft, start: GridPosition): Set<string> {
  const reachable = new Set<string>();
  if (!isInside(draft, start.x, start.y)) return reachable;

  const startKey = key(start.x, start.y);
  if (draft.movementBlocked.has(startKey)) return reachable;

  const queue: GridPosition[] = [start];
  reachable.add(startKey);

  const dirs: GridPosition[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];

  while (queue.length) {
    const cur = queue.shift() as GridPosition;
    for (const d of dirs) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      if (!isInside(draft, nx, ny)) continue;
      const k = key(nx, ny);
      if (reachable.has(k)) continue;
      if (draft.movementBlocked.has(k)) continue;
      reachable.add(k);
      queue.push({ x: nx, y: ny });
    }
  }

  return reachable;
}
