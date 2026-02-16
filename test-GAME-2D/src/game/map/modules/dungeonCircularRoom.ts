import type { GridPosition } from "../../../types";
import type { ObstacleTypeDefinition } from "../../obstacleTypes";
import type { EntrancePlacementSpec, EntranceSide, MapBuildContext, MapEntrancesSpec, MapSpec } from "../generation/types";
import {
  clamp,
  createDraft,
  setLight,
  setTerrain,
  tryPlaceObstacle,
  tryPlaceWallSegment,
  key,
  scatterTerrainPatches
} from "../generation/draft";
import { pickVariantIdForPlacement, randomRotationForPlacement, weightedTypesForContext } from "../generation/obstacleSelector";
import { findWallType } from "../generation/wallSelector";
import { pickWeighted, randomIntInclusive } from "../generation/random";
import { resolveWallKindFromType } from "../walls/kind";
import { resolveWallMaxHp } from "../walls/durability";
import type { WallDirection, WallKind } from "../walls/types";

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

function groupBoundaryBySide(params: {
  boundary: GridPosition[];
  cx: number;
  cy: number;
}): Record<EntranceSide, GridPosition[]> {
  const north: GridPosition[] = [];
  const south: GridPosition[] = [];
  const west: GridPosition[] = [];
  const east: GridPosition[] = [];

  for (const cell of params.boundary) {
    const dx = cell.x - params.cx;
    const dy = cell.y - params.cy;
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx >= 0) east.push(cell);
      else west.push(cell);
    } else {
      if (dy >= 0) south.push(cell);
      else north.push(cell);
    }
  }

  north.sort((a, b) => a.x - b.x);
  south.sort((a, b) => a.x - b.x);
  west.sort((a, b) => a.y - b.y);
  east.sort((a, b) => a.y - b.y);

  return { north, south, west, east };
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
  cols: number;
  rows: number;
  rand: () => number;
}): GridPosition[] {
  const { boundary, bySide, entrances, cols, rows, rand } = params;
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
  const extra = chooseOpeningsOnMaskBoundary({
    cols,
    rows,
    boundary: remaining,
    count: target - chosen.length,
    rand
  });

  return chosen.concat(extra);
}

function pickDungeonDefaults(spec: MapSpec, ctx: MapBuildContext) {
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

  const { wallType, wallDoorType, pillarType, barrelType } = pickDungeonDefaults(spec, ctx);

  const roomRadius =
    dSpec.room.radius ?? Math.max(2, Math.floor(Math.min(cols, rows) * 0.33));

  const cx = clamp(Math.floor(cols * 0.62), 0, cols - 1);
  const cy = clamp(Math.floor(rows * 0.5), 0, rows - 1);

  const roomMask = buildCircularMask({ cols, rows, cx, cy, radius: roomRadius });
  draft.playable = roomMask;

  // Player start: une cellule jouable proche de l'ouverture la plus "� gauche".
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

  // Lighting: faible sur les bords, plus forte au centre si demand�
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

  // Ouvertures (acc�s) dans les murs
  const boundaryBySide = groupBoundaryBySide({ boundary: boundaryCells, cx, cy });

  const openings = resolveOpenings({
    boundary: boundaryCells,
    bySide: boundaryBySide,
    entrances: dSpec.entrances,
    cols,
    rows,
    rand
  });
  const openingKeys = new Set(openings.map(o => key(o.x, o.y)));
  for (const ok of openingKeys) draft.reserved.add(ok);

  if (wallType && dSpec.borderWalls) {
    const baseKind = resolveWallKindFromType(wallType);
    const doorKind: WallKind = wallDoorType ? resolveWallKindFromType(wallDoorType) : "door";
    const baseMaxHp = resolveWallMaxHp(wallType);
    const doorMaxHp = resolveWallMaxHp(wallDoorType);
    let placedWalls = 0;

    const openingDirForCell = (cell: GridPosition): WallDirection => {
      const dx = cell.x - cx;
      const dy = cell.y - cy;
      if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "E" : "W";
      return dy >= 0 ? "S" : "N";
    };

    const dirs: { dx: number; dy: number; dir: WallDirection }[] = [
      { dx: 0, dy: -1, dir: "N" },
      { dx: 0, dy: 1, dir: "S" },
      { dx: -1, dy: 0, dir: "W" },
      { dx: 1, dy: 0, dir: "E" }
    ];

    for (const cell of boundaryCells) {
      const isOpening = openingKeys.has(key(cell.x, cell.y));
      const openingDir = isOpening ? openingDirForCell(cell) : null;
      for (const d of dirs) {
        const nx = cell.x + d.dx;
        const ny = cell.y + d.dy;
        const neighborKey = key(nx, ny);
        if (roomMask.has(neighborKey)) continue;
        const isDoorEdge = isOpening && openingDir === d.dir;
        const kind = isDoorEdge ? doorKind : baseKind;
        const state = isDoorEdge ? "open" : undefined;
        const typeId = isDoorEdge ? wallDoorType?.id : wallType.id;
        const maxHp = isDoorEdge ? doorMaxHp : baseMaxHp;
        if (tryPlaceWallSegment({
          draft,
          x: cell.x,
          y: cell.y,
          dir: d.dir,
          kind,
          state,
          typeId,
          maxHp: maxHp ?? undefined,
          allowOnReserved: true
        })) {
          placedWalls++;
        }
      }
    }
    draft.log.push(`Murs: ${placedWalls} segments (avec ${openings.length} acces).`);
  } else {
    draft.log.push("Murs: aucun type de mur disponible.");
  }

  // Colonnes: r�parties autour du centre
  const columns = Math.max(0, dSpec.columns);
  if (columns > 0) {
    const typeForColumns = pillarType ?? null;
    if (!typeForColumns) {
      draft.log.push("Colonnes: aucun type de pilier disponible.");
    }
    let placed = 0;

    const ring = Math.max(1, Math.floor(roomRadius * 0.5));
    const candidates: GridPosition[] = [
      { x: cx + ring, y: cy },
      { x: cx - ring, y: cy },
      { x: cx, y: cy + ring },
      { x: cx, y: cy - ring }
    ].filter(p => roomMask.has(key(p.x, p.y)));

    while (typeForColumns && placed < columns && candidates.length) {
      const p = candidates.shift() as GridPosition;
      const variantId = typeForColumns ? pickVariantIdForPlacement(typeForColumns, "scatter", rand) : "base";
      const rotation = typeForColumns ? randomRotationForPlacement(typeForColumns, variantId, rand) : 0;
      const ok = tryPlaceObstacle({
        draft,
        type: typeForColumns,
        x: p.x,
        y: p.y,
        variantId,
        rotation
      });
      if (ok) placed++;
    }

    // Si on a demand� plus que 4 colonnes, on compl�te en scatter � l'int�rieur.
    let attempts = 0;
    while (typeForColumns && placed < columns && attempts < 200) {
      attempts++;
      const x = clamp(cx + randomIntInclusive(rand, -roomRadius + 1, roomRadius - 1), 0, cols - 1);
      const y = clamp(cy + randomIntInclusive(rand, -roomRadius + 1, roomRadius - 1), 0, rows - 1);
      if (!roomMask.has(key(x, y))) continue;
      if (openingKeys.has(key(x, y))) continue;
      const variantId = typeForColumns ? pickVariantIdForPlacement(typeForColumns, "scatter", rand) : "base";
      const rotation = typeForColumns ? randomRotationForPlacement(typeForColumns, variantId, rand) : 0;
      const ok = tryPlaceObstacle({
        draft,
        type: typeForColumns,
        x,
        y,
        variantId,
        rotation
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
      const rotation = randomRotationForPlacement(altarType, variantId, rand);
      const ok = tryPlaceObstacle({
        draft,
        type: altarType,
        x: cx,
        y: cy,
        variantId,
        rotation
      });
      draft.log.push(ok ? "Autel: plac� au centre." : "Autel: placement impossible (collision).");
    } else {
      draft.log.push("Autel: aucun type d'obstacle appropri�.");
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
    const rotation = randomRotationForPlacement(chosen, variantId, rand);

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







