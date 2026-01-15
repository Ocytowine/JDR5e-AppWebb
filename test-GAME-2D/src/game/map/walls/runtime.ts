import type { GridPosition } from "../../../types";
import type { WallSegment, WallKind } from "./types";
import { edgeBetweenCells, wallEdgeKey, wallEdgeKeyForSegment, getAdjacentCellsForEdge } from "./grid";

export interface WallEdgeSets {
  movement: Set<string>;
  vision: Map<string, WallSegment>;
  attacks: Set<string>;
}

function isBlockingKind(kind: WallKind, state?: string): boolean {
  if (kind === "door") return state !== "open";
  return true;
}

export function buildWallEdgeSets(walls: WallSegment[]): WallEdgeSets {
  const movement = new Set<string>();
  const attacks = new Set<string>();
  const vision = new Map<string, WallSegment>();

  for (const seg of walls) {
    const key = wallEdgeKeyForSegment(seg);
    if (seg.kind === "door" && seg.state === "open") continue;
    movement.add(key);
    attacks.add(key);
    vision.set(key, seg);
  }

  return { movement, vision, attacks };
}

export function isEdgeBlockedForMovement(
  from: GridPosition,
  to: GridPosition,
  movementEdges: Set<string>
): boolean {
  const edge = edgeBetweenCells(from, to);
  if (!edge) return false;
  const key = wallEdgeKey(edge.x, edge.y, edge.dir);
  return movementEdges.has(key);
}

export function isEdgeBlockedForAttack(
  from: GridPosition,
  to: GridPosition,
  attackEdges: Set<string>
): boolean {
  const edge = edgeBetweenCells(from, to);
  if (!edge) return false;
  const key = wallEdgeKey(edge.x, edge.y, edge.dir);
  return attackEdges.has(key);
}

export function isEdgeBlockingVision(
  from: GridPosition,
  to: GridPosition,
  observer: GridPosition,
  visionEdges: Map<string, WallSegment>
): boolean {
  const edge = edgeBetweenCells(from, to);
  if (!edge) return false;
  const key = wallEdgeKey(edge.x, edge.y, edge.dir);
  const seg = visionEdges.get(key);
  if (!seg) return false;
  if (seg.kind === "door" && seg.state === "open") return false;
  if (seg.kind === "low") {
    const cells = getAdjacentCellsForEdge(edge);
    const isAdjacent =
      (cells.a.x === observer.x && cells.a.y === observer.y) ||
      (cells.b.x === observer.x && cells.b.y === observer.y);
    if (isAdjacent) return false;
  }
  return true;
}

export function computeClosedCells(params: {
  cols: number;
  rows: number;
  playableCells?: Set<string> | null;
  walls: WallSegment[];
}): Set<string> {
  const { cols, rows } = params;
  const playable = params.playableCells ?? null;
  const edgeBlocks = new Set<string>();

  for (const seg of params.walls) {
    const blocks = seg.kind === "wall" || (seg.kind === "door" && seg.state !== "open");
    if (!blocks) continue;
    edgeBlocks.add(wallEdgeKeyForSegment(seg));
  }

  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows;
  const isPlayable = (x: number, y: number) => {
    if (!inside(x, y)) return false;
    if (!playable || playable.size === 0) return true;
    return playable.has(`${x},${y}`);
  };

  const visited = new Set<string>();
  const queue: GridPosition[] = [];

  for (let x = 0; x < cols; x++) {
    for (const y of [0, rows - 1]) {
      if (!isPlayable(x, y)) continue;
      const k = `${x},${y}`;
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push({ x, y });
    }
  }
  for (let y = 0; y < rows; y++) {
    for (const x of [0, cols - 1]) {
      if (!isPlayable(x, y)) continue;
      const k = `${x},${y}`;
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push({ x, y });
    }
  }

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
      if (!isPlayable(nx, ny)) continue;
      const edge = edgeBetweenCells(cur, { x: nx, y: ny });
      if (edge) {
        const edgeKey = wallEdgeKey(edge.x, edge.y, edge.dir);
        if (edgeBlocks.has(edgeKey)) continue;
      }
      const k = `${nx},${ny}`;
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push({ x: nx, y: ny });
    }
  }

  const closed = new Set<string>();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!isPlayable(x, y)) continue;
      const k = `${x},${y}`;
      if (!visited.has(k)) closed.add(k);
    }
  }

  return closed;
}
