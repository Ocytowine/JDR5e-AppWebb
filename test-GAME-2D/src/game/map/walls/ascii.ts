import type { MapPatternRotation } from "../../mapPatternCatalog";
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

  for (let y = 0; y < baseH; y++) {
    for (let x = 0; x < baseW; x++) {
      const ch = getCellChar(base, x, y);
      if (ch !== "#" && ch !== "L") continue;

      const kind = ch === "L" ? "low" : "wall";
      const rotated = rotatePoint(x, y, baseW, baseH, rotation);
      const gx = params.originX + rotated.x;
      const gy = params.originY + rotated.y;
      const north = rotateDir("N", rotation);
      const east = rotateDir("E", rotation);
      const south = rotateDir("S", rotation);
      const west = rotateDir("W", rotation);

      addSegment(gx, gy, north, kind);
      addSegment(gx, gy, east, kind);
      addSegment(gx, gy, south, kind);
      addSegment(gx, gy, west, kind);
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

export function getAsciiFootprint(ascii: string[]): { w: number; h: number } {
  const base = normalizeAscii(ascii ?? []);
  const w = base.length > 0 ? base[0].length : 0;
  const h = base.length;
  return { w, h };
}
