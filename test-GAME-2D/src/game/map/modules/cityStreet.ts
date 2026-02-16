import type { GridPosition } from "../../../types";
import type { MapBuildContext, MapSpec } from "../generation/types";
import { clamp, createDraft, setHeight, setLight, setTerrain, tryPlaceObstacle } from "../generation/draft";
import { loadMapPatternsFromIndex } from "../generation/mapPatternCatalog";
import { choosePatternsByPrompt, getPatternSize, pickPatternTransform, placePattern } from "../generation/patterns";
import { findObstacleType, pickVariantIdForPlacement, randomRotationForPlacement } from "../generation/obstacleSelector";
import type { Orientation8 } from "../../engine/footprint";

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
  anchorYs?: number[];
  anchorXs?: number[];
  prompt: string;
  patterns: typeof CITY_PATTERNS;
  requestedPatterns: string[] | null;
  patternCount: number | null;
}): { count: number; ids: string[] } {
  const { draft, rand, obstacleTypes, wallTypes, cols, rows, anchorYs, anchorXs, prompt, patterns, requestedPatterns, patternCount } = params;
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
      const maxAnchorY = rows - size.h;
      if (maxAnchorX < 0) continue;
      if (maxAnchorY < 0) continue;
      const anchorX = anchorXs && anchorXs.length
        ? anchorXs[Math.floor(rand() * anchorXs.length)]!
        : Math.floor(rand() * (maxAnchorX + 1));
      const anchorY = anchorYs && anchorYs.length
        ? anchorYs[Math.floor(rand() * anchorYs.length)]!
        : Math.floor(rand() * (maxAnchorY + 1));
      if (anchorX < 0 || anchorX >= cols || anchorY < 0 || anchorY >= rows) continue;
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
  const direction = city.direction ?? "horizontal";
  const sidewalk = Math.max(0, Math.floor(city.sidewalk ?? 0));
  const streetW =
    direction === "horizontal"
      ? clamp(Math.floor(city.streetWidth), 1, Math.max(1, rows - 2))
      : clamp(Math.floor(city.streetWidth), 1, Math.max(1, cols - 2));
  const maxDepth =
    direction === "horizontal"
      ? Math.max(1, Math.floor(rows / 2) - 1)
      : Math.max(1, Math.floor(cols / 2) - 1);
  let depth = clamp(Math.floor(city.buildingDepth), 1, maxDepth);
  if (requested && patterns.length > 0) {
    const requiredDepth = patterns.reduce((max, p) => {
      const size = direction === "horizontal" ? p.footprint.h : p.footprint.w;
      return Math.max(max, Math.floor(size));
    }, 1);
    if (requiredDepth > maxDepth) {
      draft.log.push(`Patterns: besoin depth=${requiredDepth}, max=${maxDepth} (trop petit).`);
    } else if (requiredDepth > depth) {
      depth = clamp(requiredDepth, 1, maxDepth);
      draft.log.push(`Patterns: buildingDepth ajuste a ${depth}.`);
    }
  }
  const centerY = clamp(Math.floor(rows / 2), 0, rows - 1);
  const centerX = clamp(Math.floor(cols / 2), 0, cols - 1);
  const offset = city.streetOffset?.amount ?? 0;
  const offsetDir = city.streetOffset?.dir ?? null;
  let streetCenterY = centerY;
  let streetCenterX = centerX;
  if (offset > 0 && offsetDir) {
    if (direction === "horizontal") {
      if (offsetDir === "north") streetCenterY -= offset;
      if (offsetDir === "south") streetCenterY += offset;
    } else {
      if (offsetDir === "west") streetCenterX -= offset;
      if (offsetDir === "east") streetCenterX += offset;
    }
  }
  streetCenterY = clamp(streetCenterY, 0, rows - 1);
  streetCenterX = clamp(streetCenterX, 0, cols - 1);

  const streetY1 = clamp(streetCenterY - Math.floor(streetW / 2), 0, rows - 1);
  const streetY2 = clamp(streetY1 + streetW - 1, 0, rows - 1);
  const streetX1 = clamp(streetCenterX - Math.floor(streetW / 2), 0, cols - 1);
  const streetX2 = clamp(streetX1 + streetW - 1, 0, cols - 1);

  if (direction === "horizontal") {
    for (let y = streetY1; y <= streetY2; y++) {
      for (let x = 0; x < cols; x++) setTerrain(draft, x, y, "road");
    }
  } else {
    for (let x = streetX1; x <= streetX2; x++) {
      for (let y = 0; y < rows; y++) setTerrain(draft, x, y, "road");
    }
  }

  const topY2 = clamp(streetY1 - 1 - sidewalk, 0, rows - 1);
  const topY1 = clamp(topY2 - depth + 1, 0, rows - 1);
  const botY1 = clamp(streetY2 + 1 + sidewalk, 0, rows - 1);
  const botY2 = clamp(botY1 + depth - 1, 0, rows - 1);
  const leftX2 = clamp(streetX1 - 1 - sidewalk, 0, cols - 1);
  const leftX1 = clamp(leftX2 - depth + 1, 0, cols - 1);
  const rightX1 = clamp(streetX2 + 1 + sidewalk, 0, cols - 1);
  const rightX2 = clamp(rightX1 + depth - 1, 0, cols - 1);

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
    anchorYs: direction === "horizontal" ? [topY2, botY2] : undefined,
    anchorXs: direction === "vertical" ? [leftX2, rightX1] : undefined,
    prompt: spec.prompt,
    patterns,
    requestedPatterns: requested,
    patternCount: requestedCount
  });
  if (placedPatterns.count > 0) {
    draft.log.push(`Patterns: +${placedPatterns.count} (city).`);
  }

  if (spec.obstacleRequests && spec.obstacleRequests.length > 0) {
    const maxAttemptsPerItem = Math.max(20, cols * 2);
    for (const req of spec.obstacleRequests) {
      const type = findObstacleType(ctx.obstacleTypes, req.typeId);
      if (!type) {
        draft.log.push(`Obstacle manquant: ${req.typeId}.`);
        continue;
      }
      const count = Math.max(1, Math.floor(req.count ?? 1));
      const orientation = req.orientation as Orientation8 | undefined;
      const placement = req.placement ?? "road";
      let placed = 0;
      let attempts = 0;
      while (placed < count && attempts < maxAttemptsPerItem) {
        attempts += 1;
        let x = Math.floor(rand() * cols);
        let y = Math.floor(rand() * rows);
        if (direction === "horizontal") {
          if (placement === "road") {
            y = clamp(streetY1 + Math.floor(rand() * (streetY2 - streetY1 + 1)), 0, rows - 1);
          } else if (placement === "road_edge" || placement === "between_road_house") {
            const sideRows = [
              ...Array.from({ length: Math.max(0, streetY1 - topY2 - 1) }, (_, i) => topY2 + 1 + i),
              ...Array.from({ length: Math.max(0, botY1 - streetY2 - 1) }, (_, i) => streetY2 + 1 + i)
            ].filter(v => v >= 0 && v < rows);
            if (sideRows.length > 0) {
              y = sideRows[Math.floor(rand() * sideRows.length)]!;
            } else {
              y = clamp(streetY1 + Math.floor(rand() * (streetY2 - streetY1 + 1)), 0, rows - 1);
            }
          } else if (placement === "near_house") {
            const houseRows = [
              ...Array.from({ length: Math.max(0, topY2 - topY1 + 1) }, (_, i) => topY1 + i),
              ...Array.from({ length: Math.max(0, botY2 - botY1 + 1) }, (_, i) => botY1 + i)
            ].filter(v => v >= 0 && v < rows);
            if (houseRows.length > 0) {
              y = houseRows[Math.floor(rand() * houseRows.length)]!;
            }
          }
        } else {
          if (placement === "road") {
            x = clamp(streetX1 + Math.floor(rand() * (streetX2 - streetX1 + 1)), 0, cols - 1);
          } else if (placement === "road_edge" || placement === "between_road_house") {
            const sideCols = [
              ...Array.from({ length: Math.max(0, streetX1 - leftX2 - 1) }, (_, i) => leftX2 + 1 + i),
              ...Array.from({ length: Math.max(0, rightX1 - streetX2 - 1) }, (_, i) => streetX2 + 1 + i)
            ].filter(v => v >= 0 && v < cols);
            if (sideCols.length > 0) {
              x = sideCols[Math.floor(rand() * sideCols.length)]!;
            } else {
              x = clamp(streetX1 + Math.floor(rand() * (streetX2 - streetX1 + 1)), 0, cols - 1);
            }
          } else if (placement === "near_house") {
            const houseCols = [
              ...Array.from({ length: Math.max(0, leftX2 - leftX1 + 1) }, (_, i) => leftX1 + i),
              ...Array.from({ length: Math.max(0, rightX2 - rightX1 + 1) }, (_, i) => rightX1 + i)
            ].filter(v => v >= 0 && v < cols);
            if (houseCols.length > 0) {
              x = houseCols[Math.floor(rand() * houseCols.length)]!;
            }
          }
        }
        const variantId = pickVariantIdForPlacement(type, "scatter", rand);
        const rotation =
          orientation === undefined
            ? randomRotationForPlacement(type, variantId, rand)
            : 0;
        const ok = tryPlaceObstacle({
          draft,
          type,
          x,
          y,
          variantId,
          rotation,
          orientation
        });
        if (ok) placed += 1;
      }
      draft.log.push(`Obstacle demande: ${req.typeId} (${placed}/${count}).`);
    }
  }

  draft.log.push("Maisons: murs places uniquement via patterns.");

  return { draft, playerStart };
}


