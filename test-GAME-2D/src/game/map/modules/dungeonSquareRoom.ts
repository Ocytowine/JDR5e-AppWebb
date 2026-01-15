import type { GridPosition } from "../../../types";
import type { ObstacleTypeDefinition } from "../../obstacleTypes";
import type { EntrancePlacementSpec, EntranceSide, MapBuildContext, MapEntrancesSpec, MapSpec } from "../types";
import {
  clamp,
  createDraft,
  setLight,
  setTerrain,
  tryPlaceObstacle,
  tryPlaceWallSegment,
  key,
  scatterTerrainPatches
} from "../draft";
import { pickVariantIdForPlacement, weightedTypesForContext } from "../obstacleSelector";
import { findWallType } from "../wallSelector";
import { pickWeighted, randomIntInclusive } from "../random";
import { resolveWallKindFromType } from "../walls/kind";
import { resolveWallMaxHp } from "../walls/durability";
import type { WallDirection, WallKind } from "../walls/types";

function pickDungeonDefaults(ctx: MapBuildContext) {
  const wallType =
    findWallType(ctx.wallTypes, "wall-stone") ??
    ctx.wallTypes.find(t => t.category === "wall") ??
    ctx.wallTypes[0] ??
    null;
  const wallDoorType =
    findWallType(ctx.wallTypes, "wall-stone-door") ??
    ctx.wallTypes.find(t => (t.tags ?? []).includes("door")) ??
    null;

  const pillarType =
    ctx.obstacleTypes.find(t => t.id === "pillar-stone") ??
    ctx.obstacleTypes.find(t => (t.tags ?? []).includes("pillar")) ??
    null;

  const barrelType =
    ctx.obstacleTypes.find(t => t.id === "barrel-wood") ??
    ctx.obstacleTypes.find(t => (t.tags ?? []).includes("barrel")) ??
    null;

  return { wallType, wallDoorType, pillarType, barrelType };
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

function groupBoundaryBySide(rect: { x1: number; y1: number; x2: number; y2: number }): Record<EntranceSide, GridPosition[]> {
  const north: GridPosition[] = [];
  const south: GridPosition[] = [];
  const west: GridPosition[] = [];
  const east: GridPosition[] = [];

  for (let x = rect.x1; x <= rect.x2; x++) {
    north.push({ x, y: rect.y1 });
    south.push({ x, y: rect.y2 });
  }
  for (let y = rect.y1 + 1; y <= rect.y2 - 1; y++) {
    west.push({ x: rect.x1, y });
    east.push({ x: rect.x2, y });
  }

  return { north, south, west, east };
}

function placeBoundaryEdges(params: {
  draft: ReturnType<typeof createDraft>;
  boundaryBySide: Record<EntranceSide, GridPosition[]>;
  wallType: ReturnType<typeof pickDungeonDefaults>["wallType"];
  wallDoorType: ReturnType<typeof pickDungeonDefaults>["wallDoorType"];
  openingKeys: Set<string>;
}): number {
  const { draft, boundaryBySide, wallType, wallDoorType, openingKeys } = params;
  if (!wallType) return 0;
  const baseKind = resolveWallKindFromType(wallType);
  const doorKind: WallKind = wallDoorType ? resolveWallKindFromType(wallDoorType) : "door";
  const baseMaxHp = resolveWallMaxHp(wallType);
  const doorMaxHp = resolveWallMaxHp(wallDoorType);

  const placeSide = (cells: GridPosition[], dir: WallDirection) => {
    let placed = 0;
    for (const cell of cells) {
      const isOpening = openingKeys.has(key(cell.x, cell.y));
      const kind = isOpening ? doorKind : baseKind;
      const state = isOpening ? "open" : undefined;
      const typeId = isOpening ? wallDoorType?.id : wallType.id;
      const maxHp = isOpening ? doorMaxHp : baseMaxHp;
      if (tryPlaceWallSegment({ draft, x: cell.x, y: cell.y, dir, kind, state, typeId, maxHp: maxHp ?? undefined, allowOnReserved: true })) placed++;
    }
    return placed;
  };

  return (
    placeSide(boundaryBySide.north, "N") +
    placeSide(boundaryBySide.south, "S") +
    placeSide(boundaryBySide.west, "W") +
    placeSide(boundaryBySide.east, "E")
  );
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

function pickByPosition(
  cells: GridPosition[],
  position: EntrancePlacementSpec["position"] | undefined
): GridPosition | null {
  if (!cells.length) return null;
  if (!position) return cells[Math.floor(cells.length / 2)] ?? null;
  if (position === "start") return cells[0] ?? null;
  if (position === "end") return cells[cells.length - 1] ?? null;
  return cells[Math.floor(cells.length / 2)] ?? null;
}

function pickOpeningsOnSide(params: {
  cells: GridPosition[];
  count: number;
  position?: EntrancePlacementSpec["position"];
  rand: () => number;
}): GridPosition[] {
  const { cells, count, position, rand } = params;
  if (!cells.length || count <= 0) return [];
  if (count === 1) {
    const picked = pickByPosition(cells, position);
    return picked ? [picked] : [];
  }

  const picks: GridPosition[] = [];
  const step = Math.max(1, Math.floor(cells.length / (count + 1)));
  for (let i = 0; i < count && i * step < cells.length; i++) {
    const idx = Math.min(cells.length - 1, step * (i + 1));
    picks.push(cells[idx] ?? cells[cells.length - 1] as GridPosition);
  }

  while (picks.length < count) {
    picks.push(cells[Math.floor(rand() * cells.length)] as GridPosition);
  }

  return picks;
}

function resolveOpenings(params: {
  boundary: GridPosition[];
  bySide: Record<EntranceSide, GridPosition[]>;
  entrances: MapEntrancesSpec;
  rand: () => number;
}): GridPosition[] {
  const { boundary, bySide, entrances, rand } = params;
  if (!entrances) return [];
  const chosen: GridPosition[] = [];
  const chosenKeys = new Set<string>();

  const placements = entrances.placements ?? [];
  for (const placement of placements) {
    const sideCells = bySide[placement.side] ?? [];
    const count = Math.max(1, Math.floor(placement.count ?? 1));
    const picks = pickOpeningsOnSide({
      cells: sideCells,
      count,
      position: placement.position,
      rand
    });
    for (const p of picks) {
      const k = key(p.x, p.y);
      if (chosenKeys.has(k)) continue;
      chosenKeys.add(k);
      chosen.push(p);
    }
  }

  const target = Math.max(0, Math.floor(entrances.count ?? 0));
  if (chosen.length >= target) return chosen.slice(0, target);

  const sideFilter =
    entrances.sides && entrances.sides.length
      ? entrances.sides.flatMap(side => bySide[side] ?? [])
      : boundary;

  const remaining = sideFilter.filter(c => !chosenKeys.has(key(c.x, c.y)));
  const extra = chooseOpenings({
    boundary: remaining,
    count: target - chosen.length,
    rand
  });

  return chosen.concat(extra);
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

  const { wallType, wallDoorType, pillarType, barrelType } = pickDungeonDefaults(ctx);
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
  const boundaryBySide = groupBoundaryBySide(rect);

  const openings = resolveOpenings({
    boundary: boundaryCells,
    bySide: boundaryBySide,
    entrances: dSpec.entrances,
    rand
  });
  const openingKeys = new Set(openings.map(o => key(o.x, o.y)));
  for (const ok of openingKeys) draft.reserved.add(ok);

  // Murs sur la bordure (variant 1x1 privilégié pour la continuité).
  if (wallType && dSpec.borderWalls) {
    const placedWalls = placeBoundaryEdges({
      draft,
      boundaryBySide,
      wallType,
      wallDoorType,
      openingKeys
    });
    draft.log.push(`Murs: ${placedWalls} segments (avec ${openings.length} acces).`);
  } else {
    draft.log.push("Murs: aucun type de mur disponible.");
  }

  // Colonnes dans l'intérieur (hors bordure)
  const columns = Math.max(0, dSpec.columns ?? 0);
  if (columns > 0) {
    const typeForColumns = pillarType ?? null;
    if (!typeForColumns) {
      draft.log.push("Colonnes: aucun type de pilier disponible.");
    }
    let placed = 0;

    let attempts = 0;
    while (typeForColumns && placed < columns && attempts < 300) {
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
