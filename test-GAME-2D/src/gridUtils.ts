import { isCellInsideBoard } from "./boardConfig";
import type { GridPosition, TokenState } from "./types";
import { getTokenOccupiedCells } from "./game/engine/runtime/footprint";

function key(pos: GridPosition): string {
  return `${pos.x},${pos.y}`;
}

export function samePos(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

export function isInsideBoard(pos: GridPosition): boolean {
  return isCellInsideBoard(pos.x, pos.y);
}

export function isCellOccupied(
  pos: GridPosition,
  tokens: TokenState[],
  ignoreId?: string
): boolean {
  return tokens.some(t => {
    if (t.id === ignoreId || t.hp <= 0) return false;
    return getTokenOccupiedCells(t).some(c => c.x === pos.x && c.y === pos.y);
  });
}

export function buildOccupancyMap(
  tokens: TokenState[]
): Map<string, TokenState> {
  const map = new Map<string, TokenState>();
  for (const t of tokens) {
    if (t.hp <= 0) continue;
    for (const c of getTokenOccupiedCells(t)) {
      map.set(key(c), t);
    }
  }
  return map;
}

export function getTokenAt(
  pos: GridPosition,
  tokens: TokenState[]
): TokenState | null {
  return (
    tokens.find(t => {
      if (t.hp <= 0) return false;
      return getTokenOccupiedCells(t).some(c => c.x === pos.x && c.y === pos.y);
    }) ?? null
  );
}


