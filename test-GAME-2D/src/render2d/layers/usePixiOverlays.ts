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
import { computeVisionEffectForToken, isCellVisible } from "../../vision";
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
      layer.filters = [new BlurFilter({ strength: 2, quality: 2 })];
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

    if (visionCells || visibleCells) {
      const fogColor = isNight ? 0x000000 : 0xffffff;
      for (let y = 0; y < options.grid.rows; y++) {
        for (let x = 0; x < options.grid.cols; x++) {
          if (!isCellPlayable(x, y)) continue;
          const key = buildCellKey(x, y);
          const inVision = visionCells ? visionCells.has(key) : true;
          const perceivable = visibleCells ? visibleCells.has(key) : true;
          if (inVision && perceivable) continue;

          const rect = cellRect(x, y);
          const alpha = inVision ? 0.65 : isNight ? 0.65 : 0.45;
          const color = inVision ? 0x000000 : fogColor;
          fogLayer.rect(rect.x, rect.y, rect.size, rect.size).fill({
            color,
            alpha
          });
        }
      }
    } else if (options.visibilityLevels) {
      for (let y = 0; y < options.grid.rows; y++) {
        for (let x = 0; x < options.grid.cols; x++) {
          if (!isCellInView(x, y)) continue;
          if (!isCellPlayable(x, y)) continue;
          const key = buildCellKey(x, y);
          const visibility = options.visibilityLevels.get(key) ?? 0;
          if (visibility >= 2) continue;

          const rect = cellRect(x, y);
          const alpha = visibility === 1 ? 0.35 : 0.6;
          fogLayer.rect(rect.x, rect.y, rect.size, rect.size).fill({
            color: 0x000000,
            alpha
          });
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
