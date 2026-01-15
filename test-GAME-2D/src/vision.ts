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
import { isCellInsideGrid } from "./boardConfig";
import type { WallSegment } from "./game/map/walls/types";

const DEFAULT_VISION_RANGE = 100;

const DEFAULT_CONE_VISION: VisionProfile = {
  shape: "cone",
  range: DEFAULT_VISION_RANGE,
  apertureDeg: 180
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
  playableCells?: Set<string> | null,
  wallVisionEdges?: Map<string, WallSegment> | null
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
          opaqueCells,
          wallVisionEdges ?? null
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
  playableCells?: Set<string> | null,
  wallVisionEdges?: Map<string, WallSegment> | null
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
      opaqueCells,
      wallVisionEdges ?? null
    )
  );
}

export function isTargetVisible(
  observer: TokenState,
  target: TokenState,
  allTokens: TokenState[],
  opaqueCells?: Set<string> | null,
  playableCells?: Set<string> | null,
  wallVisionEdges?: Map<string, WallSegment> | null
): boolean {
  if (target.hp <= 0) return false;
  if (playableCells && playableCells.size > 0) {
    if (!playableCells.has(key({ x: target.x, y: target.y }))) return false;
    if (!playableCells.has(key({ x: observer.x, y: observer.y }))) return false;
  }

  const visibles = getEntitiesInVision(
    observer,
    allTokens,
    opaqueCells,
    playableCells,
    wallVisionEdges
  );
  const inCone = visibles.some(t => t.id === target.id);
  if (!inCone) return false;
  return true;
}

export type VisibilityLevel = 0 | 1 | 2;

function isInsideBounds(
  x: number,
  y: number,
  grid?: { cols: number; rows: number } | null,
  playableCells?: Set<string> | null
): boolean {
  if (grid && !isCellInsideGrid(x, y, grid.cols, grid.rows)) return false;
  if (playableCells && playableCells.size > 0) return playableCells.has(`${x},${y}`);
  return true;
}

function setVisibility(
  map: Map<string, VisibilityLevel>,
  x: number,
  y: number,
  level: VisibilityLevel
): void {
  const k = `${x},${y}`;
  const prev = map.get(k) ?? 0;
  if (level > prev) map.set(k, level);
}

function computeShadowcastVisibility(params: {
  origin: GridPosition;
  range: number;
  grid?: { cols: number; rows: number } | null;
  playableCells?: Set<string> | null;
  opaqueCells?: Set<string> | null;
}): Map<string, VisibilityLevel> {
  const {
    origin,
    range,
    grid = null,
    playableCells = null,
    opaqueCells = null
  } = params;
  const result = new Map<string, VisibilityLevel>();
  if (range <= 0) return result;

  const isOpaque = (x: number, y: number) =>
    Boolean(opaqueCells && opaqueCells.has(`${x},${y}`));

  const castLight = (
    row: number,
    start: number,
    end: number,
    radius: number,
    xx: number,
    xy: number,
    yx: number,
    yy: number
  ) => {
    if (start < end) return;
    let newStart = start;
    let blocked = false;

    for (let dist = row; dist <= radius && !blocked; dist++) {
      let dx = -dist - 1;
      let dy = -dist;
      while (dx <= 0) {
        dx += 1;
        const mx = origin.x + dx * xx + dy * xy;
        const my = origin.y + dx * yx + dy * yy;
        const lSlope = (dx - 0.5) / (dy + 0.5);
        const rSlope = (dx + 0.5) / (dy - 0.5);

        if (start < rSlope) {
          continue;
        }
        if (end > lSlope) {
          break;
        }
        if (!isInsideBounds(mx, my, grid, playableCells)) {
          continue;
        }

        if (dx * dx + dy * dy <= radius * radius) {
          const opaque = isOpaque(mx, my);
          setVisibility(result, mx, my, opaque ? 1 : 2);
        }

        const opaque = isOpaque(mx, my);
        if (blocked) {
          if (opaque) {
            newStart = rSlope;
            continue;
          }
          blocked = false;
          start = newStart;
        } else if (opaque && dist < radius) {
          blocked = true;
          castLight(dist + 1, start, lSlope, radius, xx, xy, yx, yy);
          newStart = rSlope;
        }
      }
    }
  };

  setVisibility(result, origin.x, origin.y, 2);

  const transforms = [
    [1, 0, 0, 1],
    [0, 1, 1, 0],
    [-1, 0, 0, 1],
    [0, -1, 1, 0],
    [-1, 0, 0, -1],
    [0, -1, -1, 0],
    [1, 0, 0, -1],
    [0, 1, -1, 0]
  ];

  for (const [xx, xy, yx, yy] of transforms) {
    castLight(1, 1.0, 0.0, range, xx, xy, yx, yy);
  }

  return result;
}

export function computeVisibilityLevelsForToken(params: {
  token: TokenState;
  playableCells?: Set<string> | null;
  grid?: { cols: number; rows: number } | null;
  opaqueCells?: Set<string> | null;
  wallVisionEdges?: Map<string, WallSegment> | null;
}): Map<string, VisibilityLevel> {
  const {
    token,
    playableCells = null,
    grid = null,
    opaqueCells = null,
    wallVisionEdges = null
  } = params;
  const profile = getVisionProfileForToken(token);
  const facing = getFacingForToken(token);
  const range = Math.max(0, Math.floor(profile.range ?? 0));
  if (range <= 0) return new Map<string, VisibilityLevel>();

  const base = computeShadowcastVisibility({
    origin: { x: token.x, y: token.y },
    range,
    grid,
    playableCells,
    opaqueCells
  });

  if (profile.shape === "circle") {
    if (!wallVisionEdges || wallVisionEdges.size === 0) return base;
    const filtered = new Map<string, VisibilityLevel>();
    for (const [k, v] of base.entries()) {
      const [x, y] = k.split(",").map(Number);
      if (
        hasLineOfSight(
          { x: token.x, y: token.y },
          { x, y },
          opaqueCells ?? null,
          wallVisionEdges
        )
      ) {
        filtered.set(k, v);
      }
    }
    return filtered;
  }

  const cone = generateConeEffect(
    `cone-${token.id}`,
    token.x,
    token.y,
    range,
    facing,
    profile.apertureDeg,
    { playableCells }
  );
  const allowed = new Set<string>(cone.cells.map(c => `${c.x},${c.y}`));
  allowed.add(`${token.x},${token.y}`);

  const filtered = new Map<string, VisibilityLevel>();
  for (const [k, v] of base.entries()) {
    if (!allowed.has(k)) continue;
    const [x, y] = k.split(",").map(Number);
    if (
      hasLineOfSight(
        { x: token.x, y: token.y },
        { x, y },
        opaqueCells ?? null,
        wallVisionEdges
      )
    ) {
      filtered.set(k, v);
    }
  }
  return filtered;
}
