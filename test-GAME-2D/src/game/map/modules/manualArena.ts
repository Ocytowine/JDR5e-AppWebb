import type { GridPosition } from "../../../types";
import type { MapBuildContext, ManualMapConfig } from "../types";
import {
  createDraft,
  setLight,
  setTerrain,
  tryPlaceObstacle
} from "../draft";
import { pickVariantIdForPlacement, randomRotationForPlacement } from "../obstacleSelector";
import { randomIntInclusive } from "../random";
import { loadMapPatternsFromIndex } from "../../mapPatternCatalog";
import { getPatternSize, pickPatternTransform, placePatternAtOrigin } from "../patterns";

const MANUAL_PATTERNS = loadMapPatternsFromIndex();

function resolveBaseLight(lighting: ManualMapConfig["options"]["lighting"]): number {
  if (lighting === "low") return 0.35;
  if (lighting === "bright") return 0.9;
  return 0.7;
}

function placeManualPatterns(params: {
  draft: ReturnType<typeof createDraft>;
  manualConfig: ManualMapConfig;
  rand: () => number;
  obstacleTypes: MapBuildContext["obstacleTypes"];
  cols: number;
  rows: number;
}): number {
  const { draft, manualConfig, rand, obstacleTypes, cols, rows } = params;
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
  const placedPatterns = placeManualPatterns({
    draft,
    manualConfig,
    rand,
    obstacleTypes: ctx.obstacleTypes,
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
      const rotation = randomRotationForPlacement(type, variantId, rand);

      const ok = tryPlaceObstacle({
        draft,
        type,
        x,
        y,
        variantId,
        rotation
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
