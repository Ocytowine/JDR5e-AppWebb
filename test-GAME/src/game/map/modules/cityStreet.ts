import type { GridPosition } from "../../../types";
import type { MapBuildContext, MapSpec } from "../types";
import { clamp, createDraft, setHeight, setLight, setTerrain, tryPlaceObstacle, tryPlaceWall } from "../draft";
import { findWallType } from "../wallSelector";
import { findObstacleType } from "../obstacleSelector";
import { loadMapPatternsFromIndex } from "../../mapPatternCatalog";
import { choosePatternsByPrompt, getPatternSize, pickPatternTransform, placePattern } from "../patterns";

const CITY_PATTERNS = loadMapPatternsFromIndex().filter(p => p.theme === "city");

function resolveCityPatterns(
  spec: MapSpec
): { patterns: typeof CITY_PATTERNS; requested: string[] | null } {
  const requested = Array.isArray(spec.city?.patterns) && spec.city?.patterns.length
    ? spec.city.patterns
    : null;
  if (!requested) return { patterns: CITY_PATTERNS, requested: null };
  const requestedSet = new Set(requested);
  const filtered = CITY_PATTERNS.filter(p => requestedSet.has(p.id));
  return { patterns: filtered, requested };
}

function placeCityPatterns(params: {
  draft: ReturnType<typeof createDraft>;
  rand: () => number;
  obstacleTypes: MapBuildContext["obstacleTypes"];
  wallTypes: MapBuildContext["wallTypes"];
  cols: number;
  rows: number;
  anchorYs: number[];
  prompt: string;
  patterns: typeof CITY_PATTERNS;
  requestedPatterns: string[] | null;
}): { count: number; ids: string[] } {
  const { draft, rand, obstacleTypes, wallTypes, cols, rows, anchorYs, prompt, patterns, requestedPatterns } = params;
  if (patterns.length === 0) return { count: 0, ids: [] };

  let placed = 0;
  const placedIds: string[] = [];
  const attempts = Math.min(8, cols);
  const picks =
    requestedPatterns && requestedPatterns.length
      ? patterns
      : choosePatternsByPrompt({
          patterns,
          prompt,
          rand,
          count: attempts
        });
  for (const pattern of picks) {
    const attemptCount = Math.max(3, Math.min(10, cols));
    let placedThis = false;
    for (let attempt = 0; attempt < attemptCount && !placedThis; attempt++) {
      const transform = pickPatternTransform({
        rand,
        allowedRotations: [0, 180],
        allowMirrorX: true,
        allowMirrorY: false
      });
      const size = getPatternSize(pattern, transform);
      const maxAnchorX = cols - size.w;
      if (maxAnchorX < 0) continue;
      const anchorX = Math.floor(rand() * (maxAnchorX + 1));
      for (const anchorY of anchorYs) {
        if (anchorY < 0 || anchorY >= rows) continue;
        const ok = placePattern({ draft, pattern, anchorX, anchorY, obstacleTypes, wallTypes, rand, transform });
        if (ok) {
          placed++;
          placedIds.push(pattern.id);
          placedThis = true;
          break;
        }
      }
    }
  }

  if (placedIds.length > 0) {
    draft.log.push(`Patterns (city): ${placedIds.join(", ")}.`);
  } else if (requestedPatterns && requestedPatterns.length > 0) {
    draft.log.push(`Patterns (city): echec de placement pour ${requestedPatterns.join(", ")}.`);
  }

  return { count: placed, ids: placedIds };
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
  const draft = createDraft({ cols, rows, reserved: new Set(), seedPrefix: "obs" });

  const city = spec.city ?? {
    direction: "horizontal",
    streetWidth: 2,
    buildingDepth: 2,
    doors: "closed",
    lighting: "day"
  };
  const { patterns, requested } = resolveCityPatterns(spec);

  draft.log.push("Module: city_street.");
  draft.log.push("Layout: ville (rue).");

  const baseLight = city.lighting === "night" ? 0.25 : 0.9;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      setLight(draft, x, y, baseLight);
      setTerrain(draft, x, y, "stone");
    }
  }

  const wallType =
    findWallType(ctx.wallTypes, "wall-stone") ??
    ctx.wallTypes.find(t => t.category === "wall") ??
    ctx.wallTypes[0] ??
    null;
  const wallDoorType =
    findWallType(ctx.wallTypes, "wall-stone-door") ??
    ctx.wallTypes.find(t => (t.behavior?.kind ?? "solid") === "door") ??
    null;

  if (!wallType) {
    draft.log.push("Maisons: aucun type de mur disponible.");
    return { draft, playerStart };
  }

  // Rue horizontale par défaut: une bande centrale libre, maisons de chaque côté.
  const streetW = clamp(Math.floor(city.streetWidth), 1, Math.max(1, rows - 2));
  const maxDepth = Math.max(1, Math.floor(rows / 2) - 1);
  let depth = clamp(Math.floor(city.buildingDepth), 1, maxDepth);
  if (requested && patterns.length > 0) {
    const requiredDepth = patterns.reduce(
      (max, p) => Math.max(max, Math.floor(p.footprint.h)),
      1
    );
    if (requiredDepth > maxDepth) {
      draft.log.push(`Patterns: besoin depth=${requiredDepth}, max=${maxDepth} (trop petit).`);
    } else if (requiredDepth > depth) {
      depth = clamp(requiredDepth, 1, maxDepth);
      draft.log.push(`Patterns: buildingDepth ajuste a ${depth}.`);
    }
  }
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

  const promptLower = String(spec.prompt ?? "").toLowerCase();
  const wantsBalcony = promptLower.includes("balcon");

  if (wantsBalcony && topY2 >= 2) {
    const stairType = findObstacleType(ctx.obstacleTypes, "stairs-stone");
    const houseW = clamp(Math.floor(cols / 3), 4, Math.max(4, cols - 2));
    const houseX1 = clamp(Math.floor(cols * 0.65) - Math.floor(houseW / 2), 1, cols - houseW - 1);
    const houseX2 = clamp(houseX1 + houseW - 1, 1, cols - 2);
    const houseDepth = clamp(Math.max(3, depth), 3, Math.max(3, topY2 + 1));
    const houseY2 = topY2;
    const houseY1 = clamp(houseY2 - houseDepth + 1, 0, houseY2);

    const smallestVariant =
      (wallType.variants ?? [])
        .map(v => ({
          id: v.id,
          len: Array.isArray(v.footprint) ? v.footprint.length : 1
        }))
        .sort((a, b) => a.len - b.len)[0]?.id ?? (wallType.variants?.[0]?.id ?? "1");

    const doorX = clamp(houseX1 + Math.floor(houseW / 2), 1, cols - 2);
    for (let x = houseX1; x <= houseX2; x++) {
      const isDoorCell = x === doorX && houseY2 === topY2;
      const typeForCell = isDoorCell && wallDoorType ? wallDoorType : wallType;
      const state = isDoorCell ? "open" : "closed";
      tryPlaceWall({
        draft,
        type: typeForCell,
        x,
        y: houseY2,
        variantId: smallestVariant,
        rotation: 0,
        state
      });
      tryPlaceWall({
        draft,
        type: wallType,
        x,
        y: houseY1,
        variantId: smallestVariant,
        rotation: 0
      });
    }

    for (let y = houseY1 + 1; y <= houseY2 - 1; y++) {
      tryPlaceWall({
        draft,
        type: wallType,
        x: houseX1,
        y,
        variantId: smallestVariant,
        rotation: 0
      });
      tryPlaceWall({
        draft,
        type: wallType,
        x: houseX2,
        y,
        variantId: smallestVariant,
        rotation: 0
      });
    }

    const balconyY = houseY2 - 2;
    const stairY = houseY2 - 1;
    if (balconyY >= houseY1 && stairY >= houseY1) {
      for (let x = houseX1 + 1; x <= houseX2 - 1; x++) {
        setHeight(draft, x, balconyY, 1);
        setTerrain(draft, x, balconyY, "stone");
      }

      if (stairType) {
        const stairX = doorX;
        tryPlaceObstacle({
          draft,
          type: stairType,
          x: stairX,
          y: stairY,
          variantId: stairType.variants?.[0]?.id ?? "base",
          rotation: 0
        });
      }
      draft.log.push("Balcon: maison + niveau 1 (demo).");
    }
  }

  if (requested && requested.length > 0 && patterns.length === 0) {
    draft.log.push(`Patterns (city): aucun pattern charge pour ${requested.join(", ")}.`);
  }
  const placedPatterns = placeCityPatterns({
    draft,
    rand,
    obstacleTypes: ctx.obstacleTypes,
    wallTypes: ctx.wallTypes,
    cols,
    rows,
    anchorYs: [topY2, botY2],
    prompt: spec.prompt,
    patterns,
    requestedPatterns: requested
  });
  if (placedPatterns.count > 0) {
    draft.log.push(`Patterns: +${placedPatterns.count} (city).`);
  }

  draft.log.push("Maisons: murs places uniquement via patterns.");

  return { draft, playerStart };
}
