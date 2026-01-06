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
import {
  findObstacleType,
  pickVariantIdForPlacement,
  rotationForLine,
  weightedTypesForContext
} from "../obstacleSelector";
import { pickWeighted, randomIntInclusive } from "../random";

function cellDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function buildCircularMask(params: {
  cols: number;
  rows: number;
  cx: number;
  cy: number;
  radius: number;
}): Set<string> {
  const mask = new Set<string>();
  for (let y = 0; y < params.rows; y++) {
    for (let x = 0; x < params.cols; x++) {
      const d = cellDistance(x, y, params.cx, params.cy);
      if (d <= params.radius) mask.add(key(x, y));
    }
  }
  return mask;
}

function isBoundaryCell(mask: Set<string>, x: number, y: number): boolean {
  const k = key(x, y);
  if (!mask.has(k)) return false;
  return (
    !mask.has(key(x + 1, y)) ||
    !mask.has(key(x - 1, y)) ||
    !mask.has(key(x, y + 1)) ||
    !mask.has(key(x, y - 1))
  );
}

function chooseOpeningsOnMaskBoundary(params: {
  cols: number;
  rows: number;
  boundary: GridPosition[];
  count: number;
  rand: () => number;
}): GridPosition[] {
  const { boundary, count, rand } = params;
  if (boundary.length === 0 || count <= 0) return [];

  // Heuristique simple: prendre des points "loin les uns des autres" sur la boundary.
  const chosen: GridPosition[] = [];
  const shuffled = [...boundary].sort(() => rand() - 0.5);

  const minDist = Math.max(2, Math.floor(Math.min(params.cols, params.rows) / 3));

  for (const c of shuffled) {
    if (chosen.length >= count) break;
    if (
      chosen.every(o => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) >= minDist)
    ) {
      chosen.push(c);
    }
  }

  while (chosen.length < count) {
    chosen.push(boundary[Math.floor(rand() * boundary.length)] as GridPosition);
  }

  return chosen.slice(0, count);
}

function pickDungeonDefaults(spec: MapSpec, ctx: MapBuildContext) {
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

export function generateDungeonCircularRoom(params: {
  spec: MapSpec;
  ctx: MapBuildContext;
  rand: () => number;
}): {
  draft: ReturnType<typeof createDraft>;
  playerStart: GridPosition;
} {
  const { spec, ctx, rand } = params;
  const cols = Math.max(1, spec.grid.cols);
  const rows = Math.max(1, spec.grid.rows);

  const draft = createDraft({ cols, rows, reserved: new Set(), seedPrefix: "obs" });
  draft.log.push("Layout: donjon (salle circulaire).");

  const dSpec = spec.dungeon ?? {
    borderWalls: true,
    entrances: { count: 2, width: 1 },
    room: { shape: "circle" },
    columns: 0,
    hasAltar: false,
    lighting: "normal"
  };

  const { wallType, pillarType, barrelType } = pickDungeonDefaults(spec, ctx);

  const roomRadius =
    dSpec.room.radius ?? Math.max(2, Math.floor(Math.min(cols, rows) * 0.33));

  const cx = clamp(Math.floor(cols * 0.62), 0, cols - 1);
  const cy = clamp(Math.floor(rows * 0.5), 0, rows - 1);

  const roomMask = buildCircularMask({ cols, rows, cx, cy, radius: roomRadius });
  draft.playable = roomMask;

  // Player start: une cellule jouable proche de l'ouverture la plus "à gauche".
  let playerStart: GridPosition = { x: cx, y: cy };
  let best: GridPosition | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const k of roomMask) {
    const [xStr, yStr] = k.split(",");
    const x = Number(xStr);
    const y = Number(yStr);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const score = x * 100 + Math.abs(y - cy);
    if (score < bestScore) {
      bestScore = score;
      best = { x, y };
    }
  }
  if (best) playerStart = best;
  draft.reserved = buildReservedRadius(playerStart, 2, cols, rows);

  // Terrain de base
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (roomMask.has(key(x, y))) setTerrain(draft, x, y, "stone");
    }
  }
  const dirtPatchCount = clamp(Math.floor((roomMask.size || 0) / 140), 1, 5);
  scatterTerrainPatches({
    draft,
    rand,
    terrain: "dirt",
    count: dirtPatchCount,
    radiusMin: 1,
    radiusMax: 2,
    mask: roomMask
  });

  // Lighting: faible sur les bords, plus forte au centre si demandé
  const baseLight = dSpec.lighting === "low" ? 0.25 : 0.75;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!roomMask.has(key(x, y))) continue;
      const dist = cellDistance(x, y, cx, cy);
      const t = clamp(1 - dist / (roomRadius + 0.001), 0, 1);
      const centerBoost = dSpec.lighting === "low" ? 0.55 * t : 0.15 * t;
      setLight(draft, x, y, clamp(baseLight + centerBoost, 0, 1));
    }
  }

  // Boundary cells = murs
  const boundaryCells: GridPosition[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!isBoundaryCell(roomMask, x, y)) continue;
      boundaryCells.push({ x, y });
    }
  }

  // Ouvertures (accès) dans les murs
  const openings = chooseOpeningsOnMaskBoundary({
    cols,
    rows,
    boundary: boundaryCells,
    count: Math.max(0, dSpec.entrances.count),
    rand
  });
  const openingKeys = new Set(openings.map(o => key(o.x, o.y)));
  for (const ok of openingKeys) draft.reserved.add(ok);

  if (wallType && dSpec.borderWalls) {
    let placedWalls = 0;
    const smallestVariant =
      (wallType.variants ?? [])
        .map(v => ({
          id: v.id,
          len: Array.isArray(v.footprint) ? v.footprint.length : 1
        }))
        .sort((a, b) => a.len - b.len)[0]?.id ?? (wallType.variants?.[0]?.id ?? "1");
    for (const cell of boundaryCells) {
      if (openingKeys.has(key(cell.x, cell.y))) continue;
      // Pour une enceinte continue, on privilégie un variant 1 case.
      const variantId = smallestVariant;
      const rot = rotationForLine(wallType, variantId, "horizontal");
      const ok = tryPlaceObstacle({
        draft,
        type: wallType,
        x: cell.x,
        y: cell.y,
        variantId,
        rotation: rot
      });
      if (ok) placedWalls++;
    }
    draft.log.push(`Murs: ${placedWalls} segments (avec ${openings.length} accès).`);
  } else {
    draft.log.push("Murs: aucun type de mur disponible.");
  }

  // Colonnes: réparties autour du centre
  const columns = Math.max(0, dSpec.columns);
  if (columns > 0) {
    const typeForColumns = pillarType ?? wallType;
    let placed = 0;

    const ring = Math.max(1, Math.floor(roomRadius * 0.5));
    const candidates: GridPosition[] = [
      { x: cx + ring, y: cy },
      { x: cx - ring, y: cy },
      { x: cx, y: cy + ring },
      { x: cx, y: cy - ring }
    ].filter(p => roomMask.has(key(p.x, p.y)));

    while (placed < columns && candidates.length) {
      const p = candidates.shift() as GridPosition;
      const variantId = typeForColumns ? pickVariantIdForPlacement(typeForColumns, "scatter", rand) : "base";
      const ok = tryPlaceObstacle({
        draft,
        type: typeForColumns,
        x: p.x,
        y: p.y,
        variantId,
        rotation: 0
      });
      if (ok) placed++;
    }

    // Si on a demandé plus que 4 colonnes, on complète en scatter à l'intérieur.
    let attempts = 0;
    while (placed < columns && attempts < 200) {
      attempts++;
      const x = clamp(cx + randomIntInclusive(rand, -roomRadius + 1, roomRadius - 1), 0, cols - 1);
      const y = clamp(cy + randomIntInclusive(rand, -roomRadius + 1, roomRadius - 1), 0, rows - 1);
      if (!roomMask.has(key(x, y))) continue;
      if (openingKeys.has(key(x, y))) continue;
      const variantId = typeForColumns ? pickVariantIdForPlacement(typeForColumns, "scatter", rand) : "base";
      const ok = tryPlaceObstacle({
        draft,
        type: typeForColumns,
        x,
        y,
        variantId,
        rotation: 0
      });
      if (ok) placed++;
    }

    draft.log.push(`Colonnes: ${placed}/${columns}.`);
  }

  // "Autel" central: pour l'instant, on utilise un prop existant (tonneau ou pilier).
  if (dSpec.hasAltar) {
    const altarType: ObstacleTypeDefinition | null = barrelType ?? pillarType ?? null;
    if (altarType) {
      const variantId = pickVariantIdForPlacement(altarType, "room", rand);
      const ok = tryPlaceObstacle({
        draft,
        type: altarType,
        x: cx,
        y: cy,
        variantId,
        rotation: 0
      });
      draft.log.push(ok ? "Autel: placé au centre." : "Autel: placement impossible (collision).");
    } else {
      draft.log.push("Autel: aucun type d'obstacle approprié.");
    }
  }

  // Props divers si la salle est trop vide
  const propTypes = weightedTypesForContext(ctx.obstacleTypes, t => t.category !== "wall");
  const extraPropsTarget = clamp(Math.floor((cols * rows) / 45), 1, 3);
  let extraPlaced = 0;
  let attempts = 0;
  while (extraPlaced < extraPropsTarget && attempts < 120) {
    attempts++;
    const chosen = pickWeighted(propTypes, rand) ?? null;
    if (!chosen) break;
    const x = clamp(cx + randomIntInclusive(rand, -roomRadius + 1, roomRadius - 1), 0, cols - 1);
    const y = clamp(cy + randomIntInclusive(rand, -roomRadius + 1, roomRadius - 1), 0, rows - 1);
    if (!roomMask.has(key(x, y))) continue;
    if (openingKeys.has(key(x, y))) continue;

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
    if (ok) extraPlaced++;
  }
  if (extraPlaced > 0) draft.log.push(`Props: +${extraPlaced}.`);

  return { draft, playerStart };
}
