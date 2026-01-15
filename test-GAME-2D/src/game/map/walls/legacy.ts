import type { WallInstance, WallTypeDefinition } from "../../wallTypes";
import { getWallOccupiedCells } from "../../wallRuntime";
import type { WallSegment, WallKind } from "./types";
import { wallEdgeKey } from "./grid";

function resolveWallKind(typeDef: WallTypeDefinition | null | undefined): WallKind {
  if (!typeDef) return "wall";
  const kind = typeDef.behavior?.kind ?? "solid";
  if (kind === "door") return "door";
  const heightClass = typeDef.appearance?.heightClass ?? "";
  if (String(heightClass).toLowerCase() === "low") return "low";
  const tags = typeDef.tags ?? [];
  if (tags.some(t => String(t).toLowerCase() === "low")) return "low";
  return "wall";
}

export function convertLegacyWallsToSegments(params: {
  walls: WallInstance[];
  wallTypes: WallTypeDefinition[];
}): WallSegment[] {
  const { walls, wallTypes } = params;
  const typeById = new Map(wallTypes.map(t => [t.id, t] as const));
  const occupied = new Set<string>();
  const cellKinds = new Map<string, WallKind>();
  const doorStates = new Map<string, WallInstance["state"]>();

  for (const wall of walls) {
    if (wall.hp <= 0) continue;
    const typeDef = typeById.get(wall.typeId);
    const kind = resolveWallKind(typeDef ?? null);
    const cells = getWallOccupiedCells(wall, typeDef ?? null);
    for (const c of cells) {
      const key = `${c.x},${c.y}`;
      occupied.add(key);
      cellKinds.set(key, kind);
      if (kind === "door") doorStates.set(key, wall.state ?? "closed");
    }
  }

  const segments = new Map<string, WallSegment>();
  const addSegment = (x: number, y: number, dir: "N" | "E" | "S" | "W", kind: WallKind, state?: WallInstance["state"]) => {
    const key = wallEdgeKey(x, y, dir);
    if (segments.has(key)) return;
    segments.set(key, {
      id: `legacy-${key}`,
      x,
      y,
      dir,
      kind,
      state
    });
  };

  for (const cellKey of occupied) {
    const [sx, sy] = cellKey.split(",").map(Number);
    const kind = cellKinds.get(cellKey) ?? "wall";
    const state = kind === "door" ? doorStates.get(cellKey) ?? "closed" : undefined;

    const northKey = `${sx},${sy - 1}`;
    const southKey = `${sx},${sy + 1}`;
    const westKey = `${sx - 1},${sy}`;
    const eastKey = `${sx + 1},${sy}`;

    if (!occupied.has(northKey)) addSegment(sx, sy, "N", kind, state);
    if (!occupied.has(southKey)) addSegment(sx, sy, "S", kind, state);
    if (!occupied.has(westKey)) addSegment(sx, sy, "W", kind, state);
    if (!occupied.has(eastKey)) addSegment(sx, sy, "E", kind, state);
  }

  return Array.from(segments.values());
}
