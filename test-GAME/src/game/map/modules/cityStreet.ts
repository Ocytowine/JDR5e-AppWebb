import type { GridPosition } from "../../../types";
import type { MapBuildContext, MapSpec } from "../types";
import { clamp, createDraft, setLight, setTerrain, tryPlaceObstacle, key, buildReservedRadius } from "../draft";
import { findObstacleType, pickVariantIdForPlacement, rotationForLine } from "../obstacleSelector";
import { loadMapPatternsFromIndex } from "../../mapPatternCatalog";
import { choosePatternsByPrompt, pickPatternTransform, placePattern } from "../patterns";

const CITY_PATTERNS = loadMapPatternsFromIndex().filter(p => p.theme === "city");

function placeCityPatterns(params: {
  draft: ReturnType<typeof createDraft>;
  rand: () => number;
  obstacleTypes: MapBuildContext["obstacleTypes"];
  cols: number;
  rows: number;
  topY2: number;
  prompt: string;
}): number {
  const { draft, rand, obstacleTypes, cols, rows, topY2, prompt } = params;
  if (CITY_PATTERNS.length === 0) return 0;
  if (topY2 < 0 || topY2 >= rows) return 0;

  let placed = 0;
  const attempts = Math.min(8, cols);
  const picks = choosePatternsByPrompt({
    patterns: CITY_PATTERNS,
    prompt,
    rand,
    count: attempts
  });
  for (const pattern of picks) {
    const anchorX = Math.floor(rand() * cols);
    const anchorY = topY2;
    const transform = pickPatternTransform({
      rand,
      allowedRotations: [0, 180],
      allowMirrorX: true,
      allowMirrorY: false
    });
    const ok = placePattern({ draft, pattern, anchorX, anchorY, obstacleTypes, rand, transform });
    if (ok) placed++;
  }

  return placed;
}

export function generateCityStreet(params: {
  spec: MapSpec;
  ctx: MapBuildContext;
  rand: () => number;
}): { draft: ReturnType<typeof createDraft>; playerStart: GridPosition } {
  const { spec, ctx, rand } = params;
  const cols = Math.max(1, spec.grid.cols);
  const rows = Math.max(1, spec.grid.rows);

  const playerStart: GridPosition = { x: 1, y: Math.floor(rows / 2) };
  const reserved = buildReservedRadius(playerStart, 2, cols, rows);
  const draft = createDraft({ cols, rows, reserved, seedPrefix: "obs" });

  const city = spec.city ?? {
    direction: "horizontal",
    streetWidth: 2,
    buildingDepth: 2,
    doors: "closed",
    lighting: "day"
  };

  draft.log.push("Layout: ville (rue).");

  const baseLight = city.lighting === "night" ? 0.25 : 0.9;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      setLight(draft, x, y, baseLight);
      setTerrain(draft, x, y, "stone");
    }
  }

  const wallType =
    findObstacleType(ctx.obstacleTypes, "wall-stone") ??
    ctx.obstacleTypes.find(t => t.category === "wall") ??
    ctx.obstacleTypes[0] ??
    null;

  if (!wallType) {
    draft.log.push("Maisons: aucun type de mur disponible.");
    return { draft, playerStart };
  }

  // Rue horizontale par défaut: une bande centrale libre, maisons de chaque côté.
  const streetW = clamp(Math.floor(city.streetWidth), 1, Math.max(1, rows - 2));
  const depth = clamp(Math.floor(city.buildingDepth), 1, Math.max(1, Math.floor(rows / 2) - 1));
  const centerY = clamp(Math.floor(rows / 2), 0, rows - 1);
  const streetY1 = clamp(centerY - Math.floor(streetW / 2), 0, rows - 1);
  const streetY2 = clamp(streetY1 + streetW - 1, 0, rows - 1);

  // Marque le "sol" de la rue au centre.
  for (let y = streetY1; y <= streetY2; y++) {
    for (let x = 0; x < cols; x++) setTerrain(draft, x, y, "road");
  }

  // Zones "maisons" = au-dessus et en dessous de la rue.
  const topY2 = clamp(streetY1 - 1, 0, rows - 1);
  const topY1 = clamp(topY2 - depth + 1, 0, rows - 1);
  const botY1 = clamp(streetY2 + 1, 0, rows - 1);
  const botY2 = clamp(botY1 + depth - 1, 0, rows - 1);

  const placedPatterns = placeCityPatterns({
    draft,
    rand,
    obstacleTypes: ctx.obstacleTypes,
    cols,
    rows,
    topY2,
    prompt: spec.prompt
  });
  if (placedPatterns > 0) {
    draft.log.push(`Patterns: +${placedPatterns} (city).`);
  }

  draft.log.push("Maisons: murs places uniquement via patterns.");

  return { draft, playerStart };
}
