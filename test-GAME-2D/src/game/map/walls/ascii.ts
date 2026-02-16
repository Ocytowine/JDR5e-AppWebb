import type { MapPatternRotation } from "../mapPatternCatalog";
import type { WallDoorSpec, WallSegment, WallState } from "./types";
import { wallEdgeKey } from "./grid";

const DEFAULT_DOOR_STATE: WallState = "closed";

function rotateDir(dir: "N" | "E" | "S" | "W", rotation: MapPatternRotation): "N" | "E" | "S" | "W" {
  const order: ("N" | "E" | "S" | "W")[] = ["N", "E", "S", "W"];
  const idx = order.indexOf(dir);
  const steps = rotation === 90 ? 1 : rotation === 180 ? 2 : rotation === 270 ? 3 : 0;
  return order[(idx + steps) % order.length] ?? dir;
}

function rotatePoint(x: number, y: number, w: number, h: number, rotation: MapPatternRotation): { x: number; y: number } {
  switch (rotation) {
    case 90:
      return { x: (h - 1) - y, y: x };
    case 180:
      return { x: (w - 1) - x, y: (h - 1) - y };
    case 270:
      return { x: y, y: (w - 1) - x };
    default:
      return { x, y };
  }
}

function normalizeAscii(lines: string[]): string[] {
  const cleaned = lines
    .map(line => (line ?? "").replace(/\r/g, ""))
    .filter(line => line.trim().length > 0);
  const width = cleaned.reduce((max, line) => Math.max(max, line.length), 0);
  return cleaned.map(line => line.padEnd(width, " "));
}

function getCellChar(lines: string[], x: number, y: number): string {
  if (y < 0 || y >= lines.length) return " ";
  const row = lines[y] ?? "";
  if (x < 0 || x >= row.length) return " ";
  return row[x] ?? " ";
}

export function buildInteriorCellsFromAscii(params: {
  ascii: string[];
  originX: number;
  originY: number;
  rotation?: MapPatternRotation;
}): { x: number; y: number }[] {
  const rotation = params.rotation ?? 0;
  const base = normalizeAscii(params.ascii ?? []);
  const baseW = base.length > 0 ? base[0].length : 0;
  const baseH = base.length;
  if (baseW === 0 || baseH === 0) return [];

  const isWallCell = (x: number, y: number): boolean => {
    const ch = getCellChar(base, x, y);
    return ch === "#" || ch === "L";
  };

  const isEmptyCell = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= baseW || y >= baseH) return false;
    return !isWallCell(x, y);
  };

  const visited = new Set<string>();
  const floodDirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];

  const interiorKeys = new Set<string>();

  for (let y = 0; y < baseH; y++) {
    for (let x = 0; x < baseW; x++) {
      if (!isWallCell(x, y)) continue;
      const k = `${x},${y}`;
      if (visited.has(k)) continue;
      const queue: { x: number; y: number }[] = [{ x, y }];
      visited.add(k);
      const cells: { x: number; y: number }[] = [];
      while (queue.length) {
        const cur = queue.shift() as { x: number; y: number };
        cells.push(cur);
        for (const d of floodDirs) {
          const nx = cur.x + d.dx;
          const ny = cur.y + d.dy;
          if (!isWallCell(nx, ny)) continue;
          const nk = `${nx},${ny}`;
          if (visited.has(nk)) continue;
          visited.add(nk);
          queue.push({ x: nx, y: ny });
        }
      }

      let minX = baseW;
      let maxX = 0;
      let minY = baseH;
      let maxY = 0;
      for (const cell of cells) {
        minX = Math.min(minX, cell.x);
        maxX = Math.max(maxX, cell.x);
        minY = Math.min(minY, cell.y);
        maxY = Math.max(maxY, cell.y);
      }
      minX = Math.max(0, minX - 1);
      minY = Math.max(0, minY - 1);
      maxX = Math.min(baseW - 1, maxX + 1);
      maxY = Math.min(baseH - 1, maxY + 1);

      const outside = new Set<string>();
      const queueEmpty: { x: number; y: number }[] = [];
      for (let x = minX; x <= maxX; x++) {
        for (const y of [minY, maxY]) {
          if (!isEmptyCell(x, y)) continue;
          const kk = `${x},${y}`;
          if (outside.has(kk)) continue;
          outside.add(kk);
          queueEmpty.push({ x, y });
        }
      }
      for (let y = minY; y <= maxY; y++) {
        for (const x of [minX, maxX]) {
          if (!isEmptyCell(x, y)) continue;
          const kk = `${x},${y}`;
          if (outside.has(kk)) continue;
          outside.add(kk);
          queueEmpty.push({ x, y });
        }
      }
      while (queueEmpty.length) {
        const cur = queueEmpty.shift() as { x: number; y: number };
        for (const d of floodDirs) {
          const nx = cur.x + d.dx;
          const ny = cur.y + d.dy;
          if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
          if (!isEmptyCell(nx, ny)) continue;
          const kk = `${nx},${ny}`;
          if (outside.has(kk)) continue;
          outside.add(kk);
          queueEmpty.push({ x: nx, y: ny });
        }
      }

      for (let iy = minY; iy <= maxY; iy++) {
        for (let ix = minX; ix <= maxX; ix++) {
          if (!isEmptyCell(ix, iy)) continue;
          const kk = `${ix},${iy}`;
          if (outside.has(kk)) continue;
          interiorKeys.add(kk);
        }
      }
    }
  }

  const cells: { x: number; y: number }[] = [];
  for (const kk of interiorKeys) {
    const parts = kk.split(",");
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const rotated = rotatePoint(x, y, baseW, baseH, rotation);
    cells.push({ x: params.originX + rotated.x, y: params.originY + rotated.y });
  }
  return cells;
}

export function buildSegmentsFromAscii(params: {
  ascii: string[];
  originX: number;
  originY: number;
  rotation?: MapPatternRotation;
  doors?: WallDoorSpec[];
  nextId: () => string;
}): WallSegment[] {
  const rotation = params.rotation ?? 0;
  const base = normalizeAscii(params.ascii ?? []);
  const baseW = base.length > 0 ? base[0].length : 0;
  const baseH = base.length;

  const rotatedSize = rotation === 90 || rotation === 270
    ? { w: baseH, h: baseW }
    : { w: baseW, h: baseH };

  const segments = new Map<string, WallSegment>();

  const addSegment = (x: number, y: number, dir: "N" | "E" | "S" | "W", kind: "wall" | "low", state?: WallState) => {
    const key = wallEdgeKey(x, y, dir);
    const existing = segments.get(key);
    const id = existing?.id ?? params.nextId();
    if (existing) {
      if (existing.kind === "door") return;
      if (existing.kind === "wall") {
        if (kind === "wall") return;
      }
    }
    segments.set(key, { id, x, y, dir, kind, state });
  };

  const isWallCell = (x: number, y: number): boolean => {
    const ch = getCellChar(base, x, y);
    return ch === "#" || ch === "L";
  };

  const isEmptyCell = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= baseW || y >= baseH) return false;
    return !isWallCell(x, y);
  };

  const dirs: { dx: number; dy: number; dir: "N" | "E" | "S" | "W" }[] = [
    { dx: 0, dy: -1, dir: "N" },
    { dx: 1, dy: 0, dir: "E" },
    { dx: 0, dy: 1, dir: "S" },
    { dx: -1, dy: 0, dir: "W" }
  ];

  const visited = new Set<string>();
  const floodDirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];

  const components: { cells: { x: number; y: number }[] }[] = [];
  for (let y = 0; y < baseH; y++) {
    for (let x = 0; x < baseW; x++) {
      if (!isWallCell(x, y)) continue;
      const k = `${x},${y}`;
      if (visited.has(k)) continue;
      const queue: { x: number; y: number }[] = [{ x, y }];
      visited.add(k);
      const cells: { x: number; y: number }[] = [];
      while (queue.length) {
        const cur = queue.shift() as { x: number; y: number };
        cells.push(cur);
        for (const d of floodDirs) {
          const nx = cur.x + d.dx;
          const ny = cur.y + d.dy;
          if (!isWallCell(nx, ny)) continue;
          const nk = `${nx},${ny}`;
          if (visited.has(nk)) continue;
          visited.add(nk);
          queue.push({ x: nx, y: ny });
        }
      }
      components.push({ cells });
    }
  }

  for (const comp of components) {
    let minX = baseW;
    let maxX = 0;
    let minY = baseH;
    let maxY = 0;
    for (const cell of comp.cells) {
      minX = Math.min(minX, cell.x);
      maxX = Math.max(maxX, cell.x);
      minY = Math.min(minY, cell.y);
      maxY = Math.max(maxY, cell.y);
    }
    minX = Math.max(0, minX - 1);
    minY = Math.max(0, minY - 1);
    maxX = Math.min(baseW - 1, maxX + 1);
    maxY = Math.min(baseH - 1, maxY + 1);

    const outside = new Set<string>();
    const queue: { x: number; y: number }[] = [];
    for (let x = minX; x <= maxX; x++) {
      for (const y of [minY, maxY]) {
        if (!isEmptyCell(x, y)) continue;
        const k = `${x},${y}`;
        if (outside.has(k)) continue;
        outside.add(k);
        queue.push({ x, y });
      }
    }
    for (let y = minY; y <= maxY; y++) {
      for (const x of [minX, maxX]) {
        if (!isEmptyCell(x, y)) continue;
        const k = `${x},${y}`;
        if (outside.has(k)) continue;
        outside.add(k);
        queue.push({ x, y });
      }
    }
    while (queue.length) {
      const cur = queue.shift() as { x: number; y: number };
      for (const d of floodDirs) {
        const nx = cur.x + d.dx;
        const ny = cur.y + d.dy;
        if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
        if (!isEmptyCell(nx, ny)) continue;
        const k = `${nx},${ny}`;
        if (outside.has(k)) continue;
        outside.add(k);
        queue.push({ x: nx, y: ny });
      }
    }

    for (const cell of comp.cells) {
      const ch = getCellChar(base, cell.x, cell.y);
      const kind = ch === "L" ? "low" : "wall";
      const rotated = rotatePoint(cell.x, cell.y, baseW, baseH, rotation);
      const gx = params.originX + rotated.x;
      const gy = params.originY + rotated.y;
      for (const d of dirs) {
        const nx = cell.x + d.dx;
        const ny = cell.y + d.dy;
        if (isWallCell(nx, ny)) continue;
        const outsideOk =
          nx < minX || nx > maxX || ny < minY || ny > maxY || outside.has(`${nx},${ny}`);
        if (!outsideOk) continue;
        const dir = rotateDir(d.dir, rotation);
        addSegment(gx, gy, dir, kind);
      }
    }
  }

  const doors = Array.isArray(params.doors) ? params.doors : [];
  for (const door of doors) {
    const rotated = rotatePoint(door.x, door.y, baseW, baseH, rotation);
    const dir = rotateDir(door.dir, rotation);
    const gx = params.originX + rotated.x;
    const gy = params.originY + rotated.y;
    const key = wallEdgeKey(gx, gy, dir);
    const id = segments.get(key)?.id ?? params.nextId();
    segments.set(key, {
      id,
      x: gx,
      y: gy,
      dir,
      kind: "door",
      state: door.state ?? DEFAULT_DOOR_STATE
    });
  }

  return Array.from(segments.values());
}

export function buildWallCellsFromAscii(params: {
  ascii: string[];
  originX: number;
  originY: number;
  rotation?: MapPatternRotation;
}): { x: number; y: number }[] {
  const rotation = params.rotation ?? 0;
  const base = normalizeAscii(params.ascii ?? []);
  const baseW = base.length > 0 ? base[0].length : 0;
  const baseH = base.length;
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < baseH; y++) {
    for (let x = 0; x < baseW; x++) {
      const ch = getCellChar(base, x, y);
      if (ch !== "#" && ch !== "L") continue;
      const rotated = rotatePoint(x, y, baseW, baseH, rotation);
      const gx = params.originX + rotated.x;
      const gy = params.originY + rotated.y;
      cells.push({ x: gx, y: gy });
    }
  }
  return cells;
}

export function getAsciiFootprint(ascii: string[]): { w: number; h: number } {
  const base = normalizeAscii(ascii ?? []);
  const w = base.length > 0 ? base[0].length : 0;
  const h = base.length;
  return { w, h };
}
