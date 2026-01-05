import {
  generateCircleEffect,
  generateConeEffect,
  type BoardEffect,
  type ConeDirection
} from "./boardEffects";
import type {
  GridPosition,
  TokenState,
  VisionProfile
} from "./types";
import { hasLineOfSight } from "./lineOfSight";

const DEFAULT_VISION_RANGE = 30;

const DEFAULT_CONE_VISION: VisionProfile = {
  shape: "cone",
  range: DEFAULT_VISION_RANGE
};

export function getFacingForToken(token: TokenState): ConeDirection {
  if (token.facing) {
    return token.facing;
  }
  // Convention simple:
  // - le joueur regarde vers la droite au debut.
  // - les ennemis regardent vers la gauche (vers la zone de depart du joueur).
  if (token.type === "player") {
    return "right";
  }
  return "left";
}

export function getVisionProfileForToken(token: TokenState): VisionProfile {
  if (token.visionProfile) {
    return token.visionProfile;
  }
  // Par defaut, tout le monde a une vision conique modeste.
  return DEFAULT_CONE_VISION;
}

export function computeVisionEffectForToken(
  token: TokenState,
  playableCells?: Set<string> | null
): BoardEffect {
  const profile = getVisionProfileForToken(token);
  const facing = getFacingForToken(token);
  const id = `vision-${token.id}`;

  if (profile.range <= 0) {
    return {
      id,
      type: profile.shape === "circle" ? "circle" : "cone",
      cells: []
    };
  }

  if (profile.shape === "circle") {
    return generateCircleEffect(id, token.x, token.y, profile.range, {
      playableCells: playableCells ?? null
    });
  }

  return generateConeEffect(
    id,
    token.x,
    token.y,
    profile.range,
    facing,
    profile.apertureDeg,
    { playableCells: playableCells ?? null }
  );
}

function key(pos: GridPosition): string {
  return `${pos.x},${pos.y}`;
}

export function isCellVisible(
  observer: TokenState,
  cell: GridPosition,
  opaqueCells?: Set<string> | null,
  playableCells?: Set<string> | null
): boolean {
  if (playableCells && playableCells.size > 0) {
    if (!playableCells.has(key(cell))) return false;
    if (!playableCells.has(key({ x: observer.x, y: observer.y }))) return false;
  }

  const effect = computeVisionEffectForToken(observer, playableCells ?? null);
  if (!effect.cells.length) return false;

  const cellKey = key(cell);
  for (const c of effect.cells) {
    if (playableCells && playableCells.size > 0 && !playableCells.has(key(c))) {
      continue;
    }
    if (key(c) === cellKey) {
      if (opaqueCells && opaqueCells.size > 0) {
        return hasLineOfSight(
          { x: observer.x, y: observer.y },
          { x: cell.x, y: cell.y },
          opaqueCells
        );
      }
      return true;
    }
  }

  return false;
}

export function getEntitiesInVision(
  observer: TokenState,
  allTokens: TokenState[],
  opaqueCells?: Set<string> | null,
  playableCells?: Set<string> | null
): TokenState[] {
  const effect = computeVisionEffectForToken(observer, playableCells ?? null);
  if (!effect.cells.length) return [];

  const cells = new Set<string>();
  for (const cell of effect.cells) {
    const k = key(cell);
    if (playableCells && playableCells.size > 0 && !playableCells.has(k)) continue;
    cells.add(k);
  }

  const candidates = allTokens.filter(
    t =>
      t.id !== observer.id &&
      t.hp > 0 &&
      cells.has(key({ x: t.x, y: t.y }))
  );

  const filteredByPlayable =
    playableCells && playableCells.size > 0
      ? candidates.filter(t => playableCells.has(key({ x: t.x, y: t.y })))
      : candidates;

  if (!opaqueCells || opaqueCells.size === 0) return filteredByPlayable;

  return filteredByPlayable.filter(t =>
    hasLineOfSight(
      { x: observer.x, y: observer.y },
      { x: t.x, y: t.y },
      opaqueCells
    )
  );
}

export function isTargetVisible(
  observer: TokenState,
  target: TokenState,
  allTokens: TokenState[],
  opaqueCells?: Set<string> | null,
  playableCells?: Set<string> | null
): boolean {
  if (target.hp <= 0) return false;
  if (playableCells && playableCells.size > 0) {
    if (!playableCells.has(key({ x: target.x, y: target.y }))) return false;
    if (!playableCells.has(key({ x: observer.x, y: observer.y }))) return false;
  }

  const visibles = getEntitiesInVision(observer, allTokens, opaqueCells, playableCells);
  const inCone = visibles.some(t => t.id === target.id);
  if (!inCone) return false;
  return true;
}
