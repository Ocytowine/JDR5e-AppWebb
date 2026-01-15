import { useEffect } from "react";
import { Text } from "pixi.js";
import type { Container } from "pixi.js";
import type { RefObject } from "react";
import { LEVEL_HEIGHT_PX, TILE_SIZE, gridToScreenForGrid } from "../boardConfig";
import { getHeightAtGrid } from "../game/map/draft";

export function usePixiGridLabels(options: {
  labelLayerRef: RefObject<Container | null>;
  showLabels: boolean;
  playableCells?: Set<string> | null;
  grid: { cols: number; rows: number };
  heightMap: number[];
  activeLevel: number;
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

    const fontSize = Math.max(9, Math.round(TILE_SIZE * 0.16));
    const { cols, rows } = options.grid;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const height = getHeightAtGrid(options.heightMap, cols, rows, x, y);
        if (height !== options.activeLevel) continue;
        if (
          options.playableCells &&
          options.playableCells.size > 0 &&
          !options.playableCells.has(`${x},${y}`)
        ) {
          continue;
        }

        const center = gridToScreenForGrid(x, y, cols, rows);
        const label = new Text(`${x},${y}`, {
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
        label.y = center.y - height * LEVEL_HEIGHT_PX;

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
    options.pixiReadyTick
  ]);
}
