import { createGridAdapter } from "../../src/ui/grid";
import { type CliffSegment, getWorldMapCellKey, type MapCell, type WorldMapLayout } from "../data/worldMapLayout";

type Point = { x: number; y: number };

export type CliffOverlaySegment = {
  key: string;
  line: string;
  highCell: MapCell;
  lowCell: MapCell;
};

export type CliffOverlayPath = {
  key: string;
  path: string;
};

export type CliffOverlayPolygon = {
  key: string;
  path: string;
};

type CliffBaseSegment = {
  id: string;
  start: Point;
  end: Point;
  normal: Point;
  highCell: MapCell;
  lowCell: MapCell;
};

type OrientedCliffSegment = {
  id: string;
  start: Point;
  end: Point;
  normal: Point;
};

function createGrid(layout: WorldMapLayout) {
  return createGridAdapter({
    kind: "hex",
    tileSize: layout.grid.tileSize / Math.sqrt(3),
    origin: { x: layout.grid.tileSize / 2, y: layout.grid.tileSize / 2 },
    hex: {
      offset: layout.grid.offset,
      orientation: layout.grid.orientation
    }
  });
}

function getCellCenter(layout: WorldMapLayout, cell: MapCell): Point {
  return createGrid(layout).toScreen(cell, layout.grid);
}

function getCellPolygonPoints(layout: WorldMapLayout, cell: MapCell): Point[] {
  const center = getCellCenter(layout, cell);
  const radius = layout.grid.tileSize / Math.sqrt(3);
  const points: Point[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = -Math.PI / 2 + (Math.PI / 3) * i;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    });
  }
  return points;
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;
}

function pointKey(point: Point): string {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

export function getSharedHexEdge(layout: WorldMapLayout, a: MapCell, b: MapCell): { start: Point; end: Point } | null {
  const aPoints = getCellPolygonPoints(layout, a);
  const bPoints = getCellPolygonPoints(layout, b);
  for (let i = 0; i < aPoints.length; i += 1) {
    const start = aPoints[i];
    const end = aPoints[(i + 1) % aPoints.length];
    for (let j = 0; j < bPoints.length; j += 1) {
      const otherStart = bPoints[j];
      const otherEnd = bPoints[(j + 1) % bPoints.length];
      if ((samePoint(start, otherEnd) && samePoint(end, otherStart)) || (samePoint(start, otherStart) && samePoint(end, otherEnd))) {
        return { start, end };
      }
    }
  }
  return null;
}

function normalize(point: Point): Point {
  const length = Math.hypot(point.x, point.y) || 1;
  return { x: point.x / length, y: point.y / length };
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(point: Point, factor: number): Point {
  return { x: point.x * factor, y: point.y * factor };
}

function buildCliffChains(segments: CliffBaseSegment[]): OrientedCliffSegment[][] {
  const remaining = new Map(segments.map(segment => [segment.id, segment]));
  const endpointIndex = new Map<string, CliffBaseSegment[]>();

  segments.forEach(segment => {
    [segment.start, segment.end].forEach(point => {
      const key = pointKey(point);
      const bucket = endpointIndex.get(key) ?? [];
      bucket.push(segment);
      endpointIndex.set(key, bucket);
    });
  });

  function getDegree(point: Point): number {
    return (endpointIndex.get(pointKey(point)) ?? []).length;
  }

  function orient(segment: CliffBaseSegment, from: Point): OrientedCliffSegment {
    if (samePoint(segment.start, from)) {
      return { id: segment.id, start: segment.start, end: segment.end, normal: segment.normal };
    }
    return { id: segment.id, start: segment.end, end: segment.start, normal: segment.normal };
  }

  function findNext(point: Point): OrientedCliffSegment | null {
    const candidates = endpointIndex.get(pointKey(point)) ?? [];
    for (const candidate of candidates) {
      if (!remaining.has(candidate.id)) continue;
      return orient(candidate, point);
    }
    return null;
  }

  const chains: OrientedCliffSegment[][] = [];

  while (remaining.size > 0) {
    const seed = Array.from(remaining.values()).sort((a, b) => {
      const aDegree = Math.min(getDegree(a.start), getDegree(a.end));
      const bDegree = Math.min(getDegree(b.start), getDegree(b.end));
      return aDegree - bDegree;
    })[0];

    const startPoint = getDegree(seed.start) <= getDegree(seed.end) ? seed.start : seed.end;
    const orientedSeed = orient(seed, startPoint);
    remaining.delete(seed.id);

    const chain: OrientedCliffSegment[] = [orientedSeed];

    let forward = findNext(orientedSeed.end);
    while (forward) {
      remaining.delete(forward.id);
      chain.push(forward);
      forward = findNext(forward.end);
    }

    let backward = findNext(orientedSeed.start);
    while (backward) {
      remaining.delete(backward.id);
      chain.unshift(backward);
      backward = findNext(backward.start);
    }

    chains.push(chain);
  }

  return chains;
}

function buildRidgePath(points: Point[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function lineIntersection(pointA: Point, directionA: Point, pointB: Point, directionB: Point): Point | null {
  const determinant = cross(directionA, directionB);
  if (Math.abs(determinant) < 0.0001) return null;
  const diff = subtract(pointB, pointA);
  const t = cross(diff, directionB) / determinant;
  return add(pointA, scale(directionA, t));
}

function buildOffsetPolyline(chain: OrientedCliffSegment[], inset: number): Point[] {
  if (chain.length === 0) return [];

  const offsetSegments = chain.map(segment => ({
    start: add(segment.start, scale(segment.normal, inset)),
    end: add(segment.end, scale(segment.normal, inset)),
    direction: subtract(segment.end, segment.start)
  }));

  const points: Point[] = [];
  points.push(offsetSegments[0].start);

  for (let i = 0; i < offsetSegments.length - 1; i += 1) {
    const current = offsetSegments[i];
    const next = offsetSegments[i + 1];
    const intersection = lineIntersection(current.start, current.direction, next.start, next.direction);

    if (!intersection) {
      points.push(current.end);
      continue;
    }

    const currentLength = Math.hypot(current.direction.x, current.direction.y) || 1;
    const maxJoinDistance = inset * 3;
    const fromCurrentEnd = Math.hypot(intersection.x - current.end.x, intersection.y - current.end.y);
    const fromNextStart = Math.hypot(intersection.x - next.start.x, intersection.y - next.start.y);

    if (fromCurrentEnd > maxJoinDistance || fromNextStart > maxJoinDistance || currentLength < 0.001) {
      points.push(current.end);
      points.push(next.start);
      continue;
    }

    points.push(intersection);
  }

  points.push(offsetSegments[offsetSegments.length - 1].end);
  return points.filter((point, index, array) => index === 0 || !samePoint(point, array[index - 1]));
}

function buildShadowPolygonPath(chain: OrientedCliffSegment[], inset: number): string {
  if (chain.length === 0) return "";
  const ridgePoints = [chain[0].start, ...chain.map(segment => segment.end)];
  const offsetPoints = buildOffsetPolyline(chain, inset);
  if (offsetPoints.length < 2) return "";
  const polygonPoints = [...ridgePoints, ...offsetPoints.slice().reverse()];
  return polygonPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ") + " Z";
}

export function computeCliffOverlay(layout: WorldMapLayout): {
  ridgeSegments: CliffOverlaySegment[];
  ridgePaths: CliffOverlayPath[];
  shadowPolygons: CliffOverlayPolygon[];
} {
  const ridgeSegments: CliffOverlaySegment[] = [];
  const baseSegments: CliffBaseSegment[] = [];

  layout.cliffSegments.forEach((segment: CliffSegment) => {
    const edge = getSharedHexEdge(layout, segment.a, segment.b);
    if (!edge) return;

    const lowCenter = getCellCenter(layout, segment.low);
    const midX = (edge.start.x + edge.end.x) / 2;
    const midY = (edge.start.y + edge.end.y) / 2;
    const towardLowX = lowCenter.x - midX;
    const towardLowY = lowCenter.y - midY;
    const length = Math.hypot(towardLowX, towardLowY) || 1;
    const normal = { x: towardLowX / length, y: towardLowY / length };

    ridgeSegments.push({
      key: `cliff-${getWorldMapCellKey(segment.a)}-${getWorldMapCellKey(segment.b)}`,
      line: `M ${edge.start.x} ${edge.start.y} L ${edge.end.x} ${edge.end.y}`,
      highCell: segment.high,
      lowCell: segment.low
    });

    baseSegments.push({
      id: `cliff-base-${baseSegments.length}`,
      start: edge.start,
      end: edge.end,
      normal,
      highCell: segment.high,
      lowCell: segment.low
    });
  });

  const chains = buildCliffChains(baseSegments);
  const shadowPolygons = chains
    .map((chain, index) => {
      const path = buildShadowPolygonPath(chain, 10);
      return path
        ? {
            key: `cliff-shadow-poly-${index}`,
            path
          }
        : null;
    })
    .filter((entry): entry is CliffOverlayPolygon => Boolean(entry));

  return {
    ridgeSegments,
    ridgePaths: chains.map((chain, index) => {
      const points = [chain[0].start, ...chain.map(segment => segment.end)];
      return {
        key: `cliff-ridge-${index}`,
        path: buildRidgePath(points)
      };
    }),
    shadowPolygons
  };
}
