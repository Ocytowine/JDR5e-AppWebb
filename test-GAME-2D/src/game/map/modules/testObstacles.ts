import type { GridPosition } from "../../../types";
import type { MapBuildContext, MapSpec } from "../types";
import { createDraft, key, setLight, setTerrain, tryPlaceObstacle } from "../draft";

type FootprintBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
};

function getFootprintBounds(footprint: Array<{ x: number; y: number }> | undefined): FootprintBounds {
  if (!footprint || footprint.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 1, h: 1 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const cell of footprint) {
    if (cell.x < minX) minX = cell.x;
    if (cell.y < minY) minY = cell.y;
    if (cell.x > maxX) maxX = cell.x;
    if (cell.y > maxY) maxY = cell.y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 1, h: 1 };
  }
  const w = Math.max(1, Math.round(maxX - minX + 1));
  const h = Math.max(1, Math.round(maxY - minY + 1));
  return { minX, minY, maxX, maxY, w, h };
}

function getSpriteGridSize(type: { appearance?: { spriteGrid?: { tilesX: number; tilesY: number }; layers?: Array<{ spriteGrid?: { tilesX: number; tilesY: number } }> } }): { w: number; h: number } | null {
  const grids: Array<{ tilesX: number; tilesY: number }> = [];
  if (type.appearance?.spriteGrid?.tilesX && type.appearance?.spriteGrid?.tilesY) {
    grids.push(type.appearance.spriteGrid);
  }
  if (type.appearance?.layers) {
    for (const layer of type.appearance.layers) {
      if (layer.spriteGrid?.tilesX && layer.spriteGrid?.tilesY) {
        grids.push(layer.spriteGrid);
      }
    }
  }
  if (!grids.length) return null;
  const w = Math.max(...grids.map(g => Math.max(1, Math.floor(g.tilesX))));
  const h = Math.max(...grids.map(g => Math.max(1, Math.floor(g.tilesY))));
  return { w, h };
}

export function generateTestObstacles(params: {
  spec: MapSpec;
  ctx: MapBuildContext;
  rand: () => number;
}): { draft: ReturnType<typeof createDraft>; playerStart: GridPosition } {
  const { spec, ctx } = params;
  const padding = 1;
  const startX = 2;
  const startY = 1;
  const effectZoneW = 5;
  const effectZoneH = 5;

  const fireOnly = ctx.obstacleTypes.find(type => type.id === "fire-only") ?? null;
  const items = ctx.obstacleTypes
    .filter(type => type.id !== "fire-only")
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(type => {
      const variant = type.variants.find(v => v.id === "base") ?? type.variants[0];
      const bounds = getFootprintBounds(variant?.footprint);
      const spriteGrid = getSpriteGridSize(type);
      if (spriteGrid) {
        bounds.w = Math.max(bounds.w, spriteGrid.w);
        bounds.h = Math.max(bounds.h, spriteGrid.h);
      }
      return { type, variantId: variant?.id ?? "base", bounds };
    });

  const maxItemW = items.reduce((max, item) => Math.max(max, item.bounds.w), 1);
  let cols = Math.max(1, Math.floor(spec.grid.cols));
  cols = Math.max(cols, startX + maxItemW + padding);

  const usableCols = Math.max(1, cols - startX);
  let cursorX = 0;
  let cursorY = 0;
  let rowH = 0;
  const placements: Array<{ item: (typeof items)[number]; x: number; y: number }> = [];
  let maxPlacedX = startX;

  for (const item of items) {
    if (cursorX > 0 && cursorX + item.bounds.w > usableCols) {
      cursorX = 0;
      cursorY += rowH + padding;
      rowH = 0;
    }
    placements.push({ item, x: startX + cursorX, y: startY + cursorY });
    maxPlacedX = Math.max(maxPlacedX, startX + cursorX + item.bounds.w - 1);
    cursorX += item.bounds.w + padding;
    rowH = Math.max(rowH, item.bounds.h);
  }

  const rowsNeeded = startY + cursorY + rowH + 1;
  const effectZoneX = maxPlacedX + padding + 2;
  const effectZoneY = startY;
  cols = Math.max(cols, effectZoneX + effectZoneW + 1);
  const rows = Math.max(1, Math.floor(spec.grid.rows), rowsNeeded, effectZoneY + effectZoneH + 1);
  const draft = createDraft({ cols, rows, reserved: new Set(), seedPrefix: "testobs" });

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      setTerrain(draft, x, y, "stone");
      setLight(draft, x, y, 0.85);
    }
  }

  draft.reserved.add(key(0, 0));
  draft.reserved.add(key(1, 0));
  draft.reserved.add(key(0, 1));
  draft.reserved.add(key(1, 1));

  for (const placement of placements) {
    const { item } = placement;
    const originX = placement.x - item.bounds.minX;
    const originY = placement.y - item.bounds.minY;
    const ok = tryPlaceObstacle({
      draft,
      type: item.type,
      x: originX,
      y: originY,
      variantId: item.variantId,
      rotation: 0
    });
    if (!ok) {
      draft.log.push(`Test obstacle ignore: ${item.type.id}`);
    }
  }

  for (let y = effectZoneY; y < effectZoneY + effectZoneH; y++) {
    for (let x = effectZoneX; x < effectZoneX + effectZoneW; x++) {
      setTerrain(draft, x, y, "floor");
    }
  }

  if (fireOnly) {
    const centerX = effectZoneX + Math.floor(effectZoneW / 2);
    const centerY = effectZoneY + Math.floor(effectZoneH / 2);
    tryPlaceObstacle({
      draft,
      type: fireOnly,
      x: centerX,
      y: centerY,
      variantId: "base",
      rotation: 0
    });
  }

  const playerStart: GridPosition = { x: 0, y: 0 };
  draft.log.push(`Test obstacles: ${draft.obstacles.length}/${items.length}`);
  return { draft, playerStart };
}
