import type { GridPosition } from "../../../types";
import type { MapBuildContext, ManualMapConfig } from "../types";
import {
  createDraft,
  setLight,
  setTerrain,
  tryPlaceObstacle,
  tryPlaceWall,
  key
} from "../draft";
import { pickVariantIdForPlacement } from "../obstacleSelector";
import { findWallType } from "../wallSelector";
import { randomIntInclusive } from "../random";
import { loadMapPatternsFromIndex } from "../../mapPatternCatalog";
import { getPatternSize, pickPatternTransform, placePatternAtOrigin } from "../patterns";

const MANUAL_PATTERNS = loadMapPatternsFromIndex();

function resolveBaseLight(lighting: ManualMapConfig["options"]["lighting"]): number {
  if (lighting === "low") return 0.35;
  if (lighting === "bright") return 0.9;
  return 0.7;
}

function buildRectBoundary(params: { x1: number; y1: number; x2: number; y2: number }): GridPosition[] {
  const cells: GridPosition[] = [];
  for (let x = params.x1; x <= params.x2; x++) {
    cells.push({ x, y: params.y1 });
    if (params.y2 !== params.y1) cells.push({ x, y: params.y2 });
  }
  for (let y = params.y1 + 1; y <= params.y2 - 1; y++) {
    cells.push({ x: params.x1, y });
    if (params.x2 !== params.x1) cells.push({ x: params.x2, y });
  }
  return cells;
}

function filterByBorderMask(
  cells: GridPosition[],
  rect: { x1: number; y1: number; x2: number; y2: number },
  mask: ManualMapConfig["options"]["borderMask"]
): GridPosition[] {
  return cells.filter(cell => {
    if (cell.y === rect.y1 && !mask.north) return false;
    if (cell.y === rect.y2 && !mask.south) return false;
    if (cell.x === rect.x1 && !mask.west) return false;
    if (cell.x === rect.x2 && !mask.east) return false;
    return true;
  });
}

function chooseOpenings(params: { boundary: GridPosition[]; count: number; rand: () => number }): GridPosition[] {
  const { boundary, rand } = params;
  const count = Math.max(0, Math.floor(params.count));
  if (!boundary.length || count <= 0) return [];

  const chosen: GridPosition[] = [];
  const shuffled = [...boundary].sort(() => rand() - 0.5);

  const minDist = 4;
  for (const c of shuffled) {
    if (chosen.length >= count) break;
    if (chosen.every(o => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) >= minDist)) {
      chosen.push(c);
    }
  }

  while (chosen.length < count) {
    chosen.push(boundary[Math.floor(rand() * boundary.length)] as GridPosition);
  }

  return chosen.slice(0, count);
}

function placeManualPatterns(params: {
  draft: ReturnType<typeof createDraft>;
  manualConfig: ManualMapConfig;
  rand: () => number;
  obstacleTypes: MapBuildContext["obstacleTypes"];
  wallTypes: MapBuildContext["wallTypes"];
  cols: number;
  rows: number;
}): number {
  const { draft, manualConfig, rand, obstacleTypes, wallTypes, cols, rows } = params;
  const requested = manualConfig.options.patterns ?? [];
  if (!requested.length || MANUAL_PATTERNS.length === 0) return 0;

  const byId = new Map(MANUAL_PATTERNS.map(p => [p.id, p]));
  let placed = 0;

  for (const id of requested) {
    const pattern = byId.get(id);
    if (!pattern) continue;

    const attempts = 20;
    let ok = false;
    for (let i = 0; i < attempts && !ok; i++) {
      const transform = pickPatternTransform({
        rand,
        allowedRotations: [0, 90, 180, 270],
        allowMirrorX: true,
        allowMirrorY: true
      });
      const size = getPatternSize(pattern, transform);
      const maxX = Math.max(0, cols - size.w);
      const maxY = Math.max(0, rows - size.h);
      const originX = randomIntInclusive(rand, 0, maxX);
      const originY = randomIntInclusive(rand, 0, maxY);
      ok = placePatternAtOrigin({
        draft,
        pattern,
        originX,
        originY,
        obstacleTypes,
        wallTypes,
        rand,
        transform
      });
    }
    if (ok) placed++;
  }

  return placed;
}

export function generateManualArena(params: {
  manualConfig: ManualMapConfig;
  ctx: MapBuildContext;
  rand: () => number;
}): { draft: ReturnType<typeof createDraft>; playerStart: GridPosition } {
  const { manualConfig, ctx, rand } = params;
  const cols = Math.max(1, Math.floor(manualConfig.grid.cols));
  const rows = Math.max(1, Math.floor(manualConfig.grid.rows));

  const draft = createDraft({ cols, rows, reserved: new Set(), seedPrefix: "obs" });
  draft.log.push("Layout: manual arena.");

  const baseLight = resolveBaseLight(manualConfig.options.lighting);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      setTerrain(draft, x, y, "floor");
      setLight(draft, x, y, baseLight);
    }
  }

  const playerStart: GridPosition = { x: 1, y: Math.floor(rows / 2) };

  const typeById = new Map(ctx.obstacleTypes.map(t => [t.id, t]));
  const wallById = new Map(ctx.wallTypes.map(t => [t.id, t]));

  if (manualConfig.options.walls) {
    const wallType =
      findWallType(ctx.wallTypes, "wall-stone") ??
      ctx.wallTypes.find(t => t.category === "wall") ??
      ctx.wallTypes[0] ??
      null;
    const wallDoorType =
      findWallType(ctx.wallTypes, "wall-stone-door") ??
      wallById.get("wall-stone-door") ??
      null;

    if (wallType) {
      const rect = { x1: 0, y1: 0, x2: cols - 1, y2: rows - 1 };
      const boundaryCells = filterByBorderMask(
        buildRectBoundary(rect),
        rect,
        manualConfig.options.borderMask
      );

      const openings = chooseOpenings({
        boundary: boundaryCells,
        count: manualConfig.options.entrances ?? 0,
        rand
      });
      const openingKeys = new Set(openings.map(o => key(o.x, o.y)));
      for (const ok of openingKeys) draft.reserved.add(ok);

      const smallestVariant =
        (wallType.variants ?? [])
          .map(v => ({
            id: v.id,
            len: Array.isArray(v.footprint) ? v.footprint.length : 1
          }))
          .sort((a, b) => a.len - b.len)[0]?.id ?? (wallType.variants?.[0]?.id ?? "1");

      let placedWalls = 0;
      for (const cell of boundaryCells) {
        const isOpening = openingKeys.has(key(cell.x, cell.y));
        const typeForCell = isOpening && wallDoorType ? wallDoorType : wallType;
        const state = isOpening ? "open" : "closed";
        const ok = tryPlaceWall({
          draft,
          type: typeForCell,
          x: cell.x,
          y: cell.y,
          variantId: smallestVariant,
          rotation: 0,
          state,
          allowOnReserved: true
        });
        if (ok) placedWalls++;
      }

      draft.log.push(`Walls: ${placedWalls} segments (openings ${openings.length}).`);
    } else {
      draft.log.push("Walls: no wall type available.");
    }
  }

  const placedPatterns = placeManualPatterns({
    draft,
    manualConfig,
    rand,
    obstacleTypes: ctx.obstacleTypes,
    wallTypes: ctx.wallTypes,
    cols,
    rows
  });
  if (placedPatterns > 0) {
    draft.log.push(`Patterns: +${placedPatterns} (manual).`);
  }

  for (const entry of manualConfig.obstacles) {
    const count = Math.max(0, Math.floor(entry.count));
    if (count === 0) continue;

    const type = typeById.get(entry.typeId) ?? null;
    if (!type) {
      draft.log.push(`Manual: obstacle type missing (${entry.typeId}).`);
      continue;
    }

    let placed = 0;
    let attempts = 0;
    const maxAttempts = Math.max(40, count * 60);

    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const x = randomIntInclusive(rand, 0, Math.max(0, cols - 1));
      const y = randomIntInclusive(rand, 0, Math.max(0, rows - 1));

      const shapeHint = type.spawnRules?.shapeHint;
      const desiredShape =
        shapeHint === "line"
          ? "line"
          : shapeHint === "room"
            ? "room"
            : "scatter";
      const variantId = pickVariantIdForPlacement(type, desiredShape, rand);

      const ok = tryPlaceObstacle({
        draft,
        type,
        x,
        y,
        variantId,
        rotation: 0
      });

      if (ok) placed++;
    }

    if (placed < count) {
      draft.log.push(`Manual: ${type.id} ${placed}/${count} placed.`);
    } else {
      draft.log.push(`Manual: ${type.id} ${placed}/${count} placed.`);
    }
  }

  return { draft, playerStart };
}
