import type { GridPosition } from "../../../types";
import type { MapBuildContext, MapSpec } from "../types";
import { clamp, createDraft, setLight, setTerrain, tryPlaceObstacle, key, buildReservedRadius } from "../draft";
import { findObstacleType, pickVariantIdForPlacement, rotationForLine } from "../obstacleSelector";

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
      setTerrain(draft, x, y, "road");
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

  let placed = 0;
  const placeWallLine = (y: number, x1: number, x2: number) => {
    for (let x = x1; x <= x2; x++) {
      const variantId = pickVariantIdForPlacement(wallType, "line", rand);
      const rot = rotationForLine(wallType, variantId, "horizontal");
      if (tryPlaceObstacle({ draft, type: wallType, x, y, variantId, rotation: rot })) placed++;
    }
  };

  // "Façades" des maisons: une ligne de mur le long de la rue, portes fermées = aucune ouverture.
  if (topY2 >= 0 && topY2 < rows) placeWallLine(topY2, 0, cols - 1);
  if (botY1 >= 0 && botY1 < rows) placeWallLine(botY1, 0, cols - 1);

  // Murs arrière (optionnel si on a la place)
  if (topY1 !== topY2 && topY1 >= 0 && topY1 < rows) placeWallLine(topY1, 0, cols - 1);
  if (botY2 !== botY1 && botY2 >= 0 && botY2 < rows) placeWallLine(botY2, 0, cols - 1);

  draft.log.push(`Maisons: ${placed} segments de murs (portes ${city.doors === "closed" ? "fermées" : "ouvertes"}).`);

  return { draft, playerStart };
}

