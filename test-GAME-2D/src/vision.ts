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
import { distanceBetweenGridCells, isCellInsideGrid } from "./boardConfig";
import type { WallSegment } from "./game/map/walls/types";
import { getClosestFootprintCellToPoint, getTokenOccupiedCells } from "./game/engine/runtime/footprint";
import { isLightVisible, resolveLightVisionMode } from "./lighting";
import type { LightVisionMode } from "./lighting";
import { metersToCells } from "./game/engine/runtime/units";

const DEFAULT_VISION_RANGE = 150;

const DEFAULT_CONE_VISION: VisionProfile = {
  shape: "cone",
  range: DEFAULT_VISION_RANGE,
  apertureDeg: 180
};

export function getVisionRangeCells(profile: VisionProfile): number {
  return Math.max(0, metersToCells(profile.range));
}

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
  playableCells?: Set<string> | null,
  grid?: { cols: number; rows: number } | null
): BoardEffect {
  const profile = getVisionProfileForToken(token);
  const facing = getFacingForToken(token);
  const id = `vision-${token.id}`;

  const rangeCells = getVisionRangeCells(profile);

  if (rangeCells <= 0) {
    return {
      id,
      type: profile.shape === "circle" ? "circle" : "cone",
      cells: []
    };
  }

  if (profile.shape === "circle") {
    return generateCircleEffect(id, token.x, token.y, rangeCells, {
      playableCells: playableCells ?? null,
      grid: grid ?? null
    });
  }

  return generateConeEffect(
    id,
    token.x,
    token.y,
    rangeCells,
    facing,
    profile.apertureDeg,
    { playableCells: playableCells ?? null, grid: grid ?? null }
  );
}

function key(pos: GridPosition): string {
  return `${pos.x},${pos.y}`;
}

function getLightVisionMode(profile: VisionProfile): LightVisionMode {
  if (profile.lightVision) return resolveLightVisionMode(profile.lightVision);
  if (profile.canSeeInDark) return "darkvision";
  return "normal";
}

function getLightAt(
  lightLevels: number[] | null | undefined,
  grid: { cols: number; rows: number } | null | undefined,
  x: number,
  y: number
): number | null {
  if (!lightLevels || !grid) return null;
  if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return null;
  const idx = y * grid.cols + x;
  return typeof lightLevels[idx] === "number" ? lightLevels[idx] : null;
}

export function isCellVisible(
  observer: TokenState,
  cell: GridPosition,
  opaqueCells?: Set<string> | null,
  playableCells?: Set<string> | null,
  wallVisionEdges?: Map<string, WallSegment> | null,
  lightLevels?: number[] | null,
  grid?: { cols: number; rows: number } | null
): boolean {
  if (playableCells && playableCells.size > 0) {
    if (!playableCells.has(key(cell))) return false;
    if (!playableCells.has(key({ x: observer.x, y: observer.y }))) return false;
  }

  const effect = computeVisionEffectForToken(observer, playableCells ?? null, grid ?? null);
  if (!effect.cells.length) return false;

  const cellKey = key(cell);
  for (const c of effect.cells) {
    if (playableCells && playableCells.size > 0 && !playableCells.has(key(c))) {
      continue;
    }
    if (key(c) === cellKey) {
      const hasOpaque = Boolean(opaqueCells && opaqueCells.size > 0);
      const hasWalls = Boolean(wallVisionEdges && wallVisionEdges.size > 0);
      const hasLos =
        !hasOpaque && !hasWalls
          ? true
          : hasLineOfSight(
              { x: observer.x, y: observer.y },
              { x: cell.x, y: cell.y },
              opaqueCells,
              wallVisionEdges ?? null
            );
      if (!hasLos) return false;
      if (cell.x === observer.x && cell.y === observer.y) return true;
      const light = getLightAt(lightLevels, grid ?? null, cell.x, cell.y);
      if (light === null) return true;
      const mode = getLightVisionMode(getVisionProfileForToken(observer));
      return isLightVisible(light, mode);
    }
  }

  return false;
}

export function getEntitiesInVision(
  observer: TokenState,
  allTokens: TokenState[],
  opaqueCells?: Set<string> | null,
  playableCells?: Set<string> | null,
  wallVisionEdges?: Map<string, WallSegment> | null,
  lightLevels?: number[] | null,
  grid?: { cols: number; rows: number } | null
): TokenState[] {
  const effect = computeVisionEffectForToken(observer, playableCells ?? null, grid ?? null);
  if (!effect.cells.length) return [];

  const cells = new Set<string>();
  for (const cell of effect.cells) {
    const k = key(cell);
    if (playableCells && playableCells.size > 0 && !playableCells.has(k)) continue;
    cells.add(k);
  }

  const lightMode = getLightVisionMode(getVisionProfileForToken(observer));
  const candidates = allTokens.filter(t => {
    if (t.id === observer.id || t.hp <= 0) return false;
    const footprint = getTokenOccupiedCells(t);
    return footprint.some(c => {
      if (!cells.has(key(c))) return false;
      const light = getLightAt(lightLevels, grid ?? null, c.x, c.y);
      if (light === null) return true;
      return isLightVisible(light, lightMode);
    });
  });

  const filteredByPlayable =
    playableCells && playableCells.size > 0
      ? candidates.filter(t =>
          getTokenOccupiedCells(t).some(c => playableCells.has(key(c)))
        )
      : candidates;

  const hasOpaque = Boolean(opaqueCells && opaqueCells.size > 0);
  const hasWalls = Boolean(wallVisionEdges && wallVisionEdges.size > 0);
  if (!hasOpaque && !hasWalls) return filteredByPlayable;

  return filteredByPlayable.filter(t => {
    const targetCell =
      getClosestFootprintCellToPoint({ x: observer.x, y: observer.y }, t) ??
      { x: t.x, y: t.y };
    return hasLineOfSight(
      { x: observer.x, y: observer.y },
      targetCell,
      opaqueCells,
      wallVisionEdges ?? null
    );
  });
}

export function isTargetVisible(
  observer: TokenState,
  target: TokenState,
  allTokens: TokenState[],
  opaqueCells?: Set<string> | null,
  playableCells?: Set<string> | null,
  wallVisionEdges?: Map<string, WallSegment> | null,
  lightLevels?: number[] | null,
  grid?: { cols: number; rows: number } | null
): boolean {
  if (target.hp <= 0) return false;
  if (playableCells && playableCells.size > 0) {
    const targetCells = getTokenOccupiedCells(target);
    if (!targetCells.some(c => playableCells.has(key(c)))) return false;
    if (!playableCells.has(key({ x: observer.x, y: observer.y }))) return false;
  }

  const visibles = getEntitiesInVision(
    observer,
    allTokens,
    opaqueCells,
    playableCells,
    wallVisionEdges,
    lightLevels,
    grid
  );
  const inCone = visibles.some(t => t.id === target.id);
  if (!inCone) return false;
  return true;
}

export type VisibilityLevel = 0 | 1 | 2;

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
  wallVisionEdges?: Map<string, WallSegment> | null;
}): Map<string, VisibilityLevel> {
  const {
    origin,
    range,
    grid = null,
    playableCells = null,
    opaqueCells = null,
    wallVisionEdges = null
  } = params;
  const result = new Map<string, VisibilityLevel>();
  if (range <= 0) return result;

  const originKey = `${origin.x},${origin.y}`;
  setVisibility(result, origin.x, origin.y, 2);

  const testCell = (x: number, y: number) => {
    const cellKey = `${x},${y}`;
    if (cellKey === originKey) return;
    if (playableCells && playableCells.size > 0 && !playableCells.has(cellKey)) return;
    if (grid && !isCellInsideGrid(x, y, grid.cols, grid.rows)) return;
    if (distanceBetweenGridCells(origin, { x, y }) > range) return;
    if (!hasLineOfSight(origin, { x, y }, opaqueCells, wallVisionEdges)) return;
    const opaque = Boolean(opaqueCells && opaqueCells.has(cellKey));
    setVisibility(result, x, y, opaque ? 1 : 2);
  };

  if (playableCells && playableCells.size > 0) {
    for (const cellKey of playableCells) {
      const [xs, ys] = cellKey.split(",");
      const x = Number(xs);
      const y = Number(ys);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      testCell(x, y);
    }
    return result;
  }

  if (grid) {
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        testCell(x, y);
      }
    }
    return result;
  }

  const scan = Math.max(1, range);
  for (let y = origin.y - scan; y <= origin.y + scan; y++) {
    for (let x = origin.x - scan; x <= origin.x + scan; x++) {
      testCell(x, y);
    }
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
  const range = getVisionRangeCells(profile);
  if (range <= 0) return new Map<string, VisibilityLevel>();

  const base = computeShadowcastVisibility({
    origin: { x: token.x, y: token.y },
    range,
    grid,
    playableCells,
    opaqueCells,
    wallVisionEdges
  });

  if (profile.shape === "circle") {
    return base;
  }

  const cone = generateConeEffect(
    `cone-${token.id}`,
    token.x,
    token.y,
    range,
    facing,
    profile.apertureDeg,
    { playableCells, grid }
  );
  const allowed = new Set<string>(cone.cells.map(c => `${c.x},${c.y}`));
  allowed.add(`${token.x},${token.y}`);

  const filtered = new Map<string, VisibilityLevel>();
  for (const [k, v] of base.entries()) {
    if (!allowed.has(k)) continue;
    filtered.set(k, v);
  }
  return filtered;
}



