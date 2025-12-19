import type { GridPosition } from "../../types";
import type { EnemyTypeDefinition } from "../enemyTypes";
import type { MapDraft } from "./draft";
import { clamp, key, computeReachableCells } from "./draft";

function chooseEnemyType(enemyTypes: EnemyTypeDefinition[], rand: () => number) {
  if (enemyTypes.length === 0) return null;
  return enemyTypes[Math.floor(rand() * enemyTypes.length)] ?? enemyTypes[0];
}

export function spawnEnemies(params: {
  draft: MapDraft;
  playerStart: GridPosition;
  enemyCount: number;
  enemyTypes: EnemyTypeDefinition[];
  rand: () => number;
}): { enemySpawns: { enemyType: EnemyTypeDefinition; position: GridPosition }[]; log: string[] } {
  const { draft, playerStart, enemyTypes, rand } = params;
  const log: string[] = [];

  const enemySpawns: { enemyType: EnemyTypeDefinition; position: GridPosition }[] = [];
  const enemyCount = clamp(params.enemyCount, 1, 20);

  const reachable = computeReachableCells(draft, playerStart);

  const scoreCell = (x: number, y: number) =>
    Math.abs(x - playerStart.x) + Math.abs(y - playerStart.y) + rand() * 0.25;

  const candidates: GridPosition[] = [];
  for (let y = 0; y < draft.rows; y++) {
    for (let x = 0; x < draft.cols; x++) {
      if (draft.occupied.has(key(x, y))) continue;
      if (draft.playable.size > 0 && !draft.playable.has(key(x, y))) continue;
      if (x === playerStart.x && y === playerStart.y) continue;
      if (reachable.size > 0 && !reachable.has(key(x, y))) continue;
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) {
    // fallback: au moins placer quelque part
    for (let y = 0; y < draft.rows; y++) {
      for (let x = 0; x < draft.cols; x++) {
        if (draft.occupied.has(key(x, y))) continue;
        if (draft.playable.size > 0 && !draft.playable.has(key(x, y))) continue;
        if (x === playerStart.x && y === playerStart.y) continue;
        candidates.push({ x, y });
      }
    }
    log.push("Spawns: fallback (aucune case atteignable libre).");
  }

  candidates.sort((a, b) => scoreCell(b.x, b.y) - scoreCell(a.x, a.y));

  for (let i = 0; i < enemyCount; i++) {
    const enemyType = chooseEnemyType(enemyTypes, rand);
    if (!enemyType) break;
    const pos = candidates.find(c => !enemySpawns.some(e => e.position.x === c.x && e.position.y === c.y));
    if (!pos) break;
    enemySpawns.push({ enemyType, position: pos });
  }

  log.push(`Spawns: ${enemySpawns.length}/${enemyCount} ennemis.`);
  return { enemySpawns, log };
}
