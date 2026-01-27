import { useEffect } from "react";
import type { RefObject } from "react";
import { BlurFilter, Graphics } from "pixi.js";
import type { TokenState } from "../../types";
import type { EffectSpec } from "../../game/turnTypes";
import type { BoardEffect } from "../../boardEffects";
import {
  generateCircleEffect,
  generateConeEffect,
  generateRectangleEffect
} from "../../boardEffects";
import { TILE_SIZE, gridToScreenForGrid } from "../../boardConfig";
import {
  computeVisionEffectForToken,
  getFacingForToken,
  getVisionProfileForToken,
  isCellVisible
} from "../../vision";
import { hasLineOfSight } from "../../lineOfSight";
import type { WallSegment } from "../../game/map/walls/types";
import { getTokenOccupiedCells } from "../../game/footprint";
import type { LightSource } from "../../lighting";

export function usePixiOverlays(options: {
  pathLayerRef: RefObject<Graphics | null>;
  player: TokenState;
  enemies: TokenState[];
  selectedPath: { x: number; y: number }[];
  effectSpecs: EffectSpec[];
  selectedTargetId: string | null;
  selectedObstacleCell: { x: number; y: number } | null;
  obstacleVisionCells?: Set<string> | null;
  wallVisionEdges?: Map<string, WallSegment> | null;
  closedCells?: Set<string> | null;
  showVisionDebug: boolean;
  showFogSegments?: boolean;
  lightMap?: number[] | null;
  lightSources?: LightSource[] | null;
  showLightOverlay: boolean;
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

    pathLayer.clear();
    fogLayer.clear();

    const activeEffects: BoardEffect[] = options.effectSpecs.map(spec => {
      switch (spec.kind) {
        case "circle":
          return generateCircleEffect(
            spec.id,
            options.player.x,
            options.player.y,
            spec.radius ?? 1,
            { playableCells: options.playableCells ?? null }
          );
        case "rectangle":
          return generateRectangleEffect(
            spec.id,
            options.player.x,
            options.player.y,
            spec.width ?? 1,
            spec.height ?? 1,
            { playableCells: options.playableCells ?? null }
          );
        case "cone":
          return generateConeEffect(
            spec.id,
            options.player.x,
            options.player.y,
            spec.range ?? 1,
            spec.direction ?? "right",
            undefined,
            { playableCells: options.playableCells ?? null }
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

    const cellRect = (x: number, y: number) => {
      const center = gridToScreenForGrid(x, y, options.grid.cols, options.grid.rows);
      return {
        x: center.x - TILE_SIZE / 2,
        y: center.y - TILE_SIZE / 2,
        size: TILE_SIZE
      };
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
    if (Array.isArray(options.lightSources)) {
      activeSources.push(...options.lightSources);
    }
    if (options.playerTorchOn) {
      activeSources.push({
        x: options.player.x,
        y: options.player.y,
        radius: Math.max(1, Math.floor(options.playerTorchRadius ?? 4))
      });
    }

    if (options.showLightOverlay) {
      const blocked = options.obstacleVisionCells ?? null;
      for (let y = 0; y < options.grid.rows; y++) {
        for (let x = 0; x < options.grid.cols; x++) {
          if (!isCellInView(x, y)) continue;
          if (!isCellPlayable(x, y)) continue;

          let light = baseLightAt(x, y);
          if (Array.isArray(options.lightLevels) && options.lightLevels.length > 0) {
            const idx = y * options.grid.cols + x;
            const value = options.lightLevels[idx];
            light = Number.isFinite(value) ? clamp01(value) : light;
          } else {
            for (const source of activeSources) {
              const dx = x - source.x;
              const dy = y - source.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > source.radius) continue;
              if (blocked && blocked.size > 0) {
                const hasLos = hasLineOfSight(
                  { x: source.x, y: source.y },
                  { x, y },
                  blocked,
                  options.wallVisionEdges ?? null
                );
                if (!hasLos) continue;
              }
              light = Math.max(light, 1);
            }
          }

          const darkness = clamp01(1 - light) * 0.75;
          if (darkness <= 0.01) continue;
          const rect = cellRect(x, y);
          pathLayer.rect(rect.x, rect.y, rect.size, rect.size).fill({
            color: 0x000000,
            alpha: darkness
          });
        }
      }
    }

    if (options.lightTints && isNight) {
      const colors = options.lightTints.colors;
      const strength = options.lightTints.strength;
      for (let y = 0; y < options.grid.rows; y++) {
        for (let x = 0; x < options.grid.cols; x++) {
          if (!isCellInView(x, y)) continue;
          if (!isCellPlayable(x, y)) continue;
          const key = buildCellKey(x, y);
          if (visibleCells && visibleCells.size > 0 && !visibleCells.has(key)) continue;
          const idx = y * options.grid.cols + x;
          const alpha = clamp01(strength[idx] ?? 0) * 0.35;
          if (alpha <= 0.01) continue;
          const rect = cellRect(x, y);
          pathLayer.rect(rect.x, rect.y, rect.size, rect.size).fill({
            color: colors[idx] ?? 0xffffff,
            alpha
          });
        }
      }
    }

    const fogColor = isNight ? 0x000000 : 0xffffff;
    const fogAlpha = isNight ? 0 : 0.35;
    const hasVisibilityMask = Boolean(visionCells || visibleCells || options.visibilityLevels);

    const visibilityLevelAt = (x: number, y: number) => {
      if (!options.visibilityLevels) return 0;
      return options.visibilityLevels.get(buildCellKey(x, y)) ?? 0;
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

    const gridToScreenRaw = (x: number, y: number) => ({
      x: x * TILE_SIZE + TILE_SIZE / 2,
      y: y * TILE_SIZE + TILE_SIZE / 2
    });

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

    if (hasVisibilityMask && fogAlpha > 0) {
      const cols = options.grid.cols;
      const rows = options.grid.rows;
      const profile = getVisionProfileForToken(options.player);
      const centerGrid = { x: options.player.x, y: options.player.y };
      const centerScreen = gridToScreenRaw(centerGrid.x, centerGrid.y);
      const range = Math.max(0, profile.range ?? 0);
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

        if (options.showFogSegments) {
          pathLayer.setStrokeStyle({ width: 2, color: 0xffffff, alpha: 0.85 });
          const coneRegion = regions.find(r => r.some(s => s.inCone)) ?? samples;
          const coneSamples = coneRegion.filter(s => s.inCone && s.clearDist > 0);
          if (coneSamples.length > 0) {
            pathLayer.moveTo(centerScreen.x, centerScreen.y);
            for (const s of coneSamples) {
              const dist = Math.max(baseMin, s.clearDist);
              const p = toScreenAt(s.angle, dist);
              pathLayer.lineTo(p.x, p.y);
            }
            pathLayer.closePath();
            pathLayer.stroke();
          }
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
          const rect = cellRect(x, y);
          pathLayer.rect(rect.x, rect.y, rect.size, rect.size).fill({
            color: 0x000000,
            alpha: 0.5
          });
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

        const rect = cellRect(cell.x, cell.y);
        const color =
          effect.type === "circle"
            ? 0x3498db
            : effect.type === "rectangle"
              ? 0x2ecc71
              : 0xe74c3c;

        pathLayer.rect(rect.x, rect.y, rect.size, rect.size).fill({
          color,
          alpha: 0.45
        });
      }
    }

    if (options.showVisionDebug) {
      const allTokens: TokenState[] = [options.player, ...options.enemies];
      for (const token of allTokens) {
          const visionEffect = computeVisionEffectForToken(token, options.playableCells ?? null);
          for (const cell of visionEffect.cells) {
          if (!isCellInView(cell.x, cell.y)) continue;
          if (
            options.playableCells &&
            options.playableCells.size > 0 &&
            !options.playableCells.has(`${cell.x},${cell.y}`)
          ) {
            continue;
          }
          if (
            !isCellVisible(
              token,
              cell,
              options.obstacleVisionCells ?? null,
              options.playableCells ?? null,
              options.wallVisionEdges ?? null,
              options.lightLevels ?? null,
              options.grid
            )
          ) {
            continue;
          }
          const rect = cellRect(cell.x, cell.y);
          const color = token.type === "player" ? 0x2980b9 : 0xc0392b;

          pathLayer.rect(rect.x, rect.y, rect.size, rect.size).fill({
            color,
            alpha: token.type === "player" ? 0.25 : 0.2
          });
        }
      }
    }

    const occupiedTokens: TokenState[] = [options.player, ...options.enemies];
    for (const token of occupiedTokens) {
      const color = token.type === "player" ? 0x2ecc71 : 0xe74c3c;
      for (const cell of getTokenOccupiedCells(token)) {
        if (!isCellInView(cell.x, cell.y)) continue;
        const rect = cellRect(cell.x, cell.y);
        pathLayer.rect(rect.x, rect.y, rect.size, rect.size).fill({
          color,
          alpha: 0.2
        });
      }
    }

    if (options.selectedTargetId) {
      const target = options.enemies.find(e => e.id === options.selectedTargetId);
      if (target) {
        for (const cell of getTokenOccupiedCells(target)) {
          if (!isCellInView(cell.x, cell.y)) continue;
          const rect = cellRect(cell.x, cell.y);
          pathLayer.rect(rect.x, rect.y, rect.size, rect.size).fill({
            color: 0x3498db,
            alpha: 0.6
          });
        }
      }
    }

    if (options.selectedObstacleCell && isCellInView(options.selectedObstacleCell.x, options.selectedObstacleCell.y)) {
      const rect = cellRect(options.selectedObstacleCell.x, options.selectedObstacleCell.y);
      pathLayer.rect(rect.x, rect.y, rect.size, rect.size).fill({
        color: 0x9b59b6,
        alpha: 0.6
      });
    }

    if (options.selectedPath.length > 0) {
      const last = options.selectedPath[options.selectedPath.length - 1];
      const rect = cellRect(last.x, last.y);
      pathLayer.rect(rect.x, rect.y, rect.size, rect.size).fill({
        color: 0xf1c40f,
        alpha: 0.2
      });
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
    options.player,
    options.enemies,
    options.selectedPath,
    options.effectSpecs,
    options.selectedTargetId,
    options.selectedObstacleCell,
    options.showVisionDebug,
    options.showFogSegments,
    options.showLightOverlay,
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
