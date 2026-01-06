import type { GridPosition } from "../../../types";
import type { ObstacleTypeDefinition } from "../../obstacleTypes";
import type { MapBuildContext, MapSpec } from "../types";
import {
  buildReservedRadius,
  clamp,
  createDraft,
  setLight,
  setTerrain,
  tryPlaceObstacle,
  key,
  scatterTerrainPatches
} from "../draft";
import { findObstacleType, pickVariantIdForPlacement, weightedTypesForContext } from "../obstacleSelector";
import { pickWeighted, randomIntInclusive } from "../random";

function pickDungeonDefaults(ctx: MapBuildContext) {
  const wallType =
    findObstacleType(ctx.obstacleTypes, "wall-stone") ??
    ctx.obstacleTypes.find(t => t.category === "wall") ??
    ctx.obstacleTypes[0] ??
    null;

  const pillarType =
    findObstacleType(ctx.obstacleTypes, "pillar-stone") ??
    ctx.obstacleTypes.find(t => (t.tags ?? []).includes("pillar")) ??
    null;

  const barrelType =
    findObstacleType(ctx.obstacleTypes, "barrel-wood") ??
    ctx.obstacleTypes.find(t => (t.tags ?? []).includes("barrel")) ??
    null;

  return { wallType, pillarType, barrelType };
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

export function generateDungeonSquareRoom(params: {
  spec: MapSpec;
  ctx: MapBuildContext;
  rand: () => number;
}): { draft: ReturnType<typeof createDraft>; playerStart: GridPosition } {
  const { spec, ctx, rand } = params;
  const cols = Math.max(1, spec.grid.cols);
  const rows = Math.max(1, spec.grid.rows);

  const draft = createDraft({ cols, rows, reserved: new Set(), seedPrefix: "obs" });
  draft.log.push("Layout: donjon (salle carrée/rectangulaire).");

  // Ici, la forme de la battlemap = la grille entière (le masque jouable est le rectangle complet).
  // Les murs sont donc posés sur la bordure de la grille.
  // (Plus tard: on pourra placer une salle interne, ou des couloirs, etc.)

  // Terrain + lumière de base
  const baseLight =
    spec.dungeon?.lighting === "low"
      ? 0.35
      : 0.8;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      setTerrain(draft, x, y, "stone");
      setLight(draft, x, y, baseLight);
    }
  }
  const dirtPatchCount = clamp(Math.floor((cols * rows) / 140), 1, 6);
  scatterTerrainPatches({
    draft,
    rand,
    terrain: "dirt",
    count: dirtPatchCount,
    radiusMin: 1,
    radiusMax: 2
  });

  const playerStart: GridPosition = { x: 1, y: Math.floor(rows / 2) };
  draft.reserved = buildReservedRadius(playerStart, 2, cols, rows);

  const { wallType, pillarType, barrelType } = pickDungeonDefaults(ctx);
  const dSpec = spec.dungeon ?? {
    borderWalls: true,
    entrances: { count: 2, width: 1 },
    room: { shape: "rectangle" },
    columns: 0,
    hasAltar: false,
    lighting: "normal"
  };

  const rect = { x1: 0, y1: 0, x2: cols - 1, y2: rows - 1 };
  const boundaryCells = buildRectBoundary(rect);

  const openings = chooseOpenings({
    boundary: boundaryCells,
    count: dSpec.entrances?.count ?? 2,
    rand
  });
  const openingKeys = new Set(openings.map(o => key(o.x, o.y)));
  for (const ok of openingKeys) draft.reserved.add(ok);

  // Murs sur la bordure (variant 1x1 privilégié pour la continuité).
  if (wallType && dSpec.borderWalls) {
    const smallestVariant =
      (wallType.variants ?? [])
        .map(v => ({
          id: v.id,
          len: Array.isArray(v.footprint) ? v.footprint.length : 1
        }))
        .sort((a, b) => a.len - b.len)[0]?.id ?? (wallType.variants?.[0]?.id ?? "1");

    let placedWalls = 0;
    for (const cell of boundaryCells) {
      if (openingKeys.has(key(cell.x, cell.y))) continue;
      const ok = tryPlaceObstacle({
        draft,
        type: wallType,
        x: cell.x,
        y: cell.y,
        variantId: smallestVariant,
        rotation: 0
      });
      if (ok) placedWalls++;
    }
    draft.log.push(`Murs: ${placedWalls} segments (avec ${openings.length} accès).`);
  } else {
    draft.log.push("Murs: aucun type de mur disponible.");
  }

  // Colonnes dans l'intérieur (hors bordure)
  const columns = Math.max(0, dSpec.columns ?? 0);
  if (columns > 0) {
    const typeForColumns = pillarType ?? wallType;
    let placed = 0;

    let attempts = 0;
    while (placed < columns && attempts < 300) {
      attempts++;
      const x = clamp(1 + Math.floor(rand() * Math.max(1, cols - 2)), 1, Math.max(1, cols - 2));
      const y = clamp(1 + Math.floor(rand() * Math.max(1, rows - 2)), 1, Math.max(1, rows - 2));
      const variantId = typeForColumns ? pickVariantIdForPlacement(typeForColumns, "scatter", rand) : "base";
      const ok = tryPlaceObstacle({ draft, type: typeForColumns, x, y, variantId, rotation: 0 });
      if (ok) placed++;
    }

    draft.log.push(`Colonnes: ${placed}/${columns}.`);
  }

  // "Autel" central (fallback sur un prop)
  if (dSpec.hasAltar) {
    const altarType: ObstacleTypeDefinition | null = barrelType ?? pillarType ?? null;
    if (altarType) {
      const variantId = pickVariantIdForPlacement(altarType, "room", rand);
      const cx = Math.floor(cols / 2);
      const cy = Math.floor(rows / 2);
      const ok = tryPlaceObstacle({ draft, type: altarType, x: cx, y: cy, variantId, rotation: 0 });
      draft.log.push(ok ? "Autel: placé au centre." : "Autel: placement impossible (collision).");
    } else {
      draft.log.push("Autel: aucun type d'obstacle approprié.");
    }
  }

  // Quelques props si vide (hors murs)
  const propTypes = weightedTypesForContext(ctx.obstacleTypes, t => t.category !== "wall");
  const extraPropsTarget = clamp(Math.floor((cols * rows) / 120), 0, 6);
  let extraPlaced = 0;
  let attempts = 0;
  while (extraPlaced < extraPropsTarget && attempts < 300) {
    attempts++;
    const chosen = pickWeighted(propTypes, rand) ?? null;
    if (!chosen) break;
    const x = clamp(1 + randomIntInclusive(rand, 0, Math.max(0, cols - 3)), 1, Math.max(1, cols - 2));
    const y = clamp(1 + randomIntInclusive(rand, 0, Math.max(0, rows - 3)), 1, Math.max(1, rows - 2));
    const variantId = pickVariantIdForPlacement(chosen, "scatter", rand);
    const ok = tryPlaceObstacle({ draft, type: chosen, x, y, variantId, rotation: 0 });
    if (ok) extraPlaced++;
  }
  if (extraPlaced) draft.log.push(`Props: +${extraPlaced}.`);

  return { draft, playerStart };
}
