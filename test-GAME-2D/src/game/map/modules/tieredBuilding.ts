import type { GridPosition } from "../../../types";
import type { MapBuildContext, MapSpec } from "../types";
import type { MapDraft } from "../draft";
import { createDraft, setHeight, setTerrain, tryPlaceObstacle, tryPlaceWallSegment } from "../draft";
import { findObstacleType } from "../obstacleSelector";
import { findWallType } from "../wallSelector";
import { resolveWallKindFromType } from "../walls/kind";
import { resolveWallMaxHp } from "../walls/durability";
import type { WallDirection } from "../walls/types";

const ROOF_HEIGHT = 1;
const HOLE_RADIUS = 1;

function clampRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildInnerBounds(cols: number, rows: number): {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
} {
  const safeCols = Math.max(6, cols);
  const safeRows = Math.max(6, rows);
  const padding = Math.max(1, Math.floor(Math.min(safeCols, safeRows) * 0.15));
  const roofWidth = Math.max(4, safeCols - padding * 2);
  const roofHeight = Math.max(4, safeRows - padding * 2);
  const x1 = clampRange(Math.floor((safeCols - roofWidth) / 2), 1, safeCols - 3);
  const y1 = clampRange(Math.floor((safeRows - roofHeight) / 2), 1, safeRows - 3);
  const x2 = clampRange(x1 + roofWidth - 1, x1 + 2, safeCols - 2);
  const y2 = clampRange(y1 + roofHeight - 1, y1 + 2, safeRows - 2);
  return { x1, x2, y1, y2 };
}

function ensureInBounds(value: number, max: number): number {
  return clampRange(value, 0, max - 1);
}

export function generateTieredBuilding(params: {
  spec: MapSpec;
  ctx: MapBuildContext;
  rand: () => number;
}): { draft: MapDraft; playerStart: GridPosition } {
  const { spec, ctx } = params;
  const cols = Math.max(6, spec.grid.cols);
  const rows = Math.max(6, spec.grid.rows);
  const draft = createDraft({ cols, rows, reserved: new Set<string>(), seedPrefix: "bld" });
  const style = spec.building?.style === "closed" ? "closed" : "open";

  draft.log.push("Module: building_tiered.");
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      setTerrain(draft, x, y, "stone");
    }
  }

  const bounds = buildInnerBounds(cols, rows);
  for (let y = bounds.y1; y <= bounds.y2; y++) {
    for (let x = bounds.x1; x <= bounds.x2; x++) {
      setHeight(draft, x, y, ROOF_HEIGHT);
    }
  }

  const centerX = Math.floor((bounds.x1 + bounds.x2) / 2);
  const centerY = Math.floor((bounds.y1 + bounds.y2) / 2);
  setHeight(draft, centerX, centerY, 0);

  const stairType = findObstacleType(ctx.obstacleTypes, "stairs-stone");
  if (stairType) {
    const stairVariantId = stairType.variants?.[0]?.id ?? "base";
    tryPlaceObstacle({
      draft,
      type: stairType,
      x: centerX,
      y: centerY,
      variantId: stairVariantId,
      rotation: 0
    });
  }

  let startY = centerY - HOLE_RADIUS - 1;
  if (startY < 0) startY = centerY + HOLE_RADIUS + 1;
  startY = ensureInBounds(startY, rows);
  setHeight(draft, centerX, startY, 0);
  const minY = Math.min(centerY, startY);
  const maxY = Math.max(centerY, startY);
  for (let y = minY; y <= maxY; y++) {
    setHeight(draft, centerX, y, 0);
  }
  const playerStart: GridPosition = { x: ensureInBounds(centerX, cols), y: startY };

  if (style === "closed") {
    const wallType = findWallType(ctx.wallTypes, "wall-stone") ?? ctx.wallTypes[0] ?? null;
    if (wallType) {
      const baseKind = resolveWallKindFromType(wallType);
      const baseMaxHp = resolveWallMaxHp(wallType);
      const placed = new Set<string>();
      const placeEdge = (x: number, y: number, dir: WallDirection) => {
        if (x < 0 || x >= cols || y < 0 || y >= rows) return;
        const key = `${x},${y},${dir}`;
        if (placed.has(key)) return;
        placed.add(key);
        tryPlaceWallSegment({ draft, x, y, dir, kind: baseKind, typeId: wallType.id, maxHp: baseMaxHp ?? undefined, allowOnReserved: true });
      };

      for (let x = bounds.x1; x <= bounds.x2; x++) {
        placeEdge(x, bounds.y1 - 1, "S");
        placeEdge(x, bounds.y2 + 1, "N");
      }
      for (let y = bounds.y1; y <= bounds.y2; y++) {
        placeEdge(bounds.x1 - 1, y, "E");
        placeEdge(bounds.x2 + 1, y, "W");
      }
    }
  }

  draft.log.push(`Bâtiment à toit ${style} généré (niveau 1 accessible).`);
  return { draft, playerStart };
}
