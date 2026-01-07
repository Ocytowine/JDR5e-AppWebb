import type { GridPosition } from "../../../types";
import type { MapBuildContext, MapSpec } from "../types";
import {
  clamp,
  createDraft,
  setLight,
  setTerrain,
  tryPlaceObstacle,
  key,
  scatterTerrainPatches,
  scatterDecorations
} from "../draft";
import { findObstacleType, pickVariantIdForPlacement, weightedTypesForContext } from "../obstacleSelector";
import { pickWeighted, randomIntInclusive } from "../random";
import { loadMapPatternsFromIndex } from "../../mapPatternCatalog";
import { choosePatternsByPrompt, getPatternSize, pickPatternTransform, placePatternAtOrigin } from "../patterns";

const FOREST_PATTERNS = loadMapPatternsFromIndex().filter(p => p.theme === "forest");

function placeForestPatterns(params: {
  draft: ReturnType<typeof createDraft>;
  rand: () => number;
  obstacleTypes: MapBuildContext["obstacleTypes"];
  wallTypes: MapBuildContext["wallTypes"];
  cols: number;
  rows: number;
  cx: number;
  cy: number;
  radius: number;
  prompt: string;
}): number {
  const { draft, rand, obstacleTypes, wallTypes, cols, rows, cx, cy, radius, prompt } = params;
  if (FOREST_PATTERNS.length === 0) return 0;

  let placed = 0;

  const picks = choosePatternsByPrompt({
    patterns: FOREST_PATTERNS,
    prompt,
    rand,
    count: 2
  });

  for (const pattern of picks) {
    const transform = pickPatternTransform({
      rand,
      allowedRotations: [0, 90, 180, 270],
      allowMirrorX: true,
      allowMirrorY: true
    });

    const size = getPatternSize(pattern, transform);
    const originX = clamp(cx - Math.floor(size.w / 2), 0, cols - 1);
    const originY = clamp(cy - Math.floor(size.h / 2), 0, rows - 1);
    let ok = placePatternAtOrigin({
      draft,
      pattern,
      originX,
      originY,
      obstacleTypes,
      wallTypes,
      rand,
      transform
    });

    if (!ok) {
      const attempts = 4;
      for (let i = 0; i < attempts && !ok; i++) {
        const ox = clamp(cx + randomIntInclusive(rand, -radius, radius), 0, cols - 1);
        const oy = clamp(cy + randomIntInclusive(rand, -radius, radius), 0, rows - 1);
        ok = placePatternAtOrigin({
          draft,
          pattern,
          originX: ox,
          originY: oy,
          obstacleTypes,
          wallTypes,
          rand,
          transform
        });
      }
    }

    if (ok) placed++;
  }

  return placed;
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function generateForestClearing(params: {
  spec: MapSpec;
  ctx: MapBuildContext;
  rand: () => number;
}): { draft: ReturnType<typeof createDraft>; playerStart: GridPosition } {
  const { spec, ctx, rand } = params;
  const cols = Math.max(1, spec.grid.cols);
  const rows = Math.max(1, spec.grid.rows);

  const playerStart: GridPosition = { x: 1, y: Math.floor(rows / 2) };
  const draft = createDraft({ cols, rows, reserved: new Set(), seedPrefix: "obs" });

  const forest = spec.forest ?? {
    radius: Math.max(2, Math.floor(Math.min(cols, rows) * 0.30)),
    treesOnRing: "sparse",
    lighting: "day"
  };

  const cx = clamp(Math.floor(cols * 0.6), 0, cols - 1);
  const cy = clamp(Math.floor(rows * 0.5), 0, rows - 1);
  const r = Math.max(2, forest.radius);

  draft.log.push("Layout: forêt (clairière).");

  const placedPatterns = placeForestPatterns({
    draft,
    rand,
    obstacleTypes: ctx.obstacleTypes,
    wallTypes: ctx.wallTypes,
    cols,
    rows,
    cx,
    cy,
    radius: r,
    prompt: spec.prompt
  });
  if (placedPatterns > 0) {
    draft.log.push(`Patterns: +${placedPatterns} (forest).`);
  }

  // Terrain: herbe partout, clairière = herbe + taches de terre.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      setTerrain(draft, x, y, "grass");
    }
  }

  const dirtPatchCount = clamp(Math.floor((cols * rows) / 55), 2, 10);
  scatterTerrainPatches({
    draft,
    rand,
    terrain: "dirt",
    count: dirtPatchCount,
    radiusMin: 1,
    radiusMax: 3
  });

  // Lumière: jour = élevé, nuit = bas (pour l'instant sans sources dynamiques).
  const baseLight = forest.lighting === "night" ? 0.25 : 0.9;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) setLight(draft, x, y, baseLight);
  }

  const treeType =
    findObstacleType(ctx.obstacleTypes, "tree-oak") ??
    ctx.obstacleTypes.find(t => (t.tags ?? []).includes("tree")) ??
    ctx.obstacleTypes.find(t => t.category === "vegetation") ??
    null;

  const vegetationTypes = weightedTypesForContext(
    ctx.obstacleTypes,
    t => (t.tags ?? []).includes("tree") || t.category === "vegetation"
  );

  // Règle de placement: arbres surtout sur un anneau autour de la clairière.
  const ringThickness = forest.treesOnRing === "dense" ? 1.8 : 1.2;
  const density = forest.treesOnRing === "dense" ? 0.55 : 0.3;

  let placed = 0;
  let attempts = 0;
  const target = clamp(Math.floor((cols * rows) * density * 0.12), 3, 14);

  while (placed < target && attempts < 400) {
    attempts++;

    const x = Math.floor(rand() * cols);
    const y = Math.floor(rand() * rows);


    const d = distance(x, y, cx, cy);
    const onRing = d >= r - ringThickness && d <= r + ringThickness;
    if (!onRing) continue;

    const chosen = pickWeighted(vegetationTypes, rand) ?? treeType;
    if (!chosen) break;

    const variantId = pickVariantIdForPlacement(chosen, "scatter", rand);
    const variant = (chosen.variants ?? []).find(v => v.id === variantId) ?? null;
    const rotation = variant?.rotatable
      ? (pickWeighted(
          [
            { item: 0 as const, weight: 1 },
            { item: 90 as const, weight: 1 },
            { item: 180 as const, weight: 1 },
            { item: 270 as const, weight: 1 }
          ],
          rand
        ) ?? 0)
      : 0;

    const ok = tryPlaceObstacle({
      draft,
      type: chosen,
      x,
      y,
      variantId,
      rotation
    });
    if (ok) placed++;
  }

  draft.log.push(`Arbres: ${placed} (anneau de clairière).`);

  // Un peu de "vie": quelques props à l'intérieur, très faible.
  const propTypes = weightedTypesForContext(ctx.obstacleTypes, t => t.category !== "wall" && t.category !== "vegetation");
  const smallTarget = clamp(Math.floor((cols * rows) / 80), 0, 3);
  let propsPlaced = 0;
  attempts = 0;
  while (propsPlaced < smallTarget && attempts < 150) {
    attempts++;
    const x = clamp(cx + randomIntInclusive(rand, -r + 1, r - 1), 0, cols - 1);
    const y = clamp(cy + randomIntInclusive(rand, -r + 1, r - 1), 0, rows - 1);
    const d = distance(x, y, cx, cy);
    if (d > r - 1) continue; // intérieur
    const chosen = pickWeighted(propTypes, rand) ?? null;
    if (!chosen) break;
    const variantId = pickVariantIdForPlacement(chosen, "scatter", rand);
    const ok = tryPlaceObstacle({ draft, type: chosen, x, y, variantId, rotation: 0 });
    if (ok) propsPlaced++;
  }
  if (propsPlaced) draft.log.push(`Props: +${propsPlaced}.`);

  const decorCount = clamp(Math.floor((cols * rows) / 18), 6, 24);
  const decorBefore = draft.decorations.length;
  scatterDecorations({
    draft,
    rand,
    spriteKeys: ["decor:grass", "decor:grass_2"],
    count: decorCount,
    terrainFilter: ["grass"]
  });
  const decorPlaced = draft.decorations.length - decorBefore;
  if (decorPlaced > 0) draft.log.push(`Decor: +${decorPlaced}.`);

  return { draft, playerStart };
}
