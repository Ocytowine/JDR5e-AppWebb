import type { GridPosition } from "../../../types";
import type { ObstacleTypeDefinition } from "../../obstacleTypes";
import type { MapBuildContext, MapSpec, EntrancePosition, EntranceSide } from "../generation/types";
import { clamp, createDraft, key, setLight, setTerrain, scatterTerrainPatches, tryPlaceObstacle, tryPlaceWallSegment } from "../generation/draft";
import { pickVariantIdForPlacement, randomRotationForPlacement, weightedTypesForContext } from "../generation/obstacleSelector";
import { findWallType } from "../generation/wallSelector";
import { resolveWallKindFromType } from "../walls/kind";
import { resolveWallMaxHp } from "../walls/durability";
import type { WallDirection, WallKind } from "../walls/types";

interface RoomMasksResult {
  draft: ReturnType<typeof createDraft>;
  playerStart: GridPosition;
  roomMasks: Record<string, Set<string>>;
  playerRoomId: string;
  enemyRoomId?: string;
}

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

  const tableType =
    ctx.obstacleTypes.find(t => t.id === "table-wood") ??
    ctx.obstacleTypes.find(t => (t.tags ?? []).includes("table")) ??
    null;

  const crateType =
    ctx.obstacleTypes.find(t => t.id === "crate-wood") ??
    ctx.obstacleTypes.find(t => (t.tags ?? []).includes("crate")) ??
    null;

  const altarType =
    ctx.obstacleTypes.find(t => t.id === "altar-stone") ??
    ctx.obstacleTypes.find(t => (t.tags ?? []).includes("altar")) ??
    null;

  return { wallType, wallDoorType, pillarType, barrelType, tableType, crateType, altarType };
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

function pickByPosition(cells: GridPosition[], position: EntrancePosition | undefined): GridPosition | null {
  if (!cells.length) return null;
  if (!position) return cells[Math.floor(cells.length / 2)] ?? null;
  if (position === "start") return cells[0] ?? null;
  if (position === "end") return cells[cells.length - 1] ?? null;
  return cells[Math.floor(cells.length / 2)] ?? null;
}

function placeBoundaryWalls(params: {
  draft: ReturnType<typeof createDraft>;
  boundaryBySide: Record<EntranceSide, GridPosition[]>;
  wallType: ReturnType<typeof pickDungeonDefaults>["wallType"];
  wallDoorType: ReturnType<typeof pickDungeonDefaults>["wallDoorType"];
  openings: Map<string, "open" | "closed">;
}): void {
  const { draft, boundaryBySide, wallType, wallDoorType, openings } = params;
  if (!wallType) {
    draft.log.push("Murs: aucun type de mur disponible.");
    return;
  }

  const baseKind = resolveWallKindFromType(wallType);
  const doorKind: WallKind = wallDoorType ? resolveWallKindFromType(wallDoorType) : "door";
  const baseMaxHp = resolveWallMaxHp(wallType);
  const doorMaxHp = resolveWallMaxHp(wallDoorType);

  const placeSide = (cells: GridPosition[], dir: WallDirection) => {
    let placed = 0;
    for (const cell of cells) {
      const k = key(cell.x, cell.y);
      const openingState = openings.get(k) ?? null;
      const isOpening = openingState !== null;
      const kind = isOpening ? doorKind : baseKind;
      const state = isOpening ? openingState : undefined;
      const typeId = isOpening ? wallDoorType?.id : wallType.id;
      const maxHp = isOpening ? doorMaxHp : baseMaxHp;
      if (tryPlaceWallSegment({ draft, x: cell.x, y: cell.y, dir, kind, state, typeId, maxHp: maxHp ?? undefined, allowOnReserved: true })) {
        placed++;
      }
    }
    return placed;
  };

  const placedWalls =
    placeSide(boundaryBySide.north, "N") +
    placeSide(boundaryBySide.south, "S") +
    placeSide(boundaryBySide.west, "W") +
    placeSide(boundaryBySide.east, "E");

  draft.log.push(`Murs: ${placedWalls} segments (avec ${openings.size} acces).`);
}

function placeWallLine(params: {
  draft: ReturnType<typeof createDraft>;
  wallType: ReturnType<typeof pickDungeonDefaults>["wallType"];
  wallDoorType: ReturnType<typeof pickDungeonDefaults>["wallDoorType"];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  doorCells?: Set<string>;
  doorState?: "open" | "closed";
}): void {
  const { draft, wallType, wallDoorType } = params;
  if (!wallType) return;
  const baseKind = resolveWallKindFromType(wallType);
  const doorKind: WallKind = wallDoorType ? resolveWallKindFromType(wallDoorType) : "door";
  const baseMaxHp = resolveWallMaxHp(wallType);
  const doorMaxHp = resolveWallMaxHp(wallDoorType);
  const isVertical = params.x1 === params.x2;
  const isHorizontal = params.y1 === params.y2;
  if (!isVertical && !isHorizontal) return;

  const dir: WallDirection = isVertical ? "W" : "N";
  const dx = Math.sign(params.x2 - params.x1);
  const dy = Math.sign(params.y2 - params.y1);
  let x = params.x1;
  let y = params.y1;
  while (true) {
    const isDoor = params.doorCells?.has(key(x, y)) ?? false;
    const kind = isDoor ? doorKind : baseKind;
    const state = isDoor ? params.doorState ?? "open" : undefined;
    const typeId = isDoor ? wallDoorType?.id : wallType.id;
    const maxHp = isDoor ? doorMaxHp : baseMaxHp;
    tryPlaceWallSegment({
      draft,
      x,
      y,
      dir,
      kind,
      state,
      typeId,
      maxHp: maxHp ?? undefined,
      allowOnReserved: true
    });
    if (x === params.x2 && y === params.y2) break;
    x += dx;
    y += dy;
  }
}

function pickDoorAlongLine(params: {
  axis: "vertical" | "horizontal";
  min: number;
  max: number;
  fixed: number;
  position?: EntrancePosition;
}): GridPosition {
  const length = Math.max(1, params.max - params.min + 1);
  const center = params.min + Math.floor(length / 2);
  const start = params.min;
  const end = params.max;
  let chosen = center;
  if (params.position === "start") chosen = start;
  if (params.position === "end") chosen = end;
  if (params.axis === "vertical") return { x: params.fixed, y: chosen };
  return { x: chosen, y: params.fixed };
}

function collectRoomMask(params: {
  cols: number;
  rows: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}): Set<string> {
  const mask = new Set<string>();
  const x1 = clamp(params.x1, 0, params.cols - 1);
  const y1 = clamp(params.y1, 0, params.rows - 1);
  const x2 = clamp(params.x2, 0, params.cols - 1);
  const y2 = clamp(params.y2, 0, params.rows - 1);
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      mask.add(key(x, y));
    }
  }
  return mask;
}

function placeContents(params: {
  draft: ReturnType<typeof createDraft>;
  roomMask: Set<string>;
  contents: { kind: "table" | "barrel" | "crate" | "pillar" | "altar"; count?: number }[];
  ctx: MapBuildContext;
  rand: () => number;
}): number {
  const { draft, roomMask, contents, ctx, rand } = params;
  const { tableType, barrelType, crateType, pillarType, altarType } = pickDungeonDefaults(ctx);
  const typeByKind: Record<string, ObstacleTypeDefinition | null> = {
    table: tableType,
    barrel: barrelType,
    crate: crateType,
    pillar: pillarType,
    altar: altarType
  };

  let placed = 0;
  for (const item of contents) {
    const type = typeByKind[item.kind] ?? null;
    if (!type) continue;
    const count = Math.max(1, Math.floor(item.count ?? 1));
    let placedForItem = 0;
    let attempts = 0;
    while (placedForItem < count && attempts < 120) {
      attempts++;
      const cells = Array.from(roomMask);
      const pick = cells[Math.floor(rand() * cells.length)] ?? null;
      if (!pick) break;
      const [xStr, yStr] = pick.split(",");
      const x = Number(xStr);
      const y = Number(yStr);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const variantId = pickVariantIdForPlacement(type, "room", rand);
      const rotation = randomRotationForPlacement(type, variantId, rand);
      const ok = tryPlaceObstacle({ draft, type, x, y, variantId, rotation });
      if (ok) {
        placed++;
        placedForItem++;
      }
    }
  }

  return placed;
}

function fillRoomFallback(params: {
  draft: ReturnType<typeof createDraft>;
  roomMask: Set<string>;
  ctx: MapBuildContext;
  rand: () => number;
}): void {
  const { draft, roomMask, ctx, rand } = params;
  const propTypes = weightedTypesForContext(ctx.obstacleTypes, t => t.category !== "wall");
  if (!propTypes.length) return;
  const target = Math.max(0, Math.floor(roomMask.size / 80));
  let placed = 0;
  let attempts = 0;
  while (placed < target && attempts < 100) {
    attempts++;
    const chosen = propTypes[Math.floor(rand() * propTypes.length)]?.item ?? null;
    if (!chosen) continue;
    const cells = Array.from(roomMask);
    const pick = cells[Math.floor(rand() * cells.length)] ?? null;
    if (!pick) break;
    const [xStr, yStr] = pick.split(",");
    const x = Number(xStr);
    const y = Number(yStr);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const variantId = pickVariantIdForPlacement(chosen, "scatter", rand);
    const rotation = randomRotationForPlacement(chosen, variantId, rand);
    const ok = tryPlaceObstacle({ draft, type: chosen, x, y, variantId, rotation });
    if (ok) placed++;
  }
}

export function generateDungeonRoomPlan(params: {
  spec: MapSpec;
  ctx: MapBuildContext;
  rand: () => number;
}): RoomMasksResult {
  const { spec, ctx, rand } = params;
  const cols = Math.max(1, spec.grid.cols);
  const rows = Math.max(1, spec.grid.rows);
  const draft = createDraft({ cols, rows, reserved: new Set(), seedPrefix: "obs" });
  const plan = spec.dungeonPlan;

  draft.log.push("Layout: donjon (salles planifiees).");

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

  const { wallType, wallDoorType } = pickDungeonDefaults(ctx);
  const rect = { x1: 0, y1: 0, x2: cols - 1, y2: rows - 1 };
  const boundaryCells = buildRectBoundary(rect);
  const boundaryBySide = groupBoundaryBySide(rect);
  const openings = new Map<string, "open" | "closed">();

  const playerRoomId = plan?.playerRoomId ?? plan?.rooms[0]?.id ?? "room-1";
  const enemyRoomId = plan?.enemyRoomId;
  const roomMasks: Record<string, Set<string>> = {};

  const addExteriorOpening = (side: EntranceSide, position?: EntrancePosition, state?: "open" | "closed") => {
    const cells = boundaryBySide[side] ?? [];
    const picked = pickByPosition(cells, position);
    if (!picked) return;
    openings.set(key(picked.x, picked.y), state ?? "open");
    draft.reserved.add(key(picked.x, picked.y));
  };

  if (plan?.exteriorAccess?.length) {
    for (const access of plan.exteriorAccess) {
      const side = access.side ?? "west";
      addExteriorOpening(side, access.position, access.state === "closed" ? "closed" : "open");
    }
  }

  if (plan?.layoutStyle === "corridor") {
    const corridorSide = plan.corridorSide ?? "north";
    const corridorWidth = 2;
    const roomCount = Math.max(2, plan.roomCount);
    const roomWallGap = 0;

    if (corridorSide === "north" || corridorSide === "south") {
      const roomWidth = Math.max(3, Math.floor((cols - 2 - roomWallGap) / roomCount));
      const corridorYStart = corridorSide === "north" ? 1 : rows - corridorWidth - 1;
      const corridorYEnd = corridorYStart + corridorWidth - 1;
      const wallY = corridorSide === "north" ? corridorYEnd + 1 : corridorYStart - 1;
      let startX = 1;
      const doorCells = new Set<string>();

      for (let i = 0; i < roomCount; i++) {
        const roomId = plan.rooms[i]?.id ?? `room-${i + 1}`;
        const x1 = startX;
        const x2 = Math.min(cols - 2, x1 + roomWidth - 1);
        const y1 = corridorSide === "north" ? wallY : 1;
        const y2 = corridorSide === "north" ? rows - 2 : wallY;
        const mask = collectRoomMask({ cols, rows, x1, y1, x2, y2 });
        roomMasks[roomId] = mask;

        const doorCell = pickDoorAlongLine({
          axis: "horizontal",
          min: x1,
          max: x2,
          fixed: wallY,
          position: plan.doorPosition
        });
        draft.reserved.add(key(doorCell.x, doorCell.y));
        doorCells.add(key(doorCell.x, doorCell.y));

        if (i < roomCount - 1) {
          const wallX = x2 + 1;
          placeWallLine({
            draft,
            wallType,
            wallDoorType,
            x1: wallX,
            y1,
            x2: wallX,
            y2
          });
        }

        startX = x2 + 1;
      }

      placeWallLine({
        draft,
        wallType,
        wallDoorType,
        x1: 1,
        y1: wallY,
        x2: cols - 2,
        y2: wallY,
        doorCells,
        doorState: plan.doorState === "closed" ? "closed" : "open"
      });
    } else {
      const roomHeight = Math.max(3, Math.floor((rows - 2 - roomWallGap) / roomCount));
      const corridorXStart = corridorSide === "west" ? 1 : cols - corridorWidth - 1;
      const corridorXEnd = corridorXStart + corridorWidth - 1;
      const wallX = corridorSide === "west" ? corridorXEnd + 1 : corridorXStart - 1;
      let startY = 1;
      const doorCells = new Set<string>();

      for (let i = 0; i < roomCount; i++) {
        const roomId = plan.rooms[i]?.id ?? `room-${i + 1}`;
        const y1 = startY;
        const y2 = Math.min(rows - 2, y1 + roomHeight - 1);
        const x1 = corridorSide === "west" ? wallX : 1;
        const x2 = corridorSide === "west" ? cols - 2 : wallX;
        const mask = collectRoomMask({ cols, rows, x1, y1, x2, y2 });
        roomMasks[roomId] = mask;

        const doorCell = pickDoorAlongLine({
          axis: "vertical",
          min: y1,
          max: y2,
          fixed: wallX,
          position: plan.doorPosition
        });
        draft.reserved.add(key(doorCell.x, doorCell.y));
        doorCells.add(key(doorCell.x, doorCell.y));

        if (i < roomCount - 1) {
          const wallY = y2 + 1;
          placeWallLine({
            draft,
            wallType,
            wallDoorType,
            x1,
            y1: wallY,
            x2,
            y2: wallY
          });
        }

        startY = y2 + 1;
      }

      placeWallLine({
        draft,
        wallType,
        wallDoorType,
        x1: wallX,
        y1: 1,
        x2: wallX,
        y2: rows - 2,
        doorCells,
        doorState: plan.doorState === "closed" ? "closed" : "open"
      });
    }
  } else {
    const axis = plan?.splitAxis ?? "vertical";
    if (axis === "vertical") {
      const wallX = clamp(Math.floor(cols / 2), 2, cols - 3);
      const doorCell = pickDoorAlongLine({
        axis: "vertical",
        min: 1,
        max: rows - 2,
        fixed: wallX,
        position: plan?.doorPosition
      });
      draft.reserved.add(key(doorCell.x, doorCell.y));
      const doorCells = new Set<string>([key(doorCell.x, doorCell.y)]);
      placeWallLine({
        draft,
        wallType,
        wallDoorType,
        x1: wallX,
        y1: 1,
        x2: wallX,
        y2: rows - 2,
        doorCells,
        doorState: plan?.doorState === "closed" ? "closed" : "open"
      });

      const leftMask = collectRoomMask({ cols, rows, x1: 1, y1: 1, x2: wallX - 1, y2: rows - 2 });
      const rightMask = collectRoomMask({ cols, rows, x1: wallX, y1: 1, x2: cols - 2, y2: rows - 2 });
      roomMasks[plan?.rooms[0]?.id ?? "room-1"] = leftMask;
      roomMasks[plan?.rooms[1]?.id ?? "room-2"] = rightMask;
    } else {
      const wallY = clamp(Math.floor(rows / 2), 2, rows - 3);
      const doorCell = pickDoorAlongLine({
        axis: "horizontal",
        min: 1,
        max: cols - 2,
        fixed: wallY,
        position: plan?.doorPosition
      });
      draft.reserved.add(key(doorCell.x, doorCell.y));
      const doorCells = new Set<string>([key(doorCell.x, doorCell.y)]);
      placeWallLine({
        draft,
        wallType,
        wallDoorType,
        x1: 1,
        y1: wallY,
        x2: cols - 2,
        y2: wallY,
        doorCells,
        doorState: plan?.doorState === "closed" ? "closed" : "open"
      });

      const topMask = collectRoomMask({ cols, rows, x1: 1, y1: 1, x2: cols - 2, y2: wallY - 1 });
      const bottomMask = collectRoomMask({ cols, rows, x1: 1, y1: wallY, x2: cols - 2, y2: rows - 2 });
      roomMasks[plan?.rooms[0]?.id ?? "room-1"] = topMask;
      roomMasks[plan?.rooms[1]?.id ?? "room-2"] = bottomMask;
    }
  }

  if (openings.size === 0 && plan) {
    if (plan.layoutStyle === "corridor") {
      const side = plan.corridorSide ?? "north";
      addExteriorOpening(side, plan.doorPosition, plan.doorState === "closed" ? "closed" : "open");
    } else {
      const axis = plan.splitAxis ?? "vertical";
      const isFirstRoomPlayer = playerRoomId === (plan.rooms[0]?.id ?? "room-1");
      const side =
        axis === "vertical"
          ? (isFirstRoomPlayer ? "west" : "east")
          : (isFirstRoomPlayer ? "north" : "south");
      addExteriorOpening(side, plan.doorPosition, plan.doorState === "closed" ? "closed" : "open");
    }
  }

  placeBoundaryWalls({
    draft,
    boundaryBySide,
    wallType,
    wallDoorType,
    openings
  });

  if (plan?.rooms?.length) {
    for (const room of plan.rooms) {
      const mask = roomMasks[room.id];
      if (!mask) continue;
      if (room.contents?.length) {
        placeContents({ draft, roomMask: mask, contents: room.contents, ctx, rand });
      } else {
        fillRoomFallback({ draft, roomMask: mask, ctx, rand });
      }
    }
  }

  const playerMask = roomMasks[playerRoomId] ?? null;
  let playerStart: GridPosition = { x: 1, y: Math.floor(rows / 2) };
  if (playerMask && playerMask.size > 0) {
    const cells = Array.from(playerMask);
    const pick = cells[Math.floor(cells.length / 3)] ?? cells[0];
    if (pick) {
      const [xStr, yStr] = pick.split(",");
      const x = Number(xStr);
      const y = Number(yStr);
      if (Number.isFinite(x) && Number.isFinite(y)) playerStart = { x, y };
    }
  }

  return { draft, playerStart, roomMasks, playerRoomId, enemyRoomId };
}

