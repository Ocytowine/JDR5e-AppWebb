import type { TokenState } from "../types";
import { isTargetVisible } from "../vision";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function manhattan(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function gridDistance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function isTokenDead(token: TokenState): boolean {
  return token.hp <= 0;
}

export function getAttackRangeForToken(token: TokenState): number {
  if (typeof token.attackRange === "number" && token.attackRange > 0) {
    return token.attackRange;
  }
  return 1;
}

export function getMaxAttacksForToken(token: TokenState): number {
  if (
    typeof token.maxAttacksPerTurn === "number" &&
    token.maxAttacksPerTurn > 0
  ) {
    return token.maxAttacksPerTurn;
  }
  return 1;
}

export function canEnemySeePlayer(
  enemy: TokenState,
  playerToken: TokenState,
  allTokens: TokenState[],
  opaqueCells?: Set<string> | null,
  playableCells?: Set<string> | null,
  wallVisionEdges?: Map<string, import("../map/walls/types").WallSegment> | null
): boolean {
  if (isTokenDead(enemy) || isTokenDead(playerToken)) return false;
  return isTargetVisible(
    enemy,
    playerToken,
    allTokens,
    opaqueCells,
    playableCells,
    wallVisionEdges ?? null
  );
}

export function canEnemyMeleeAttack(
  enemy: { x: number; y: number },
  playerToken: { x: number; y: number }
): boolean {
  return gridDistance(enemy, playerToken) <= 1;
}

export function canEnemyAttackPlayer(
  enemy: TokenState,
  playerToken: TokenState
): boolean {
  const range = getAttackRangeForToken(enemy);
  return gridDistance(enemy, playerToken) <= range;
}

export function computeFacingTowards(
  from: { x: number; y: number },
  to: { x: number; y: number }
): "up" | "down" | "left" | "right" | "up-left" | "up-right" | "down-left" | "down-right" {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (dx === 0 && dy === 0) {
    return "right";
  }
  if (dx === 0) {
    return dy >= 0 ? "down" : "up";
  }
  if (dy === 0) {
    return dx >= 0 ? "right" : "left";
  }
  if (dx > 0 && dy > 0) return "down-right";
  if (dx > 0 && dy < 0) return "up-right";
  if (dx < 0 && dy > 0) return "down-left";
  return "up-left";
}
