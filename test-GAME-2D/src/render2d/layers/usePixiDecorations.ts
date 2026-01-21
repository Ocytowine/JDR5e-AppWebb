import { useEffect } from "react";
import { Container, Graphics } from "pixi.js";
import type { RefObject } from "react";
import type { DecorInstance } from "../../game/decorTypes";
import { TILE_SIZE, gridToScreenForGrid } from "../../boardConfig";
import { DEPTH_Z } from "./depthOrdering";

export function usePixiDecorations(options: {
  depthLayerRef: RefObject<Container | null>;
  decorations: DecorInstance[];
  pixiReadyTick?: number;
  grid: { cols: number; rows: number };
  heightMap: number[];
  activeLevel: number;
  visibleCells?: Set<string> | null;
  showAllLevels?: boolean;
}): void {
  useEffect(() => {
    const depthLayer = options.depthLayerRef.current;
    if (!depthLayer) return;

    for (const child of [...depthLayer.children]) {
      if (child.label === "decor") {
        depthLayer.removeChild(child);
        child.destroy?.();
      }
    }

    const visibleCells = options.visibleCells ?? null;
    const showAll = Boolean(options.showAllLevels);
    const cellKey = (x: number, y: number) => `${x},${y}`;

    for (const decor of options.decorations) {
      const key = cellKey(decor.x, decor.y);
      const isVisible = showAll || (visibleCells?.has(key) ?? true);
      if (!isVisible) continue;

      const center = gridToScreenForGrid(decor.x, decor.y, options.grid.cols, options.grid.rows);
      const size = TILE_SIZE * 0.5;
      const x = center.x - size / 2;
      const y = center.y - size / 2;

      const color = decor.layer === "wall" ? 0xb08a5a : 0x6b8f3a;
      const g = new Graphics();
      g.rect(x, y, size, size).fill({
        color,
        alpha: 0.75
      });

      g.label = "decor";
      g.zIndex = center.y + DEPTH_Z.decor;
      depthLayer.addChild(g);
    }
  }, [
    options.depthLayerRef,
    options.decorations,
    options.pixiReadyTick,
    options.grid,
    options.heightMap,
    options.activeLevel,
    options.visibleCells,
    options.showAllLevels
  ]);
}
