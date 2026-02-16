export const CELL_SIZE_M = 1.5;

export function metersToCells(meters: number): number {
  if (!Number.isFinite(meters)) return 0;
  return Math.max(0, Math.round(meters / CELL_SIZE_M));
}

export function cellsToMeters(cells: number): number {
  if (!Number.isFinite(cells)) return 0;
  return cells * CELL_SIZE_M;
}
