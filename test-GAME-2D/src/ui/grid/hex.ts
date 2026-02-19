
import type {
  GridAdapter,
  GridBounds,
  GridCell,
  GridConfig,
  GridPoint,
  HexOffsetKind,
  HexOptions,
  ToGridOptions
} from "./types";

interface Axial {
  q: number;
  r: number;
}

interface Cube {
  x: number;
  y: number;
  z: number;
}

const SQRT_3 = Math.sqrt(3);

function isInside(cell: GridCell, bounds: GridBounds): boolean {
  return cell.x >= 0 && cell.x < bounds.cols && cell.y >= 0 && cell.y < bounds.rows;
}

function axialToOffset(cell: Axial, offset: HexOffsetKind): GridCell {
  if (offset === "odd-r") {
    return {
      x: cell.q + Math.floor((cell.r - (cell.r & 1)) / 2),
      y: cell.r
    };
  }
  return {
    x: cell.q + Math.floor((cell.r + (cell.r & 1)) / 2),
    y: cell.r
  };
}

function offsetToAxial(cell: GridCell, offset: HexOffsetKind): Axial {
  if (offset === "odd-r") {
    return {
      q: cell.x - Math.floor((cell.y - (cell.y & 1)) / 2),
      r: cell.y
    };
  }
  return {
    q: cell.x - Math.floor((cell.y + (cell.y & 1)) / 2),
    r: cell.y
  };
}

function axialToCube(axial: Axial): Cube {
  return { x: axial.q, z: axial.r, y: -axial.q - axial.r };
}

function cubeToAxial(cube: Cube): Axial {
  return { q: cube.x, r: cube.z };
}

function cubeRound(cube: Cube): Cube {
  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);
  const xDiff = Math.abs(rx - cube.x);
  const yDiff = Math.abs(ry - cube.y);
  const zDiff = Math.abs(rz - cube.z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { x: rx, y: ry, z: rz };
}

function axialDistance(a: Axial, b: Axial): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs((a.q + a.r) - (b.q + b.r))) / 2;
}

const AXIAL_NEIGHBORS: Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

function clampInt(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function dedupCells(cells: GridCell[]): GridCell[] {
  const map = new Map<string, GridCell>();
  for (const cell of cells) {
    map.set(`${cell.x},${cell.y}`, cell);
  }
  return Array.from(map.values());
}

export function createHexGridAdapter(config: GridConfig): GridAdapter {
  const origin: GridPoint = config.origin ?? { x: 0, y: 0 };
  const tileSize = Math.max(1, Number(config.tileSize) || 1);
  const defaults: HexOptions = { offset: "odd-r", orientation: "pointy-top" };
  const hexOptions: HexOptions = {
    offset: config.hex?.offset ?? defaults.offset,
    orientation: config.hex?.orientation ?? defaults.orientation
  };

  function toScreen(cell: GridCell, bounds: GridBounds): GridPoint {
    const clamped = {
      x: clampInt(cell.x, 0, bounds.cols - 1),
      y: clampInt(cell.y, 0, bounds.rows - 1)
    };
    const axial = offsetToAxial(clamped, hexOptions.offset);

    // Phase A: pointy-top prioritaire. flat-top garde une projection stable
    // mais n'est pas activé en jeu tant que les choix finaux ne sont pas validés.
    if (hexOptions.orientation === "flat-top") {
      const x = tileSize * (1.5 * axial.q);
      const y = tileSize * (SQRT_3 * (axial.r + axial.q / 2));
      return { x: origin.x + x, y: origin.y + y };
    }

    const x = tileSize * (SQRT_3 * (axial.q + axial.r / 2));
    const y = tileSize * (1.5 * axial.r);
    return { x: origin.x + x, y: origin.y + y };
  }

  function toGrid(point: GridPoint, bounds: GridBounds, options?: ToGridOptions): GridCell {
    const px = point.x - origin.x;
    const py = point.y - origin.y;

    let fractional: Axial;
    if (hexOptions.orientation === "flat-top") {
      fractional = {
        q: (2 / 3) * (px / tileSize),
        r: ((-1 / 3) * px + (SQRT_3 / 3) * py) / tileSize
      };
    } else {
      fractional = {
        q: ((SQRT_3 / 3) * px - (1 / 3) * py) / tileSize,
        r: ((2 / 3) * py) / tileSize
      };
    }

    const rounded = cubeRound(axialToCube(fractional));
    const raw = axialToOffset(cubeToAxial(rounded), hexOptions.offset);
    if (options?.clamp === false) return raw;
    return {
      x: clampInt(raw.x, 0, bounds.cols - 1),
      y: clampInt(raw.y, 0, bounds.rows - 1)
    };
  }

  function neighbors(cell: GridCell, bounds: GridBounds): GridCell[] {
    const axial = offsetToAxial(cell, hexOptions.offset);
    return AXIAL_NEIGHBORS.map(delta => ({ q: axial.q + delta.q, r: axial.r + delta.r }))
      .map(next => axialToOffset(next, hexOptions.offset))
      .filter(next => isInside(next, bounds));
  }

  function distance(a: GridCell, b: GridCell): number {
    const aa = offsetToAxial(a, hexOptions.offset);
    const bb = offsetToAxial(b, hexOptions.offset);
    return axialDistance(aa, bb);
  }

  function line(from: GridCell, to: GridCell, bounds?: GridBounds): GridCell[] {
    const aa = offsetToAxial(from, hexOptions.offset);
    const bb = offsetToAxial(to, hexOptions.offset);
    const n = Math.max(0, Math.floor(axialDistance(aa, bb)));
    if (n === 0) {
      const cell = { x: from.x, y: from.y };
      if (bounds && !isInside(cell, bounds)) return [];
      return [cell];
    }

    const aCube = axialToCube(aa);
    const bCube = axialToCube(bb);
    const out: GridCell[] = [];

    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const interpolated: Cube = {
        x: aCube.x + (bCube.x - aCube.x) * t,
        y: aCube.y + (bCube.y - aCube.y) * t,
        z: aCube.z + (bCube.z - aCube.z) * t
      };
      const rounded = cubeRound(interpolated);
      const cell = axialToOffset(cubeToAxial(rounded), hexOptions.offset);
      if (!bounds || isInside(cell, bounds)) out.push(cell);
    }

    return dedupCells(out);
  }

  return {
    kind: "hex",
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
