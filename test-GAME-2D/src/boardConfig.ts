// Top-down board configuration (test-GAME-2D)
// -------------------------------------------
// - Square grid
// - Orthographic projection
import { createGridAdapter, type GridKind, type HexOptions } from "./ui/grid";

export const GRID_COLS = 12;
export const GRID_ROWS = 8;

export const TILE_SIZE = 64;
const HEX_TILE_SIZE = TILE_SIZE / Math.sqrt(3);

export const BOARD_WIDTH = GRID_COLS * TILE_SIZE;
export const BOARD_HEIGHT = GRID_ROWS * TILE_SIZE;

// No vertical stacking in the top-down view.
export const LEVEL_HEIGHT_PX = 0;

export const BOARD_BACKGROUND_COLOR = 0x1c1b29;
export const BOARD_BACKGROUND_IMAGE_URL: string | null = null;

interface BoardGridProjection {
  kind: GridKind;
  hex: HexOptions;
}

const DEFAULT_HEX_OPTIONS: HexOptions = {
  offset: "odd-r",
  orientation: "pointy-top"
};

let boardGridProjection: BoardGridProjection = {
  kind: "square",
  hex: DEFAULT_HEX_OPTIONS
};
let lastGridCols = GRID_COLS;
let lastGridRows = GRID_ROWS;

let boardGridAdapter = createGridAdapter({
  kind: boardGridProjection.kind,
  tileSize: TILE_SIZE
});

function createBoardAdapter() {
  return createGridAdapter({
    kind: boardGridProjection.kind,
    tileSize: boardGridProjection.kind === "hex" ? HEX_TILE_SIZE : TILE_SIZE,
    origin: boardGridProjection.kind === "hex" ? { x: TILE_SIZE / 2, y: TILE_SIZE / 2 } : { x: 0, y: 0 },
    hex: boardGridProjection.kind === "hex" ? boardGridProjection.hex : undefined
  });
}

export function setBoardGridProjection(
  kind: GridKind,
  hex: Partial<HexOptions> = {}
): void {
  boardGridProjection = {
    kind,
    hex: {
      ...DEFAULT_HEX_OPTIONS,
      ...(kind === "hex" ? boardGridProjection.hex : {}),
      ...hex
    }
  };
  boardGridAdapter = createBoardAdapter();
}

export function getBoardGridProjectionKind(): GridKind {
  return boardGridProjection.kind;
}

export function getBoardHexOptions(): HexOptions {
  return { ...boardGridProjection.hex };
}

export function distanceBetweenGridCells(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return boardGridAdapter.distance(a, b);
}

export function lineBetweenGridCells(
  from: { x: number; y: number },
  to: { x: number; y: number },
  grid?: { cols: number; rows: number } | null
): Array<{ x: number; y: number }> {
  const bounds = grid
    ? {
        cols: Math.max(1, Math.floor(grid.cols)),
        rows: Math.max(1, Math.floor(grid.rows))
      }
    : undefined;
  return boardGridAdapter.line(from, to, bounds);
}

export function getGridNeighborsForGrid(
  cell: { x: number; y: number },
  cols: number,
  rows: number,
  includeDiagonals = true
): Array<{ x: number; y: number }> {
  if (boardGridProjection.kind === "hex") {
    return boardGridAdapter.neighbors(cell, { cols, rows });
  }
  return boardGridAdapter.neighbors(cell, { cols, rows }, { includeDiagonals });
}

export function isCellInsideBoard(x: number, y: number): boolean {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

export function getBoardWidth(cols: number): number {
  const safeCols = Math.max(1, Math.floor(cols));
  lastGridCols = safeCols;
  if (boardGridProjection.kind !== "hex") {
    return safeCols * TILE_SIZE;
  }

  const bounds = getGridVisualBounds(safeCols, lastGridRows);
  return Math.max(TILE_SIZE, Math.ceil(bounds.maxX - bounds.minX));
}

export function getBoardHeight(rows: number): number {
  const safeRows = Math.max(1, Math.floor(rows));
  lastGridRows = safeRows;
  if (boardGridProjection.kind !== "hex") {
    return safeRows * TILE_SIZE;
  }

  const bounds = getGridVisualBounds(lastGridCols, safeRows);
  return Math.max(TILE_SIZE, Math.ceil(bounds.maxY - bounds.minY));
}

export function isCellInsideGrid(
  x: number,
  y: number,
  cols: number,
  rows: number
): boolean {
  return x >= 0 && x < cols && y >= 0 && y < rows;
}

export function gridToScreenForGrid(
  x: number,
  y: number,
  cols: number,
  rows: number
): { x: number; y: number } {
  return boardGridAdapter.toScreen(
    { x, y },
    {
      cols: Math.max(1, Math.floor(cols)),
      rows: Math.max(1, Math.floor(rows))
    }
  );
}

export function gridToScreenBaseForGrid(
  x: number,
  y: number,
  cols: number,
  rows: number
): { x: number; y: number } {
  return gridToScreenForGrid(x, y, cols, rows);
}

const GRID_SNAP_EPS = 1e-4;

export function screenToGridForGrid(
  screenX: number,
  screenY: number,
  cols: number,
  rows: number
): { x: number; y: number } {
  if (boardGridProjection.kind === "square") {
    const gx = Math.floor((screenX + GRID_SNAP_EPS) / TILE_SIZE);
    const gy = Math.floor((screenY + GRID_SNAP_EPS) / TILE_SIZE);
    return {
      x: Math.max(0, Math.min(cols - 1, gx)),
      y: Math.max(0, Math.min(rows - 1, gy))
    };
  }
  return boardGridAdapter.toGrid(
    { x: screenX, y: screenY },
    {
      cols: Math.max(1, Math.floor(cols)),
      rows: Math.max(1, Math.floor(rows))
    }
  );
}

export function gridToScreen(x: number, y: number): { x: number; y: number } {
  return { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
}

export function screenToGrid(
  screenX: number,
  screenY: number
): { x: number; y: number } {
  return {
    x: Math.floor((screenX + GRID_SNAP_EPS) / TILE_SIZE),
    y: Math.floor((screenY + GRID_SNAP_EPS) / TILE_SIZE)
  };
}

export function getGridCellPolygonForGrid(
  x: number,
  y: number,
  cols: number,
  rows: number
): Array<{ x: number; y: number }> {
  const center = gridToScreenForGrid(x, y, cols, rows);
  if (boardGridProjection.kind !== "hex") {
    return [
      { x: center.x - TILE_SIZE / 2, y: center.y - TILE_SIZE / 2 },
      { x: center.x + TILE_SIZE / 2, y: center.y - TILE_SIZE / 2 },
      { x: center.x + TILE_SIZE / 2, y: center.y + TILE_SIZE / 2 },
      { x: center.x - TILE_SIZE / 2, y: center.y + TILE_SIZE / 2 }
    ];
  }

  const startAngle =
    boardGridProjection.hex.orientation === "flat-top" ? 0 : -Math.PI / 2;
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 6; i++) {
    const angle = startAngle + (Math.PI / 3) * i;
    points.push({
      x: center.x + HEX_TILE_SIZE * Math.cos(angle),
      y: center.y + HEX_TILE_SIZE * Math.sin(angle)
    });
  }
  return points;
}

function getGridVisualBounds(cols: number, rows: number): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const polygon = getGridCellPolygonForGrid(x, y, cols, rows);
      for (const p of polygon) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { minX: 0, minY: 0, maxX: TILE_SIZE, maxY: TILE_SIZE };
  }
  return { minX, minY, maxX, maxY };
}
