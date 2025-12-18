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
import { TILE_SIZE, gridToScreen } from "../boardConfig";
import { computeVisionEffectForToken } from "../vision";

export function usePixiOverlays(options: {
  pathLayerRef: RefObject<Graphics | null>;
  player: TokenState;
  enemies: TokenState[];
  selectedPath: { x: number; y: number }[];
  effectSpecs: EffectSpec[];
  selectedTargetId: string | null;
  showVisionDebug: boolean;
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
            spec.radius ?? 1
          );
        case "rectangle":
          return generateRectangleEffect(
            spec.id,
            options.player.x,
            options.player.y,
            spec.width ?? 1,
            spec.height ?? 1
          );
        case "cone":
          return generateConeEffect(
            spec.id,
            options.player.x,
            options.player.y,
            spec.range ?? 1,
            spec.direction ?? "right"
          );
        default:
          return { id: spec.id, type: "circle", cells: [] };
      }
    });

    for (const effect of activeEffects) {
      for (const cell of effect.cells) {
        const center = gridToScreen(cell.x, cell.y);
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
      const allTokens: TokenState[] = [options.player, ...options.enemies];
      for (const token of allTokens) {
        const visionEffect = computeVisionEffectForToken(token);
        for (const cell of visionEffect.cells) {
          const center = gridToScreen(cell.x, cell.y);
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
      const center = gridToScreen(token.x, token.y);
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
        const center = gridToScreen(target.x, target.y);
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

    if (options.selectedPath.length > 0) {
      const last = options.selectedPath[options.selectedPath.length - 1];
      const center = gridToScreen(last.x, last.y);
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

      const pathNodes = enemy.plannedPath;
      const first = pathNodes[0];
      const start = gridToScreen(first.x, first.y);

      pathLayer.setStrokeStyle({
        width: 3,
        color: 0xe74c3c,
        alpha: 0.9
      });

      pathLayer.moveTo(start.x, start.y);
      for (const node of pathNodes.slice(1)) {
        const p = gridToScreen(node.x, node.y);
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

    const start = gridToScreen(options.player.x, options.player.y);
    pathLayer.moveTo(start.x, start.y);

    for (const node of options.selectedPath) {
      const p = gridToScreen(node.x, node.y);
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
    options.showVisionDebug
  ]);
}

