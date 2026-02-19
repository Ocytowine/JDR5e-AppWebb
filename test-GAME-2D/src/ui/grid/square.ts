
import type {
  GridAdapter,
  GridBounds,
  GridCell,
  GridConfig,
  GridPoint,
  NeighborOptions,
  ToGridOptions
} from "./types";

const GRID_SNAP_EPS = 1e-4;

function clampInt(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function isInside(cell: GridCell, bounds: GridBounds): boolean {
  return cell.x >= 0 && cell.x < bounds.cols && cell.y >= 0 && cell.y < bounds.rows;
}

function key(cell: GridCell): string {
  return `${cell.x},${cell.y}`;
}

function lineBresenham(from: GridCell, to: GridCell): GridCell[] {
  const points: GridCell[] = [];
  let x0 = Math.floor(from.x);
  let y0 = Math.floor(from.y);
  const x1 = Math.floor(to.x);
  const y1 = Math.floor(to.y);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return points;
}

export function createSquareGridAdapter(config: GridConfig): GridAdapter {
  const origin: GridPoint = config.origin ?? { x: 0, y: 0 };
  const tileSize = Math.max(1, Number(config.tileSize) || 1);

  function toScreen(cell: GridCell, bounds: GridBounds): GridPoint {
    const x = clampInt(cell.x, 0, bounds.cols - 1);
    const y = clampInt(cell.y, 0, bounds.rows - 1);
    return {
      x: origin.x + x * tileSize + tileSize / 2,
      y: origin.y + y * tileSize + tileSize / 2
    };
  }

  function toGrid(point: GridPoint, bounds: GridBounds, options?: ToGridOptions): GridCell {
    const localX = point.x - origin.x;
    const localY = point.y - origin.y;
    const gx = Math.floor((localX + GRID_SNAP_EPS) / tileSize);
    const gy = Math.floor((localY + GRID_SNAP_EPS) / tileSize);
    if (options?.clamp === false) return { x: gx, y: gy };
    return {
      x: clampInt(gx, 0, bounds.cols - 1),
      y: clampInt(gy, 0, bounds.rows - 1)
    };
  }

  function neighbors(cell: GridCell, bounds: GridBounds, options?: NeighborOptions): GridCell[] {
    const includeDiagonals = options?.includeDiagonals !== false;
    const deltas = includeDiagonals
      ? [
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 },
          { x: 1, y: 1 },
          { x: 1, y: -1 },
          { x: -1, y: 1 },
          { x: -1, y: -1 }
        ]
      : [
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 }
        ];
    return deltas
      .map(delta => ({ x: cell.x + delta.x, y: cell.y + delta.y }))
      .filter(next => isInside(next, bounds));
  }

  function distance(a: GridCell, b: GridCell): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  function line(from: GridCell, to: GridCell, bounds?: GridBounds): GridCell[] {
    const raw = lineBresenham(from, to);
    if (!bounds) return raw;
    const dedup = new Map<string, GridCell>();
    for (const point of raw) {
      if (!isInside(point, bounds)) continue;
      dedup.set(key(point), point);
    }
    return Array.from(dedup.values());
  }

  return {
    kind: "square",
    tileSize,
    origin,
    toScreen,
    toGrid,
    neighbors,
    distance,
    line,
    isInside
  };
}
