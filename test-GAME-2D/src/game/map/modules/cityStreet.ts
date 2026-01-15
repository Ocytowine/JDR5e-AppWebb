import type { GridPosition } from "../../../types";
import type { MapBuildContext, MapSpec } from "../types";
import { clamp, createDraft, setHeight, setLight, setTerrain, tryPlaceObstacle } from "../draft";
import { loadMapPatternsFromIndex } from "../../mapPatternCatalog";
import { choosePatternsByPrompt, getPatternSize, pickPatternTransform, placePattern } from "../patterns";

const CITY_PATTERNS = loadMapPatternsFromIndex().filter(p => p.theme === "city");

function resolveCityPatterns(
  spec: MapSpec
): { patterns: typeof CITY_PATTERNS; requested: string[] | null; requestedCount: number | null } {
  const requested = Array.isArray(spec.city?.patterns) && spec.city?.patterns.length
    ? spec.city.patterns
    : null;
  const requestedCount =
    typeof spec.city?.patternCount === "number"
      ? Math.max(1, Math.floor(spec.city.patternCount))
      : null;
  if (!requested) return { patterns: CITY_PATTERNS, requested: null, requestedCount };
  const requestedSet = new Set(requested);
  const filtered = CITY_PATTERNS.filter(p => requestedSet.has(p.id));
  return { patterns: filtered, requested, requestedCount };
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
  patternCount: number | null;
}): { count: number; ids: string[] } {
  const { draft, rand, obstacleTypes, wallTypes, cols, rows, anchorYs, prompt, patterns, requestedPatterns, patternCount } = params;
  if (patterns.length === 0) return { count: 0, ids: [] };

  const anchorOffset = (
    anchor: "center" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight",
    size: { w: number; h: number }
  ) => {
    switch (anchor) {
      case "topRight":
        return { x: size.w - 1, y: 0 };
      case "bottomLeft":
        return { x: 0, y: size.h - 1 };
      case "bottomRight":
        return { x: size.w - 1, y: size.h - 1 };
      case "center":
        return { x: Math.floor((size.w - 1) / 2), y: Math.floor((size.h - 1) / 2) };
      default:
        return { x: 0, y: 0 };
    }
  };

  let placed = 0;
  const placedIds: string[] = [];
  const attempts = Math.min(8, cols);
  const desiredCount = Math.max(
    1,
    Math.floor(
      patternCount ?? (requestedPatterns && requestedPatterns.length ? patterns.length : attempts)
    )
  );
  const picks =
    requestedPatterns && requestedPatterns.length
      ? Array.from({ length: desiredCount }, (_, idx) => patterns[idx % patterns.length] as typeof patterns[number])
      : choosePatternsByPrompt({
          patterns,
          prompt,
          rand,
          count: desiredCount
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
          const offset = anchorOffset(pattern.anchor, size);
          const originX = anchorX - offset.x;
          const originY = anchorY - offset.y;
          placed++;
          placedIds.push(pattern.id);
          placedThis = true;
          draft.log.push(
            `Pattern placee: ${pattern.id} anchor=(${anchorX},${anchorY}) origin=(${originX},${originY}) size=${size.w}x${size.h} rot=${transform.rotation ?? 0} mx=${transform.mirrorX ? 1 : 0} my=${transform.mirrorY ? 1 : 0}`
          );
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
  const { patterns, requested, requestedCount } = resolveCityPatterns(spec);

  draft.log.push("Module: city_street.");
  draft.log.push("Layout: ville (rue).");

  const baseLight = city.lighting === "night" ? 0.25 : 0.9;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      setLight(draft, x, y, baseLight);
      setTerrain(draft, x, y, "stone");
    }
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
    requestedPatterns: requested,
    patternCount: requestedCount
  });
  if (placedPatterns.count > 0) {
    draft.log.push(`Patterns: +${placedPatterns.count} (city).`);
  }

  draft.log.push("Maisons: murs places uniquement via patterns.");

  return { draft, playerStart };
}
