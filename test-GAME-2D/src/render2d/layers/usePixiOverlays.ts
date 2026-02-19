import { useEffect } from "react";
import type { RefObject } from "react";
import { BlurFilter, Container, Graphics, Sprite, Texture } from "pixi.js";
import type { TokenState } from "../../types";
import type { EffectSpec } from "../../game/engine/runtime/turnTypes";
import type { BoardEffect } from "../../boardEffects";
import {
  generateCircleEffect,
  generateConeEffect,
  generateLineEffect,
  generateRectangleEffect
} from "../../boardEffects";
import {
  TILE_SIZE,
  getBoardGridProjectionKind,
  getGridCellPolygonForGrid,
  gridToScreenForGrid
} from "../../boardConfig";
import {
  getFacingForToken,
  getVisionRangeCells,
  getVisionProfileForToken,
  isCellVisible
} from "../../vision";
import { hasLineOfSight } from "../../lineOfSight";
import type { WallSegment } from "../../game/map/walls/types";
import { getTokenOccupiedCells } from "../../game/engine/runtime/footprint";
import type { LightSource } from "../../lighting";
import {
  computeHexFogContoursFromCells,
  offsetLoopInward
} from "../../vision/fogContourHex";

export function usePixiOverlays(options: {
  pathLayerRef: RefObject<Graphics | null>;
  gridKind?: "square" | "hex";
  player: TokenState;
  enemies: TokenState[];
  selectedPath: { x: number; y: number }[];
  effectSpecs: EffectSpec[];
  selectedTargetId?: string | null;
  selectedTargetIds?: string[];
  selectedObstacleCell: { x: number; y: number } | null;
  obstacleVisionCells?: Set<string> | null;
  wallVisionEdges?: Map<string, WallSegment> | null;
  closedCells?: Set<string> | null;
  showVisionDebug: boolean;
  lightMap?: number[] | null;
  lightSources?: LightSource[] | null;
  showLightOverlay: boolean;
  showGridLines?: boolean;
  playerTorchOn: boolean;
  playerTorchRadius?: number;
  lightLevels?: number[] | null;
  lightTints?: { colors: number[]; strength: number[] } | null;
  isNight?: boolean;
  pixiReadyTick?: number;
  playableCells?: Set<string> | null;
  grid: { cols: number; rows: number };
  heightMap: number[];
  activeLevel: number;
  visibleCells?: Set<string> | null;
  visionCells?: Set<string> | null;
  visibilityLevels?: Map<string, number> | null;
  showAllLevels?: boolean;
}): void {
  useEffect(() => {
    const pathLayer = options.pathLayerRef.current;
    if (!pathLayer) return;

    const fogLayer: Graphics = (() => {
      const parent = pathLayer.parent as any;
      if (!parent) return pathLayer;
      const existing = parent.__fogLayer as Graphics | undefined;
      if (existing) return existing;
      const layer = new Graphics();
      layer.filters = [new BlurFilter({ strength: 4, quality: 3 })];
      parent.__fogLayer = layer;
      parent.addChild(layer);
      return layer;
    })();
    const lightLayer: Container = (() => {
      const parent = pathLayer.parent as any;
      if (!parent) return new Container();
      const existing = parent.__lightLayer as Container | undefined;
      const desiredIndex = parent.children.findIndex(
        (child: any) =>
          child &&
          ((typeof child.label === "string" && child.label === "staticDepthLayer") ||
            (typeof child.name === "string" && child.name === "staticDepthLayer"))
      );
      if (existing) {
        if (desiredIndex >= 0) {
          const targetIndex = Math.max(0, desiredIndex);
          if (parent.getChildIndex(existing) !== targetIndex) {
            parent.setChildIndex(existing, targetIndex);
          }
        }
        return existing;
      }
      const layer = new Container();
      layer.filters = [new BlurFilter({ strength: 6, quality: 3 })];
      (layer as any).blendMode = "add";
      layer.label = "lightLayer";
      parent.__lightLayer = layer;
      if (desiredIndex >= 0) {
        parent.addChildAt(layer, Math.max(0, desiredIndex));
      } else {
        parent.addChild(layer);
      }
      return layer;
    })();

    pathLayer.clear();
    fogLayer.clear();
    lightLayer.removeChildren();

    const lineSpecs = options.effectSpecs.filter(spec => spec.kind === "line");
    for (const spec of lineSpecs) {
      if (typeof spec.toX !== "number" || typeof spec.toY !== "number") continue;
      const start = gridToScreenForGrid(options.player.x, options.player.y, options.grid.cols, options.grid.rows);
      const end = gridToScreenForGrid(spec.toX, spec.toY, options.grid.cols, options.grid.rows);
      const color = typeof spec.color === "number" ? spec.color : 0x6fd27f;
      const alpha = typeof spec.alpha === "number" ? spec.alpha : 0.9;
      const thickness = typeof spec.thickness === "number" ? spec.thickness : 2;
      if (typeof (pathLayer as any).setStrokeStyle !== "function") {
        pathLayer.lineStyle(thickness, color, alpha);
      }
      pathLayer.moveTo(start.x, start.y);
      pathLayer.lineTo(end.x, end.y);
      if (typeof (pathLayer as any).setStrokeStyle === "function") {
        (pathLayer as any).setStrokeStyle({ width: thickness, color, alpha });
        (pathLayer as any).stroke();
      }
    }

    const activeEffects: BoardEffect[] = options.effectSpecs
      .filter(spec => spec.kind !== "line")
      .map(spec => {
      switch (spec.kind) {
        case "circle":
          return generateCircleEffect(
            spec.id,
            options.player.x,
            options.player.y,
            spec.radius ?? 1,
            { playableCells: options.playableCells ?? null, grid: options.grid }
          );
        case "rectangle":
          return generateRectangleEffect(
            spec.id,
            options.player.x,
            options.player.y,
            spec.width ?? 1,
            spec.height ?? 1,
            { playableCells: options.playableCells ?? null, grid: options.grid }
          );
        case "cone":
          return generateConeEffect(
            spec.id,
            options.player.x,
            options.player.y,
            spec.range ?? 1,
            spec.direction ?? "right",
            undefined,
            { playableCells: options.playableCells ?? null, grid: options.grid }
          );
        default:
          return { id: spec.id, type: "circle", cells: [] };
      }
    });

    const buildCellKey = (x: number, y: number) => `${x},${y}`;
    const visibleCells = options.visibleCells ?? null;
    const visionCells = options.visionCells ?? null;
    const isNight = Boolean(options.isNight);
    const showAll = Boolean(options.showAllLevels);
    const isCellInView = (x: number, y: number) => {
      if (showAll) return true;
      if (!visibleCells || visibleCells.size === 0) return true;
      return visibleCells.has(buildCellKey(x, y));
    };
    const isCellPlayable = (x: number, y: number) => {
      if (!options.playableCells || options.playableCells.size === 0) return true;
      return options.playableCells.has(`${x},${y}`);
    };

    const gridKind = getBoardGridProjectionKind();
    const isHexGrid = gridKind === "hex";
    const fillCell = (x: number, y: number, color: number, alpha: number) => {
      if (gridKind === "hex") {
        const polygon = getGridCellPolygonForGrid(x, y, options.grid.cols, options.grid.rows);
        pathLayer.poly(polygon.flatMap(p => [p.x, p.y]), true).fill({ color, alpha });
        return;
      }
      const center = gridToScreenForGrid(x, y, options.grid.cols, options.grid.rows);
      pathLayer.rect(center.x - TILE_SIZE / 2, center.y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE).fill({
        color,
        alpha
      });
    };

    const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
    const mapLight = Array.isArray(options.lightMap) ? options.lightMap : null;
    const baseLightAt = (x: number, y: number) => {
      if (!mapLight || mapLight.length === 0) return 1;
      const idx = y * options.grid.cols + x;
      const value = mapLight[idx];
      return Number.isFinite(value) ? clamp01(value) : 1;
    };

    const activeSources: LightSource[] = [];
    if (!isHexGrid && Array.isArray(options.lightSources)) {
      activeSources.push(...options.lightSources);
    }
    if (!isHexGrid && options.playerTorchOn) {
      activeSources.push({
        x: options.player.x,
        y: options.player.y,
        radius: Math.max(1, Math.floor(options.playerTorchRadius ?? 4))
      });
    }

    const gridToScreenRaw = (x: number, y: number) => ({
      x: x * TILE_SIZE + TILE_SIZE / 2,
      y: y * TILE_SIZE + TILE_SIZE / 2
    });

    const buildSegmentsForLighting = () => {
      const minX = -0.5;
      const minY = -0.5;
      const maxX = options.grid.cols - 0.5;
      const maxY = options.grid.rows - 0.5;
      type Segment = { ax: number; ay: number; bx: number; by: number };
      const segments: Segment[] = [
        { ax: minX, ay: minY, bx: maxX, by: minY },
        { ax: maxX, ay: minY, bx: maxX, by: maxY },
        { ax: maxX, ay: maxY, bx: minX, by: maxY },
        { ax: minX, ay: maxY, bx: minX, by: minY }
      ];
      const blocked = options.obstacleVisionCells ?? null;
      if (blocked && blocked.size > 0) {
        const isBlocked = (x: number, y: number) => blocked.has(buildCellKey(x, y));
        const pushEdge = (ax: number, ay: number, bx: number, by: number) => {
          segments.push({ ax, ay, bx, by });
        };
        for (const key of blocked) {
          const [xs, ys] = key.split(",");
          const x = Number(xs);
          const y = Number(ys);
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          if (!isCellPlayable(x, y)) continue;
          const left = x - 0.5;
          const right = x + 0.5;
          const top = y - 0.5;
          const bottom = y + 0.5;
          if (!isBlocked(x, y - 1)) pushEdge(left, top, right, top);
          if (!isBlocked(x + 1, y)) pushEdge(right, top, right, bottom);
          if (!isBlocked(x, y + 1)) pushEdge(right, bottom, left, bottom);
          if (!isBlocked(x - 1, y)) pushEdge(left, bottom, left, top);
        }
      }
      if (options.wallVisionEdges && options.wallVisionEdges.size > 0) {
        for (const wall of options.wallVisionEdges.values()) {
          const x = wall.x;
          const y = wall.y;
          const left = x - 0.5;
          const right = x + 0.5;
          const top = y - 0.5;
          const bottom = y + 0.5;
          switch (wall.dir) {
            case "N":
              segments.push({ ax: left, ay: top, bx: right, by: top });
              break;
            case "E":
              segments.push({ ax: right, ay: top, bx: right, by: bottom });
              break;
            case "S":
              segments.push({ ax: left, ay: bottom, bx: right, by: bottom });
              break;
            case "W":
              segments.push({ ax: left, ay: top, bx: left, by: bottom });
              break;
            default:
              break;
          }
        }
      }
      return segments;
    };

    const lightSegments = buildSegmentsForLighting();
    const intersectRaySegment = (
      origin: { x: number; y: number },
      angle: number,
      seg: { ax: number; ay: number; bx: number; by: number }
    ): number | null => {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const sx = seg.bx - seg.ax;
      const sy = seg.by - seg.ay;
      const det = dx * sy - dy * sx;
      if (Math.abs(det) < 1e-8) return null;
      const ox = seg.ax - origin.x;
      const oy = seg.ay - origin.y;
      const t = (ox * sy - oy * sx) / det;
      const u = (ox * dy - oy * dx) / det;
      if (t < 0) return null;
      if (u < -1e-4 || u > 1 + 1e-4) return null;
      return t;
    };

    const traceLightPolygon = (source: LightSource) => {
      const origin = { x: source.x, y: source.y };
      const maxDist = Math.max(0.5, source.radius);
      const angles: number[] = [];
      const baseSegments = 140;
      for (let i = 0; i <= baseSegments; i++) {
        angles.push((i / baseSegments) * Math.PI * 2 - Math.PI);
      }
      const EPS = 1e-4;
      for (const seg of lightSegments) {
        const a1 = Math.atan2(seg.ay - origin.y, seg.ax - origin.x);
        const a2 = Math.atan2(seg.by - origin.y, seg.bx - origin.x);
        angles.push(a1 - EPS, a1, a1 + EPS, a2 - EPS, a2, a2 + EPS);
      }
      angles.sort((a, b) => a - b);
      const pts = angles.map(angle => {
        let best: number | null = null;
        for (const seg of lightSegments) {
          const t = intersectRaySegment(origin, angle, seg);
          if (t === null) continue;
          if (best === null || t < best) best = t;
        }
        const dist = Math.min(best ?? maxDist, maxDist);
        return {
          x: origin.x + Math.cos(angle) * dist,
          y: origin.y + Math.sin(angle) * dist
        };
      });
      return pts.map(p => gridToScreenRaw(p.x, p.y));
    };

    const getLightGradientTexture = () => {
      const parent = pathLayer.parent as any;
      if (parent?.__lightGradientTexture) return parent.__lightGradientTexture as Texture;
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        const fallback = Texture.WHITE;
        if (parent) parent.__lightGradientTexture = fallback;
        return fallback;
      }
      const cx = size / 2;
      const cy = size / 2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      const texture = Texture.from(canvas);
      if (parent) parent.__lightGradientTexture = texture;
      return texture;
    };

    // Light overlay is now drawn as smooth shapes in lightLayer (no per-cell rendering).

    if (!isHexGrid && activeSources.length > 0) {
      const gradientTexture = getLightGradientTexture();
      const minAlpha = 0.1;
      const maxAlpha = 0.7;
      const extraAlpha = Math.max(0, maxAlpha - minAlpha);
      for (const source of activeSources) {
        const pts = traceLightPolygon(source);
        if (pts.length < 3) continue;
        const color = source.color ?? 0xfff1cc;
        const center = gridToScreenRaw(source.x, source.y);
        const radiusPx = Math.max(1, source.radius) * TILE_SIZE;

        const baseSprite = new Sprite(gradientTexture);
        baseSprite.anchor.set(0.5);
        baseSprite.position.set(center.x, center.y);
        baseSprite.width = radiusPx * 2;
        baseSprite.height = radiusPx * 2;
        baseSprite.tint = color;
        baseSprite.alpha = minAlpha;
        lightLayer.addChild(baseSprite);

        if (extraAlpha > 0.01) {
          const mask = new Graphics();
          mask.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            mask.lineTo(pts[i].x, pts[i].y);
          }
          mask.closePath();
          mask.fill({ color: 0xffffff, alpha: 1 });

          const litSprite = new Sprite(gradientTexture);
          litSprite.anchor.set(0.5);
          litSprite.position.set(center.x, center.y);
          litSprite.width = radiusPx * 2;
          litSprite.height = radiusPx * 2;
          litSprite.tint = color;
          litSprite.alpha = extraAlpha;
          litSprite.mask = mask;

          lightLayer.addChild(litSprite);
          lightLayer.addChild(mask);
        }
      }
    }
    // Light tints are handled by the smooth light shapes; skip per-cell tinting.

    const fogColor = isNight ? 0x000000 : 0xffffff;
    const fogAlpha = isNight ? 0 : 0.35;
    const hasVisibilityMask = Boolean(visionCells || visibleCells || options.visibilityLevels);

    const visibilityLevelAt = (x: number, y: number) => {
      if (!options.visibilityLevels) return 0;
      return options.visibilityLevels.get(buildCellKey(x, y)) ?? 0;
    };
    const isCellVisibleForFog = (x: number, y: number) => {
      if (!isCellPlayable(x, y)) return false;
      if (showAll) return true;
      const key = buildCellKey(x, y);
      if (visionCells) return visionCells.has(key);
      if (options.visibilityLevels) return visibilityLevelAt(x, y) >= 2;
      const inVision = visionCells ? visionCells.has(key) : true;
      const perceivable = visibleCells ? visibleCells.has(key) : true;
      return inVision && perceivable;
    };
    const isVisibleAtPointForFog = (gx: number, gy: number) => {
      const fx = Math.floor(gx);
      const fy = Math.floor(gy);
      const primaryVis = visibilityLevelAt(fx, fy);
      if (primaryVis >= 1 && isCellPlayable(fx, fy)) return true;
      for (let oy = 0; oy <= 1; oy++) {
        for (let ox = 0; ox <= 1; ox++) {
          const cx = fx + ox;
          const cy = fy + oy;
          if (cx < 0 || cy < 0 || cx >= options.grid.cols || cy >= options.grid.rows) {
            continue;
          }
          if (!isCellPlayable(cx, cy)) continue;
          if (options.visibilityLevels) {
            // Neighbor visibility can bleed past obstacles; require full visibility.
            if (visibilityLevelAt(cx, cy) >= 2) return true;
            continue;
          }
          const key = buildCellKey(cx, cy);
          const inVision = visionCells ? visionCells.has(key) : true;
          const perceivable = visibleCells ? visibleCells.has(key) : true;
          if (inVision && perceivable) return true;
        }
      }
      return false;
    };
    const fillFogCell = (x: number, y: number, color: number, alpha: number) => {
      if (gridKind === "hex") {
        const polygon = getGridCellPolygonForGrid(x, y, options.grid.cols, options.grid.rows);
        fogLayer.poly(polygon.flatMap(p => [p.x, p.y]), true).fill({ color, alpha });
        return;
      }
      const center = gridToScreenForGrid(x, y, options.grid.cols, options.grid.rows);
      fogLayer
        .rect(center.x - TILE_SIZE / 2, center.y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE)
        .fill({ color, alpha });
    };
    const drawContourLoops = (
      layer: Graphics,
      loops: Array<Array<{ x: number; y: number }>>,
      color: number,
      alpha: number,
      width: number
    ) => {
      if (loops.length === 0) return;
      layer.setStrokeStyle({ width, color, alpha });
      for (const loop of loops) {
        if (loop.length < 2) continue;
        layer.moveTo(loop[0].x, loop[0].y);
        for (let i = 1; i < loop.length; i++) {
          layer.lineTo(loop[i].x, loop[i].y);
        }
        layer.closePath();
      }
      layer.stroke();
    };
    const fillContourLoops = (
      layer: Graphics,
      loops: Array<Array<{ x: number; y: number }>>,
      color: number,
      alpha: number
    ) => {
      if (loops.length === 0) return;
      for (const loop of loops) {
        if (loop.length < 3) continue;
        layer.moveTo(loop[0].x, loop[0].y);
        for (let i = 1; i < loop.length; i++) {
          layer.lineTo(loop[i].x, loop[i].y);
        }
        layer.closePath();
        layer.fill({ color, alpha });
      }
    };
    const drawFogGradientBand = (
      loops: Array<Array<{ x: number; y: number }>>,
      color: number,
      baseAlpha: number
    ) => {
      if (loops.length === 0) return;
      const fillBandBetweenLoops = (
        outer: Array<{ x: number; y: number }>,
        inner: Array<{ x: number; y: number }>,
        alpha: number
      ) => {
        if (outer.length < 3 || inner.length < 3) return;
        if (outer.length !== inner.length) return;
        for (let i = 0; i < outer.length; i++) {
          const j = (i + 1) % outer.length;
          const a = outer[i];
          const b = outer[j];
          const c = inner[j];
          const d = inner[i];
          fogLayer.moveTo(a.x, a.y);
          fogLayer.lineTo(b.x, b.y);
          fogLayer.lineTo(c.x, c.y);
          fogLayer.lineTo(d.x, d.y);
          fogLayer.closePath();
          fogLayer.fill({ color, alpha });
        }
      };

      // Longer inward-only fog fringe: more rings for a deeper transparency gradient.
      const ringSteps = [16, 14, 12, 10, 8, 7, 6, 5];
      const ringAlpha = [
        baseAlpha * 0.24,
        baseAlpha * 0.2,
        baseAlpha * 0.17,
        baseAlpha * 0.14,
        baseAlpha * 0.11,
        baseAlpha * 0.085,
        baseAlpha * 0.065,
        baseAlpha * 0.05
      ];
      let currentLoops = loops;
      for (let ring = 0; ring < ringSteps.length; ring++) {
        const step = ringSteps[ring];
        const alpha = ringAlpha[ring];
        const nextLoops: Array<Array<{ x: number; y: number }>> = [];
        for (const loop of currentLoops) {
          if (loop.length < 6) continue;
          const inner = offsetLoopInward(loop, step);
          if (inner.length !== loop.length || inner.length < 6) continue;
          fillBandBetweenLoops(loop, inner, alpha);
          nextLoops.push(inner);
        }
        if (nextLoops.length === 0) break;
        currentLoops = nextLoops;
      }
    };
    const roundClosedLoop = (
      loop: Array<{ x: number; y: number }>,
      passes = 1
    ): Array<{ x: number; y: number }> => {
      if (loop.length < 4 || passes <= 0) return loop;
      let current = [...loop];
      for (let pass = 0; pass < passes; pass++) {
        const next: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < current.length; i++) {
          const a = current[i];
          const b = current[(i + 1) % current.length];
          const q = { x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y };
          const r = { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y };
          next.push(q, r);
        }
        current = next;
        if (current.length > 2400) break;
      }
      return current;
    };
    const directionToAngleRad = (dir: string) => {
      switch (dir) {
        case "up":
          return -Math.PI / 2;
        case "down":
          return Math.PI / 2;
        case "left":
          return Math.PI;
        case "right":
          return 0;
        case "up-left":
          return -3 * Math.PI / 4;
        case "up-right":
          return -Math.PI / 4;
        case "down-left":
          return 3 * Math.PI / 4;
        case "down-right":
          return Math.PI / 4;
        default:
          return 0;
      }
    };

    if (isHexGrid && hasVisibilityMask && fogAlpha > 0 && !options.showVisionDebug) {
      const fogCells: Array<{ x: number; y: number }> = [];
      for (let y = 0; y < options.grid.rows; y++) {
        for (let x = 0; x < options.grid.cols; x++) {
          if (!isCellPlayable(x, y)) continue;
          if (isCellVisibleForFog(x, y)) continue;
          fogCells.push({ x, y });
        }
      }

      const fogContoursRaw = computeHexFogContoursFromCells({
        fogCells,
        grid: options.grid
      }).rawLoops;
      const fogContours = fogContoursRaw.map(loop => roundClosedLoop(loop, 1));
      if (fogContours.length > 0) {
        // Gameplay view: fog fill + gradient only (no visible contour stroke).
        fillContourLoops(fogLayer, fogContours, fogColor, fogAlpha);
        drawFogGradientBand(fogContours, fogColor, fogAlpha);
      }

      if (options.showVisionDebug) {
        const debugCells = visionCells ?? visibleCells;
        if (debugCells && debugCells.size > 0) {
          fogLayer.setStrokeStyle({ width: 2, color: 0x2dd4bf, alpha: 0.9 });
          for (const k of debugCells) {
            const [xs, ys] = k.split(",");
            const x = Number(xs);
            const y = Number(ys);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            if (!isCellPlayable(x, y)) continue;
            const polygon = getGridCellPolygonForGrid(x, y, options.grid.cols, options.grid.rows);
            fogLayer.moveTo(polygon[0].x, polygon[0].y);
            for (let i = 1; i < polygon.length; i++) {
              fogLayer.lineTo(polygon[i].x, polygon[i].y);
            }
            fogLayer.closePath();
          }
          fogLayer.stroke();
        }
      }
    }

    if (!isHexGrid && hasVisibilityMask && fogAlpha > 0 && !options.showVisionDebug) {
      const cols = options.grid.cols;
      const rows = options.grid.rows;
      const profile = getVisionProfileForToken(options.player);
      const centerGrid = { x: options.player.x, y: options.player.y };
      const range = getVisionRangeCells(profile);
      if (range > 0) {
        const facing = getFacingForToken(options.player);
        const coneApertureDeg =
          profile.shape === "circle"
            ? 360
            : Math.max(10, Math.min(180, profile.apertureDeg ?? 90));
        const apertureRad = (coneApertureDeg * Math.PI) / 180;
        const angleCenter = directionToAngleRad(facing);
        const normalizeAngle = (a: number) => {
          let v = a;
          while (v <= -Math.PI) v += Math.PI * 2;
          while (v > Math.PI) v -= Math.PI * 2;
          return v;
        };
        const isAngleInCone = (angle: number) => {
          if (profile.shape === "circle") return true;
          const delta = normalizeAngle(angle - angleCenter);
          return Math.abs(delta) <= apertureRad / 2;
        };
        // Sweep a full circle centered on the facing to avoid wrap artifacts.
        const startAngle = angleCenter - Math.PI;
        const endAngle = angleCenter + Math.PI;
        const segments = profile.shape === "circle" ? 360 : 520;
        const step = 0.1;

        const minX = -0.5;
        const minY = -0.5;
        const maxX = cols - 0.5;
        const maxY = rows - 0.5;
        const EPS = 1e-4;

        type Segment = { ax: number; ay: number; bx: number; by: number };

        const opaque = options.obstacleVisionCells ?? null;
        const isOpaque = (x: number, y: number) =>
          Boolean(opaque && opaque.has(buildCellKey(x, y)));

        const blockerSegments: Segment[] = [];
        if (opaque && opaque.size > 0) {
          const pushEdge = (ax: number, ay: number, bx: number, by: number) => {
            blockerSegments.push({ ax, ay, bx, by });
          };
          for (const key of opaque) {
            const [xs, ys] = key.split(",");
            const x = Number(xs);
            const y = Number(ys);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            if (!isCellPlayable(x, y)) continue;
            const left = x - 0.5;
            const right = x + 0.5;
            const top = y - 0.5;
            const bottom = y + 0.5;
            if (!isOpaque(x, y - 1)) pushEdge(left, top, right, top);
            if (!isOpaque(x + 1, y)) pushEdge(right, top, right, bottom);
            if (!isOpaque(x, y + 1)) pushEdge(right, bottom, left, bottom);
            if (!isOpaque(x - 1, y)) pushEdge(left, bottom, left, top);
          }
        }

        const wallSegments: Segment[] = [];
        if (options.wallVisionEdges && options.wallVisionEdges.size > 0) {
          for (const wall of options.wallVisionEdges.values()) {
            const x = wall.x;
            const y = wall.y;
            const left = x - 0.5;
            const right = x + 0.5;
            const top = y - 0.5;
            const bottom = y + 0.5;
            switch (wall.dir) {
              case "N":
                wallSegments.push({ ax: left, ay: top, bx: right, by: top });
                break;
              case "E":
                wallSegments.push({ ax: right, ay: top, bx: right, by: bottom });
                break;
              case "S":
                wallSegments.push({ ax: left, ay: bottom, bx: right, by: bottom });
                break;
              case "W":
                wallSegments.push({ ax: left, ay: top, bx: left, by: bottom });
                break;
              default:
                break;
            }
          }
        }

        const boundarySegments: Segment[] = [
          { ax: minX, ay: minY, bx: maxX, by: minY },
          { ax: maxX, ay: minY, bx: maxX, by: maxY },
          { ax: maxX, ay: maxY, bx: minX, by: maxY },
          { ax: minX, ay: maxY, bx: minX, by: minY }
        ];

        const segmentsAll: Segment[] = [
          ...boundarySegments,
          ...blockerSegments,
          ...wallSegments
        ];

        const intersectRaySegment = (angle: number, seg: Segment): number | null => {
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          const sx = seg.bx - seg.ax;
          const sy = seg.by - seg.ay;
          const det = dx * sy - dy * sx;
          if (Math.abs(det) < 1e-8) return null;
          const ox = seg.ax - centerGrid.x;
          const oy = seg.ay - centerGrid.y;
          const t = (ox * sy - oy * sx) / det;
          const u = (ox * dy - oy * dx) / det;
          if (t < 0) return null;
          if (u < -EPS || u > 1 + EPS) return null;
          return t;
        };

        const nearestHit = (angle: number, segs: Segment[]) => {
          let best: number | null = null;
          for (const seg of segs) {
            const t = intersectRaySegment(angle, seg);
            if (t === null) continue;
            if (best === null || t < best) best = t;
          }
          return best;
        };

        const farBoundForAngle = (angle: number) =>
          Math.max(0, nearestHit(angle, boundarySegments) ?? range);

        const visibilityCapFromLevels = (_angle: number, farDist: number) =>
          Math.min(farDist, range);

        const samples: Array<{
          angle: number;
          clearDist: number;
          farDist: number;
          inCone: boolean;
        }> = [];

        const makeSample = (angle: number, forceInCone?: boolean) => {
          const farDist = Math.min(farBoundForAngle(angle), range);
          const inCone = forceInCone ?? isAngleInCone(angle);
          if (!inCone) {
            return { angle, clearDist: 0, farDist, inCone: false } as const;
          }
          const hitAll = nearestHit(angle, segmentsAll);
          const geomVisible =
            hitAll === null ? farDist : Math.max(0, Math.min(hitAll, farDist));
          const capVisible = visibilityCapFromLevels(angle, farDist);
          const clearDist = Math.max(0, Math.min(geomVisible, capVisible));
          return { angle, clearDist, farDist, inCone: true } as const;
        };

        const angles: number[] = [];
        for (let i = 0; i <= segments; i++) {
          const t = segments === 0 ? 0 : i / segments;
          angles.push(startAngle + (endAngle - startAngle) * t);
        }
        const endpointAngles: number[] = [];
        for (const seg of [...blockerSegments, ...wallSegments]) {
          const a1 = Math.atan2(seg.ay - centerGrid.y, seg.ax - centerGrid.x);
          const a2 = Math.atan2(seg.by - centerGrid.y, seg.bx - centerGrid.x);
          endpointAngles.push(a1 - EPS, a1, a1 + EPS, a2 - EPS, a2, a2 + EPS);
        }
        // Ensure cone edge rays exist to avoid fog bleeding across boundaries.
        if (profile.shape !== "circle") {
          angles.push(angleCenter - apertureRad / 2, angleCenter + apertureRad / 2);
        }
        const allAngles = [...angles, ...endpointAngles];
        allAngles.sort((a, b) => a - b);

        for (const angle of allAngles) {
          samples.push(makeSample(angle));
        }

        const toScreenAt = (angle: number, dist: number) => {
          const gx = centerGrid.x + Math.cos(angle) * dist;
          const gy = centerGrid.y + Math.sin(angle) * dist;
          return gridToScreenRaw(gx, gy);
        };

        const regions: typeof samples[] = [];
        let currentRegion: typeof samples = [];
        for (let i = 0; i < samples.length; i++) {
          const s = samples[i];
          const prev = currentRegion[currentRegion.length - 1];
          if (!prev) {
            currentRegion.push(s);
            continue;
          }
          if (prev.inCone !== s.inCone) {
            // Duplicate boundary sample into both regions with appropriate clearDist.
            const boundaryAngle = s.angle;
            currentRegion.push(makeSample(boundaryAngle, prev.inCone));
            regions.push(currentRegion);
            currentRegion = [makeSample(boundaryAngle, s.inCone)];
          }
          currentRegion.push(s);
        }
        if (currentRegion.length > 1) regions.push(currentRegion);

        const baseMin = 0.55;

        const drawRegionFog = (region: typeof samples) => {
          for (let i = 0; i < region.length - 1; i++) {
            const a = region[i];
            const b = region[i + 1];
            let startA = Math.max(0, Math.min(a.clearDist, a.farDist));
            let startB = Math.max(0, Math.min(b.clearDist, b.farDist));
            if (a.inCone && a.clearDist > 0) startA = Math.max(baseMin, startA);
            if (b.inCone && b.clearDist > 0) startB = Math.max(baseMin, startB);
            if (a.farDist - startA <= 0.01 && b.farDist - startB <= 0.01) continue;
            const p1 = toScreenAt(a.angle, startA);
            const p2 = toScreenAt(b.angle, startB);
            const q2 = toScreenAt(b.angle, b.farDist);
            const q1 = toScreenAt(a.angle, a.farDist);
            fogLayer.moveTo(p1.x, p1.y);
            fogLayer.lineTo(p2.x, p2.y);
            fogLayer.lineTo(q2.x, q2.y);
            fogLayer.lineTo(q1.x, q1.y);
            fogLayer.closePath();
            fogLayer.fill({ color: fogColor, alpha: fogAlpha });
          }
        };

        for (const region of regions) {
          drawRegionFog(region);
        }

      }
    }

    if (options.closedCells && options.closedCells.size > 0) {
      for (let y = 0; y < options.grid.rows; y++) {
        for (let x = 0; x < options.grid.cols; x++) {
          if (!isCellInView(x, y)) continue;
          if (!isCellPlayable(x, y)) continue;
          const key = buildCellKey(x, y);
          if (!options.closedCells.has(key)) continue;
          fillCell(x, y, 0x000000, 0.5);
        }
      }
    }

    for (const effect of activeEffects) {
      for (const cell of effect.cells) {
        if (!isCellInView(cell.x, cell.y)) continue;
        if (
          options.playableCells &&
          options.playableCells.size > 0 &&
          !options.playableCells.has(`${cell.x},${cell.y}`)
        ) {
          continue;
        }
        if (
          options.obstacleVisionCells &&
          options.obstacleVisionCells.size > 0 &&
          !isCellVisible(
            options.player,
            cell,
            options.obstacleVisionCells,
            options.playableCells ?? null,
            options.wallVisionEdges ?? null,
            options.lightLevels ?? null,
            options.grid
          )
        ) {
          continue;
        }

        const color =
          effect.type === "circle"
            ? 0x3498db
            : effect.type === "rectangle"
              ? 0x2ecc71
              : 0xe74c3c;

        fillCell(cell.x, cell.y, color, 0.45);
      }
    }

    if (options.showVisionDebug) {
      const parseKey = (k: string): { x: number; y: number } | null => {
        const [xs, ys] = k.split(",");
        const x = Number(xs);
        const y = Number(ys);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x, y };
      };
      const mechanicalLevelAt = (x: number, y: number): number => {
        const key = buildCellKey(x, y);
        if (options.visibilityLevels) return options.visibilityLevels.get(key) ?? 0;
        if (visionCells) return visionCells.has(key) ? 2 : 0;
        return 0;
      };

      // Debug mode: replace aesthetic fog with explicit mechanical visibility map.
      fogLayer.clear();
      for (let y = 0; y < options.grid.rows; y++) {
        for (let x = 0; x < options.grid.cols; x++) {
          if (!isCellPlayable(x, y)) continue;
          const vis = mechanicalLevelAt(x, y);
          if (vis >= 2) fillFogCell(x, y, 0x2563eb, 0.24);
        }
      }

      if (visionCells && visionCells.size > 0) {
        fogLayer.setStrokeStyle({ width: 1.5, color: 0x2dd4bf, alpha: 0.95 });
        for (const k of visionCells) {
          const cell = parseKey(k);
          if (!cell) continue;
          if (!isCellPlayable(cell.x, cell.y)) continue;
          if (gridKind === "hex") {
            const polygon = getGridCellPolygonForGrid(cell.x, cell.y, options.grid.cols, options.grid.rows);
            fogLayer.moveTo(polygon[0].x, polygon[0].y);
            for (let i = 1; i < polygon.length; i++) {
              fogLayer.lineTo(polygon[i].x, polygon[i].y);
            }
            fogLayer.closePath();
          } else {
            const center = gridToScreenForGrid(cell.x, cell.y, options.grid.cols, options.grid.rows);
            fogLayer.rect(center.x - TILE_SIZE / 2, center.y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
          }
        }
        fogLayer.stroke();
      }

      if (options.obstacleVisionCells && options.obstacleVisionCells.size > 0) {
        for (const k of options.obstacleVisionCells) {
          const cell = parseKey(k);
          if (!cell) continue;
          if (!isCellPlayable(cell.x, cell.y)) continue;
          fillFogCell(cell.x, cell.y, 0xef4444, 0.22);
        }
      }

      if (isHexGrid) {
        const fogCells: Array<{ x: number; y: number }> = [];
        for (let y = 0; y < options.grid.rows; y++) {
          for (let x = 0; x < options.grid.cols; x++) {
            if (!isCellPlayable(x, y)) continue;
            if (mechanicalLevelAt(x, y) >= 2) continue;
            fogCells.push({ x, y });
          }
        }
        if (fogCells.length > 0) {
          const fogContoursRaw = computeHexFogContoursFromCells({
            fogCells,
            grid: options.grid
          }).rawLoops;
          const fogContours = fogContoursRaw.map(loop => roundClosedLoop(loop, 1));
          if (fogContours.length > 0) {
            // FX: show raw mechanical frontier contours only.
            drawContourLoops(pathLayer, fogContours, 0xffffff, 0.95, 2.8);
          }
        }
      }

      const facing = getFacingForToken(options.player);
      const facingLine = generateLineEffect(
        "vision-facing-debug",
        options.player.x,
        options.player.y,
        2,
        facing,
        { playableCells: options.playableCells ?? null, grid: options.grid }
      );
      if (facingLine.cells.length >= 2) {
        const from = facingLine.cells[0];
        const to = facingLine.cells[facingLine.cells.length - 1];
        const p0 = gridToScreenForGrid(from.x, from.y, options.grid.cols, options.grid.rows);
        const p1 = gridToScreenForGrid(to.x, to.y, options.grid.cols, options.grid.rows);
        pathLayer.setStrokeStyle({ width: 3, color: 0xfacc15, alpha: 0.95 });
        pathLayer.moveTo(p0.x, p0.y);
        pathLayer.lineTo(p1.x, p1.y);
        pathLayer.stroke();
      }
    }

    const occupiedTokens: TokenState[] = [options.player, ...options.enemies];
    for (const token of occupiedTokens) {
      const color = token.type === "player" ? 0x2ecc71 : 0xe74c3c;
      for (const cell of getTokenOccupiedCells(token)) {
        if (!isCellInView(cell.x, cell.y)) continue;
        fillCell(cell.x, cell.y, color, 0.2);
      }
    }

    const selectedIds =
      options.selectedTargetIds && options.selectedTargetIds.length > 0
        ? options.selectedTargetIds
        : options.selectedTargetId
        ? [options.selectedTargetId]
        : [];
    if (selectedIds.length > 0) {
      for (const id of selectedIds) {
        const target = options.enemies.find(e => e.id === id) ?? null;
        if (!target) continue;
        for (const cell of getTokenOccupiedCells(target)) {
          if (!isCellInView(cell.x, cell.y)) continue;
          fillCell(cell.x, cell.y, 0x3498db, 0.6);
        }
      }
    }

    if (options.selectedObstacleCell && isCellInView(options.selectedObstacleCell.x, options.selectedObstacleCell.y)) {
      fillCell(options.selectedObstacleCell.x, options.selectedObstacleCell.y, 0x9b59b6, 0.6);
    }

    if (options.selectedPath.length > 0) {
      const last = options.selectedPath[options.selectedPath.length - 1];
      fillCell(last.x, last.y, 0xf1c40f, 0.2);
    }

    for (const enemy of options.enemies) {
      if (!enemy.plannedPath || enemy.plannedPath.length === 0) continue;
      if (!isCellInView(enemy.x, enemy.y)) continue;

      const pathNodes = enemy.plannedPath;
      const first = pathNodes[0];
      const start = gridToScreenForGrid(first.x, first.y, options.grid.cols, options.grid.rows);

      pathLayer.setStrokeStyle({
        width: 3,
        color: 0xe74c3c,
        alpha: 0.9
      });

      pathLayer.moveTo(start.x, start.y);
      for (const node of pathNodes.slice(1)) {
        const p = gridToScreenForGrid(node.x, node.y, options.grid.cols, options.grid.rows);
        pathLayer.lineTo(p.x, p.y);
      }
      pathLayer.stroke();
    }

    if (options.showGridLines) {
      const cols = options.grid.cols;
      const rows = options.grid.rows;
      pathLayer.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.25 });
      if (gridKind === "hex") {
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const polygon = getGridCellPolygonForGrid(x, y, cols, rows);
            pathLayer.moveTo(polygon[0].x, polygon[0].y);
            for (let i = 1; i < polygon.length; i++) {
              pathLayer.lineTo(polygon[i].x, polygon[i].y);
            }
            pathLayer.closePath();
          }
        }
      } else {
        for (let x = 0; x <= cols; x++) {
          const px = x * TILE_SIZE;
          pathLayer.moveTo(px, 0);
          pathLayer.lineTo(px, rows * TILE_SIZE);
        }
        for (let y = 0; y <= rows; y++) {
          const py = y * TILE_SIZE;
          pathLayer.moveTo(0, py);
          pathLayer.lineTo(cols * TILE_SIZE, py);
        }
      }
      pathLayer.stroke();
    }

    if (options.selectedPath.length === 0) return;

    pathLayer.setStrokeStyle({
      width: 6,
      color: 0xf1c40f,
      alpha: 1
    });

    const start = gridToScreenForGrid(options.player.x, options.player.y, options.grid.cols, options.grid.rows);
    pathLayer.moveTo(start.x, start.y);

    for (const node of options.selectedPath) {
      const p = gridToScreenForGrid(node.x, node.y, options.grid.cols, options.grid.rows);
      pathLayer.lineTo(p.x, p.y);
    }

    pathLayer.stroke();
  }, [
    options.pathLayerRef,
    options.gridKind,
    options.player,
    options.enemies,
    options.selectedPath,
    options.effectSpecs,
    options.selectedTargetId,
    options.selectedTargetIds,
    options.selectedObstacleCell,
    options.showVisionDebug,
    options.showLightOverlay,
    options.showGridLines,
    options.lightMap,
    options.lightSources,
    options.playerTorchOn,
    options.playerTorchRadius,
    options.lightLevels,
    options.lightTints,
    options.isNight,
    options.pixiReadyTick,
    options.playableCells,
    options.grid,
    options.heightMap,
    options.activeLevel,
    options.visibleCells,
    options.visionCells,
    options.visibilityLevels,
    options.showAllLevels,
    options.obstacleVisionCells,
    options.closedCells,
    options.wallVisionEdges
  ]);
}


