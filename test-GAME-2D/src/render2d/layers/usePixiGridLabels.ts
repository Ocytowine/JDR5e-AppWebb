import { useEffect } from "react";
import { Text } from "pixi.js";
import type { Container } from "pixi.js";
import type { RefObject } from "react";
import { TILE_SIZE, gridToScreenForGrid } from "../../boardConfig";
import type { ObstacleInstance, ObstacleTypeDefinition } from "../../game/obstacleTypes";
import { getObstacleOccupiedCells } from "../../game/obstacleRuntime";

export function usePixiGridLabels(options: {
  labelLayerRef: RefObject<Container | null>;
  showLabels: boolean;
  playableCells?: Set<string> | null;
  grid: { cols: number; rows: number };
  heightMap: number[];
  activeLevel: number;
  obstacles?: ObstacleInstance[] | null;
  obstacleTypes?: ObstacleTypeDefinition[] | null;
  pixiReadyTick?: number;
}): void {
  useEffect(() => {
    const labelLayer = options.labelLayerRef.current;
    if (!labelLayer) return;

    const removed = labelLayer.removeChildren();
    for (const child of removed) {
      child.destroy();
    }

    if (!options.showLabels) return;

    const fontSize = Math.max(9, Math.round(TILE_SIZE * 0.18));
    const { cols, rows } = options.grid;
    const obstacles = Array.isArray(options.obstacles) ? options.obstacles : [];
    const obstacleTypes = Array.isArray(options.obstacleTypes) ? options.obstacleTypes : [];
    const obstacleById = new Map<string, ObstacleTypeDefinition>();
    for (const t of obstacleTypes) obstacleById.set(t.id, t);
    const obstacleLabels = new Map<string, string[]>();
    for (const obs of obstacles) {
      if (obs.hp <= 0) continue;
      const def = obstacleById.get(obs.typeId);
      const cells = getObstacleOccupiedCells(obs, def);
      for (const cell of cells) {
        const key = `${cell.x},${cell.y}`;
        const list = obstacleLabels.get(key);
        if (list) {
          list.push(obs.id);
        } else {
          obstacleLabels.set(key, [obs.id]);
        }
      }
    }

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (
          options.playableCells &&
          options.playableCells.size > 0 &&
          !options.playableCells.has(`${x},${y}`)
        ) {
          continue;
        }

        const center = gridToScreenForGrid(x, y, cols, rows);
        const obstacleIds = obstacleLabels.get(`${x},${y}`);
        const labelText = obstacleIds
          ? `${x},${y}\nobs:${obstacleIds.join(",")}`
          : `${x},${y}`;
        const label = new Text(labelText, {
          fontFamily: "Arial",
          fontSize,
          fill: 0xffffff,
          stroke: 0x000000,
          strokeThickness: 3,
          align: "center"
        });
        label.anchor.set(0.5, 0.5);
        label.alpha = 0.9;
        label.x = center.x;
        label.y = center.y;

        labelLayer.addChild(label);
      }
    }
  }, [
    options.labelLayerRef,
    options.showLabels,
    options.playableCells,
    options.grid,
    options.heightMap,
    options.activeLevel,
    options.obstacles,
    options.obstacleTypes,
    options.pixiReadyTick
  ]);
}
