import { useEffect, useMemo, useState } from "react";
import { Assets, Container, Graphics, Sprite, TilingSprite, Texture } from "pixi.js";
import type { RefObject } from "react";
import {
  TILE_SIZE,
  getBoardGridProjectionKind,
  getBoardHeight,
  getBoardWidth,
  getGridCellPolygonForGrid
} from "../../boardConfig";
import type { TerrainCell } from "../../game/map/generation/draft";
import type { TerrainMixCell } from "../../game/map/generation/terrainMix";
import type { FloorMaterial } from "../../data/maps/floors/types";
import {
  getFloorTilingTextureFromUrl,
  getFloorTilingUrl,
  getFloorTilingVariantUrls,
  preloadFloorTilingTexturesFor
} from "../../floorTilingHelper";

const floorMaskModules = import.meta.glob("../../data/maps/floors/mask/*.png", {
  query: "?url",
  import: "default",
  eager: true
});

const FLOOR_BORDER_MASK_URL_BY_ID: Record<string, string> = {};
const borderMaskCutCanvasByUrl = new Map<string, HTMLCanvasElement>();
const borderMaskPendingByUrl = new Set<string>();

for (const [path, url] of Object.entries(floorMaskModules)) {
  const file = path.split("/").pop() ?? "";
  const base = file.replace(/\.png$/i, "").trim().toLowerCase();
  const match = base.match(/^mask[-_\s]+(.+)$/i);
  const id = (match?.[1] ?? base).trim();
  if (!id) continue;
  FLOOR_BORDER_MASK_URL_BY_ID[id] = url as string;
}

type Edge = "N" | "S" | "W" | "E";
type Point = { x: number; y: number };
type Segment = { a: Point; b: Point; inside?: Point };
type EdgeRecord = { count: number; a: Point; b: Point; inside?: Point };
interface SegmentPaths {
  closedLoops: Point[][];
  openPaths: Point[][];
}
const BORDER_OVERFLOW_RATIO = 0.3;

function hash01(x: number, y: number, seed: number): number {
  const n = x * 374761393 + y * 668265263 + seed * 1442695041;
  let h = (n ^ (n >> 13)) * 1274126177;
  h = (h ^ (h >> 16)) >>> 0;
  return (h % 1000) / 1000;
}

function hasNaturalTag(tags?: string[]): boolean {
  if (!tags || tags.length === 0) return false;
  return tags.includes("nature") || tags.includes("natural");
}

function parseHexColor(hex: string | null | undefined): number | null {
  if (!hex) return null;
  const cleaned = hex.trim().replace("#", "");
  if (!cleaned) return null;
  const value = Number.parseInt(cleaned, 16);
  return Number.isFinite(value) ? value : null;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isSamePoint(a: Point, b: Point): boolean {
  const eps = 1e-5;
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

function pointKey(p: Point): string {
  return `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
}

function edgeKey(a: Point, b: Point): string {
  const ka = pointKey(a);
  const kb = pointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

function buildPathsFromSegments(segments: Segment[]): SegmentPaths {
  const closedLoops: Point[][] = [];
  const openPaths: Point[][] = [];
  const used = new Array<boolean>(segments.length).fill(false);
  const byPoint = new Map<string, number[]>();
  const pointByKey = new Map<string, Point>();

  const vecNorm = (x: number, y: number): { x: number; y: number } => {
    const len = Math.hypot(x, y);
    if (len <= 1e-6) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
  };

  segments.forEach((seg, index) => {
    const aKey = pointKey(seg.a);
    const bKey = pointKey(seg.b);
    pointByKey.set(aKey, seg.a);
    pointByKey.set(bKey, seg.b);
    const listA = byPoint.get(aKey);
    if (listA) listA.push(index);
    else byPoint.set(aKey, [index]);
    const listB = byPoint.get(bKey);
    if (listB) listB.push(index);
    else byPoint.set(bKey, [index]);
  });

  const getOtherPoint = (seg: Segment, currentKey: string): Point => {
    return pointKey(seg.a) === currentKey ? seg.b : seg.a;
  };

  const pickNextEdge = (currentKey: string, prevDir: { x: number; y: number } | null): number | null => {
    const candidates = byPoint.get(currentKey) ?? [];
    let best: number | null = null;
    let bestScore = -Infinity;
    for (const edgeIndex of candidates) {
      if (used[edgeIndex]) continue;
      if (!prevDir) return edgeIndex;
      const seg = segments[edgeIndex];
      const currentPoint = pointByKey.get(currentKey);
      if (!currentPoint) continue;
      const nextPoint = getOtherPoint(seg, currentKey);
      const dir = vecNorm(nextPoint.x - currentPoint.x, nextPoint.y - currentPoint.y);
      const score = prevDir.x * dir.x + prevDir.y * dir.y;
      if (score > bestScore) {
        bestScore = score;
        best = edgeIndex;
      }
    }
    return best;
  };

  const traceFrom = (startKey: string, forcedFirstEdge: number | null): Point[] => {
    const startPoint = pointByKey.get(startKey);
    if (!startPoint) return [];
    const points: Point[] = [startPoint];
    let currentKey = startKey;
    let prevDir: { x: number; y: number } | null = null;

    let firstEdge = forcedFirstEdge;
    while (true) {
      const edgeIndex = firstEdge ?? pickNextEdge(currentKey, prevDir);
      firstEdge = null;
      if (edgeIndex === null || used[edgeIndex]) break;
      used[edgeIndex] = true;
      const seg = segments[edgeIndex];
      const currentPoint = pointByKey.get(currentKey);
      if (!currentPoint) break;
      const nextPoint = getOtherPoint(seg, currentKey);
      const nextKey = pointKey(nextPoint);
      points.push(nextPoint);
      const dir = vecNorm(nextPoint.x - currentPoint.x, nextPoint.y - currentPoint.y);
      prevDir = dir;
      currentKey = nextKey;
      if (currentKey === startKey) break;
    }
    return points;
  };

  // Open paths first: start from degree-1 vertices.
  for (const [key, edges] of byPoint.entries()) {
    if (edges.length !== 1) continue;
    const onlyEdge = edges[0];
    if (used[onlyEdge]) continue;
    const points = traceFrom(key, onlyEdge);
    if (points.length >= 2 && !isSamePoint(points[0], points[points.length - 1])) {
      openPaths.push(points);
    }
  }

  // Remaining edges are loops or complex branches.
  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    const startKey = pointKey(segments[i].a);
    const points = traceFrom(startKey, i);
    if (points.length >= 4 && isSamePoint(points[0], points[points.length - 1])) {
      closedLoops.push(points.slice(0, points.length - 1));
    } else if (points.length >= 2) {
      openPaths.push(points);
    }
  }

  return { closedLoops, openPaths };
}

function canvasBlendTriangle(
  ctx: CanvasRenderingContext2D,
  corner: TerrainMixCell["corner"],
  left: number,
  top: number,
  right: number,
  bottom: number
): void {
  ctx.beginPath();
  if (corner === "NE") {
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.lineTo(right, bottom);
  } else if (corner === "NW") {
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.lineTo(left, bottom);
  } else if (corner === "SE") {
    ctx.moveTo(right, top);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
  } else {
    ctx.moveTo(left, top);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
  }
  ctx.closePath();
  ctx.fill();
}

function canvasBaseTriangle(
  ctx: CanvasRenderingContext2D,
  corner: TerrainMixCell["corner"],
  left: number,
  top: number,
  right: number,
  bottom: number
): void {
  ctx.beginPath();
  if (corner === "NE") {
    ctx.moveTo(left, top);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
  } else if (corner === "NW") {
    ctx.moveTo(right, top);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
  } else if (corner === "SE") {
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.lineTo(left, bottom);
  } else {
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.lineTo(right, bottom);
  }
  ctx.closePath();
  ctx.fill();
}

function applyPlayableClipMask(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  isPlayable: (x: number, y: number) => boolean
): void {
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!isPlayable(x, y)) continue;
      const polygon = getGridCellPolygonForGrid(x, y, cols, rows);
      if (polygon.length < 3) continue;
      ctx.moveTo(polygon[0].x, polygon[0].y);
      for (let i = 1; i < polygon.length; i++) {
        ctx.lineTo(polygon[i].x, polygon[i].y);
      }
      ctx.closePath();
    }
  }
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
}

async function preloadBorderMaskImages(urls: string[]): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const url of urls) {
    if (!url) continue;
    if (borderMaskCutCanvasByUrl.has(url) || borderMaskPendingByUrl.has(url)) continue;
    borderMaskPendingByUrl.add(url);
    jobs.push(
      new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const cutCanvas = document.createElement("canvas");
          cutCanvas.width = Math.max(1, img.width);
          cutCanvas.height = Math.max(1, img.height);
          const cutCtx = cutCanvas.getContext("2d");
          if (cutCtx) {
            cutCtx.drawImage(img, 0, 0);
            const imageData = cutCtx.getImageData(0, 0, cutCanvas.width, cutCanvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              // Invert source alpha so transparent/opaque logic is swapped.
              data[i] = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
              data[i + 3] = 255 - data[i + 3];
            }
            cutCtx.putImageData(imageData, 0, 0);
            borderMaskCutCanvasByUrl.set(url, cutCanvas);
          }
          borderMaskPendingByUrl.delete(url);
          resolve();
        };
        img.onerror = () => {
          borderMaskPendingByUrl.delete(url);
          reject(new Error(`Failed to load floor border mask: ${url}`));
        };
        img.src = url;
      })
    );
  }
  if (jobs.length > 0) {
    await Promise.allSettled(jobs);
  }
}

export function usePixiNaturalTiling(options: {
  layerRef: RefObject<Container | null>;
  terrain?: TerrainCell[] | null;
  terrainMix?: Array<TerrainMixCell | null> | null;
  playableCells?: Set<string> | null;
  grid: { cols: number; rows: number };
  materials: Map<string, FloorMaterial>;
  enableBorderMask?: boolean;
  showMaskPlacementRects?: boolean;
  showMaskNormals?: boolean;
  pixiReadyTick?: number;
  onInvalidate?: () => void;
}): void {
  const [readyTick, setReadyTick] = useState(0);
  const texturedIds = useMemo(() => {
    const list: string[] = [];
    for (const mat of options.materials.values()) {
      if (getFloorTilingUrl(mat.id)) list.push(mat.id);
    }
    list.sort();
    return list;
  }, [options.materials]);
  const naturalIds = useMemo(() => {
    const list: string[] = [];
    for (const mat of options.materials.values()) {
      if (hasNaturalTag(mat.tags)) list.push(mat.id);
    }
    list.sort();
    return list;
  }, [options.materials]);
  const borderMaskUrls = useMemo(() => {
    const urls: string[] = [];
    for (const id of naturalIds) {
      const url = FLOOR_BORDER_MASK_URL_BY_ID[id];
      if (url) urls.push(url);
    }
    return Array.from(new Set(urls));
  }, [naturalIds]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await preloadFloorTilingTexturesFor(texturedIds, 256);
        if (!cancelled) setReadyTick(t => t + 1);
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to preload floor tiling textures:", error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [texturedIds.join("|")]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await preloadBorderMaskImages(borderMaskUrls);
        if (!cancelled) setReadyTick(t => t + 1);
      } catch {
        if (!cancelled) setReadyTick(t => t + 1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [borderMaskUrls.join("|")]);

  useEffect(() => {
    const layer = options.layerRef.current;
    if (!layer) return;

    const removed = layer.removeChildren();
    for (const child of removed) {
      child.destroy();
    }

    const terrain = Array.isArray(options.terrain) ? options.terrain : null;
    if (!terrain || terrain.length === 0) return;

    const terrainMix = Array.isArray(options.terrainMix) ? options.terrainMix : null;
    const isHexGrid = getBoardGridProjectionKind() === "hex";
    const enableBorderMask = options.enableBorderMask !== false;
    const showMaskPlacementRects = options.showMaskPlacementRects === true;
    const showMaskNormals = options.showMaskNormals === true;
    const playable = options.playableCells ?? null;
    const { cols, rows } = options.grid;
    const boardW = getBoardWidth(cols);
    const boardH = getBoardHeight(rows);
    const maskDebugRects: Array<{ x: number; y: number; angle: number; w: number; h: number; flipped: boolean }> = [];
    const maskDebugNormals: Array<{ x1: number; y1: number; x2: number; y2: number; toInside: boolean }> = [];

    const isPlayable = (x: number, y: number): boolean => {
      if (!playable || playable.size === 0) return true;
      return playable.has(`${x},${y}`);
    };
    const getTerrainAt = (x: number, y: number): TerrainCell => {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return "unknown";
      const index = y * cols + x;
      return terrain[index] ?? "unknown";
    };
    const getMixAt = (x: number, y: number): TerrainMixCell | null => {
      if (!terrainMix) return null;
      if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
      return terrainMix[y * cols + x] ?? null;
    };
    const getEdgeTerrain = (x: number, y: number, edge: Edge): TerrainCell | null => {
      if (!isPlayable(x, y)) return null;
      const base = getTerrainAt(x, y);
      const mix = getMixAt(x, y);
      if (!mix) return base;
      const blend = mix.blend;
      if (mix.corner === "NE") {
        return edge === "N" || edge === "E" ? blend : base;
      }
      if (mix.corner === "NW") {
        return edge === "N" || edge === "W" ? blend : base;
      }
      if (mix.corner === "SE") {
        return edge === "S" || edge === "E" ? blend : base;
      }
      return edge === "S" || edge === "W" ? blend : base;
    };
    const collectBoundarySegments = (id: string): Segment[] => {
      if (isHexGrid) {
        const edgeMap = new Map<string, EdgeRecord>();
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if (!isPlayable(x, y)) continue;
            if (getTerrainAt(x, y) !== id) continue;

            const polygon = getGridCellPolygonForGrid(x, y, cols, rows);
            if (polygon.length < 3) continue;
            let cx = 0;
            let cy = 0;
            for (const p of polygon) {
              cx += p.x;
              cy += p.y;
            }
            const inside = { x: cx / polygon.length, y: cy / polygon.length };

            for (let i = 0; i < polygon.length; i++) {
              const a = polygon[i];
              const b = polygon[(i + 1) % polygon.length];
              const key = edgeKey(a, b);
              const rec = edgeMap.get(key);
              if (rec) {
                rec.count += 1;
              } else {
                edgeMap.set(key, { count: 1, a, b, inside });
              }
            }
          }
        }
        return Array.from(edgeMap.values())
          .filter(rec => rec.count === 1)
          .map(rec => ({ a: rec.a, b: rec.b, inside: rec.inside }));
      }

      const segments: Segment[] = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!isPlayable(x, y)) continue;
          const mix = getMixAt(x, y);
          const left = x;
          const top = y;
          const right = x + 1;
          const bottom = y + 1;

          const northEdge = getEdgeTerrain(x, y, "N");
          const southEdge = getEdgeTerrain(x, y, "S");
          const westEdge = getEdgeTerrain(x, y, "W");
          const eastEdge = getEdgeTerrain(x, y, "E");

          if (northEdge === id) {
            const neighbor = getEdgeTerrain(x, y - 1, "S");
            if (!neighbor || neighbor !== id) {
              segments.push({ a: { x: left, y: top }, b: { x: right, y: top } });
            }
          }
          if (southEdge === id) {
            const neighbor = getEdgeTerrain(x, y + 1, "N");
            if (!neighbor || neighbor !== id) {
              segments.push({ a: { x: left, y: bottom }, b: { x: right, y: bottom } });
            }
          }
          if (westEdge === id) {
            const neighbor = getEdgeTerrain(x - 1, y, "E");
            if (!neighbor || neighbor !== id) {
              segments.push({ a: { x: left, y: top }, b: { x: left, y: bottom } });
            }
          }
          if (eastEdge === id) {
            const neighbor = getEdgeTerrain(x + 1, y, "W");
            if (!neighbor || neighbor !== id) {
              segments.push({ a: { x: right, y: top }, b: { x: right, y: bottom } });
            }
          }

          if (mix && (mix.base === id || mix.blend === id) && mix.base !== mix.blend) {
            if (mix.corner === "NE" || mix.corner === "SW") {
              segments.push({ a: { x: left, y: top }, b: { x: right, y: bottom } });
            } else {
              segments.push({ a: { x: right, y: top }, b: { x: left, y: bottom } });
            }
          }
        }
      }
      return segments;
    };
    for (const id of texturedIds) {
      const variantUrls = getFloorTilingVariantUrls(id);
      const fallbackUrl = getFloorTilingUrl(id);
      const resolvedVariants =
        variantUrls.length > 0 ? variantUrls : fallbackUrl ? [fallbackUrl] : [null];
      const variantCount = resolvedVariants.length;
      const variantSeed = hashString(id);
      const hasVariants = variantCount > 1;
      const variantIndices = [...Array(variantCount).keys()];

      const material = options.materials.get(id);
      const fallbackColor = parseHexColor(material?.fallbackColor) ?? 0x3f6b3a;
      const solidColor = parseHexColor(material?.solidColor ?? null);

      const pickVariantIndex = (x: number, y: number): number => {
        if (!hasVariants) return 0;
        const t = hash01(x, y, variantSeed);
        return Math.min(variantCount - 1, Math.floor(t * variantCount));
      };

      const baseMaskCanvas = document.createElement("canvas");
      baseMaskCanvas.width = boardW;
      baseMaskCanvas.height = boardH;
      const baseCtx = baseMaskCanvas.getContext("2d");
      if (!baseCtx) continue;
      baseCtx.fillStyle = "#ffffff";
      baseCtx.imageSmoothingEnabled = true;

      if (naturalIds.includes(id)) {
        const segments = collectBoundarySegments(id);
        const borderMaskUrl = FLOOR_BORDER_MASK_URL_BY_ID[id] ?? null;
        const borderMask = borderMaskUrl ? borderMaskCutCanvasByUrl.get(borderMaskUrl) ?? null : null;
        const paths = buildPathsFromSegments(segments);
        const smoothLoops = paths.closedLoops;

        if (smoothLoops.length > 0) {
          baseCtx.beginPath();
          for (const loop of smoothLoops) {
            if (loop.length < 3) continue;
            if (isHexGrid) {
              baseCtx.moveTo(loop[0].x, loop[0].y);
            } else {
              baseCtx.moveTo(loop[0].x * TILE_SIZE, loop[0].y * TILE_SIZE);
            }
            for (let i = 1; i < loop.length; i++) {
              if (isHexGrid) {
                baseCtx.lineTo(loop[i].x, loop[i].y);
              } else {
                baseCtx.lineTo(loop[i].x * TILE_SIZE, loop[i].y * TILE_SIZE);
              }
            }
            baseCtx.closePath();
          }
          try {
            baseCtx.fill("evenodd");
          } catch {
            baseCtx.fill();
          }
        }

        baseCtx.beginPath();
        for (const loop of smoothLoops) {
          if (loop.length < 3) continue;
          if (isHexGrid) {
            baseCtx.moveTo(loop[0].x, loop[0].y);
          } else {
            baseCtx.moveTo(loop[0].x * TILE_SIZE, loop[0].y * TILE_SIZE);
          }
          for (let i = 1; i < loop.length; i++) {
            if (isHexGrid) {
              baseCtx.lineTo(loop[i].x, loop[i].y);
            } else {
              baseCtx.lineTo(loop[i].x * TILE_SIZE, loop[i].y * TILE_SIZE);
            }
          }
          baseCtx.closePath();
        }
        for (const path of paths.openPaths) {
          if (path.length < 2) continue;
          if (isHexGrid) {
            baseCtx.moveTo(path[0].x, path[0].y);
          } else {
            baseCtx.moveTo(path[0].x * TILE_SIZE, path[0].y * TILE_SIZE);
          }
          for (let i = 1; i < path.length; i++) {
            if (isHexGrid) {
              baseCtx.lineTo(path[i].x, path[i].y);
            } else {
              baseCtx.lineTo(path[i].x * TILE_SIZE, path[i].y * TILE_SIZE);
            }
          }
        }
        baseCtx.save();
        baseCtx.lineJoin = "round";
        baseCtx.lineCap = "round";
        // Keep a small border expansion so mask cutting has material to remove.
        baseCtx.lineWidth = borderMask
          // Canvas stroke is centered on contour: width/2 gives outside overflow.
          ? Math.max(2, TILE_SIZE * BORDER_OVERFLOW_RATIO * 2)
          : TILE_SIZE * (isHexGrid ? 0.45 : 0.6);
        baseCtx.strokeStyle = "#ffffff";
        baseCtx.stroke();
        baseCtx.restore();

        if (borderMask && enableBorderMask) {
          const borderMaskImage = borderMask;
          const stampHeight = Math.max(8, TILE_SIZE * BORDER_OVERFLOW_RATIO);
          const stampWidth = Math.max(
            stampHeight,
            (stampHeight * borderMaskImage.width) / Math.max(1, borderMaskImage.height)
          );
          // Place stamps almost one mask-width apart to avoid heavy overlap.
          const step = Math.max(2, stampWidth * 0.92);
          const vertexKeys = new Set<string>();
          const vertexPoints: Array<{ x: number; y: number }> = [];
          const addVertex = (x: number, y: number) => {
            const key = `${x.toFixed(2)},${y.toFixed(2)}`;
            if (vertexKeys.has(key)) return;
            vertexKeys.add(key);
            vertexPoints.push({ x, y });
          };
          const toCanvasPoint = (p: Point): Point => {
            if (isHexGrid) return { x: p.x, y: p.y };
            return { x: p.x * TILE_SIZE, y: p.y * TILE_SIZE };
          };
          const insideByEdge = new Map<string, Point>();
          for (const seg of segments) {
            if (seg.inside) {
              insideByEdge.set(edgeKey(seg.a, seg.b), seg.inside);
            }
          }
          const getStampFrame = (
            ax: number,
            ay: number,
            bx: number,
            by: number,
            inside?: Point
          ): { angle: number; flipped: boolean; midX: number; midY: number; len: number } | null => {
            const dx = bx - ax;
            const dy = by - ay;
            const len = Math.hypot(dx, dy);
            if (len < 1e-6) return null;
            const angle = Math.atan2(dy, dx);
            const midX = (ax + bx) * 0.5;
            const midY = (ay + by) * 0.5;
            const leftNx = -dy / len;
            const leftNy = dx / len;
            const insideCanvas = inside
              ? toCanvasPoint(inside)
              : { x: midX, y: midY };
            const sideDot = (insideCanvas.x - ax) * leftNx + (insideCanvas.y - ay) * leftNy;
            const flipped = sideDot < 0;
            return { angle, flipped, midX, midY, len };
          };
          const drawStamp = (px: number, py: number, angle: number, flipped: boolean): void => {
            baseCtx.save();
            baseCtx.translate(px, py);
            baseCtx.rotate(angle);
            // Bottom of mask stays on contour; flip only when interior side requires it.
            if (flipped) baseCtx.scale(1, -1);
            baseCtx.drawImage(borderMaskImage, -stampWidth * 0.5, -stampHeight, stampWidth, stampHeight);
            baseCtx.restore();
            if (showMaskPlacementRects) {
              maskDebugRects.push({ x: px, y: py, angle, w: stampWidth, h: stampHeight, flipped });
            }
          };
          const drawPathStamps = (path: Point[]): void => {
            if (path.length < 2) return;
            let nextStampAt = 0;
            let traversed = 0;
            for (let i = 0; i < path.length - 1; i++) {
              const aModel = path[i];
              const bModel = path[i + 1];
              const a = toCanvasPoint(aModel);
              const b = toCanvasPoint(bModel);
              addVertex(a.x, a.y);
              addVertex(b.x, b.y);
              const inside = insideByEdge.get(edgeKey(aModel, bModel));
              const frame = getStampFrame(a.x, a.y, b.x, b.y, inside);
              if (!frame) continue;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              if (showMaskNormals) {
                const leftNx = -dy / frame.len;
                const leftNy = dx / frame.len;
                const nx = frame.flipped ? -leftNx : leftNx;
                const ny = frame.flipped ? -leftNy : leftNy;
                const normalLen = Math.max(6, stampHeight * 0.45);
                const insideCanvas = inside ? toCanvasPoint(inside) : { x: frame.midX, y: frame.midY };
                const toInside = (insideCanvas.x - a.x) * leftNx + (insideCanvas.y - a.y) * leftNy > 0;
                maskDebugNormals.push({
                  x1: frame.midX,
                  y1: frame.midY,
                  x2: frame.midX + nx * normalLen,
                  y2: frame.midY + ny * normalLen,
                  toInside
                });
              }

              while (traversed + frame.len >= nextStampAt) {
                const local = Math.max(0, nextStampAt - traversed);
                const t = Math.min(1, local / frame.len);
                const px = a.x + dx * t;
                const py = a.y + dy * t;
                drawStamp(px, py, frame.angle, frame.flipped);
                nextStampAt += step;
              }
              traversed += frame.len;
            }
          };
          baseCtx.save();
          baseCtx.globalCompositeOperation = "destination-out";
          for (const loop of smoothLoops) {
            if (loop.length < 3) continue;
            const closedPath = [...loop, loop[0]];
            drawPathStamps(closedPath);
          }
          for (const path of paths.openPaths) {
            if (path.length < 2) continue;
            drawPathStamps(path);
          }
          // Round joins at corners to improve continuity on acute/obtuse angles.
          const joinRadius = Math.max(1.5, stampHeight * 0.16);
          for (const p of vertexPoints) {
            baseCtx.beginPath();
            baseCtx.arc(p.x, p.y, joinRadius, 0, Math.PI * 2);
            baseCtx.fillStyle = "#ffffff";
            baseCtx.fill();
          }
          baseCtx.restore();
        }
      } else {
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if (!isPlayable(x, y)) continue;
            const cell = getTerrainAt(x, y);
            const mix = getMixAt(x, y);
            const polygon = getGridCellPolygonForGrid(x, y, cols, rows);

            if (isHexGrid || !mix) {
              if (cell === id) {
                baseCtx.beginPath();
                baseCtx.moveTo(polygon[0].x, polygon[0].y);
                for (let i = 1; i < polygon.length; i++) {
                  baseCtx.lineTo(polygon[i].x, polygon[i].y);
                }
                baseCtx.closePath();
                baseCtx.fill();
              }
            } else {
              const left = x * TILE_SIZE;
              const top = y * TILE_SIZE;
              const right = left + TILE_SIZE;
              const bottom = top + TILE_SIZE;
              if (mix.blend === id) {
                canvasBlendTriangle(baseCtx, mix.corner, left, top, right, bottom);
              }
              if (mix.base === id) {
                canvasBaseTriangle(baseCtx, mix.corner, left, top, right, bottom);
              }
            }
          }
        }
      }

      // Keep terrain masks strictly inside playable map cells.
      applyPlayableClipMask(baseCtx, cols, rows, isPlayable);

      const baseMaskTexture = Texture.from(baseMaskCanvas);
      const baseMaskSprite = new Sprite(baseMaskTexture);
      baseMaskSprite.x = 0;
      baseMaskSprite.y = 0;
      baseMaskSprite.alpha = 0.001;
      baseMaskSprite.label = `natural-mask:${id}:base`;

      const materialContainer = new Container();
      materialContainer.mask = baseMaskSprite;

      layer.addChild(baseMaskSprite);
      layer.addChild(materialContainer);

      const hasAnyTexture = resolvedVariants.some(url => Boolean(url));
      const backgroundTint = solidColor ?? fallbackColor;
      if (solidColor !== null) {
        const backgroundSprite = new TilingSprite({ texture: Texture.WHITE, width: boardW, height: boardH });
        backgroundSprite.tint = backgroundTint;
        backgroundSprite.x = 0;
        backgroundSprite.y = 0;
        backgroundSprite.tileScale.set(1, 1);
        materialContainer.addChild(backgroundSprite);
      }

      if (!hasAnyTexture) {
        const solidSprite = new TilingSprite({ texture: Texture.WHITE, width: boardW, height: boardH });
        solidSprite.tint = fallbackColor;
        solidSprite.x = 0;
        solidSprite.y = 0;
        solidSprite.tileScale.set(1, 1);
        materialContainer.addChild(solidSprite);
        continue;
      }

      for (const variantIndex of variantIndices) {
        const variantUrl = resolvedVariants[variantIndex] ?? null;
        if (!variantUrl) continue;
        const resizedTexture = getFloorTilingTextureFromUrl(variantUrl, 256);
        const baseTexture = resizedTexture ?? (Assets.get(variantUrl) as Texture) ?? Texture.from(variantUrl);
        if (baseTexture.source) {
          baseTexture.source.scaleMode = "linear";
          baseTexture.source.mipmapFilter = "linear";
          baseTexture.source.autoGenerateMipmaps = true;
          baseTexture.source.maxAnisotropy = 4;
          baseTexture.source.addressMode = "repeat";
        }

        const sprite = new TilingSprite({ texture: baseTexture, width: boardW, height: boardH });
        sprite.x = 0;
        sprite.y = 0;

        const texW = baseTexture.width || TILE_SIZE;
        const texH = baseTexture.height || TILE_SIZE;
        sprite.tileScale.set(TILE_SIZE / texW, TILE_SIZE / texH);

        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = boardW;
        maskCanvas.height = boardH;
        const ctx = maskCanvas.getContext("2d");
        if (!ctx) continue;
        ctx.fillStyle = "#ffffff";
        ctx.imageSmoothingEnabled = true;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if (!isPlayable(x, y)) continue;
            const cell = getTerrainAt(x, y);
            const mix = getMixAt(x, y);
            const hasId = isHexGrid ? cell === id : !mix ? cell === id : mix.base === id || mix.blend === id;
            if (!hasId) continue;
            if (hasVariants && pickVariantIndex(x, y) !== variantIndex) continue;
            if (isHexGrid || !mix) {
              const polygon = getGridCellPolygonForGrid(x, y, cols, rows);
              ctx.beginPath();
              ctx.moveTo(polygon[0].x, polygon[0].y);
              for (let i = 1; i < polygon.length; i++) {
                ctx.lineTo(polygon[i].x, polygon[i].y);
              }
              ctx.closePath();
              ctx.fill();
            } else {
              ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
          }
        }

        const maskTexture = Texture.from(maskCanvas);
        const maskSprite = new Sprite(maskTexture);
        maskSprite.x = 0;
        maskSprite.y = 0;
        maskSprite.alpha = 0.001;
        maskSprite.label = `natural-mask:${id}:v${variantIndex}`;

        sprite.mask = maskSprite;
        materialContainer.addChild(sprite);
        materialContainer.addChild(maskSprite);
      }
    }

    if (showMaskPlacementRects && maskDebugRects.length > 0) {
      const debug = new Graphics();
      debug.label = "mask-placement-rects";
      for (const rect of maskDebugRects) {
        const hw = rect.w * 0.5;
        const top = rect.flipped ? 0 : -rect.h;
        const bottom = rect.flipped ? rect.h : 0;
        const corners = [
          { x: -hw, y: top },
          { x: hw, y: top },
          { x: hw, y: bottom },
          { x: -hw, y: bottom }
        ].map(p => ({
          x: rect.x + p.x * Math.cos(rect.angle) - p.y * Math.sin(rect.angle),
          y: rect.y + p.x * Math.sin(rect.angle) + p.y * Math.cos(rect.angle)
        }));
        debug.poly([
          corners[0].x, corners[0].y,
          corners[1].x, corners[1].y,
          corners[2].x, corners[2].y,
          corners[3].x, corners[3].y
        ]);
        debug.stroke({ width: 1, color: 0xff4d4d, alpha: 0.9 });
      }
      layer.addChild(debug);
    }
    if (showMaskNormals && maskDebugNormals.length > 0) {
      const normals = new Graphics();
      normals.label = "mask-normals";
      for (const n of maskDebugNormals) {
        normals.moveTo(n.x1, n.y1);
        normals.lineTo(n.x2, n.y2);
        normals.stroke({ width: 1, color: n.toInside ? 0x00d8ff : 0xffa500, alpha: 0.95 });
      }
      layer.addChild(normals);
    }

    options.onInvalidate?.();
    return;
  }, [
    options.layerRef,
    options.terrain,
    options.terrainMix,
    options.playableCells,
    options.grid,
    options.materials,
    options.enableBorderMask,
    options.showMaskPlacementRects,
    options.showMaskNormals,
    options.pixiReadyTick,
    options.onInvalidate,
    texturedIds,
    naturalIds,
    readyTick
  ]);
}

