import type { GridPosition } from "../../types";
import type { DecorInstance } from "../decorTypes";
import type {
  ObstacleInstance,
  ObstacleTypeDefinition,
  ObstacleRotationDeg
} from "../obstacleTypes";
import type { WallInstance, WallRotationDeg, WallTypeDefinition, WallState } from "../wallTypes";
import { getObstacleOccupiedCells } from "../obstacleRuntime";
import { getWallOccupiedCells } from "../wallRuntime";

// ------------------------------------------------------------
// MapDraft: état intermédiaire "multi-couches"
// ------------------------------------------------------------
// Idée:
// - obstacle/instances (déjà utilisées par le gameplay)
// - terrain (eau/boue/route...), hauteur, lumière (futur)
// - un log de génération lisible (debug)

export type TerrainCell =
  | "floor"
  | "grass"
  | "dirt"
  | "stone"
  | "water"
  | "road"
  | "unknown";

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
  walls: WallInstance[];
  wallOccupied: Set<string>;
  decorations: DecorInstance[];
  decorOccupied: Set<string>;

  reserved: Set<string>;
  log: string[];

  nextObstacleId: () => string;
  nextWallId: () => string;
  nextDecorId: () => string;
}

export function key(x: number, y: number): string {
  return `${x},${y}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveTokenScale(
  type: ObstacleTypeDefinition | null,
  override?: number
): number | null {
  if (!type) return null;
  const scaleSpec = type.appearance?.tokenScale;
  const hasOverride = typeof override === "number" && Number.isFinite(override);
  const min = scaleSpec && Number.isFinite(scaleSpec.min) ? scaleSpec.min : null;
  const max = scaleSpec && Number.isFinite(scaleSpec.max) ? scaleSpec.max : null;
  const def = scaleSpec && Number.isFinite(scaleSpec.default) ? scaleSpec.default : null;
  let chosen: number | null = null;

  if (hasOverride) {
    chosen = override as number;
  } else if (min !== null && max !== null) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    chosen = lo + (hi - lo) * Math.random();
  } else if (def !== null) {
    chosen = def;
  }

  if (chosen === null) return null;
  if (min !== null || max !== null) {
    const lo = min ?? chosen;
    const hi = max ?? chosen;
    chosen = clamp(chosen, Math.min(lo, hi), Math.max(lo, hi));
  }
  return chosen;
}

export function isInside(draft: MapDraft, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < draft.cols && y < draft.rows;
}

export function indexOf(draft: MapDraft, x: number, y: number): number {
  return y * draft.cols + x;
}

export function getTerrainAt(draft: MapDraft, x: number, y: number): TerrainCell | null {
  if (!isInside(draft, x, y)) return null;
  return draft.layers.terrain[indexOf(draft, x, y)] ?? null;
}

export function getHeightAtGrid(
  height: number[],
  cols: number,
  rows: number,
  x: number,
  y: number
): number {
  if (!height || height.length === 0) return 0;
  if (x < 0 || y < 0 || x >= cols || y >= rows) return 0;
  const value = height[y * cols + x];
  return Number.isFinite(value) ? value : 0;
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
    walls: [],
    wallOccupied: new Set<string>(),
    decorations: [],
    decorOccupied: new Set<string>(),
    reserved: params.reserved ?? new Set<string>(),
    log: [],
    nextObstacleId: () => `${prefix}-${seq++}`,
    nextWallId: () => `wall-${seq++}`,
    nextDecorId: () => `decor-${seq++}`
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

export function scatterTerrainPatches(params: {
  draft: MapDraft;
  rand: () => number;
  terrain: TerrainCell;
  count: number;
  radiusMin: number;
  radiusMax: number;
  mask?: Set<string>;
}): void {
  const { draft, rand, terrain, mask } = params;
  const count = Math.max(0, Math.floor(params.count));
  if (count === 0) return;
  const rMin = Math.max(1, Math.floor(params.radiusMin));
  const rMax = Math.max(rMin, Math.floor(params.radiusMax));

  for (let i = 0; i < count; i++) {
    const cx = Math.floor(rand() * draft.cols);
    const cy = Math.floor(rand() * draft.rows);
    const radius = rMin + Math.floor(rand() * (rMax - rMin + 1));
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius + 0.15) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!isInside(draft, x, y)) continue;
        const k = key(x, y);
        if (mask && !mask.has(k)) continue;
        setTerrain(draft, x, y, terrain);
      }
    }
  }
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
  tokenScale?: number;
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
    tokenScale: (() => {
      const resolved = resolveTokenScale(type, params.tokenScale);
      return resolved === null ? undefined : Math.round(resolved);
    })(),
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

export function tryPlaceWall(params: {
  draft: MapDraft;
  type: WallTypeDefinition | null;
  x: number;
  y: number;
  variantId: string;
  rotation: WallRotationDeg;
  state?: WallState;
  allowOnReserved?: boolean;
}): boolean {
  const { draft, type, x, y, variantId, rotation } = params;
  if (!type) return false;

  const instance: WallInstance = {
    id: draft.nextWallId(),
    typeId: type.id,
    variantId,
    x,
    y,
    rotation,
    state: params.state
  };

  const cells = getWallOccupiedCells(instance, type);
  if (!cells.length) return false;

  const enforcePlayable = draft.playable.size > 0;
  for (const c of cells) {
    if (!isInside(draft, c.x, c.y)) return false;
    const k = key(c.x, c.y);
    if (enforcePlayable && !draft.playable.has(k)) return false;
    if (!params.allowOnReserved && draft.reserved.has(k)) return false;
    if (draft.occupied.has(k)) return false;
  }

  draft.walls.push(instance);
  for (const c of cells) {
    const k = key(c.x, c.y);
    draft.wallOccupied.add(k);
    draft.occupied.add(k);
    if (type.blocking?.movement) draft.movementBlocked.add(k);
  }

  return true;
}

export function tryPlaceDecor(params: {
  draft: MapDraft;
  spriteKey: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  allowOnReserved?: boolean;
}): boolean {
  const { draft, spriteKey, x, y } = params;
  if (!spriteKey) return false;
  if (!isInside(draft, x, y)) return false;
  const k = key(x, y);
  const enforcePlayable = draft.playable.size > 0;
  if (enforcePlayable && !draft.playable.has(k)) return false;
  if (!params.allowOnReserved && draft.reserved.has(k)) return false;
  if (draft.occupied.has(k)) return false;
  if (draft.decorOccupied.has(k)) return false;

  const instance: DecorInstance = {
    id: draft.nextDecorId(),
    spriteKey,
    x,
    y,
    rotation: typeof params.rotation === "number" ? params.rotation : 0,
    scale: typeof params.scale === "number" ? params.scale : 1,
    layer: "ground"
  };

  draft.decorations.push(instance);
  draft.decorOccupied.add(k);
  return true;
}

export function scatterDecorations(params: {
  draft: MapDraft;
  rand: () => number;
  spriteKeys: string[];
  count: number;
  terrainFilter?: TerrainCell[];
  mask?: Set<string>;
}): void {
  const { draft, rand } = params;
  const count = Math.max(0, Math.floor(params.count));
  if (!count) return;
  const spriteKeys = params.spriteKeys.filter(Boolean);
  if (!spriteKeys.length) return;
  const terrainFilter = params.terrainFilter ?? null;
  const mask = params.mask ?? null;

  let placed = 0;
  let attempts = 0;
  const maxAttempts = Math.max(50, count * 20);
  while (placed < count && attempts < maxAttempts) {
    attempts++;
    const x = Math.floor(rand() * draft.cols);
    const y = Math.floor(rand() * draft.rows);
    const k = key(x, y);
    if (mask && !mask.has(k)) continue;
    if (terrainFilter) {
      const terrain = getTerrainAt(draft, x, y);
      if (!terrain || !terrainFilter.includes(terrain)) continue;
    }
    const spriteKey = spriteKeys[Math.floor(rand() * spriteKeys.length)] as string;
    const ok = tryPlaceDecor({ draft, spriteKey, x, y });
    if (ok) placed++;
  }
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
