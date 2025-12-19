import { useEffect } from "react";
import { Container, Graphics } from "pixi.js";
import type { RefObject } from "react";
import type { ObstacleInstance, ObstacleTypeDefinition } from "../game/obstacleTypes";
import { getObstacleOccupiedCells } from "../game/obstacleRuntime";
import { TILE_SIZE, gridToScreenForGrid } from "../boardConfig";

function colorForObstacle(def: ObstacleTypeDefinition | null): number {
  const category = String(def?.category ?? "").toLowerCase();
  if (category === "wall") return 0x95a5a6;
  if (category === "vegetation") return 0x2ecc71;
  if (category === "structure") return 0xbdc3c7;
  return 0xe67e22; // prop / default
}

export function usePixiObstacles(options: {
  obstacleLayerRef: RefObject<Container | null>;
  obstacleTypes: ObstacleTypeDefinition[];
  obstacles: ObstacleInstance[];
  pixiReadyTick?: number;
  grid: { cols: number; rows: number };
}): void {
  useEffect(() => {
    const obstacleLayer = options.obstacleLayerRef.current;
    if (!obstacleLayer) return;

    obstacleLayer.removeChildren();

    const typeById = new Map<string, ObstacleTypeDefinition>();
    for (const t of options.obstacleTypes) typeById.set(t.id, t);

    for (const obs of options.obstacles) {
      const def = typeById.get(obs.typeId) ?? null;

      const g = new Graphics();

      const occupiedCells = def ? getObstacleOccupiedCells(obs, def) : [{ x: obs.x, y: obs.y }];
      const w = TILE_SIZE;
      const h = TILE_SIZE * 0.5;
      const color = colorForObstacle(def);

      for (const cell of occupiedCells) {
        const center = gridToScreenForGrid(cell.x, cell.y, options.grid.cols, options.grid.rows);
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

      // Simple HP bar (for destructible obstacles).
      const hpRatio =
        obs.maxHp > 0 ? Math.max(0, Math.min(1, obs.hp / obs.maxHp)) : 1;
      const barWidth = Math.max(10, w * 0.42);
      const barHeight = 4;
      const center = gridToScreenForGrid(obs.x, obs.y, options.grid.cols, options.grid.rows);
      const barX = center.x - barWidth / 2;
      const barY = center.y - h * 0.9;

      g.rect(barX, barY, barWidth, barHeight).fill({
        color: 0x000000,
        alpha: 0.55
      });
      g.rect(barX, barY, barWidth * hpRatio, barHeight).fill({
        color: hpRatio > 0.5 ? 0x2ecc71 : hpRatio > 0.25 ? 0xf1c40f : 0xe74c3c,
        alpha: 0.85
      });

      obstacleLayer.addChild(g);
    }
  }, [
    options.obstacleLayerRef,
    options.obstacleTypes,
    options.obstacles,
    options.pixiReadyTick,
    options.grid
  ]);
}

