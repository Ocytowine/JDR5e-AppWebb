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
  opaqueCells?: Set<string> | null
): boolean {
  if (isTokenDead(enemy) || isTokenDead(playerToken)) return false;
  return isTargetVisible(enemy, playerToken, allTokens, opaqueCells);
}

export function canEnemyMeleeAttack(
  enemy: { x: number; y: number },
  playerToken: { x: number; y: number }
): boolean {
  return manhattan(enemy, playerToken) <= 1;
}

export function canEnemyAttackPlayer(
  enemy: TokenState,
  playerToken: TokenState
): boolean {
  const range = getAttackRangeForToken(enemy);
  return manhattan(enemy, playerToken) <= range;
}

export function computeFacingTowards(
  from: { x: number; y: number },
  to: { x: number; y: number }
): "up" | "down" | "left" | "right" {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "down" : "up";
}
