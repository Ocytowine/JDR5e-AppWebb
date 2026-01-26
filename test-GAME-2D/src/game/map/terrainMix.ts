import type { TerrainCell } from "./draft";

export type TerrainMixCorner = "NE" | "NW" | "SE" | "SW";

export interface TerrainMixCell {
  base: TerrainCell;
  blend: TerrainCell;
  corner: TerrainMixCorner;
}

const TERRAIN_PRIORITY: TerrainCell[] = ["rock", "dirt", "grass", "water"];
const DEFAULT_PRIORITY = 0;
const priorityByTerrain = new Map<TerrainCell, number>(
  TERRAIN_PRIORITY.map((id, index) => [id, TERRAIN_PRIORITY.length - index])
);

function getPriority(cell: TerrainCell): number {
  return priorityByTerrain.get(cell) ?? DEFAULT_PRIORITY;
}

export function buildTerrainMixLayer(params: {
  terrain: TerrainCell[];
  cols: number;
  rows: number;
  playableCells?: Set<string> | null;
}): Array<TerrainMixCell | null> {
  const cols = Math.max(1, Math.floor(params.cols));
  const rows = Math.max(1, Math.floor(params.rows));
  const size = cols * rows;
  const terrain = Array.isArray(params.terrain) ? params.terrain : [];
  const playable = params.playableCells ?? null;

  const result: Array<TerrainMixCell | null> = Array.from({ length: size }, () => null);
  const isPlayable = (x: number, y: number): boolean => {
    if (!playable || playable.size === 0) return true;
    return playable.has(`${x},${y}`);
  };
  const getTerrainAt = (x: number, y: number): TerrainCell => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return "unknown";
    const index = y * cols + x;
    return terrain[index] ?? "unknown";
  };

  const tryCorner = (
    x: number,
    y: number,
    corner: TerrainMixCorner,
    diagX: number,
    diagY: number,
    orthoA: { x: number; y: number },
    orthoB: { x: number; y: number }
  ): TerrainMixCell | null => {
    if (!isPlayable(diagX, diagY)) return null;
    if (!isPlayable(orthoA.x, orthoA.y) || !isPlayable(orthoB.x, orthoB.y)) return null;
    const base = getTerrainAt(x, y);
    const blend = getTerrainAt(diagX, diagY);
    if (!blend || blend === "unknown" || blend === base) return null;
    if (getPriority(blend) <= getPriority(base)) return null;
    if (getTerrainAt(orthoA.x, orthoA.y) !== blend) return null;
    if (getTerrainAt(orthoB.x, orthoB.y) !== blend) return null;
    return { base, blend, corner };
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!isPlayable(x, y)) continue;
      const matches: TerrainMixCell[] = [];
      const ne = tryCorner(
        x,
        y,
        "NE",
        x + 1,
        y - 1,
        { x, y: y - 1 },
        { x: x + 1, y }
      );
      if (ne) matches.push(ne);
      const nw = tryCorner(
        x,
        y,
        "NW",
        x - 1,
        y - 1,
        { x, y: y - 1 },
        { x: x - 1, y }
      );
      if (nw) matches.push(nw);
      const se = tryCorner(
        x,
        y,
        "SE",
        x + 1,
        y + 1,
        { x, y: y + 1 },
        { x: x + 1, y }
      );
      if (se) matches.push(se);
      const sw = tryCorner(
        x,
        y,
        "SW",
        x - 1,
        y + 1,
        { x, y: y + 1 },
        { x: x - 1, y }
      );
      if (sw) matches.push(sw);

      const index = y * cols + x;
      result[index] = matches.length === 1 ? matches[0] : null;
    }
  }

  return result;
}
