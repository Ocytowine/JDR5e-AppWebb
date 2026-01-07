import { useEffect } from "react";
import type { RefObject } from "react";
import type { Graphics } from "pixi.js";
import type { TokenState } from "../types";
import type { EffectSpec } from "../game/turnTypes";
import type { BoardEffect } from "../boardEffects";
import {
  generateCircleEffect,
  generateConeEffect,
  generateRectangleEffect
} from "../boardEffects";
import { LEVEL_HEIGHT_PX, TILE_SIZE, gridToScreenForGrid } from "../boardConfig";
import { getHeightAtGrid } from "../game/map/draft";
import { computeVisionEffectForToken, isCellVisible } from "../vision";

export function usePixiOverlays(options: {
  pathLayerRef: RefObject<Graphics | null>;
  player: TokenState;
  enemies: TokenState[];
  selectedPath: { x: number; y: number }[];
  effectSpecs: EffectSpec[];
  selectedTargetId: string | null;
  selectedObstacleCell: { x: number; y: number } | null;
  obstacleVisionCells?: Set<string> | null;
  showVisionDebug: boolean;
  pixiReadyTick?: number;
  playableCells?: Set<string> | null;
  grid: { cols: number; rows: number };
  heightMap: number[];
  activeLevel: number;
}): void {
  useEffect(() => {
    const pathLayer = options.pathLayerRef.current;
    if (!pathLayer) return;

    pathLayer.clear();

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

    const cellCenter = (x: number, y: number) => {
      const center = gridToScreenForGrid(x, y, options.grid.cols, options.grid.rows);
      const height = getHeightAtGrid(options.heightMap, options.grid.cols, options.grid.rows, x, y);
      const offset = height * LEVEL_HEIGHT_PX;
      return { x: center.x, y: center.y - offset, height };
    };

    for (let y = 0; y < options.grid.rows; y++) {
      for (let x = 0; x < options.grid.cols; x++) {
        const height = getHeightAtGrid(
          options.heightMap,
          options.grid.cols,
          options.grid.rows,
          x,
          y
        );
        if (height <= 0 || height !== options.activeLevel) continue;
        if (
          options.playableCells &&
          options.playableCells.size > 0 &&
          !options.playableCells.has(`${x},${y}`)
        ) {
          continue;
        }
        const center = cellCenter(x, y);
        const w = TILE_SIZE;
        const h = TILE_SIZE * 0.5;
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
        pathLayer.poly(points).fill({
          color: 0xc2a15a,
          alpha: 0.18
        });
      }
    }

    for (const effect of activeEffects) {
      for (const cell of effect.cells) {
        const height = getHeightAtGrid(
          options.heightMap,
          options.grid.cols,
          options.grid.rows,
          cell.x,
          cell.y
        );
        if (height !== options.activeLevel) continue;
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
            options.playableCells ?? null
          )
        ) {
          continue;
        }
        const center = cellCenter(cell.x, cell.y);
        const w = TILE_SIZE;
        const h = TILE_SIZE * 0.5;

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

        const color =
          effect.type === "circle"
            ? 0x3498db
            : effect.type === "rectangle"
              ? 0x2ecc71
              : 0xe74c3c;

        pathLayer.poly(points).fill({
          color,
          alpha: 0.45
        });
      }
    }

    if (options.showVisionDebug) {
      const allTokens: TokenState[] = [options.player, ...options.enemies].filter(t => {
        const height = getHeightAtGrid(
          options.heightMap,
          options.grid.cols,
          options.grid.rows,
          t.x,
          t.y
        );
        return height === options.activeLevel;
      });
      for (const token of allTokens) {
        const visionEffect = computeVisionEffectForToken(token, options.playableCells ?? null);
        for (const cell of visionEffect.cells) {
          const height = getHeightAtGrid(
            options.heightMap,
            options.grid.cols,
            options.grid.rows,
            cell.x,
            cell.y
          );
          if (height !== options.activeLevel) continue;
          if (
            options.playableCells &&
            options.playableCells.size > 0 &&
            !options.playableCells.has(`${cell.x},${cell.y}`)
          ) {
            continue;
          }
          const center = cellCenter(cell.x, cell.y);
          const w = TILE_SIZE;
          const h = TILE_SIZE * 0.5;

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

          const color = token.type === "player" ? 0x2980b9 : 0xc0392b;

          pathLayer.poly(points).fill({
            color,
            alpha: token.type === "player" ? 0.25 : 0.2
          });
        }
      }
    }

    const occupiedTokens: TokenState[] = [options.player, ...options.enemies];
    for (const token of occupiedTokens) {
      const height = getHeightAtGrid(
        options.heightMap,
        options.grid.cols,
        options.grid.rows,
        token.x,
        token.y
      );
      if (height !== options.activeLevel) continue;
      const center = cellCenter(token.x, token.y);
      const w = TILE_SIZE;
      const h = TILE_SIZE * 0.5;

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

      const color = token.type === "player" ? 0x2ecc71 : 0xe74c3c;

      pathLayer.poly(points).fill({
        color,
        alpha: 0.2
      });
    }

    if (options.selectedTargetId) {
      const target = options.enemies.find(e => e.id === options.selectedTargetId);
      if (target) {
        const height = getHeightAtGrid(
          options.heightMap,
          options.grid.cols,
          options.grid.rows,
          target.x,
          target.y
        );
        if (height === options.activeLevel) {
          const center = cellCenter(target.x, target.y);
          const w = TILE_SIZE;
          const h = TILE_SIZE * 0.5;

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

          pathLayer.poly(points).fill({
            color: 0x3498db,
            alpha: 0.6
          });
        }
      }
    }

    if (options.selectedObstacleCell) {
      const height = getHeightAtGrid(
        options.heightMap,
        options.grid.cols,
        options.grid.rows,
        options.selectedObstacleCell.x,
        options.selectedObstacleCell.y
      );
      if (height === options.activeLevel) {
        const center = cellCenter(
          options.selectedObstacleCell.x,
          options.selectedObstacleCell.y
        );
        const w = TILE_SIZE;
        const h = TILE_SIZE * 0.5;

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

        pathLayer.poly(points).fill({
          color: 0x9b59b6,
          alpha: 0.6
        });
      }
    }

    if (options.selectedPath.length > 0) {
      const last = options.selectedPath[options.selectedPath.length - 1];
      const center = cellCenter(last.x, last.y);
      const w = TILE_SIZE;
      const h = TILE_SIZE * 0.5;

      const auraPoints = [
        center.x,
        center.y - h / 2,
        center.x + w / 2,
        center.y,
        center.x,
        center.y + h / 2,
        center.x - w / 2,
        center.y
      ];

      pathLayer.poly(auraPoints).fill({
        color: 0xf1c40f,
        alpha: 0.2
      });
    }

    for (const enemy of options.enemies) {
      if (!enemy.plannedPath || enemy.plannedPath.length === 0) continue;
      const height = getHeightAtGrid(
        options.heightMap,
        options.grid.cols,
        options.grid.rows,
        enemy.x,
        enemy.y
      );
      if (height !== options.activeLevel) continue;

      const pathNodes = enemy.plannedPath;
      const first = pathNodes[0];
      const start = cellCenter(first.x, first.y);

      pathLayer.setStrokeStyle({
        width: 3,
        color: 0xe74c3c,
        alpha: 0.9
      });

      pathLayer.moveTo(start.x, start.y);
      for (const node of pathNodes.slice(1)) {
        const p = cellCenter(node.x, node.y);
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

    const start = cellCenter(options.player.x, options.player.y);
    pathLayer.moveTo(start.x, start.y);

    for (const node of options.selectedPath) {
      const p = cellCenter(node.x, node.y);
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
    options.showVisionDebug,
    options.pixiReadyTick,
    options.playableCells,
    options.grid,
    options.heightMap,
    options.activeLevel
  ]);
}

