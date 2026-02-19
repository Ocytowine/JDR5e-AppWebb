
// Source de conception: ../../docs/gameboard/grille hexa/plan de convertion.md
// Etat local des choix: ./README.md

export type GridKind = "square" | "hex";

export type HexOffsetKind = "odd-r" | "even-r";
export type HexOrientation = "pointy-top" | "flat-top";

export interface GridCell {
  x: number;
  y: number;
}

export interface GridPoint {
  x: number;
  y: number;
}

export interface GridBounds {
  cols: number;
  rows: number;
}

export interface HexOptions {
  offset: HexOffsetKind;
  orientation: HexOrientation;
}

export interface GridConfig {
  kind: GridKind;
  tileSize: number;
  origin?: GridPoint;
  hex?: Partial<HexOptions>;
}

export interface ToGridOptions {
  clamp?: boolean;
}

export interface NeighborOptions {
  includeDiagonals?: boolean;
}

export interface GridAdapter {
  readonly kind: GridKind;
  readonly tileSize: number;
  readonly origin: GridPoint;
  toScreen(cell: GridCell, bounds: GridBounds): GridPoint;
  toGrid(point: GridPoint, bounds: GridBounds, options?: ToGridOptions): GridCell;
  neighbors(cell: GridCell, bounds: GridBounds, options?: NeighborOptions): GridCell[];
  distance(a: GridCell, b: GridCell): number;
  line(from: GridCell, to: GridCell, bounds?: GridBounds): GridCell[];
  isInside(cell: GridCell, bounds: GridBounds): boolean;
}
