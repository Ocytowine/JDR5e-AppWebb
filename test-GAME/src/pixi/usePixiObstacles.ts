import { useEffect } from "react";
import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import type { RefObject } from "react";
import type { ObstacleInstance, ObstacleTypeDefinition } from "../game/obstacleTypes";
import { getObstacleOccupiedCells } from "../game/obstacleRuntime";
import { TILE_SIZE, gridToScreenBaseForGrid, gridToScreenForGrid } from "../boardConfig";

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function colorForObstacle(def: ObstacleTypeDefinition | null): number {
  const category = String(def?.category ?? "").toLowerCase();
  if (category === "wall") return 0x95a5a6;
  if (category === "vegetation") return 0x2ecc71;
  if (category === "structure") return 0xbdc3c7;
  return 0xe67e22; // prop / default
}

function spriteHeightScale(def: ObstacleTypeDefinition | null): number {
  const heightClass = String(def?.appearance?.heightClass ?? "").toLowerCase();
  if (heightClass === "low") return 0.9;
  if (heightClass === "medium") return 1.35;
  if (heightClass === "tall") return 2.1;
  return 1.2;
}

function tokenScaleFactor(
  def: ObstacleTypeDefinition | null,
  obs: ObstacleInstance
): number {
  const spec = def?.appearance?.tokenScale;
  const hasValue = typeof obs.tokenScale === "number" && Number.isFinite(obs.tokenScale);
  const fallback = spec && Number.isFinite(spec.default) ? spec.default : 100;
  let value = hasValue ? obs.tokenScale : fallback;
  const min = spec && Number.isFinite(spec.min) ? spec.min : null;
  const max = spec && Number.isFinite(spec.max) ? spec.max : null;
  if (min !== null || max !== null) {
    const lo = min ?? value;
    const hi = max ?? value;
    value = Math.min(Math.max(value, Math.min(lo, hi)), Math.max(lo, hi));
  }
  return value / 100;
}

function spriteDepthBias(def: ObstacleTypeDefinition | null): number {
  const heightClass = String(def?.appearance?.heightClass ?? "").toLowerCase();
  if (heightClass === "low") return -TILE_SIZE * 0.18;
  if (heightClass === "medium") return 0;
  if (heightClass === "tall") return TILE_SIZE * 0.45;
  return 0;
}

function isWall(def: ObstacleTypeDefinition | null | undefined): boolean {
  const category = String(def?.category ?? "").toLowerCase();
  if (category === "wall") return true;
  const tags = Array.isArray(def?.tags) ? def?.tags : [];
  return tags.some(tag => String(tag).toLowerCase() === "wall");
}

const WALL_THICKNESS_RATIO = 0.33;

function depthFromGrid(
  x: number,
  y: number,
  cols: number,
  rows: number
): number {
  return gridToScreenForGrid(x, y, cols, rows).y;
}

function scaleColor(color: number, factor: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

type WallNeighbors = {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
};

type WallDir = "n" | "e" | "s" | "w";

function getWallNeighbors(
  x: number,
  y: number,
  wallCells: Set<string>
): WallNeighbors {
  return {
    n: wallCells.has(cellKey(x, y - 1)),
    e: wallCells.has(cellKey(x + 1, y)),
    s: wallCells.has(cellKey(x, y + 1)),
    w: wallCells.has(cellKey(x - 1, y))
  };
}

function edgeEndpoints(
  center: { x: number; y: number },
  halfW: number,
  halfH: number,
  dir: WallDir
): { a: { x: number; y: number }; b: { x: number; y: number } } {
  const top = { x: center.x, y: center.y - halfH };
  const right = { x: center.x + halfW, y: center.y };
  const bottom = { x: center.x, y: center.y + halfH };
  const left = { x: center.x - halfW, y: center.y };

  switch (dir) {
    case "n":
      return { a: top, b: right };
    case "e":
      return { a: right, b: bottom };
    case "s":
      return { a: bottom, b: left };
    default:
      return { a: left, b: top };
  }
}

function drawExtrudedPolygon(options: {
  g: Graphics;
  base: { x: number; y: number }[];
  heightPx: number;
  topColor: number;
  sideRight: number;
  sideLeft: number;
  drawTop: boolean;
  outlineColor?: number;
  outlineWidth?: number;
}): void {
  const {
    g,
    base,
    heightPx,
    topColor,
    sideRight,
    sideLeft,
    drawTop,
    outlineColor,
    outlineWidth
  } = options;
  if (base.length < 3) return;
  let area = 0;
  for (let i = 0; i < base.length; i++) {
    const a = base[i];
    const b = base[(i + 1) % base.length];
    area += a.x * b.y - b.x * a.y;
  }
  const isCCW = area > 0;
  const top = base.map(p => ({ x: p.x, y: p.y - heightPx }));

  if (drawTop) {
    const flat: number[] = [];
    for (const p of top) {
      flat.push(p.x, p.y);
    }
    g.poly(flat).fill({ color: topColor, alpha: 1 });
    if (outlineColor !== undefined && outlineWidth) {
      g.poly(flat).stroke({ color: outlineColor, width: outlineWidth, alpha: 1 });
    }
  }

  const backColor = scaleColor(topColor, 0.55);
  const view = { x: -1, y: -1 };
  const viewLen = Math.hypot(view.x, view.y) || 1;
  const viewX = view.x / viewLen;
  const viewY = view.y / viewLen;
  for (let i = 0; i < base.length; i++) {
    const a = base[i];
    const b = base[(i + 1) % base.length];
    const ta = top[i];
    const tb = top[(i + 1) % base.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) continue;
    const nx = isCCW ? -dy : dy;
    const ny = isCCW ? dx : -dx;
    const nLen = Math.hypot(nx, ny) || 1;
    const nX = nx / nLen;
    const nY = ny / nLen;
    const dot = nX * viewX + nY * viewY;
    if (dot <= 0) continue;
    let color = backColor;
    if (ny > 0.0001 && Math.abs(ny) >= Math.abs(nx)) {
      color = sideLeft;
    } else if (nx > 0.0001 && Math.abs(nx) >= Math.abs(ny)) {
      color = sideRight;
    }
    g.poly([
      a.x,
      a.y,
      b.x,
      b.y,
      tb.x,
      tb.y,
      ta.x,
      ta.y
    ]).fill({ color, alpha: 1 });
  }
}

type WallPath = { points: { x: number; y: number }[]; closed: boolean };

function edgeKey(ax: number, ay: number, bx: number, by: number): string {
  if (ax < bx || (ax === bx && ay < by)) {
    return `${ax},${ay}|${bx},${by}`;
  }
  return `${bx},${by}|${ax},${ay}`;
}

function buildWallPaths(wallCells: Set<string>): WallPath[] {
  const neighborsByCell = new Map<string, { x: number; y: number }[]>();
  const degreeByCell = new Map<string, number>();

  for (const key of wallCells) {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const neighbors: { x: number; y: number }[] = [];
    if (wallCells.has(cellKey(x + 1, y))) neighbors.push({ x: x + 1, y });
    if (wallCells.has(cellKey(x - 1, y))) neighbors.push({ x: x - 1, y });
    if (wallCells.has(cellKey(x, y + 1))) neighbors.push({ x, y: y + 1 });
    if (wallCells.has(cellKey(x, y - 1))) neighbors.push({ x, y: y - 1 });
    neighborsByCell.set(key, neighbors);
    degreeByCell.set(key, neighbors.length);
  }

  const visitedEdges = new Set<string>();
  const paths: WallPath[] = [];

  for (const key of wallCells) {
    const deg = degreeByCell.get(key) ?? 0;
    if (deg === 2) continue;
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const neighbors = neighborsByCell.get(key) ?? [];
    for (const n of neighbors) {
      const eKey = edgeKey(x, y, n.x, n.y);
      if (visitedEdges.has(eKey)) continue;
      visitedEdges.add(eKey);
      const path = [{ x, y }, { x: n.x, y: n.y }];
      let prev = { x, y };
      let curr = { x: n.x, y: n.y };
      while (true) {
        const currKey = cellKey(curr.x, curr.y);
        const currDeg = degreeByCell.get(currKey) ?? 0;
        if (currDeg !== 2) break;
        const currNeighbors = neighborsByCell.get(currKey) ?? [];
        const next = currNeighbors.find(nn => nn.x !== prev.x || nn.y !== prev.y);
        if (!next) break;
        const nextEdge = edgeKey(curr.x, curr.y, next.x, next.y);
        if (visitedEdges.has(nextEdge)) break;
        visitedEdges.add(nextEdge);
        path.push({ x: next.x, y: next.y });
        prev = curr;
        curr = next;
      }
      if (path.length >= 2) paths.push({ points: path, closed: false });
    }
  }

  for (const key of wallCells) {
    const deg = degreeByCell.get(key) ?? 0;
    if (deg !== 2) continue;
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const neighbors = neighborsByCell.get(key) ?? [];
    for (const n of neighbors) {
      const eKey = edgeKey(x, y, n.x, n.y);
      if (visitedEdges.has(eKey)) continue;
      visitedEdges.add(eKey);
      const path = [{ x, y }, { x: n.x, y: n.y }];
      let prev = { x, y };
      let curr = { x: n.x, y: n.y };
      while (!(curr.x === x && curr.y === y)) {
        const currKey = cellKey(curr.x, curr.y);
        const currNeighbors = neighborsByCell.get(currKey) ?? [];
        const next = currNeighbors.find(nn => nn.x !== prev.x || nn.y !== prev.y);
        if (!next) break;
        const nextEdge = edgeKey(curr.x, curr.y, next.x, next.y);
        if (visitedEdges.has(nextEdge)) break;
        visitedEdges.add(nextEdge);
        path.push({ x: next.x, y: next.y });
        prev = curr;
        curr = next;
      }
      if (path.length >= 3) paths.push({ points: path, closed: true });
    }
  }

  return paths;
}

function splitPathIntoSegments(path: WallPath): { points: { x: number; y: number }[] }[] {
  const pts = path.points;
  if (pts.length < 2) return [];
  const segments: { points: { x: number; y: number }[] }[] = [];
  let current: { x: number; y: number }[] = [pts[0]];
  let lastDx = pts[1].x - pts[0].x;
  let lastDy = pts[1].y - pts[0].y;
  current.push(pts[1]);

  for (let i = 2; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    if (dx !== lastDx || dy !== lastDy) {
      segments.push({ points: current });
      current = [pts[i - 1], pts[i]];
    } else {
      current.push(pts[i]);
    }
    lastDx = dx;
    lastDy = dy;
  }

  if (current.length >= 2) segments.push({ points: current });
  return segments;
}

function buildOffsetPolygonGrid(
  points: { x: number; y: number }[],
  thickness: number,
  closed: boolean
): { base: { x: number; y: number }[] } | null {
  if (points.length < 2) return null;
  const segCount = closed ? points.length : points.length - 1;
  const normals: { x: number; y: number }[] = [];
  for (let i = 0; i < segCount; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    normals.push({ x: -dy / len, y: dx / len });
  }

  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  const miterLimit = thickness * 2.5;

  if (!closed) {
    for (let i = 0; i < points.length; i++) {
      if (i === 0) {
        const n0 = normals[0];
        left.push({ x: points[0].x + n0.x * thickness, y: points[0].y + n0.y * thickness });
        right.push({ x: points[0].x - n0.x * thickness, y: points[0].y - n0.y * thickness });
        continue;
      }
      if (i === points.length - 1) {
        const nLast = normals[normals.length - 1];
        const last = points[points.length - 1];
        left.push({ x: last.x + nLast.x * thickness, y: last.y + nLast.y * thickness });
        right.push({ x: last.x - nLast.x * thickness, y: last.y - nLast.y * thickness });
        continue;
      }
      const nPrev = normals[i - 1];
      const nNext = normals[i];
      let bx = nPrev.x + nNext.x;
      let by = nPrev.y + nNext.y;
      const bl = Math.hypot(bx, by);
      if (bl <= 1e-4) {
        bx = nNext.x;
        by = nNext.y;
      } else {
        bx /= bl;
        by /= bl;
      }
      const dot = bx * nNext.x + by * nNext.y;
      const denom = Math.max(0.15, Math.abs(dot));
      const miter = Math.min(miterLimit, thickness / denom);
      left.push({ x: points[i].x + bx * miter, y: points[i].y + by * miter });
      right.push({ x: points[i].x - bx * miter, y: points[i].y - by * miter });
    }
  } else {
    for (let i = 0; i < points.length; i++) {
      const nPrev = normals[(i - 1 + normals.length) % normals.length];
      const nNext = normals[i % normals.length];
      let bx = nPrev.x + nNext.x;
      let by = nPrev.y + nNext.y;
      const bl = Math.hypot(bx, by);
      if (bl <= 1e-4) {
        bx = nNext.x;
        by = nNext.y;
      } else {
        bx /= bl;
        by /= bl;
      }
      const dot = bx * nNext.x + by * nNext.y;
      const denom = Math.max(0.15, Math.abs(dot));
      const miter = Math.min(miterLimit, thickness / denom);
      left.push({ x: points[i].x + bx * miter, y: points[i].y + by * miter });
      right.push({ x: points[i].x - bx * miter, y: points[i].y - by * miter });
    }
  }

  const base = left.concat(right.reverse());
  return base.length >= 3 ? { base } : null;
}

export function usePixiObstacles(options: {
  depthLayerRef: RefObject<Container | null>;
  obstacleTypes: ObstacleTypeDefinition[];
  obstacles: ObstacleInstance[];
  pixiReadyTick?: number;
  grid: { cols: number; rows: number };
}): void {
  useEffect(() => {
    const depthLayer = options.depthLayerRef.current;
    if (!depthLayer) return;

    for (const child of [...depthLayer.children]) {
      if (child.name === "obstacle" || child.name === "obstacle-wall") {
        depthLayer.removeChild(child);
        child.destroy?.();
      }
    }

    const typeById = new Map<string, ObstacleTypeDefinition>();
    for (const t of options.obstacleTypes) typeById.set(t.id, t);

    const wallCells = new Set<string>();
    const wallColorByCell = new Map<string, number>();
    for (const obs of options.obstacles) {
      const def = typeById.get(obs.typeId) ?? null;
      if (!isWall(def)) continue;
      const occupiedCells = def ? getObstacleOccupiedCells(obs, def) : [{ x: obs.x, y: obs.y }];
      const baseColor = typeof def?.appearance?.tint === "number"
        ? def.appearance.tint
        : 0x9aa0a6;
      for (const cell of occupiedCells) {
        const key = cellKey(cell.x, cell.y);
        wallCells.add(key);
        if (!wallColorByCell.has(key)) {
          wallColorByCell.set(key, baseColor);
        }
      }
    }

    const halfW = TILE_SIZE / 2;
    const halfH = TILE_SIZE * 0.5 / 2;
    const thicknessPx = Math.min(halfW, halfH) * WALL_THICKNESS_RATIO;
    const basisLen = Math.hypot(halfW, halfH);
    const thicknessGrid = basisLen > 0 ? thicknessPx / basisLen : 0.1;
    const wallHeight = TILE_SIZE;

    type WallJunction = {
      x: number;
      y: number;
      color: number;
    };

    const wallJunctions: WallJunction[] = [];
    for (const key of wallCells) {
      const [xs, ys] = key.split(",");
      const x = Number(xs);
      const y = Number(ys);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const neighbors = getWallNeighbors(x, y, wallCells);
      const neighborCount =
        (neighbors.n ? 1 : 0) +
        (neighbors.e ? 1 : 0) +
        (neighbors.s ? 1 : 0) +
        (neighbors.w ? 1 : 0);
      const straightNS = neighbors.n && neighbors.s && !neighbors.e && !neighbors.w;
      const straightEW = neighbors.e && neighbors.w && !neighbors.n && !neighbors.s;
      if (neighborCount >= 2 && !straightNS && !straightEW) {
        wallJunctions.push({
          x,
          y,
          color: wallColorByCell.get(key) ?? 0x9aa0a6
        });
      }
    }

    type WallSegmentRender = {
      base: { x: number; y: number }[];
      baseColor: number;
      depthY: number;
      screenXMid: number;
      start: { x: number; y: number };
      end: { x: number; y: number };
      dir: { x: number; y: number };
      hideStartCap: boolean;
      hideEndCap: boolean;
      pointKeys: Set<string>;
      junctions: WallJunction[];
    };

    const wallSegments: WallSegmentRender[] = [];
    const wallPaths = buildWallPaths(wallCells);
    for (const path of wallPaths) {
      const segments = splitPathIntoSegments(path);
      for (const segment of segments) {
        const pts = segment.points;
        if (pts.length < 2) continue;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dl = Math.hypot(dx, dy) || 1;
          const extend = thicknessGrid * 0.75;
          const extendedPoints = [
            { x: a.x - (dx / dl) * extend, y: a.y - (dy / dl) * extend },
            { x: b.x + (dx / dl) * extend, y: b.y + (dy / dl) * extend }
          ];

          const offsetGrid = buildOffsetPolygonGrid(extendedPoints, thicknessGrid, false);
          if (!offsetGrid) continue;
          const offset = offsetGrid.base.map(p =>
            gridToScreenForGrid(p.x, p.y, options.grid.cols, options.grid.rows)
          );
          const baseColor = wallColorByCell.get(cellKey(a.x, a.y)) ?? 0x9aa0a6;
          const depthY = Math.max(
            depthFromGrid(a.x, a.y, options.grid.cols, options.grid.rows),
            depthFromGrid(b.x, b.y, options.grid.cols, options.grid.rows)
          );
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const midScreen = gridToScreenForGrid(mid.x, mid.y, options.grid.cols, options.grid.rows);
          const dir = {
            x: Math.sign(b.x - a.x),
            y: Math.sign(b.y - a.y)
          };
          const startNeighbors = getWallNeighbors(a.x, a.y, wallCells);
          const endNeighbors = getWallNeighbors(b.x, b.y, wallCells);
          const startNeighborCount =
            (startNeighbors.n ? 1 : 0) +
            (startNeighbors.e ? 1 : 0) +
            (startNeighbors.s ? 1 : 0) +
            (startNeighbors.w ? 1 : 0);
          const endNeighborCount =
            (endNeighbors.n ? 1 : 0) +
            (endNeighbors.e ? 1 : 0) +
            (endNeighbors.s ? 1 : 0) +
            (endNeighbors.w ? 1 : 0);
          const startHasContinuation = wallCells.has(cellKey(a.x - dir.x, a.y - dir.y));
          const endHasContinuation = wallCells.has(cellKey(b.x + dir.x, b.y + dir.y));
          const hideStartCap = startHasContinuation || startNeighborCount > 1;
          const hideEndCap = endHasContinuation || endNeighborCount > 1;
          const pointKeys = new Set<string>([cellKey(a.x, a.y), cellKey(b.x, b.y)]);
          wallSegments.push({
            base: offset,
            baseColor,
            depthY,
            screenXMid: midScreen.x,
            start: a,
            end: b,
            dir,
            hideStartCap,
            hideEndCap,
            pointKeys,
            junctions: []
          });
        }
      }
    }

    for (const junction of wallJunctions) {
      let best: WallSegmentRender | null = null;
      for (const segment of wallSegments) {
        if (!segment.pointKeys.has(cellKey(junction.x, junction.y))) continue;
        if (!best || segment.depthY > best.depthY) best = segment;
      }
      if (best) best.junctions.push(junction);
    }

    wallSegments.sort((a, b) => {
      if (a.depthY !== b.depthY) return a.depthY - b.depthY;
      if (a.screenXMid !== b.screenXMid) return b.screenXMid - a.screenXMid;
      return a.start.y - b.start.y;
    });

    const junctionSize = thicknessGrid * 0.75;
    for (const segment of wallSegments) {
      const segmentGraphics = new Graphics();
      drawExtrudedPolygon({
        g: segmentGraphics,
        base: segment.base,
        heightPx: wallHeight,
        topColor: segment.baseColor,
        sideRight: scaleColor(segment.baseColor, 0.78),
        sideLeft: scaleColor(segment.baseColor, 0.68),
        drawTop: false
      });
      drawExtrudedPolygon({
        g: segmentGraphics,
        base: segment.base,
        heightPx: wallHeight,
        topColor: segment.baseColor,
        sideRight: scaleColor(segment.baseColor, 0.78),
        sideLeft: scaleColor(segment.baseColor, 0.68),
        drawTop: true
      });

      const topPoints = segment.base.map(p => ({ x: p.x, y: p.y - wallHeight }));
      const edgeCount = topPoints.length;
      if (edgeCount >= 4) {
        const edges = [];
        for (let i = 0; i < edgeCount; i++) {
          const a = topPoints[i];
          const b = topPoints[(i + 1) % edgeCount];
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          edges.push({
            i,
            a,
            b,
            len,
            mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
          });
        }
        const sortedByLen = [...edges].sort((e1, e2) => e1.len - e2.len);
        const capEdges = new Set<number>([sortedByLen[0].i, sortedByLen[1].i]);
        const screenA = gridToScreenForGrid(segment.start.x, segment.start.y, options.grid.cols, options.grid.rows);
        const screenB = gridToScreenForGrid(segment.end.x, segment.end.y, options.grid.cols, options.grid.rows);
        const dirScreen = { x: screenB.x - screenA.x, y: screenB.y - screenA.y };
        const center = { x: (screenA.x + screenB.x) / 2, y: (screenA.y + screenB.y) / 2 };
        segmentGraphics.setStrokeStyle({
          width: 2,
          color: scaleColor(segment.baseColor, 0.25),
          alpha: 1
        });
        for (const edge of edges) {
          if (capEdges.has(edge.i)) {
            const vec = { x: edge.mid.x - center.x, y: edge.mid.y - center.y };
            const dot = vec.x * dirScreen.x + vec.y * dirScreen.y;
            if (dot < 0 && segment.hideStartCap) continue;
            if (dot >= 0 && segment.hideEndCap) continue;
          }
          segmentGraphics.moveTo(edge.a.x, edge.a.y);
          segmentGraphics.lineTo(edge.b.x, edge.b.y);
        }
        segmentGraphics.stroke();
      }

      for (const j of segment.junctions) {
        const topPoints = [
          { x: j.x, y: j.y - junctionSize },
          { x: j.x + junctionSize, y: j.y },
          { x: j.x, y: j.y + junctionSize },
          { x: j.x - junctionSize, y: j.y }
        ].map(p => {
          const screen = gridToScreenForGrid(p.x, p.y, options.grid.cols, options.grid.rows);
          return { x: screen.x, y: screen.y - wallHeight };
        });

        const flat: number[] = [];
        for (const p of topPoints) flat.push(p.x, p.y);
        segmentGraphics.poly(flat).fill({ color: j.color, alpha: 1 });
      }

      segmentGraphics.zIndex = segment.depthY;
      segmentGraphics.name = "obstacle-wall";
      depthLayer.addChild(segmentGraphics);
    }

    for (const obs of options.obstacles) {
      const def = typeById.get(obs.typeId) ?? null;

      if (isWall(def)) continue;

      const occupiedCells = def ? getObstacleOccupiedCells(obs, def) : [{ x: obs.x, y: obs.y }];
      const spriteKey = def?.appearance?.spriteKey;
      const canUseSprite = typeof spriteKey === "string" && occupiedCells.length === 1;

      if (canUseSprite) {
        const texture = Assets.get(spriteKey);
        if (texture && texture instanceof Texture) {
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5, 1);

          const heightScale = spriteHeightScale(def);
          const scaleFactor = tokenScaleFactor(def, obs);
          const targetHeight = TILE_SIZE * heightScale * scaleFactor;
          const aspect = texture.height > 0 ? texture.width / texture.height : 1;
          sprite.height = targetHeight;
          sprite.width = targetHeight * aspect;

          const base = gridToScreenBaseForGrid(occupiedCells[0].x, occupiedCells[0].y, options.grid.cols, options.grid.rows);
          sprite.x = base.x;
          sprite.y = base.y;

          if (typeof def?.appearance?.tint === "number") {
            sprite.tint = def.appearance.tint;
          }

          if (obs.rotation) {
            sprite.rotation = (obs.rotation * Math.PI) / 180;
          }

          sprite.zIndex = base.y + spriteDepthBias(def);
          sprite.name = "obstacle";
          depthLayer.addChild(sprite);
          continue;
        }
      }

      const g = new Graphics();
      const w = TILE_SIZE;
      const h = TILE_SIZE * 0.5;
      const color = colorForObstacle(def);
      let depthY = Number.NEGATIVE_INFINITY;

      for (const cell of occupiedCells) {
        const center = gridToScreenForGrid(cell.x, cell.y, options.grid.cols, options.grid.rows);
        depthY = Math.max(depthY, center.y);
        const points = [
          center.x,
          center.y - h / 2,
          center.x + w / 2,
          center.y,
          center.x,
          center.y + h / 2,
          center.x - w / 2,
          center.y
        ];

        g.poly(points).fill({
          color,
          alpha: 0.9
        });
        g.poly(points).stroke({
          color: 0x0b0b12,
          width: 2,
          alpha: 0.8
        });
      }

      g.zIndex = (Number.isFinite(depthY) ? depthY : 0) + spriteDepthBias(def);
      g.name = "obstacle";
      depthLayer.addChild(g);
    }
  }, [
    options.depthLayerRef,
    options.obstacleTypes,
    options.obstacles,
    options.pixiReadyTick,
    options.grid
  ]);
}
