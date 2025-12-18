import { GRID_COLS, GRID_ROWS, isCellInsideBoard } from "./boardConfig";
import type { GridPosition, TokenState, MovementProfile } from "./types";

interface PathfindingOptions {
  maxDistance: number;
  /**
   * Autorise la case cible a etre occupee (utile si la cible
   * est par exemple le joueur que l'on veut engager).
   */
  allowTargetOccupied?: boolean;
  /**
   * Set of blocked cells (obstacles/walls) encoded as "x,y".
   * Movement profiles with `canPassThroughWalls` can ignore these.
   */
  blockedCells?: Set<string> | null;
}

function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

function getMovementProfile(entity: TokenState): MovementProfile | null {
  if (entity.movementProfile) return entity.movementProfile;
  if (typeof entity.moveRange === "number") {
    return {
      type: "ground",
      speed: entity.moveRange,
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
  tokens: TokenState[],
  allowTargetOccupied: boolean,
  target: GridPosition,
  blockedCells?: Set<string> | null
): boolean {
  if (x < 0 || y < 0 || x >= GRID_COLS || y >= GRID_ROWS) return false;
  if (!isCellInsideBoard(x, y)) return false;

  const isTarget = x === target.x && y === target.y;

  const cellKey = coordKey(x, y);
  if (blockedCells?.has(cellKey)) {
    if (!profile?.canPassThroughWalls) {
      return false;
    }
  }

  const occupiedByOther = tokens.some(
    t => t.id !== entity.id && t.hp > 0 && t.x === x && t.y === y
  );

  if (!occupiedByOther) {
    return true;
  }

  if (isTarget && allowTargetOccupied) {
    return true;
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

export function computePathTowards(
  entity: TokenState,
  target: GridPosition,
  tokens: TokenState[],
  options: PathfindingOptions
): GridPosition[] {
  const profile = getMovementProfile(entity);
  const maxSteps =
    profile && profile.speed > 0
      ? Math.min(options.maxDistance, profile.speed)
      : options.maxDistance;

  const start: GridPosition = { x: entity.x, y: entity.y };

  if (start.x === target.x && start.y === target.y) {
    return [];
  }

  const visited = new Set<string>();
  const parents = new Map<string, string | null>();
  const distances = new Map<string, number>();

  const queue: GridPosition[] = [];

  const startKey = coordKey(start.x, start.y);
  visited.add(startKey);
  parents.set(startKey, null);
  distances.set(startKey, 0);
  queue.push(start);

  let foundTargetKey: string | null = null;

  const dirs: GridPosition[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];

  while (queue.length > 0) {
    const current = queue.shift() as GridPosition;
    const currentKey = coordKey(current.x, current.y);
    const currentDist = distances.get(currentKey) ?? 0;

    if (currentDist >= maxSteps) {
      continue;
    }

    for (const dir of dirs) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      const key = coordKey(nx, ny);
      if (visited.has(key)) continue;

      if (
        !canEnterCell(
          entity,
          profile,
          nx,
          ny,
          tokens,
          options.allowTargetOccupied ?? false,
          target,
          options.blockedCells ?? null
        )
      ) {
        continue;
      }

      visited.add(key);
      parents.set(key, currentKey);
      distances.set(key, currentDist + 1);
      const node: GridPosition = { x: nx, y: ny };
      queue.push(node);

      if (nx === target.x && ny === target.y) {
        foundTargetKey = key;
        queue.length = 0;
        break;
      }
    }
  }

  let endKey: string | null = foundTargetKey;

  if (!endKey) {
    let bestKey: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const key of visited) {
      const [sx, sy] = key.split(",").map(Number);
      const d =
        Math.abs(sx - target.x) + Math.abs(sy - target.y);
      const stepsFromStart = distances.get(key) ?? 0;
      if (stepsFromStart === 0) continue;
      if (stepsFromStart > maxSteps) continue;
      if (d < bestDist) {
        bestDist = d;
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

  // Ensure that the number of steps (cells - 1) does not exceed maxSteps
  const maxNodes = maxSteps + 1;
  if (path.length > maxNodes) {
    return path.slice(0, maxNodes);
  }

  return path;
}
