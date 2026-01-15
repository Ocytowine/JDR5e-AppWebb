// Top-down board configuration (test-GAME-2D)
// -------------------------------------------
// - Square grid
// - Orthographic projection

export const GRID_COLS = 12;
export const GRID_ROWS = 8;

export const TILE_SIZE = 64;

export const BOARD_WIDTH = GRID_COLS * TILE_SIZE;
export const BOARD_HEIGHT = GRID_ROWS * TILE_SIZE;

// No vertical stacking in the top-down view.
export const LEVEL_HEIGHT_PX = 0;

export const BOARD_BACKGROUND_COLOR = 0x1c1b29;
export const BOARD_BACKGROUND_IMAGE_URL: string | null = null;

export function isCellInsideBoard(x: number, y: number): boolean {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

export function getBoardWidth(cols: number): number {
  return Math.max(1, Math.floor(cols)) * TILE_SIZE;
}

export function getBoardHeight(rows: number): number {
  return Math.max(1, Math.floor(rows)) * TILE_SIZE;
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
  const clampedX = Math.max(0, Math.min(cols - 1, Math.floor(x)));
  const clampedY = Math.max(0, Math.min(rows - 1, Math.floor(y)));
  return {
    x: clampedX * TILE_SIZE + TILE_SIZE / 2,
    y: clampedY * TILE_SIZE + TILE_SIZE / 2
  };
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
  const gx = Math.floor((screenX + GRID_SNAP_EPS) / TILE_SIZE);
  const gy = Math.floor((screenY + GRID_SNAP_EPS) / TILE_SIZE);
  return {
    x: Math.max(0, Math.min(cols - 1, gx)),
    y: Math.max(0, Math.min(rows - 1, gy))
  };
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
