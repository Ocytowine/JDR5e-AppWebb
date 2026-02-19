
import type { GridAdapter, GridBounds, GridCell, GridPoint, ToGridOptions } from "./types";

export interface ViewTransform {
  pan: GridPoint;
  zoom: number;
}

export function stageToWorld(point: GridPoint, view: ViewTransform): GridPoint {
  return {
    x: (point.x - view.pan.x) / view.zoom,
    y: (point.y - view.pan.y) / view.zoom
  };
}

export function worldToStage(point: GridPoint, view: ViewTransform): GridPoint {
  return {
    x: point.x * view.zoom + view.pan.x,
    y: point.y * view.zoom + view.pan.y
  };
}

export function stageToGrid(
  adapter: GridAdapter,
  point: GridPoint,
  bounds: GridBounds,
  view: ViewTransform,
  options?: ToGridOptions
): GridCell {
  const world = stageToWorld(point, view);
  return adapter.toGrid(world, bounds, options);
}

export function gridToStage(
  adapter: GridAdapter,
  cell: GridCell,
  bounds: GridBounds,
  view: ViewTransform
): GridPoint {
  const world = adapter.toScreen(cell, bounds);
  return worldToStage(world, view);
}
