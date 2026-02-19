
// Plan de migration: ../../docs/gameboard/grille hexa/plan de convertion.md
// Phase A ciblee ici: brancher une facade unique sans changer le comportement square.

import { createHexGridAdapter } from "./hex";
import { createSquareGridAdapter } from "./square";
import type { GridAdapter, GridConfig } from "./types";

export function createGridAdapter(config: GridConfig): GridAdapter {
  if (config.kind === "hex") return createHexGridAdapter(config);
  return createSquareGridAdapter(config);
}
