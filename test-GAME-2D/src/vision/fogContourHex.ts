import {
  getGridCellPolygonForGrid,
  gridToScreenForGrid,
  screenToGridForGrid
} from "../boardConfig";

export interface FogContourPoint {
  x: number;
  y: number;
}

export interface FogContourResult {
  rawLoops: FogContourPoint[][];
  simplifiedLoops: FogContourPoint[][];
  smoothedLoops: FogContourPoint[][];
}

export interface FogContourDebugInfo {
  centerCandidates?: FogContourPoint[];
  usedCenters?: FogContourPoint[];
  shortcutAttempts?: number;
  shortcutAccepted?: number;
}

interface EdgeRecord {
  a: FogContourPoint;
  b: FogContourPoint;
  count: number;
}

interface Segment {
  a: FogContourPoint;
  b: FogContourPoint;
}

export interface RayVisibilitySample {
  angle: number;
  visiblePoint: FogContourPoint;
  borderPoint: FogContourPoint;
}

function quantize(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function pointKey(p: FogContourPoint): string {
  return `${quantize(p.x)},${quantize(p.y)}`;
}

function edgeKey(a: FogContourPoint, b: FogContourPoint): string {
  const ka = pointKey(a);
  const kb = pointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

function arePointsEqual(a: FogContourPoint, b: FogContourPoint): boolean {
  return pointKey(a) === pointKey(b);
}

function loopsToSegments(loops: FogContourPoint[][]): Segment[] {
  const out: Segment[] = [];
  for (const loop of loops) {
    if (loop.length < 2) continue;
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      out.push({ a, b });
    }
  }
  return out;
}

function intersectRaySegment(
  origin: FogContourPoint,
  dir: FogContourPoint,
  seg: Segment
): number | null {
  const sx = seg.b.x - seg.a.x;
  const sy = seg.b.y - seg.a.y;
  const det = dir.x * sy - dir.y * sx;
  if (Math.abs(det) < 1e-8) return null;
  const ox = seg.a.x - origin.x;
  const oy = seg.a.y - origin.y;
  const t = (ox * sy - oy * sx) / det;
  const u = (ox * dir.y - oy * dir.x) / det;
  if (t < 0) return null;
  if (u < -1e-5 || u > 1 + 1e-5) return null;
  return t;
}

function simplifyClosedPolyline(points: FogContourPoint[], epsilon: number): FogContourPoint[] {
  if (points.length < 6) return points;
  const sqEps = epsilon * epsilon;

  const distSqToSegment = (p: FogContourPoint, a: FogContourPoint, b: FogContourPoint) => {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = p.x - a.x;
    const wy = p.y - a.y;
    const c1 = wx * vx + wy * vy;
    if (c1 <= 0) return wx * wx + wy * wy;
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) {
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      return dx * dx + dy * dy;
    }
    const t = c1 / c2;
    const projX = a.x + t * vx;
    const projY = a.y + t * vy;
    const dx = p.x - projX;
    const dy = p.y - projY;
    return dx * dx + dy * dy;
  };

  const rdp = (arr: FogContourPoint[]): FogContourPoint[] => {
    if (arr.length <= 2) return arr;
    const a = arr[0];
    const b = arr[arr.length - 1];
    let maxDist = -1;
    let idx = -1;
    for (let i = 1; i < arr.length - 1; i++) {
      const d = distSqToSegment(arr[i], a, b);
      if (d > maxDist) {
        maxDist = d;
        idx = i;
      }
    }
    if (maxDist <= sqEps || idx < 0) return [a, b];
    const left = rdp(arr.slice(0, idx + 1));
    const right = rdp(arr.slice(idx));
    return [...left.slice(0, -1), ...right];
  };

  // Closed shape simplification by opening at index 0 then reclosing.
  const open = [...points, points[0]];
  const simplifiedOpen = rdp(open);
  const simplified = simplifiedOpen.slice(0, -1);
  return simplified.length >= 3 ? simplified : points;
}

function pointInPolygon(point: FogContourPoint, polygon: FogContourPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function simplifyLoop(points: FogContourPoint[]): FogContourPoint[] {
  if (points.length < 4) return points;
  const cosTolerance = Math.cos((10 * Math.PI) / 180);
  let loop = [...points];

  const removeCollinearPass = (input: FogContourPoint[]): FogContourPoint[] => {
    if (input.length < 4) return input;
    const out: FogContourPoint[] = [];
    for (let i = 0; i < input.length; i++) {
      const prev = input[(i - 1 + input.length) % input.length];
      const curr = input[i];
      const next = input[(i + 1) % input.length];
      const v1x = curr.x - prev.x;
      const v1y = curr.y - prev.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;
      const l1 = Math.hypot(v1x, v1y);
      const l2 = Math.hypot(v2x, v2y);
      if (l1 < 1e-6 || l2 < 1e-6) continue;
      const cos = (v1x * v2x + v1y * v2y) / (l1 * l2);
      if (cos > cosTolerance) continue;
      out.push(curr);
    }
    return out.length >= 3 ? out : input;
  };

  for (let pass = 0; pass < 4; pass++) {
    const next = removeCollinearPass(loop);
    if (next.length === loop.length) break;
    loop = next;
  }

  return loop;
}

function smoothLoop(points: FogContourPoint[]): FogContourPoint[] {
  if (points.length < 4) return points;
  let current = [...points];

  // Chaikin closed-curve smoothing. Two passes give soft rounded corners
  // while preserving the main silhouette of the fog frontier.
  for (let pass = 0; pass < 2; pass++) {
    const next: FogContourPoint[] = [];
    for (let i = 0; i < current.length; i++) {
      const a = current[i];
      const b = current[(i + 1) % current.length];
      const q = {
        x: 0.75 * a.x + 0.25 * b.x,
        y: 0.75 * a.y + 0.25 * b.y
      };
      const r = {
        x: 0.25 * a.x + 0.75 * b.x,
        y: 0.25 * a.y + 0.75 * b.y
      };
      next.push(q, r);
    }
    current = next;
    if (current.length > 2200) break;
  }
  return current;
}

function signedArea(loop: FogContourPoint[]): number {
  let area = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area * 0.5;
}

export function offsetLoopInward(
  loop: FogContourPoint[],
  distance: number
): FogContourPoint[] {
  if (loop.length < 3 || distance <= 0) return loop;
  const area = signedArea(loop);
  const ccw = area >= 0;
  const out: FogContourPoint[] = [];

  const inwardNormalForEdge = (dx: number, dy: number): FogContourPoint => {
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return { x: 0, y: 0 };
    if (ccw) {
      // For CCW polygons, inside is on the left side of each edge.
      return { x: -dy / len, y: dx / len };
    }
    // For CW polygons, inside is on the right side of each edge.
    return { x: dy / len, y: -dx / len };
  };

  for (let i = 0; i < loop.length; i++) {
    const prev = loop[(i - 1 + loop.length) % loop.length];
    const curr = loop[i];
    const next = loop[(i + 1) % loop.length];
    const e1x = curr.x - prev.x;
    const e1y = curr.y - prev.y;
    const e2x = next.x - curr.x;
    const e2y = next.y - curr.y;

    const n1 = inwardNormalForEdge(e1x, e1y);
    const n2 = inwardNormalForEdge(e2x, e2y);
    let nx = n1.x + n2.x;
    let ny = n1.y + n2.y;
    const nLen = Math.hypot(nx, ny);
    if (nLen < 1e-6) {
      nx = n2.x;
      ny = n2.y;
    } else {
      nx /= nLen;
      ny /= nLen;
    }

    out.push({
      x: curr.x + nx * distance,
      y: curr.y + ny * distance
    });
  }

  return out;
}

export function computeHexRectilinearVisibleContour(params: {
  originCell: { x: number; y: number };
  grid: { cols: number; rows: number };
  visibleCells: Array<{ x: number; y: number }>;
  simplifyPx?: number;
}): FogContourPoint[] {
  const { originCell, grid, visibleCells, simplifyPx = 8 } = params;
  if (visibleCells.length === 0) return [];
  const loops = computeHexFogContoursFromCells({
    fogCells: visibleCells,
    grid
  }).rawLoops;
  if (loops.length === 0) return [];

  const origin = gridToScreenForGrid(originCell.x, originCell.y, grid.cols, grid.rows);

  // Prefer the loop that actually contains the player, fallback to largest area.
  let bestLoop: FogContourPoint[] | null = null;
  for (const loop of loops) {
    if (pointInPolygon(origin, loop)) {
      bestLoop = loop;
      break;
    }
  }
  if (!bestLoop) {
    let bestArea = Number.NEGATIVE_INFINITY;
    for (const loop of loops) {
      const area = Math.abs(signedArea(loop));
      if (area > bestArea) {
        bestArea = area;
        bestLoop = loop;
      }
    }
  }
  if (!bestLoop) return [];

  return simplifyClosedPolyline(bestLoop, simplifyPx);
}

export function computeHexRectilinearContoursFromCells(params: {
  cells: Array<{ x: number; y: number }>;
  grid: { cols: number; rows: number };
  simplifyPx?: number;
  anchorPoints?: FogContourPoint[];
  spline?: boolean;
  localRoundRadiusPx?: number;
  localRoundSteps?: number;
  mapBounds?: { minX: number; minY: number; maxX: number; maxY: number } | null;
  debugInfo?: FogContourDebugInfo;
}): FogContourPoint[][] {
  const { cells, grid, debugInfo } = params;
  if (debugInfo) {
    debugInfo.centerCandidates = [];
    debugInfo.usedCenters = [];
    debugInfo.shortcutAttempts = 0;
    debugInfo.shortcutAccepted = 0;
  }
  if (cells.length === 0) return [];
  return computeHexFogContoursFromCells({
    fogCells: cells,
    grid
  }).rawLoops;
}

export function computeHexRayVisibilityContour(params: {
  originCell: { x: number; y: number };
  grid: { cols: number; rows: number };
  playableCells: Array<{ x: number; y: number }>;
  isCellVisible: (x: number, y: number) => boolean;
  rayCount?: number;
  stepPx?: number;
  simplifyPx?: number;
}): FogContourPoint[] {
  const samples = computeHexRayVisibilitySamples(params);
  if (samples.length < 3) return samples.map(s => s.visiblePoint);
  return simplifyClosedPolyline(
    samples.map(s => s.visiblePoint),
    params.simplifyPx ?? 6
  );
}

export function computeHexRayVisibilitySamples(params: {
  originCell: { x: number; y: number };
  grid: { cols: number; rows: number };
  playableCells: Array<{ x: number; y: number }>;
  isCellVisible: (x: number, y: number) => boolean;
  rayCount?: number;
  stepPx?: number;
  simplifyPx?: number;
}): RayVisibilitySample[] {
  const {
    originCell,
    grid,
    playableCells,
    isCellVisible,
    rayCount = 220,
    stepPx = 7
  } = params;
  if (playableCells.length === 0) return [];

  const visibleCells = playableCells.filter(c => isCellVisible(c.x, c.y));
  if (visibleCells.length === 0) return [];

  const borderLoops = computeHexFogContoursFromCells({
    fogCells: playableCells,
    grid
  }).rawLoops;
  if (borderLoops.length === 0) return [];
  const borderSegments = loopsToSegments(borderLoops);
  if (borderSegments.length === 0) return [];

  const visibleLoops = computeHexFogContoursFromCells({
    fogCells: visibleCells,
    grid
  }).rawLoops;
  if (visibleLoops.length === 0) return [];
  const visibleSegments = loopsToSegments(visibleLoops);
  if (visibleSegments.length === 0) return [];

  const origin = gridToScreenForGrid(originCell.x, originCell.y, grid.cols, grid.rows);
  const samples: RayVisibilitySample[] = [];
  const eps = Math.max(0.25, stepPx * 0.1);

  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };

    let borderDist: number | null = null;
    for (const seg of borderSegments) {
      const t = intersectRaySegment(origin, dir, seg);
      if (t === null) continue;
      if (borderDist === null || t < borderDist) borderDist = t;
    }
    if (borderDist === null || borderDist <= eps) continue;

    let visibleDist: number | null = null;
    for (const seg of visibleSegments) {
      const t = intersectRaySegment(origin, dir, seg);
      if (t === null) continue;
      if (t <= eps) continue;
      if (visibleDist === null || t < visibleDist) visibleDist = t;
    }

    const hitVisible = visibleDist === null ? eps : Math.min(visibleDist, borderDist);

    samples.push({
      angle,
      visiblePoint: {
        x: origin.x + dir.x * hitVisible,
        y: origin.y + dir.y * hitVisible
      },
      borderPoint: {
        x: origin.x + dir.x * borderDist,
        y: origin.y + dir.y * borderDist
      }
    });
  }

  return samples;
}

function _deprecated_computeHexRayVisibilitySamples_sampling(params: {
  originCell: { x: number; y: number };
  grid: { cols: number; rows: number };
  playableCells: Array<{ x: number; y: number }>;
  isCellVisible: (x: number, y: number) => boolean;
  rayCount?: number;
  stepPx?: number;
  simplifyPx?: number;
}): RayVisibilitySample[] {
  const {
    originCell,
    grid,
    playableCells,
    isCellVisible,
    rayCount = 220,
    stepPx = 7
  } = params;
  if (playableCells.length === 0) return [];

  const borderLoops = computeHexFogContoursFromCells({
    fogCells: playableCells,
    grid
  }).simplifiedLoops;
  if (borderLoops.length === 0) return [];
  const borderSegments = loopsToSegments(borderLoops);
  if (borderSegments.length === 0) return [];

  const origin = gridToScreenForGrid(originCell.x, originCell.y, grid.cols, grid.rows);
  const samples: RayVisibilitySample[] = [];
  const halfStep = Math.max(1, stepPx * 0.5);

  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    let borderDist: number | null = null;
    for (const seg of borderSegments) {
      const t = intersectRaySegment(origin, dir, seg);
      if (t === null) continue;
      if (borderDist === null || t < borderDist) borderDist = t;
    }
    if (borderDist === null || borderDist <= 0.5) continue;

    let lastVisible = 0;
    let firstFog: number | null = null;
    for (let d = halfStep; d <= borderDist; d += stepPx) {
      const px = origin.x + dir.x * d;
      const py = origin.y + dir.y * d;
      const cell = screenToGridForGrid(px, py, grid.cols, grid.rows);
      const visible = isCellVisible(cell.x, cell.y);
      if (!visible) {
        firstFog = d;
        break;
      }
      lastVisible = d;
    }

    let hit = borderDist;
    if (firstFog !== null) {
      let a = Math.max(0, lastVisible);
      let b = firstFog;
      for (let k = 0; k < 7; k++) {
        const m = (a + b) * 0.5;
        const px = origin.x + dir.x * m;
        const py = origin.y + dir.y * m;
        const cell = screenToGridForGrid(px, py, grid.cols, grid.rows);
        if (isCellVisible(cell.x, cell.y)) a = m;
        else b = m;
      }
      hit = (a + b) * 0.5;
    }

    samples.push({
      angle,
      visiblePoint: {
        x: origin.x + dir.x * hit,
        y: origin.y + dir.y * hit
      },
      borderPoint: {
        x: origin.x + dir.x * borderDist,
        y: origin.y + dir.y * borderDist
      }
    });
  }

  return samples;
}

export function computeHexFogContoursFromCells(params: {
  fogCells: Array<{ x: number; y: number }>;
  grid: { cols: number; rows: number };
}): FogContourResult {
  const { fogCells, grid } = params;
  if (fogCells.length === 0) {
    return { rawLoops: [], simplifiedLoops: [], smoothedLoops: [] };
  }

  const edges = new Map<string, EdgeRecord>();
  for (const cell of fogCells) {
    const poly = getGridCellPolygonForGrid(cell.x, cell.y, grid.cols, grid.rows);
    for (let i = 0; i < poly.length; i++) {
      const a = { x: poly[i].x, y: poly[i].y };
      const b = { x: poly[(i + 1) % poly.length].x, y: poly[(i + 1) % poly.length].y };
      const k = edgeKey(a, b);
      const existing = edges.get(k);
      if (existing) {
        existing.count += 1;
      } else {
        edges.set(k, { a, b, count: 1 });
      }
    }
  }

  const boundaryEdges = Array.from(edges.values()).filter(e => e.count === 1);
  if (boundaryEdges.length === 0) {
    return { rawLoops: [], simplifiedLoops: [], smoothedLoops: [] };
  }

  type Segment = { a: FogContourPoint; b: FogContourPoint; key: string };
  const segments: Segment[] = boundaryEdges.map(e => ({
    a: e.a,
    b: e.b,
    key: edgeKey(e.a, e.b)
  }));
  const segmentsByPoint = new Map<string, Segment[]>();
  const pushByPoint = (k: string, seg: Segment) => {
    const list = segmentsByPoint.get(k);
    if (list) list.push(seg);
    else segmentsByPoint.set(k, [seg]);
  };
  for (const seg of segments) {
    pushByPoint(pointKey(seg.a), seg);
    pushByPoint(pointKey(seg.b), seg);
  }

  const visited = new Set<string>();
  const rawLoops: FogContourPoint[][] = [];

  for (const seed of segments) {
    if (visited.has(seed.key)) continue;
    const loop: FogContourPoint[] = [seed.a];
    visited.add(seed.key);
    let current = seed.b;
    let guard = 0;

    while (guard < segments.length * 3) {
      guard += 1;
      loop.push(current);
      if (arePointsEqual(current, loop[0])) break;
      const candidates = segmentsByPoint.get(pointKey(current)) ?? [];
      const next = candidates.find(seg => !visited.has(seg.key));
      if (!next) break;
      visited.add(next.key);
      current = arePointsEqual(next.a, current) ? next.b : next.a;
    }

    if (loop.length >= 4 && arePointsEqual(loop[0], loop[loop.length - 1])) {
      rawLoops.push(loop.slice(0, -1));
    }
  }

  const simplifiedLoops = rawLoops
    .map(loop => simplifyLoop(loop))
    .filter(loop => loop.length >= 3);
  const smoothedLoops = simplifiedLoops
    .map(loop => smoothLoop(loop))
    .filter(loop => loop.length >= 6);

  return {
    rawLoops,
    simplifiedLoops,
    smoothedLoops
  };
}
