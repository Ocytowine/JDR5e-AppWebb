import {
  GRID_COLS,
  GRID_ROWS,
  distanceBetweenGridCells,
  getBoardGridProjectionKind,
  getGridNeighborsForGrid,
  isCellInsideGrid
} from "./boardConfig";
import type { GridPosition, TokenState, MovementProfile } from "./types";
import { getHeightAtGrid, type TerrainCell } from "./game/map/generation/draft";
import { getFloorMaterial } from "./game/map/floors/catalog";
import { isEdgeBlockedForMovement } from "./game/map/walls/runtime";
import {
  getTokenOccupiedCells,
  getTokenOccupiedCellsAt
} from "./game/engine/runtime/footprint";
import { metersToCells } from "./game/engine/runtime/units";

interface PathfindingOptions {
  /**
   * Budget de mouvement (points). Les sols peuvent consommer plus via moveCost.
   */
  maxDistance: number;
  /**
   * Autorise la case cible a etre occupee (utile si la cible
   * est par exemple le joueur que l'on veut engager).
   */
  allowTargetOccupied?: boolean;
  /**
   * Cells occupied by the target (if any). Used to allow overlap
   * when `allowTargetOccupied` is true.
   */
  targetCells?: GridPosition[] | null;
  /**
   * Set of blocked cells (obstacles/walls) encoded as "x,y".
   * Movement profiles with `canPassThroughWalls` can ignore these.
   */
  blockedCells?: Set<string> | null;
  /**
   * Set of playable cells encoded as "x,y".
   * If provided, pathfinding will not enter cells outside this mask.
   */
  playableCells?: Set<string> | null;
  /**
   * Grille logique utilisée pour les bornes.
   * Si non fourni, fallback sur `GRID_COLS/GRID_ROWS`.
   */
  grid?: { cols: number; rows: number } | null;
  /**
   * Carte de hauteur (niveau du sol par case).
   * Si fourni, bloque les cellules hors du niveau actif.
   */
  heightMap?: number[] | null;
  /**
   * Carte des sols (floorId par case).
   * Si fourni, bloque les cellules non passables.
   */
  floorIds?: TerrainCell[] | null;
  /**
   * Niveau actif (0 = sol). Si fourni avec heightMap, filtre la navigation.
   */
  activeLevel?: number | null;
  /**
   * Set of blocked edges encoded as "x,y,dir".
   */
  wallEdges?: Set<string> | null;
}

function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

class MinHeap<T> {
  private items: { value: T; score: number }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(value: T, score: number): void {
    this.items.push({ value, score });
    this.bubbleUp(this.items.length - 1);
  }

  pop(): T | null {
    if (this.items.length === 0) return null;
    const root = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return root.value;
  }

  private bubbleUp(index: number): void {
    let idx = index;
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.items[idx].score >= this.items[parent].score) break;
      [this.items[idx], this.items[parent]] = [this.items[parent], this.items[idx]];
      idx = parent;
    }
  }

  private bubbleDown(index: number): void {
    let idx = index;
    const length = this.items.length;
    while (true) {
      const left = idx * 2 + 1;
      const right = idx * 2 + 2;
      let smallest = idx;
      if (left < length && this.items[left].score < this.items[smallest].score) {
        smallest = left;
      }
      if (right < length && this.items[right].score < this.items[smallest].score) {
        smallest = right;
      }
      if (smallest === idx) break;
      [this.items[idx], this.items[smallest]] = [this.items[smallest], this.items[idx]];
      idx = smallest;
    }
  }
}

function getMovementProfile(entity: TokenState): MovementProfile | null {
  if (entity.movementProfile) {
    return {
      ...entity.movementProfile,
      speed: metersToCells(entity.movementProfile.speed)
    };
  }
  if (typeof entity.moveRange === "number") {
    return {
      type: "ground",
      speed: metersToCells(entity.moveRange),
      directions: 8,
      canPassThroughWalls: false,
      canPassThroughEntities: false,
      canStopOnOccupiedTile: false
    };
  }
  return null;
}

function canEnterCell(
  entity: TokenState,
  profile: MovementProfile | null,
  x: number,
  y: number,
  occupiedByTokens: Set<string>,
  allowTargetOccupied: boolean,
  target: GridPosition,
  targetCells: Set<string> | null,
  blockedCells?: Set<string> | null,
  playableCells?: Set<string> | null,
  grid?: { cols: number; rows: number } | null,
  heightMap?: number[] | null,
  floorIds?: TerrainCell[] | null,
  activeLevel?: number | null
): boolean {
  const cols = grid?.cols ?? GRID_COLS;
  const rows = grid?.rows ?? GRID_ROWS;
  const entityCells = getTokenOccupiedCellsAt(entity, { x, y });
  if (!entityCells.length) return false;

  for (const cell of entityCells) {
    if (!isCellInsideGrid(cell.x, cell.y, cols, rows)) return false;

    if (heightMap && heightMap.length > 0 && typeof activeLevel === "number") {
      const baseHeight = getHeightAtGrid(heightMap, cols, rows, cell.x, cell.y);
      if (baseHeight !== activeLevel) {
        return false;
      }
    }

    if (floorIds && floorIds.length > 0) {
      const idx = cell.y * cols + cell.x;
      if (idx >= 0 && idx < floorIds.length) {
        const floorId = floorIds[idx];
        const mat = getFloorMaterial(floorId);
        if (mat?.passable === false) return false;
      }
    }

    const cellKey = coordKey(cell.x, cell.y);
    if (playableCells && playableCells.size > 0 && !playableCells.has(cellKey)) {
      return false;
    }

    if (blockedCells?.has(cellKey)) {
      if (!profile?.canPassThroughWalls) {
        return false;
      }
    }
  }

  const isTarget = x === target.x && y === target.y;
  const overlaps = entityCells.some(c => occupiedByTokens.has(coordKey(c.x, c.y)));

  if (!overlaps) {
    return true;
  }

  if (isTarget && allowTargetOccupied) {
    if (!targetCells || targetCells.size === 0) return true;
    const allOverlapsAreTarget = entityCells.every(c => {
      const key = coordKey(c.x, c.y);
      return !occupiedByTokens.has(key) || targetCells.has(key);
    });
    if (allOverlapsAreTarget) return true;
  }

  if (!profile) {
    return false;
  }

  if (profile.canPassThroughEntities) {
    if (isTarget && profile.canStopOnOccupiedTile === false) {
      return false;
    }
    return true;
  }

  return false;
}

function getMoveCostForCell(
  x: number,
  y: number,
  cols: number,
  rows: number,
  floorIds?: TerrainCell[] | null
): number {
  if (!floorIds || floorIds.length === 0) return 1;
  const idx = y * cols + x;
  if (idx < 0 || idx >= floorIds.length) return 1;
  const mat = getFloorMaterial(floorIds[idx]);
  const cost = Number(mat?.moveCost ?? 1);
  if (!Number.isFinite(cost) || cost <= 0) return 1;
  return cost;
}

export function computePathTowards(
  entity: TokenState,
  target: GridPosition,
  tokens: TokenState[],
  options: PathfindingOptions
): GridPosition[] {
  const profile = getMovementProfile(entity);
  const maxCost =
    profile && profile.speed > 0
      ? Math.min(options.maxDistance, profile.speed)
      : options.maxDistance;

  const start: GridPosition = { x: entity.x, y: entity.y };

  if (start.x === target.x && start.y === target.y) {
    return [];
  }

  const occupiedByTokens = new Set<string>();
  for (const t of tokens) {
    if (t.id === entity.id || t.hp <= 0) continue;
    for (const c of getTokenOccupiedCells(t)) {
      occupiedByTokens.add(coordKey(c.x, c.y));
    }
  }
  const targetCellsSet =
    options.targetCells && options.targetCells.length > 0
      ? new Set(options.targetCells.map(c => coordKey(c.x, c.y)))
      : null;

  const visited = new Set<string>();
  const parents = new Map<string, string | null>();
  const costs = new Map<string, number>();
  const steps = new Map<string, number>();

  const open = new MinHeap<GridPosition>();

  const startKey = coordKey(start.x, start.y);
  parents.set(startKey, null);
  costs.set(startKey, 0);
  steps.set(startKey, 0);
  open.push(start, 0);

  let foundTargetKey: string | null = null;

  const allowDiagonals = profile?.directions !== 4;
  const isHexGrid = getBoardGridProjectionKind() === "hex";

  const cols = options.grid?.cols ?? GRID_COLS;
  const rows = options.grid?.rows ?? GRID_ROWS;

  while (open.size > 0) {
    const current = open.pop() as GridPosition;
    const currentKey = coordKey(current.x, current.y);
    const currentCost = costs.get(currentKey) ?? 0;
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);

    if (currentCost > maxCost) {
      continue;
    }

    const neighbors = getGridNeighborsForGrid(current, cols, rows, allowDiagonals);
    for (const next of neighbors) {
      const nx = next.x;
      const ny = next.y;
      const key = coordKey(nx, ny);

      if (
        !canEnterCell(
          entity,
          profile,
          nx,
          ny,
          occupiedByTokens,
          options.allowTargetOccupied ?? false,
          target,
          targetCellsSet,
          options.blockedCells ?? null,
          options.playableCells ?? null,
          options.grid ?? null,
          options.heightMap ?? null,
          options.floorIds ?? null,
          options.activeLevel ?? null
        )
      ) {
        continue;
      }

      if (options.wallEdges && isEdgeBlockedForMovement(current, { x: nx, y: ny }, options.wallEdges)) {
        continue;
      }

      const isDiagonal = !isHexGrid && nx !== current.x && ny !== current.y;
      if (isDiagonal) {
        const dir = { x: nx - current.x, y: ny - current.y };
        const sideAOk = canEnterCell(
          entity,
          profile,
          current.x + dir.x,
          current.y,
          occupiedByTokens,
          false,
          target,
          targetCellsSet,
          options.blockedCells ?? null,
          options.playableCells ?? null,
          options.grid ?? null,
          options.heightMap ?? null,
          options.floorIds ?? null,
          options.activeLevel ?? null
        );
        const sideBOk = canEnterCell(
          entity,
          profile,
          current.x,
          current.y + dir.y,
          occupiedByTokens,
          false,
          target,
          targetCellsSet,
          options.blockedCells ?? null,
          options.playableCells ?? null,
          options.grid ?? null,
          options.heightMap ?? null,
          options.floorIds ?? null,
          options.activeLevel ?? null
        );
        if (!sideAOk || !sideBOk) continue;
        if (options.wallEdges) {
          const stepX = { x: current.x + dir.x, y: current.y };
          const stepY = { x: current.x, y: current.y + dir.y };
          const diagonal = { x: nx, y: ny };
          if (isEdgeBlockedForMovement(current, stepX, options.wallEdges)) {
            continue;
          }
          if (isEdgeBlockedForMovement(current, stepY, options.wallEdges)) {
            continue;
          }
          if (isEdgeBlockedForMovement(stepX, diagonal, options.wallEdges)) {
            continue;
          }
          if (isEdgeBlockedForMovement(stepY, diagonal, options.wallEdges)) {
            continue;
          }
        }
      }

      const stepCost = getMoveCostForCell(nx, ny, cols, rows, options.floorIds ?? null);
      const newCost = currentCost + stepCost;
      if (newCost > maxCost) continue;

      const prevCost = costs.get(key);
      if (prevCost === undefined || newCost < prevCost) {
        parents.set(key, currentKey);
        costs.set(key, newCost);
        steps.set(key, (steps.get(currentKey) ?? 0) + 1);
        const node: GridPosition = { x: nx, y: ny };
        const heuristic = distanceBetweenGridCells(node, target);
        open.push(node, newCost + heuristic);
      }

      if (nx === target.x && ny === target.y) {
        foundTargetKey = key;
        break;
      }
    }
    if (foundTargetKey) break;
  }

  let endKey: string | null = foundTargetKey;

  if (!endKey) {
    let bestKey: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    let bestCost = Number.POSITIVE_INFINITY;

    for (const key of costs.keys()) {
      const [sx, sy] = key.split(",").map(Number);
      const d = distanceBetweenGridCells({ x: sx, y: sy }, target);
      const costFromStart = costs.get(key) ?? 0;
      if (costFromStart === 0) continue;
      if (costFromStart > maxCost) continue;
      if (d < bestDist || (d === bestDist && costFromStart < bestCost)) {
        bestDist = d;
        bestCost = costFromStart;
        bestKey = key;
      }
    }

    if (!bestKey) {
      return [];
    }

    endKey = bestKey;
  }

  const pathReversed: GridPosition[] = [];
  let cursor: string | null = endKey;
  while (cursor) {
    const [x, y] = cursor.split(",").map(Number);
    pathReversed.push({ x, y });
    if (cursor === startKey) break;
    cursor = parents.get(cursor) ?? null;
  }

  // path includes the starting cell as first element
  const path = pathReversed.reverse();

  return path;
}


